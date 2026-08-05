import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authorizeRedirectUri, clientMetadataUrl, dashboardOrigin } from "../site/api/_config.js";
import { clientAddress, consumeRateLimit } from "../site/api/_rate-limit.js";

const PRODUCTION = "https://www.copilotai.live";

afterEach(() => {
  delete process.env.DASHBOARD_ORIGIN;
});

describe("dashboardOrigin", () => {
  it("defaults to production", () => {
    assert.equal(dashboardOrigin(), PRODUCTION);
  });

  it("uses a configured origin and strips any path", () => {
    process.env.DASHBOARD_ORIGIN = "https://preview.example.com/some/path";
    assert.equal(dashboardOrigin(), "https://preview.example.com");
  });

  it("falls back to production for unparseable values", () => {
    process.env.DASHBOARD_ORIGIN = "not a url";
    assert.equal(dashboardOrigin(), PRODUCTION);
  });

  it("builds the OAuth client id and redirect from the same origin", () => {
    process.env.DASHBOARD_ORIGIN = "https://preview.example.com";
    assert.equal(clientMetadataUrl(), "https://preview.example.com/dashboard/client-metadata.json");
    assert.equal(authorizeRedirectUri(), "https://preview.example.com/authorize");
  });
});

describe("clientAddress", () => {
  it("prefers the platform header a client cannot forge", () => {
    const req = { headers: { "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6", "x-real-ip": "2.2.2.2" } };
    assert.equal(clientAddress(req), "1.1.1.1");
  });

  it("falls back to x-real-ip before x-forwarded-for", () => {
    assert.equal(clientAddress({ headers: { "x-real-ip": "2.2.2.2", "x-forwarded-for": "6.6.6.6" } }), "2.2.2.2");
  });

  it("uses the last x-forwarded-for entry so a spoofed prefix cannot rotate the key", () => {
    // A client sending its own "x-forwarded-for: evil" gets the real address
    // appended by the proxy, so only the final entry is trustworthy.
    assert.equal(clientAddress({ headers: { "x-forwarded-for": "9.9.9.9, 5.5.5.5, 3.3.3.3" } }), "3.3.3.3");
  });

  it("falls back to the socket address, then to a placeholder", () => {
    assert.equal(clientAddress({ headers: {}, socket: { remoteAddress: "9.9.9.9" } }), "9.9.9.9");
    assert.equal(clientAddress({ headers: {} }), "unknown");
  });
});

describe("consumeRateLimit", () => {
  it("counts requests inside the window and blocks past the limit", async () => {
    let count = 0;
    const db = {
      async execute() {
        count += 1;
        return { rows: [{ count, window_start: Date.now() }] };
      },
    };
    const options = { limit: 2, windowMs: 60_000 };
    assert.equal((await consumeRateLimit(db, "k", options)).allowed, true);
    assert.equal((await consumeRateLimit(db, "k", options)).allowed, true);
    const third = await consumeRateLimit(db, "k", options);
    assert.equal(third.allowed, false);
    assert.ok(third.retryAfterSeconds >= 1);
  });

  it("fails open by default so a limiter outage cannot take the endpoint down", async () => {
    const db = { async execute() { throw new Error("database unreachable"); } };
    const result = await consumeRateLimit(db, "k", { limit: 1, windowMs: 1000 });
    assert.equal(result.allowed, true);
    assert.equal(result.unavailable, true);
  });

  it("fails closed when asked, so brute-force protection cannot be bypassed", async () => {
    const db = { async execute() { throw new Error("database unreachable"); } };
    const result = await consumeRateLimit(db, "k", { limit: 1, windowMs: 60_000, failClosed: true });
    assert.equal(result.allowed, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.retryAfterSeconds, 60);
  });
});

describe("session secret enforcement", () => {
  it("refuses to issue or verify sessions when the secret is too short", async () => {
    const original = process.env.DASHBOARD_SESSION_SECRET;
    // A fresh module instance is needed because the secret is read per call but
    // the rejection notice is logged once.
    const mod = await import(`../site/api/_dashboard-session.js?weak=${Date.now()}`);
    try {
      process.env.DASHBOARD_SESSION_SECRET = "too-short";
      assert.equal(mod.sessionSecretConfigured(), false);
      assert.equal(mod.createDashboardSession({ userId: "u1" }), "");
      assert.equal(mod.signingSecret(), "");

      process.env.DASHBOARD_SESSION_SECRET = "x".repeat(mod.MINIMUM_SECRET_LENGTH);
      assert.equal(mod.sessionSecretConfigured(), true);
      const token = mod.createDashboardSession({ userId: "u1" });
      assert.equal(mod.verifyDashboardSession(token).userId, "u1");

      // A token minted under a valid secret must not verify under a weak one.
      process.env.DASHBOARD_SESSION_SECRET = "too-short";
      assert.equal(mod.verifyDashboardSession(token), null);
    } finally {
      process.env.DASHBOARD_SESSION_SECRET = original;
    }
  });
});
