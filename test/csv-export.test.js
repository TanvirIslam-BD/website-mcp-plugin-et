import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

// csvCell is internal to the handler, which cannot be imported without the
// libSQL client present, so the implementation is extracted and evaluated here.
// If the source shape changes, this test fails loudly rather than silently
// checking nothing.
function loadCsvCell() {
  const source = readFileSync(new URL("../site/api/dashboard.js", import.meta.url), "utf8");
  const match = source.match(/function csvCell\(value\) \{[\s\S]*?\n\}/);
  assert.ok(match, "csvCell could not be located in dashboard.js");
  // eslint-disable-next-line no-new-func
  return new Function(`${match[0]}; return csvCell;`)();
}

describe("CSV export cell encoding", () => {
  const csvCell = loadCsvCell();

  it("neutralizes values a spreadsheet would execute as a formula", () => {
    for (const hostile of ['=HYPERLINK("http://evil.example","x")', "+1+1", "-2+3", "@SUM(A1)", "=cmd|calc"]) {
      const encoded = csvCell(hostile);
      const firstCharacter = encoded.startsWith('"') ? encoded[1] : encoded[0];
      assert.equal(firstCharacter, "'", `expected ${hostile} to be prefixed, got ${encoded}`);
    }
  });

  it("still quotes and escapes embedded quotes, commas and newlines", () => {
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("a,b"), '"a,b"');
    assert.equal(csvCell("line1\r\nline2"), '"line1\r\nline2"');
  });

  it("leaves ordinary values untouched", () => {
    assert.equal(csvCell("Groceries"), "Groceries");
    assert.equal(csvCell("12.50"), "12.50");
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });
});
