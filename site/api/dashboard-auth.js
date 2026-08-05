import { createHash, createHmac, randomBytes } from "node:crypto";
import { authorizeRedirectUri, clientMetadataUrl } from "./_config.js";
import { signingSecret } from "./_dashboard-session.js";

const STATE_COOKIE = "expense_tracker_oauth";
const MCP_AUTHORIZATION_ENDPOINT = "https://expense-tracker-mcp.mcpize.run/oauth/authorize?server_id=15e6303c-b2e1-4aca-a40f-244ee4fba030";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function stateCookie(value) {
  return `${STATE_COOKIE}=${value}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  // Empty when the secret is missing or below the minimum length.
  const secret = signingSecret();
  if (!secret) return res.status(503).json({ error: "Dashboard authentication is not configured." });

  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.month || ""))
    ? String(req.query.month)
    : new Date().toISOString().slice(0, 7);
  // Recorded in the signed state so the callback knows to hand off to the opener
  // instead of loading the whole dashboard inside the popup.
  const popup = String(req.query.popup || "") === "1";
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const payload = encode({ state, verifier, month, popup, exp: Date.now() + 10 * 60 * 1000 });
  res.setHeader("Set-Cookie", stateCookie(`${payload}.${sign(payload, secret)}`));
  res.setHeader("Cache-Control", "no-store");

  const authorizationUrl = new URL(MCP_AUTHORIZATION_ENDPOINT);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientMetadataUrl());
  authorizationUrl.searchParams.set("redirect_uri", authorizeRedirectUri());
  authorizationUrl.searchParams.set("scope", "mcp:tools mcp:resources mcp:prompts");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  return res.redirect(302, authorizationUrl.toString());
}
