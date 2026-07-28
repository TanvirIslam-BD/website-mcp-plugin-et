import { createHmac, timingSafeEqual } from "node:crypto";

const STATE_COOKIE = "expense_tracker_oauth";
const DASHBOARD_COOKIE = "expense_tracker_dashboard";
const DASHBOARD_ORIGIN = "https://expense-chat-ai-sandy.vercel.app";
const MCP_TOKEN_ENDPOINT = "https://expense-tracker-mcp.mcpize.run/oauth/token";
const MCP_SESSION_ENDPOINT = "https://expense-tracker-mcp.mcpize.run/dashboard/session";

function cookieValue(req, name) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}

function verifyState(value, secret) {
  const [payload, received, ...extra] = value.split(".");
  if (!payload || !received || extra.length) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.state === "string" && typeof data.verifier === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(data.month) && Number(data.exp) > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function clearStateCookie() {
  return `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function dashboardCookie(token) {
  return `${DASHBOARD_COOKIE}=${token}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`;
}

function sessionToken(body) {
  const candidates = [
    body?.dashboard_token,
    body?.data?.dashboard_token,
    body?.result?.dashboard_token,
  ];
  return candidates.find((value) => typeof value === "string" && value.length > 20) || null;
}

function responseShape(body, response) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return response.headers.get("content-type") || "non-JSON";
  const keys = Object.keys(body).slice(0, 8);
  return keys.length ? `JSON fields: ${keys.join(", ")}` : "empty JSON response";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const pending = secret ? verifyState(cookieValue(req, STATE_COOKIE), secret) : null;
  if (!pending || !code || pending.state !== state) {
    res.setHeader("Set-Cookie", clearStateCookie());
    return res.status(400).send("Dashboard sign-in expired or could not be verified. Please return to /dashboard and try again.");
  }

  try {
    const tokenResponse = await fetch(MCP_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${DASHBOARD_ORIGIN}/authorize`,
        client_id: `${DASHBOARD_ORIGIN}/dashboard/client-metadata.json`,
        code_verifier: pending.verifier,
      }),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof tokenBody.access_token !== "string") throw new Error("MCPize did not return a dashboard access token.");

    const sessionResponse = await fetch(MCP_SESSION_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}`, Accept: "application/json" },
    });
    const sessionBody = await sessionResponse.json().catch(() => ({}));
    const privateSession = sessionToken(sessionBody);
    if (!sessionResponse.ok || !privateSession) {
      const detail = typeof sessionBody.error === "string" ? ` ${sessionBody.error}` : "";
      throw new Error(`Could not create the private dashboard session (MCPize returned ${sessionResponse.status}; ${responseShape(sessionBody, sessionResponse)}).${detail}`);
    }

    res.setHeader("Set-Cookie", [clearStateCookie(), dashboardCookie(privateSession)]);
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, `${DASHBOARD_ORIGIN}/dashboard?month=${encodeURIComponent(pending.month)}`);
  } catch (error) {
    res.setHeader("Set-Cookie", clearStateCookie());
    return res.status(502).send(`Dashboard sign-in could not be completed. ${error instanceof Error ? error.message : "Please try again."}`);
  }
}
