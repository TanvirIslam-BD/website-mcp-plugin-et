import { database } from "./_db.js";
import {
  clearOwnerCookie,
  createOwnerSession,
  generateOwnerPasswordHash,
  ownerAuthConfigured,
  ownerConfig,
  ownerSessionCookie,
  readSessionEpoch,
  sameOriginRequest,
  verifyActiveOwnerSession,
  verifyOwnerCredentials,
  verifyOwnerPassword,
} from "./_owner-auth.js";
import { ensureMonitoringTables, recordOwnerAudit } from "./_monitoring.js";
import { clientAddress, consumeRateLimit } from "./_rate-limit.js";

// Brute-force protection fails closed: if the counter cannot be read, sign-in is
// refused rather than left unlimited. One owner losing console access for a few
// minutes beats an unthrottled password-guessing window.
const SIGN_IN_RATE_LIMIT = { limit: 8, windowMs: 15 * 60 * 1000, failClosed: true };
// A second, address-independent ceiling. There is exactly one owner account, so
// a distributed attempt to guess its password has no legitimate counterpart.
const GLOBAL_SIGN_IN_RATE_LIMIT = { limit: 40, windowMs: 15 * 60 * 1000, failClosed: true };

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
    const owner = await verifyActiveOwnerSession(req, db);
    return owner ? res.status(200).json({ authenticated: true, owner: { email: owner.email } }) : res.status(401).json({ authenticated: false });
  }

  // DELETE: Sign out
  if (req.method === "DELETE") {
    if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
    res.setHeader("Set-Cookie", clearOwnerCookie());
    return res.status(200).json({ ok: true });
  }

  // PUT: Password change
  if (req.method === "PUT") {
    if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
    const owner = await verifyActiveOwnerSession(req, db);
    if (!owner) return res.status(401).json({ error: "Owner authentication required." });
    // Without a database the new password cannot be persisted, so reporting
    // success would be a lie.
    if (!db) return res.status(503).json({ error: "Password changes require the database to be configured." });

    const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (!currentPassword) return res.status(400).json({ error: "Current password is required." });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters long." });
    if (newPassword.length > 256) return res.status(400).json({ error: "New password is too long." });

    const config = ownerConfig();
    const activeHash = await getStoredOwnerPasswordHash(db) || config.passwordHash;
    if (!await verifyOwnerPassword(currentPassword, activeHash)) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    try {
      const newHash = await generateOwnerPasswordHash(newPassword);
      const now = new Date().toISOString();
      const nextEpoch = await readSessionEpoch(db) + 1;

      await db.execute({
        sql: `INSERT INTO owner_credentials (id, password_hash, session_epoch, updated_at) VALUES ('owner', ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash, session_epoch=excluded.session_epoch, updated_at=excluded.updated_at`,
        args: [newHash, nextEpoch, now],
      });
      await recordOwnerAudit(db, { actor: owner.email, action: "owner_password_changed", targetUserId: "owner", detail: { timestamp: now } });

      // Every previously issued session is now stale, including this one, so the
      // caller is re-authenticated with a session carrying the new epoch.
      res.setHeader("Set-Cookie", ownerSessionCookie(createOwnerSession(owner.email, nextEpoch)));
      return res.status(200).json({ ok: true, message: "Password changed. Other sessions have been signed out." });
    } catch (err) {
      console.error("Change password error:", err);
      return res.status(500).json({ error: "Failed to change password." });
    }
  }

  // POST: Sign in
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });

  // No database means no brute-force counter, so sign-in cannot be throttled and
  // must not proceed.
  if (!db) return res.status(503).json({ error: "Owner sign-in is unavailable because the database is not configured." });

  const quotas = await Promise.all([
    consumeRateLimit(db, `owner-signin:${clientAddress(req)}`, SIGN_IN_RATE_LIMIT),
    consumeRateLimit(db, "owner-signin:global", GLOBAL_SIGN_IN_RATE_LIMIT),
  ]);
  const blocked = quotas.find((quota) => !quota.allowed);
  if (blocked) {
    res.setHeader("Retry-After", String(blocked.retryAfterSeconds));
    return res.status(blocked.unavailable ? 503 : 429).json({
      error: blocked.unavailable
        ? "Owner sign-in is temporarily unavailable. Please try again shortly."
        : "Too many sign-in attempts. Try again later.",
    });
  }

  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  const config = ownerConfig();
  const activeHash = await getStoredOwnerPasswordHash(db) || config.passwordHash;

  if (!await verifyOwnerCredentials(email, password, activeHash)) {
    return res.status(401).json({ error: "Invalid owner credentials." });
  }

  res.setHeader("Set-Cookie", ownerSessionCookie(createOwnerSession(email, await readSessionEpoch(db))));
  return res.status(200).json({ ok: true });
}
