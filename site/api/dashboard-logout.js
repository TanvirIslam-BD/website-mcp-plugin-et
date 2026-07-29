const DASHBOARD_COOKIE = "expense_tracker_dashboard";

export default function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Clear-Site-Data", '"cache"');
  res.setHeader("Set-Cookie", `${DASHBOARD_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax`);
  res.writeHead(302, { Location: "/" });
  res.end();
}
