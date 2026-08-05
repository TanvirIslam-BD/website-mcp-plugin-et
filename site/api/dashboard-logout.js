import { clearDashboardSessionCookie } from "./_dashboard-session.js";

export default function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Clear-Site-Data", '"cache"');
  res.setHeader("Set-Cookie", clearDashboardSessionCookie());
  res.writeHead(302, { Location: "/" });
  res.end();
}
