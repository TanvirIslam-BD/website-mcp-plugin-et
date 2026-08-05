import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

/*
 * Guards the data-visualization palette.
 *
 * The defect this replaces: successive override layers had collapsed the three
 * cash-flow series onto three near-identical greens and forced every legend
 * swatch to a single green, leaving the chart unreadable. These checks fail if
 * that happens again.
 */
const css = readFileSync(new URL("../site/dashboard/viz.css", import.meta.url), "utf8");

function block(selector) {
  const at = css.indexOf(selector);
  assert.notEqual(at, -1, `${selector} block is missing from viz.css`);
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function tokens(selector) {
  const found = {};
  for (const [, name, value] of block(selector).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    found[name] = value.trim();
  }
  return found;
}

// OKLab-free, but sufficient to catch a collapse back to one hue: plain RGB
// Euclidean distance. The validated palette sits far above this threshold.
function rgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function distance(a, b) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.round(Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2));
}

const LIGHT = tokens(":root {");
const DARK = tokens(':root[data-theme="dark"] {');

describe("cash-flow series palette", () => {
  const slots = ["--series-income", "--series-expense", "--series-savings"];

  for (const [mode, set] of [["light", LIGHT], ["dark", DARK]]) {
    it(`defines all three series in ${mode} mode`, () => {
      for (const slot of slots) {
        assert.match(set[slot] || "", /^#[0-9a-f]{6}$/i, `${slot} missing or not a hex in ${mode}`);
      }
    });

    it(`keeps the three ${mode} series far apart`, () => {
      const values = slots.map((s) => set[s]);
      for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
          const d = distance(values[i], values[j]);
          // The regression measured 14 between income and expenses.
          assert.ok(d >= 80, `${slots[i]} vs ${slots[j]} in ${mode} is only ${d} apart`);
        }
      }
    });

    it(`uses distinct hues, not shades of one, in ${mode} mode`, () => {
      const hues = slots.map((s) => {
        const [r, g, b] = rgb(set[s]);
        // Which channel dominates is a crude but effective hue-family proxy.
        return [r, g, b].indexOf(Math.max(r, g, b));
      });
      assert.equal(new Set(hues).size, 3, `${mode} series share a dominant channel: ${hues}`);
    });
  }
});

describe("categorical palette", () => {
  it("defines eight slots plus an 'other' colour in both modes", () => {
    for (const [mode, set] of [["light", LIGHT], ["dark", DARK]]) {
      for (let i = 1; i <= 8; i += 1) {
        assert.match(set[`--cat-${i}`] || "", /^#[0-9a-f]{6}$/i, `--cat-${i} missing in ${mode}`);
      }
      assert.match(set["--cat-other"] || "", /^#[0-9a-f]{6}$/i, `--cat-other missing in ${mode}`);
    }
  });

  it("keeps adjacent categorical slots separable", () => {
    for (const [mode, set] of [["light", LIGHT], ["dark", DARK]]) {
      for (let i = 1; i < 8; i += 1) {
        const d = distance(set[`--cat-${i}`], set[`--cat-${i + 1}`]);
        assert.ok(d >= 60, `--cat-${i} vs --cat-${i + 1} in ${mode} is only ${d} apart`);
      }
    }
  });

  it("never repeats a slot within a mode", () => {
    for (const [mode, set] of [["light", LIGHT], ["dark", DARK]]) {
      const values = Array.from({ length: 8 }, (_, i) => set[`--cat-${i + 1}`].toLowerCase());
      assert.equal(new Set(values).size, 8, `${mode} categorical slots contain a duplicate`);
    }
  });
});

describe("status palette", () => {
  it("is defined and separate from the series slots", () => {
    for (const [mode, set] of [["light", LIGHT], ["dark", DARK]]) {
      for (const slot of ["--status-good", "--status-warning", "--status-critical"]) {
        assert.match(set[slot] || "", /^#[0-9a-f]{6}$/i, `${slot} missing in ${mode}`);
      }
      // Warning and critical must never read as "on track".
      assert.ok(distance(set["--status-good"], set["--status-critical"]) >= 80, `${mode}: good and critical too close`);
      assert.ok(distance(set["--status-warning"], set["--status-critical"]) >= 60, `${mode}: warning and critical too close`);
    }
  });
});

describe("viz.css load order", () => {
  it("is linked after styles.css and report.css", () => {
    const html = readFileSync(new URL("../site/dashboard/index.html", import.meta.url), "utf8");
    const at = (file) => html.indexOf(file);
    assert.ok(at("viz.css") > at("report.css"), "viz.css must load after report.css");
    assert.ok(at("report.css") > at("styles.css"), "report.css must load after styles.css");
  });

  it("has no inline script left in the dashboard shell, so the CSP can stay strict", () => {
    const html = readFileSync(new URL("../site/dashboard/index.html", import.meta.url), "utf8");
    const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
      .filter((m) => m[1].trim().length);
    assert.deepEqual(inline.map((m) => m[1].trim().slice(0, 40)), [], "inline script found");
    assert.equal(/\son(load|click|error|change)\s*=/.test(html), false, "inline event handler found");
  });
});
