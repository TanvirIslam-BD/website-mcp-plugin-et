import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "expense_tracker_dashboard";

function cookieValue(req) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1] || "";
}

function hasValidSession(token, secret) {
  if (!token || !secret) return false;
  const [payload, received, ...extra] = token.split(".");
  if (!payload || !received || extra.length) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof session.u === "string" && Boolean(session.u) && Number.isFinite(session.e) && session.e > Date.now();
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");

  const authenticated = hasValidSession(cookieValue(req), process.env.DASHBOARD_SESSION_SECRET);
  return res.status(authenticated ? 200 : 401).json({ authenticated });
}
