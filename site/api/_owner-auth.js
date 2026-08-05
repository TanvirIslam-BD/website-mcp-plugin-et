import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt is intentionally slow. The synchronous variant blocked the event loop
// for the whole derivation on every sign-in attempt, stalling unrelated requests
// on the same instance.
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

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
  return Boolean(config.email && (config.passwordHash || process.env.TURSO_DATABASE_URL) && config.sessionSecret.length >= 32);
}

export async function generateOwnerPasswordHash(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(password, Buffer.from(salt, "base64url"), KEY_LENGTH);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

export async function verifyOwnerPassword(password, encodedHash) {
  if (typeof password !== "string" || password.length < 8 || password.length > 256) return false;
  const [scheme, salt, expected, ...extra] = String(encodedHash || "").split("$");
  if (scheme !== "scrypt" || !salt || !expected || extra.length) return false;
  try {
    const actual = await scryptAsync(password, Buffer.from(salt, "base64url"), KEY_LENGTH);
    return safeEqual(actual.toString("base64url"), expected);
  } catch {
    return false;
  }
}

export async function verifyOwnerCredentials(email, password, storedHash = null) {
  const config = ownerConfig();
  const targetHash = storedHash || config.passwordHash;
  // Both checks always run so a wrong email and a wrong password cost the same.
  const passwordMatches = await verifyOwnerPassword(password, targetHash);
  return safeEqual(cleanEmail(email), config.email) && passwordMatches;
}

export function createOwnerSession(email, sessionEpoch = 0) {
  const config = ownerConfig();
  const payload = Buffer.from(JSON.stringify({
    e: cleanEmail(email),
    exp: Date.now() + 8 * 60 * 60 * 1000,
    // Bumped on password change so sessions issued before it stop working.
    v: Number(sessionEpoch) || 0,
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
    return { email: config.email, sessionEpoch: Number(value.v) || 0 };
  } catch {
    return null;
  }
}

export async function readSessionEpoch(db) {
  if (!db) return 0;
  try {
    const result = await db.execute("SELECT session_epoch FROM owner_credentials WHERE id = 'owner' LIMIT 1");
    return Number(result.rows[0]?.session_epoch || 0);
  } catch {
    return 0;
  }
}

/**
 * Signature check plus a revocation check, so changing the owner password
 * immediately invalidates every session issued before it.
 */
export async function verifyActiveOwnerSession(req, db) {
  const owner = verifyOwnerSession(req);
  if (!owner) return null;
  return owner.sessionEpoch === await readSessionEpoch(db) ? owner : null;
}

export function ownerSessionCookie(token) {
  return `${OWNER_COOKIE}=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`;
}

export function clearOwnerCookie() {
  return `${OWNER_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

// Shared with the dashboard endpoints; re-exported so existing imports of this
// module keep working.
export { sameOriginRequest } from "./_config.js";
