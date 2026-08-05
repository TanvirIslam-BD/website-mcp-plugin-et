import { readDashboardSession } from "./_dashboard-session.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");

  const authenticated = Boolean(readDashboardSession(req));
  return res.status(authenticated ? 200 : 401).json({ authenticated });
}
