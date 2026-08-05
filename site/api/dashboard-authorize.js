import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanDisplayName, cleanProfilePhoto, readMcpizeProfile } from "./_mcpize-profile.js";
import { authorizeRedirectUri, clientMetadataUrl, dashboardOrigin } from "./_config.js";
import { createDashboardSession, dashboardSessionCookie, signingSecret } from "./_dashboard-session.js";

const STATE_COOKIE = "expense_tracker_oauth";
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

const USER_ID_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;

/**
 * The user id reported by the authenticated MCPize session endpoint, if it
 * returns one. That call requires the bearer token, so its answer is
 * authoritative — unlike the unverified claims inside the token itself.
 */
function identityFromSessionResponse(body) {
  const candidates = [
    body?.user?.id, body?.user_id, body?.userId, body?.id, body?.sub,
    body?.data?.user?.id, body?.result?.user?.id,
  ];
  return candidates.find((value) => typeof value === "string" && USER_ID_PATTERN.test(value)) || "";
}

function identityFromAccessToken(accessToken) {
  // The token only reaches this code after a successful authorization-code +
  // PKCE exchange with MCPize over TLS, so transport is the trust anchor: its
  // signature is not verified here because MCPize publishes no verification key.
  // Where the session endpoint also reports an identity, the two are compared
  // below and a mismatch aborts sign-in.
  const parts = String(accessToken || "").split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const identityCandidates = [claims.sub, claims.user_id, claims.userId, claims.id, claims.user?.id, claims.data?.user?.id, claims.result?.user?.id];
    const candidate = identityCandidates.find((value) => typeof value === "string" && /^[A-Za-z0-9:_-]{1,200}$/.test(value));
    if (typeof candidate !== "string" || !/^[A-Za-z0-9:_-]{1,200}$/.test(candidate)) return null;
    const profileId = identityCandidates.find((value) => typeof value === "string" && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value)) || candidate;
    const email = cleanDisplayName(claims.email || claims.user?.email || claims.data?.user?.email || claims.user_metadata?.email || claims.raw_user_meta_data?.email);
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
      claims.user_metadata?.name ||
      claims.raw_user_meta_data?.full_name ||
      claims.raw_user_meta_data?.name ||
      claims.data?.user?.name ||
      claims.data?.user?.full_name ||
      emailName,
    );
    const profilePhotoUrl = cleanProfilePhoto(
      claims.picture ||
      claims.avatar_url ||
      claims.user?.picture ||
      claims.user?.avatar_url ||
      claims.user?.image ||
      claims.user_metadata?.avatar_url ||
      claims.user_metadata?.picture ||
      claims.raw_user_meta_data?.avatar_url ||
      claims.raw_user_meta_data?.picture ||
      claims.data?.user?.avatar_url ||
      claims.data?.user?.picture ||
      claims.data?.user?.image,
    );
    return { userId: candidate, profileId, displayName, profilePhotoUrl };
  } catch {
    return null;
  }
}

// `res.send` with a string defaults to text/html, and the error paths below
// include field names and messages that come from the MCPize response. Forcing
// text/plain means that third-party text can never be parsed as markup.
function plainText(res, status, message) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).send(String(message).replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 500));
}

function responseShape(body, response) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return response.headers.get("content-type") || "non-JSON";
  const keys = Object.keys(body).slice(0, 8);
  return keys.length ? `JSON fields: ${keys.join(", ")}` : "empty JSON response";
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const secret = signingSecret();
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const pending = secret ? verifyState(cookieValue(req, STATE_COOKIE), secret) : null;
  if (!pending || !code || pending.state !== state) {
    res.setHeader("Set-Cookie", clearStateCookie());
    return plainText(res, 400, "Dashboard sign-in expired or could not be verified. Please return to /dashboard and try again.");
  }

  try {
    const tokenResponse = await fetch(MCP_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: authorizeRedirectUri(),
        client_id: clientMetadataUrl(),
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

    // Cross-check: the session endpoint's answer is authoritative because it
    // required the bearer token. The token's own `sub` remains the stored user id
    // so existing data keeps resolving, but the two must agree.
    const sessionIdentity = identityFromSessionResponse(sessionBody);
    if (identity && sessionIdentity && sessionIdentity !== identity.userId) {
      console.error("[authorize] identity mismatch between access token and session endpoint");
      throw new Error("The sign-in identity could not be confirmed.");
    }

    const mcpizeProfile = identity ? await readMcpizeProfile(identity.profileId || identity.userId) : { displayName: "", profilePhotoUrl: "" };
    const responseDisplayName = cleanDisplayName(
      sessionBody?.user?.name ||
      sessionBody?.display_name ||
      tokenBody?.user?.name ||
      tokenBody?.display_name ||
      sessionBody?.data?.user?.name ||
      sessionBody?.data?.user?.full_name ||
      tokenBody?.data?.user?.name ||
      tokenBody?.data?.user?.full_name,
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
      tokenBody?.avatar_url ||
      sessionBody?.data?.user?.picture ||
      sessionBody?.data?.user?.avatar_url ||
      sessionBody?.data?.user?.image ||
      tokenBody?.data?.user?.picture ||
      tokenBody?.data?.user?.avatar_url ||
      tokenBody?.data?.user?.image,
    );
    // Only a session this server signed itself is accepted downstream, so an
    // unreadable identity has to fail loudly rather than mint a dead cookie.
    const privateSession = identity
      ? createDashboardSession({
        userId: identity.userId,
        displayName: mcpizeProfile.displayName || identity.displayName || responseDisplayName,
        profilePhotoUrl: mcpizeProfile.profilePhotoUrl || identity.profilePhotoUrl || responseProfilePhoto,
        mcpAccessToken: tokenBody.access_token,
      })
      : "";
    if (!privateSession) {
      const detail = typeof sessionBody.error === "string" ? ` ${sessionBody.error}` : "";
      throw new Error(`Could not create the private dashboard session (MCPize returned ${sessionResponse.status}; ${responseShape(sessionBody, sessionResponse)}).${detail}`);
    }

    res.setHeader("Set-Cookie", [clearStateCookie(), dashboardSessionCookie(privateSession)]);
    res.setHeader("Cache-Control", "no-store");

    /*
     * A popup used to be sent straight to /dashboard, so it downloaded the entire
     * application (~520KB of JS and CSS) and ran a full boot purely to redirect
     * its opener — which then downloaded all of it again. The popup flow now ends
     * on a tiny handoff page that signals the opener and closes.
     */
    const month = encodeURIComponent(pending.month);
    const destination = pending.popup
      ? `${dashboardOrigin()}/dashboard/authorize.html?month=${month}&handoff=1`
      : `${dashboardOrigin()}/dashboard?month=${month}`;
    return res.redirect(302, destination);
  } catch (error) {
    res.setHeader("Set-Cookie", clearStateCookie());
    return plainText(res, 502, `Dashboard sign-in could not be completed. ${error instanceof Error ? error.message : "Please try again."}`);
  }
}
