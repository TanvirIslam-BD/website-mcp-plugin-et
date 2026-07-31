import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanDisplayName, cleanProfilePhoto, readMcpizeProfile } from "./_mcpize-profile.js";

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

function createDashboardSession(userId, secret, displayName = "", profilePhotoUrl = "", mcpAccessToken = "") {
  const payload = Buffer.from(JSON.stringify({
    u: userId,
    e: Date.now() + 15 * 60 * 1000,
    ...(displayName ? { n: displayName } : {}),
    ...(profilePhotoUrl ? { p: profilePhotoUrl } : {}),
    // Kept only in the signed, HttpOnly dashboard session cookie so server-side
    // Copilot requests can invoke the authenticated MCPize tool catalog.
    ...(mcpAccessToken ? { mt: mcpAccessToken } : {}),
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function identityFromAccessToken(accessToken) {
  // The token only reaches this code after a successful authorization-code +
  // PKCE exchange with MCPize. We never accept an identity from the browser.
  const parts = String(accessToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const candidate = claims.sub || claims.user_id || claims.userId || claims.id || claims.user?.id;
    if (typeof candidate !== "string" || !/^[A-Za-z0-9:_-]{1,200}$/.test(candidate)) return null;
    const email = cleanDisplayName(claims.email || claims.user?.email);
    const emailName = email.includes("@")
      ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
      : "";
    const displayName = cleanDisplayName(
      claims.name ||
      claims.full_name ||
      claims.display_name ||
      claims.preferred_username ||
      claims.username ||
      claims.user?.name ||
      claims.user_metadata?.full_name ||
      emailName,
    );
    const profilePhotoUrl = cleanProfilePhoto(
      claims.picture ||
      claims.avatar_url ||
      claims.user?.picture ||
      claims.user?.avatar_url ||
      claims.user?.image ||
      claims.user_metadata?.avatar_url,
    );
    return { userId: candidate, displayName, profilePhotoUrl };
  } catch {
    return null;
  }
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
    // Preferred path: MCPize forwards the stable user id to the MCP session
    // route. Some hosted deployments proxy custom browser routes as an empty
    // 200 response, so use the identity returned by the verified OAuth token
    // exchange as a secure fallback.
    const identity = identityFromAccessToken(tokenBody.access_token);
    const mcpizeProfile = identity ? await readMcpizeProfile(identity.userId) : { displayName: "", profilePhotoUrl: "" };
    const responseDisplayName = cleanDisplayName(
      sessionBody?.user?.name ||
      sessionBody?.display_name ||
      tokenBody?.user?.name ||
      tokenBody?.display_name,
    );
    const responseProfilePhoto = cleanProfilePhoto(
      sessionBody?.user?.picture ||
      sessionBody?.user?.avatar_url ||
      sessionBody?.user?.image ||
      sessionBody?.picture ||
      sessionBody?.avatar_url ||
      tokenBody?.user?.picture ||
      tokenBody?.user?.avatar_url ||
      tokenBody?.user?.image ||
      tokenBody?.picture ||
      tokenBody?.avatar_url,
    );
    const privateSession = identity
      ? createDashboardSession(
        identity.userId,
        secret,
        mcpizeProfile.displayName || identity.displayName || responseDisplayName,
        mcpizeProfile.profilePhotoUrl || identity.profilePhotoUrl || responseProfilePhoto,
        tokenBody.access_token,
      )
      : sessionToken(sessionBody);
    if (!privateSession) {
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
