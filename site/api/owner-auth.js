import { createClient } from "@libsql/client";
import { clearOwnerCookie, createOwnerSession, generateOwnerPasswordHash, ownerAuthConfigured, ownerConfig, ownerSessionCookie, sameOriginRequest, verifyOwnerCredentials, verifyOwnerPassword, verifyOwnerSession } from "./_owner-auth.js";
import { ensureMonitoringTables, recordOwnerAudit } from "./_monitoring.js";

function database() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return url && authToken ? createClient({ url, authToken }) : null;
}

const attempts = new Map();

function rateLimited(req) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > 15 * 60 * 1000) {
    attempts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

async function getStoredOwnerPasswordHash(db) {
  if (!db) return null;
  try {
    const res = await db.execute("SELECT password_hash FROM owner_credentials WHERE id = 'owner' LIMIT 1");
    return res.rows[0]?.password_hash ? String(res.rows[0].password_hash) : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!ownerAuthConfigured()) return res.status(503).json({ error: "Owner access is not configured." });

  const db = database();
  if (db) {
    try { await ensureMonitoringTables(db); } catch (e) { console.error("ensureMonitoringTables failed", e); }
  }

  // GET: Session verification
  if (req.method === "GET") {
    const owner = verifyOwnerSession(req);
    return owner ? res.status(200).json({ authenticated: true, owner: { email: owner.email } }) : res.status(401).json({ authenticated: false });
  }

  // DELETE: Sign out
  if (req.method === "DELETE") {
    if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
    res.setHeader("Set-Cookie", clearOwnerCookie());
    return res.status(200).json({ ok: true });
  }

  // PUT: Password Change
  if (req.method === "PUT") {
    if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
    const owner = verifyOwnerSession(req);
    if (!owner) return res.status(401).json({ error: "Owner authentication required." });

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!currentPassword) return res.status(400).json({ error: "Current password is required." });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters long." });

    const config = ownerConfig();
    const dbHash = await getStoredOwnerPasswordHash(db);
    const activeHash = dbHash || config.passwordHash;

    if (!verifyOwnerPassword(currentPassword, activeHash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    try {
      const newHash = generateOwnerPasswordHash(newPassword);
      const now = new Date().toISOString();

      if (db) {
        await db.execute({
          sql: `CREATE TABLE IF NOT EXISTS owner_credentials (
            id TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )`
        });
        await db.execute({
          sql: `INSERT INTO owner_credentials (id, password_hash, updated_at) VALUES ('owner', ?, ?)
                ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash, updated_at=excluded.updated_at`,
          args: [newHash, now]
        });
        await recordOwnerAudit(db, { actor: owner.email, action: "owner_password_changed", targetUserId: "owner", detail: { timestamp: now } });
      }

      return res.status(200).json({
        ok: true,
        message: "Password changed successfully!",
        passwordHash: newHash
      });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ error: err.message || "Failed to change password." });
    }
  }

  // POST: Sign in
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
  if (rateLimited(req)) return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });

  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const config = ownerConfig();
  const dbHash = await getStoredOwnerPasswordHash(db);
  const activeHash = dbHash || config.passwordHash;

  if (!verifyOwnerCredentials(email, password, activeHash)) {
    return res.status(401).json({ error: "Invalid owner credentials." });
  }

  const token = createOwnerSession(email);
  res.setHeader("Set-Cookie", ownerSessionCookie(token));
  return res.status(200).json({ ok: true });
}
