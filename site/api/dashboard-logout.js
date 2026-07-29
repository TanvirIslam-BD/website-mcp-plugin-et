const DASHBOARD_COOKIE = "expense_tracker_dashboard";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Set-Cookie", `${DASHBOARD_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  res.writeHead(302, { Location: "/" });
  res.end();
}
