import { clearOwnerCookie, createOwnerSession, ownerAuthConfigured, ownerSessionCookie, sameOriginRequest, verifyOwnerCredentials, verifyOwnerSession } from "./_owner-auth.js";

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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!ownerAuthConfigured()) return res.status(503).json({ error: "Owner access is not configured." });

  if (req.method === "GET") {
    const owner = verifyOwnerSession(req);
    return owner ? res.status(200).json({ authenticated: true, owner: { email: owner.email } }) : res.status(401).json({ authenticated: false });
  }

  if (req.method === "DELETE") {
    if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
    res.setHeader("Set-Cookie", clearOwnerCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });
  if (rateLimited(req)) return res.status(429).json({ error: "Too many sign-in attempts. Try again later." });

  const email = typeof req.body?.email === "string" ? req.body.email : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!verifyOwnerCredentials(email, password)) return res.status(401).json({ error: "Invalid owner credentials." });
  const token = createOwnerSession(email);
  res.setHeader("Set-Cookie", ownerSessionCookie(token));
  return res.status(200).json({ ok: true });
}

