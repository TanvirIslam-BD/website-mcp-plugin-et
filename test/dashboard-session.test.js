import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { before, describe, it } from "node:test";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
let session;

before(async () => {
  process.env.DASHBOARD_SESSION_SECRET = SECRET;
  session = await import("../site/api/_dashboard-session.js");
});

function sign(payload) {
  return `${payload}.${createHmac("sha256", SECRET).update(payload).digest("base64url")}`;
}

function payloadOf(token) {
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
}

describe("dashboard session tokens", () => {
  it("round-trips a signed session", () => {
    const token = session.createDashboardSession({ userId: "user-1", displayName: "Ada Lovelace" });
    const verified = session.verifyDashboardSession(token);
    assert.equal(verified.userId, "user-1");
    assert.equal(verified.displayName, "Ada Lovelace");
  });

  it("rejects a tampered payload", () => {
    const token = session.createDashboardSession({ userId: "user-1" });
    const signature = token.split(".")[1];
    const forged = Buffer.from(JSON.stringify({ u: "attacker", e: Date.now() + 60_000 })).toString("base64url");
    assert.equal(session.verifyDashboardSession(`${forged}.${signature}`), null);
    assert.equal(session.verifyDashboardSession(`${token}x`), null);
  });

  it("rejects a token with extra segments", () => {
    const token = session.createDashboardSession({ userId: "user-1" });
    assert.equal(session.verifyDashboardSession(`${token}.extra`), null);
  });

  it("rejects an expired session even when correctly signed", () => {
    const expired = sign(Buffer.from(JSON.stringify({ u: "user-1", e: Date.now() - 1000 })).toString("base64url"));
    assert.equal(session.verifyDashboardSession(expired), null);
  });

  it("rejects a session with no user id", () => {
    const anonymous = sign(Buffer.from(JSON.stringify({ u: "", e: Date.now() + 60_000 })).toString("base64url"));
    assert.equal(session.verifyDashboardSession(anonymous), null);
  });

  it("rejects empty and malformed input", () => {
    for (const value of ["", null, undefined, "no-dot", 42]) {
      assert.equal(session.verifyDashboardSession(value), null);
    }
  });

  it("strips control characters from the display name", () => {
    const hostile = `Ada${String.fromCharCode(10)}${String.fromCharCode(0)}Lovelace`;
    const token = session.createDashboardSession({ userId: "u", displayName: hostile });
    assert.equal(session.verifyDashboardSession(token).displayName, "AdaLovelace");
  });

  it("drops a non-https profile photo", () => {
    const token = session.createDashboardSession({ userId: "u", profilePhotoUrl: "http://example.com/a.png" });
    assert.equal(session.verifyDashboardSession(token).profilePhotoUrl, "");
  });
});

describe("MCP access token encryption", () => {
  it("encrypts the token rather than only encoding it", () => {
    const secret = "mcp-bearer-token-value";
    const token = session.createDashboardSession({ userId: "user-1", mcpAccessToken: secret });
    const raw = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
    assert.ok(!raw.includes(secret), "the raw token must not appear in the cookie payload");
    assert.equal(payloadOf(token).mt, undefined, "the legacy plaintext field must not be written");
    assert.ok(payloadOf(token).mte, "an encrypted token field is expected");
    assert.equal(session.verifyDashboardSession(token).mcpAccessToken, secret);
  });

  it("produces a different ciphertext each time", () => {
    const a = payloadOf(session.createDashboardSession({ userId: "u", mcpAccessToken: "same" })).mte;
    const b = payloadOf(session.createDashboardSession({ userId: "u", mcpAccessToken: "same" })).mte;
    assert.notEqual(a, b, "a random IV should make repeated encryptions differ");
  });

  it("still reads sessions issued with the legacy plaintext field", () => {
    const legacy = sign(Buffer.from(JSON.stringify({ u: "user-1", e: Date.now() + 60_000, mt: "legacy-token" })).toString("base64url"));
    assert.equal(session.verifyDashboardSession(legacy).mcpAccessToken, "legacy-token");
  });

  it("returns an empty string for corrupted ciphertext", () => {
    assert.equal(session.decryptMcpToken("not-valid-ciphertext"), "");
    assert.equal(session.decryptMcpToken(""), "");
    assert.equal(session.decryptMcpToken(Buffer.from("tooshort").toString("base64url")), "");
  });
});

describe("session cookie", () => {
  it("is HttpOnly, Secure and SameSite=Lax", () => {
    const cookie = session.dashboardSessionCookie("abc");
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"]) {
      assert.ok(cookie.includes(attribute), `expected ${attribute} in ${cookie}`);
    }
  });

  it("clears with Max-Age=0", () => {
    assert.ok(session.clearDashboardSessionCookie().includes("Max-Age=0"));
  });

  it("reads the session out of a request cookie header", () => {
    const token = session.createDashboardSession({ userId: "user-9" });
    const req = { headers: { cookie: `other=1; expense_tracker_dashboard=${token}; last=2` } };
    assert.equal(session.readDashboardSession(req).userId, "user-9");
  });

  it("returns null when the cookie is absent", () => {
    assert.equal(session.readDashboardSession({ headers: {} }), null);
  });
});
