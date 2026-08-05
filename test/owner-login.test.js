import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
const loginHtml = read("site/owner/login.html");
const loginCss = read("site/owner/login.css");
const loginJs = read("site/owner/login.js");
const vercel = JSON.parse(read("vercel.json"));

// Matches the AA/AAA math the skill's palette validator uses, so a colour choice
// can be checked the same way here without a browser.
function relativeLuminance([r, g, b]) {
  const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexToRgb(hexA));
  const l2 = relativeLuminance(hexToRgb(hexB));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe("owner login markup", () => {
  it("has no inline script or inline event handler, matching the strict /owner CSP", () => {
    const inline = [...loginHtml.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter((m) => m[1].trim());
    assert.deepEqual(inline, [], "inline script block found");
    assert.equal(/\son(load|click|error|change|submit)\s*=/.test(loginHtml), false, "inline handler found");
  });

  it("references stylesheets and scripts that are all actually routed", () => {
    for (const src of ["/owner/login.css", "/owner/boot.js", "/owner/login.js"]) {
      assert.ok(loginHtml.includes(src), `${src} is not referenced in the page`);
    }
    // /owner/(.*) is a catch-all rewrite to site/owner/$1, so any file placed
    // there is served without a dedicated rule — confirm that rule still exists.
    assert.ok(vercel.rewrites.some((r) => r.source === "/owner/(.*)" && r.destination === "/site/owner/$1"));
  });

  it("keeps the /owner strict CSP with no relaxation for this page", () => {
    const rule = vercel.headers.find((h) => h.source === "/owner");
    const csp = rule.headers.find((h) => h.key === "Content-Security-Policy").value;
    assert.match(csp, /script-src 'self'(?!.*unsafe-inline.*script-src)/);
    assert.doesNotMatch(csp.split(";").find((p) => p.includes("script-src")) || "", /unsafe-inline/);
  });

  it("does not brand the page as the retired product name", () => {
    assert.equal(/Expense Tracker AI/i.test(loginHtml), false);
    assert.match(loginHtml, /Money Copilot AI/);
  });

  it("labels the password field with a live region for server errors", () => {
    assert.match(loginHtml, /id="form-message"[^>]*role="alert"/);
    assert.match(loginHtml, /aria-describedby="form-message/);
  });

  it("gives the password reveal button an accessible name", () => {
    assert.match(loginHtml, /id="reveal"[^>]*aria-label="[^"]+"/);
  });
});

describe("owner login styling", () => {
  it("defines every class the markup actually uses", () => {
    // The regression this replaces: login.html referenced login-shell,
    // login-card, brand, form-error, security-note and primary, and owner.css
    // (the stylesheet it loaded) defined none of them — the page rendered bare.
    const classes = [...loginHtml.matchAll(/class="([^"]+)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      .filter(Boolean);
    const missing = [...new Set(classes)].filter((cls) => !loginCss.includes(`.${cls}`));
    assert.deepEqual(missing, []);
  });

  it("passes AA contrast for body text and the submit button", () => {
    // Values pulled from the stylesheet's own custom properties so this fails if
    // either is edited without rechecking contrast.
    const muted = (loginCss.match(/--ink-muted:\s*(#[0-9a-f]{6})/i) || [])[1];
    const buttonFrom = (loginCss.match(/--button-from:\s*(#[0-9a-f]{6})/i) || [])[1];
    const buttonTo = (loginCss.match(/--button-to:\s*(#[0-9a-f]{6})/i) || [])[1];
    assert.ok(muted && buttonFrom && buttonTo, "expected tokens not found in login.css");

    assert.ok(contrastRatio(muted, "#ffffff") >= 4.5, "--ink-muted fails AA on a white panel");
    assert.ok(contrastRatio("#ffffff", buttonFrom) >= 4.5, "submit button start colour fails AA for white text");
    assert.ok(contrastRatio("#ffffff", buttonTo) >= 4.5, "submit button end colour fails AA for white text");
  });

  it("declares a dark variant rather than only a light palette", () => {
    assert.match(loginCss, /prefers-color-scheme:\s*dark/);
  });

  it("collapses to one column with a real breakpoint, not a fixed cutoff copied from elsewhere", () => {
    assert.match(loginCss, /@media \(max-width:\s*860px\)/);
    assert.match(loginCss, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it("respects prefers-reduced-motion", () => {
    assert.match(loginCss, /prefers-reduced-motion:\s*reduce/);
  });
});

describe("owner login script", () => {
  it("distinguishes the server's failure reasons instead of one generic message", () => {
    for (const status of [429, 503, 403, 401]) {
      assert.match(loginJs, new RegExp(`status === ${status}`));
    }
    assert.match(loginJs, /Retry-After/);
  });

  it("does not silently redirect on every non-2xx response", () => {
    assert.match(loginJs, /response\.ok/);
  });

  it("guards against a novalidate form submitting empty fields", () => {
    assert.match(loginJs, /novalidate/i.test(loginHtml) ? /emailInput\.value\.trim\(\)/ : /./);
  });

  it("surfaces a Caps Lock warning without reading the password value", () => {
    assert.match(loginJs, /getModifierState\("CapsLock"\)/);
    assert.equal(/passwordInput\.value\s*===/.test(loginJs), false);
  });

  it("checks for an existing session before showing the form", () => {
    assert.match(loginJs, /\/api\/owner-auth/);
    assert.match(loginJs, /location\.replace\("\/owner\/monitor"\)/);
  });
});
