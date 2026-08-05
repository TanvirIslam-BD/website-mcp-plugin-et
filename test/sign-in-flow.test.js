import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

const loginHtml = read("site/login.html");
const loginJs = read("site/login.js");
const handoffJs = read("site/dashboard/handoff.js");
const authorizeHtml = read("site/dashboard/authorize.html");
const dashboardAuth = read("site/api/dashboard-auth.js");
const dashboardAuthorize = read("site/api/dashboard-authorize.js");
const vercel = JSON.parse(read("vercel.json"));

describe("login page", () => {
  it("has no inline script or inline event handler, so it can take a strict CSP", () => {
    const inline = [...loginHtml.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .filter((m) => m[1].trim());
    assert.deepEqual(inline, [], "inline script block found");
    assert.equal(/\son(load|click|error|change|submit)\s*=/.test(loginHtml), false, "inline handler found");
  });

  it("loads its behaviour from files that are actually routed", () => {
    for (const src of ["/login.js", "/login-boot.js"]) {
      assert.ok(loginHtml.includes(`src="${src}"`), `${src} is not referenced`);
      assert.ok(
        vercel.rewrites.some((r) => r.source === src),
        `${src} has no rewrite, so it would 404 in production`,
      );
    }
  });

  it("serves the strict policy on /login", () => {
    const rule = vercel.headers.find((h) => h.source === "/login");
    assert.ok(rule, "no header rule for /login");
    const csp = rule.headers.find((h) => h.key === "Content-Security-Policy")?.value || "";
    assert.match(csp, /script-src 'self'/);
    assert.equal(csp.includes("'unsafe-inline'") && /script-src[^;]*'unsafe-inline'/.test(csp), false);
  });

  it("exposes a live region for progress and cancellation messages", () => {
    assert.match(loginHtml, /data-login-status/);
    assert.match(loginHtml, /aria-live="polite"/);
  });

  it("drives every trigger from a data attribute", () => {
    assert.match(loginHtml, /data-secure-login/);
    assert.match(loginHtml, /data-oauth-login/);
    assert.match(loginJs, /\[data-secure-login\], \[data-oauth-login\]/);
  });
});

describe("popup handoff", () => {
  it("asks the server for the popup flow explicitly", () => {
    assert.match(loginJs, /searchParams\.set\("popup", "1"\)/);
    assert.match(dashboardAuth, /req\.query\.popup/);
    assert.match(dashboardAuth, /popup,\s*exp:/, "popup must be recorded in the signed state");
  });

  it("sends a popup to the lightweight handoff page, not the whole dashboard", () => {
    assert.match(dashboardAuthorize, /pending\.popup/);
    assert.match(dashboardAuthorize, /dashboard\/authorize\.html/);
  });

  it("posts the completion to the opener with an explicit target origin", () => {
    assert.match(handoffJs, /postMessage\(\s*\{[^}]*type: "auth-complete"/s);
    assert.match(handoffJs, /location\.origin\s*\)/, "must not post to '*'");
  });

  it("falls back to navigating when there is no opener", () => {
    assert.match(handoffJs, /if \(!opener\)/);
    assert.match(handoffJs, /location\.replace\(target\)/);
  });

  it("only accepts a same-origin message of the expected shape", () => {
    assert.match(loginJs, /event\.origin !== location\.origin/);
    assert.match(loginJs, /data\.source !== "money-copilot"/);
    assert.match(loginJs, /data\.type !== "auth-complete"/);
  });

  it("keeps the handoff page free of the dashboard bundle", () => {
    assert.equal(authorizeHtml.includes("app.js"), false, "handoff must not load the application");
    assert.equal(authorizeHtml.includes("styles.css"), false, "handoff must not load dashboard CSS");
    assert.match(authorizeHtml, /handoff\.js/);
  });
});

describe("sign-in resilience", () => {
  it("falls back to a same-tab redirect when the popup is blocked", () => {
    assert.match(loginJs, /if \(!popup\)/);
    assert.match(loginJs, /authUrl\(\{ popup: false \}\)/);
  });

  it("confirms against the session endpoint before reporting a cancellation", () => {
    const watcher = loginJs.slice(loginJs.indexOf("function watchPopup"), loginJs.indexOf("function startAuth"));
    assert.match(watcher, /dashboard-session/);
    assert.match(watcher, /was not completed/);
  });

  it("restores a button's original markup rather than rebuilding it from a literal", () => {
    assert.match(loginJs, /dataset\.idleHtml = button\.innerHTML/);
    assert.match(loginJs, /button\.innerHTML = button\.dataset\.idleHtml/);
  });

  it("prefetches the dashboard so the post-auth load is warm", () => {
    assert.match(loginJs, /rel = "prefetch"/);
    for (const asset of ["/dashboard/app.js", "/dashboard/styles.css", "/dashboard/viz.css"]) {
      assert.ok(loginJs.includes(asset), `${asset} is not prefetched`);
    }
  });
});
