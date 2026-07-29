import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const OWNER_COOKIE = "expense_tracker_owner";

function cleanEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

function cookieValue(req, name = OWNER_COOKIE) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1] || "";
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function ownerConfig() {
  return {
    email: cleanEmail(process.env.OWNER_EMAIL),
    passwordHash: String(process.env.OWNER_PASSWORD_HASH || ""),
    sessionSecret: String(process.env.OWNER_SESSION_SECRET || ""),
  };
}

export function ownerAuthConfigured() {
  const config = ownerConfig();
  return Boolean(config.email && config.passwordHash && config.sessionSecret.length >= 32);
}

export function verifyOwnerPassword(password, encodedHash) {
  if (typeof password !== "string" || password.length < 8 || password.length > 256) return false;
  const [scheme, salt, expected, ...extra] = String(encodedHash || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected || extra.length) return false;
  try {
    const actual = scryptSync(password, Buffer.from(salt, "base64url"), 64);
    return safeEqual(actual.toString("base64url"), expected);
  } catch {
    return false;
  }
}

export function verifyOwnerCredentials(email, password) {
  const config = ownerConfig();
  return safeEqual(cleanEmail(email), config.email) && verifyOwnerPassword(password, config.passwordHash);
}

export function createOwnerSession(email) {
  const config = ownerConfig();
  const payload = Buffer.from(JSON.stringify({
    e: cleanEmail(email),
    exp: Date.now() + 8 * 60 * 60 * 1000,
    nonce: randomBytes(12).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOwnerSession(req) {
  const config = ownerConfig();
  const token = cookieValue(req);
  const [payload, received, ...extra] = token.split(".");
  if (!payload || !received || extra.length || !config.sessionSecret) return null;
  const expected = createHmac("sha256", config.sessionSecret).update(payload).digest("base64url");
  if (!safeEqual(received, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (cleanEmail(value.e) !== config.email || Number(value.exp) <= Date.now()) return null;
    return { email: config.email };
  } catch {
    return null;
  }
}

export function ownerSessionCookie(token) {
  return `${OWNER_COOKIE}=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`;
}

export function clearOwnerCookie() {
  return `${OWNER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function sameOriginRequest(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers.host || "");
  return !origin || new URL(origin).host === host;
}
