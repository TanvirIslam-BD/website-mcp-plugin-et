import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const DASHBOARD_COOKIE = "expense_tracker_dashboard";
export const SESSION_TTL_MS = 15 * 60 * 1000;

// A session is re-issued once this much of its lifetime has elapsed, so an
// active user keeps a valid cookie instead of being signed out mid-session.
const REFRESH_AFTER_MS = SESSION_TTL_MS / 3;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const MINIMUM_SECRET_LENGTH = 32;

let loggedRejection = false;

/**
 * A short secret makes both the session signature and the MCP-token encryption
 * key guessable, so it is rejected outright rather than warned about. Every
 * caller treats an empty secret as "not configured" and returns 503, which fails
 * closed instead of accepting forgeable sessions.
 */
function sessionSecret() {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (typeof secret !== "string" || secret.length < MINIMUM_SECRET_LENGTH) {
    if (!loggedRejection) {
      loggedRejection = true;
      console.error(
        `DASHBOARD_SESSION_SECRET must be at least ${MINIMUM_SECRET_LENGTH} characters; ` +
        "dashboard sessions are disabled until it is set. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
      );
    }
    return "";
  }
  return secret;
}

/** True when sessions can be issued and verified. */
export function sessionSecretConfigured() {
  return Boolean(sessionSecret());
}

/**
 * The validated secret, for siblings that sign their own short-lived artefacts
 * (the OAuth state cookie). Empty when the secret fails the length rule.
 */
export function signingSecret() {
  return sessionSecret();
}

function tokenKey(secret) {
  return createHash("sha256").update(`${secret}:mcp-token-v1`).digest();
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

// The MCP access token is a live bearer credential, so it is encrypted rather
// than merely signed: a leaked cookie must not hand over the MCP account.
export function encryptMcpToken(token) {
  const secret = sessionSecret();
  if (!secret || typeof token !== "string" || !token) return "";
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decryptMcpToken(value) {
  const secret = sessionSecret();
  if (!secret || typeof value !== "string" || !value) return "";
  try {
    const raw = Buffer.from(value, "base64url");
    if (raw.length <= IV_BYTES + TAG_BYTES) return "";
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(secret), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function cleanSessionName(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
}

export function cleanSessionPhoto(value) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export function createDashboardSession({ userId, displayName = "", profilePhotoUrl = "", mcpAccessToken = "" }) {
  const secret = sessionSecret();
  if (!secret || typeof userId !== "string" || !userId) return "";
  const encryptedToken = encryptMcpToken(mcpAccessToken);
  const payload = Buffer.from(JSON.stringify({
    u: userId,
    e: Date.now() + SESSION_TTL_MS,
    ...(displayName ? { n: cleanSessionName(displayName) } : {}),
    ...(profilePhotoUrl ? { p: cleanSessionPhoto(profilePhotoUrl) } : {}),
    ...(encryptedToken ? { mte: encryptedToken } : {}),
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

export function verifyDashboardSession(token) {
  const secret = sessionSecret();
  if (!secret || typeof token !== "string" || !token) return null;
  const [payload, received, ...extra] = token.split(".");
  if (!payload || !received || extra.length) return null;
  if (!safeEqual(received, createHmac("sha256", secret).update(payload).digest("base64url"))) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof value.u !== "string" || !value.u) return null;
    if (!Number.isFinite(Number(value.e)) || Number(value.e) <= Date.now()) return null;
    return {
      userId: value.u,
      expiresAt: Number(value.e),
      displayName: cleanSessionName(value.n),
      profilePhotoUrl: cleanSessionPhoto(value.p),
      // `mt` is the legacy plaintext field. It is still read so existing
      // sessions survive this deploy, and is re-issued encrypted on refresh.
      mcpAccessToken: decryptMcpToken(value.mte) || (typeof value.mt === "string" ? value.mt : ""),
    };
  } catch {
    return null;
  }
}

export function cookieValue(req, name = DASHBOARD_COOKIE) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}

export function readDashboardSession(req) {
  return verifyDashboardSession(cookieValue(req));
}

export function dashboardSessionCookie(token) {
  return `${DASHBOARD_COOKIE}=${token}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearDashboardSessionCookie() {
  return `${DASHBOARD_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// Slides the expiry forward for users who are actively using the dashboard.
export function refreshDashboardSession(res, session) {
  if (!session || session.expiresAt - Date.now() > SESSION_TTL_MS - REFRESH_AFTER_MS) return;
  const token = createDashboardSession(session);
  if (token) appendSetCookie(res, dashboardSessionCookie(token));
}

export function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) res.setHeader("Set-Cookie", cookie);
  else res.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : [existing]), cookie]);
}
