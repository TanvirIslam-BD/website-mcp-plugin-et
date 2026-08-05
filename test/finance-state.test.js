import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINANCE_SCHEMA_VERSION,
  amountToMinor,
  categoryCatalog,
  mergeExpenseSources,
  mutateFinanceState,
  readFinanceState,
  reconcileUserData,
  replaceBudgetStatements,
  safeFinance,
} from "../site/api/_finance-state.js";
import { createFakeDb } from "./fake-db.js";

describe("amountToMinor", () => {
  it("accepts well-formed amounts", () => {
    assert.equal(amountToMinor(12), 1200);
    assert.equal(amountToMinor("12.34"), 1234);
    assert.equal(amountToMinor("1,250.50"), 125050);
    assert.equal(amountToMinor(0.01), 1);
  });

  it("rejects values that must never reach the database", () => {
    for (const value of [0, -5, "abc", "", null, undefined, NaN, Infinity, -Infinity, "12.345", "1e9", {}, []]) {
      assert.equal(amountToMinor(value), null, `expected ${String(value)} to be rejected`);
    }
  });

  it("rejects amounts beyond the safe ceiling", () => {
    assert.equal(amountToMinor(1e12), null);
    assert.equal(amountToMinor(Number.MAX_VALUE), null);
  });
});

describe("safeFinance", () => {
  it("falls back to defaults for unusable input", () => {
    for (const value of [null, "", "not json", "[]", "42", '"text"']) {
      const finance = safeFinance(value);
      assert.deepEqual(finance.incomes, []);
      assert.deepEqual(finance.alertThresholds, [50, 80, 100]);
    }
  });

  it("keeps stored fields and fills in missing defaults", () => {
    const finance = safeFinance(JSON.stringify({ incomes: [{ id: "a" }] }));
    assert.equal(finance.incomes.length, 1);
    assert.deepEqual(finance.goals, []);
  });
});

describe("categoryCatalog", () => {
  it("lowercases, de-duplicates and drops blanks", () => {
    const catalog = categoryCatalog([{ name: "Food" }, { name: "food" }, { name: "" }, "Travel"]);
    assert.deepEqual(catalog.map((item) => item.name), ["food", "travel"]);
  });

  it("de-duplicates subcategories", () => {
    const [group] = categoryCatalog([{ name: "food", subcategories: ["Fruit", "Fruit", ""] }]);
    assert.deepEqual(group.subcategories, ["Fruit"]);
  });

  it("returns an empty array for non-arrays", () => {
    assert.deepEqual(categoryCatalog(undefined), []);
    assert.deepEqual(categoryCatalog({ name: "x" }), []);
  });
});

describe("replaceBudgetStatements", () => {
  it("deletes the previous row before inserting, so budgets do not accumulate", () => {
    const [remove, insert] = replaceBudgetStatements({
      id: "b1", userId: "u1", category: null, amountMinor: 5000, currency: "BDT", createdAt: "2026-08-01T00:00:00.000Z",
    });
    assert.match(remove.sql, /^DELETE FROM budgets/);
    // `IS` rather than `=` so the overall (NULL category) budget matches.
    assert.match(remove.sql, /category IS \?/);
    assert.match(insert.sql, /^INSERT INTO budgets/);
    assert.equal(insert.args.at(-1), "2026-08-01T00:00:00.000Z", "created_at must be an ISO string");
  });
});

describe("mutateFinanceState", () => {
  it("creates the row when none exists", async () => {
    const db = createFakeDb();
    await mutateFinanceState(db, "u1", (finance) => {
      finance.goals = [{ id: "g1" }];
      return finance;
    });
    assert.equal(db.readFinance("u1").goals.length, 1);
  });

  it("applies sequential mutations without losing data", async () => {
    const db = createFakeDb();
    await mutateFinanceState(db, "u1", (f) => { f.incomes.push({ id: "i1" }); return f; });
    await mutateFinanceState(db, "u1", (f) => { f.goals.push({ id: "g1" }); return f; });
    const finance = db.readFinance("u1");
    assert.equal(finance.incomes.length, 1);
    assert.equal(finance.goals.length, 1);
  });

  it("retries instead of clobbering a concurrent write", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { incomes: [], goals: [] });

    let interfered = false;
    db.state.beforeWrite = async () => {
      if (interfered) return;
      interfered = true;
      // Simulate another request committing first, invalidating our read.
      db.seedFinance("u1", { incomes: [{ id: "other" }], goals: [] }, "2026-02-02T00:00:00.000Z");
    };

    await mutateFinanceState(db, "u1", (finance) => {
      finance.goals.push({ id: "mine" });
      return finance;
    });

    const finance = db.readFinance("u1");
    assert.equal(finance.goals.length, 1, "our change must land");
    assert.equal(finance.incomes.length, 1, "the concurrent change must survive");
    assert.equal(finance.incomes[0].id, "other");
  });

  it("updates a legacy row whose updated_at is NULL", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { incomes: [] }, null);
    await mutateFinanceState(db, "u1", (finance) => {
      finance.goals.push({ id: "g1" });
      return finance;
    });
    assert.equal(db.readFinance("u1").goals.length, 1);
  });

  it("gives up with a clear error when contention never clears", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { incomes: [] });
    let counter = 0;
    db.state.beforeWrite = async () => {
      counter += 1;
      db.seedFinance("u1", { incomes: [] }, `2026-03-0${(counter % 9) + 1}T00:00:00.000Z`);
    };
    await assert.rejects(
      () => mutateFinanceState(db, "u1", (f) => f, { retries: 2 }),
      /another update landed first/,
    );
  });
});

describe("reconcileUserData", () => {
  it("does NOT delete the JSON expense array", async () => {
    // The regression this guards: an earlier migration moved these rows into the
    // table and deleted the array, on the assumption it was a stale duplicate. The
    // MCP server writes there too, so deleting it hid live transactions.
    const db = createFakeDb();
    db.seedFinance("u1", {
      expenses: [{ id: "e1", date: "2026-08-01", category: "food", amountMinor: 5000, currency: "BDT" }],
    });

    const finance = await reconcileUserData(db, "u1");

    assert.equal(Array.isArray(finance.expenses), true, "the JSON array must survive the migration");
    assert.equal(finance.expenses.length, 1);
    assert.equal(db.state.expenses.size, 0, "nothing should be copied into the table");
    assert.equal(finance.schemaVersion, FINANCE_SCHEMA_VERSION);
  });

  it("is a no-op on a second run", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { expenses: [] });
    await reconcileUserData(db, "u1");
    const after = db.state.statements.length;
    await reconcileUserData(db, "u1");
    assert.equal(db.state.statements.length, after + 1, "only the version check should run");
  });

  it("leaves a user with no stored data in a valid state", async () => {
    const db = createFakeDb();
    const finance = await reconcileUserData(db, "new-user");
    assert.equal(finance.schemaVersion, FINANCE_SCHEMA_VERSION);
    assert.deepEqual((await readFinanceState(db, "new-user")).finance.incomes, []);
  });
});

describe("mergeExpenseSources", () => {
  const row = (id, date, category, amountMinor) => ({ id, date, category, amount_minor: amountMinor, description: "", currency: "BDT" });
  const entry = (id, date, category, amountMinor) => ({ id, date, category, amountMinor, currency: "BDT" });

  it("returns expenses from both stores", () => {
    const merged = mergeExpenseSources(
      [row("t1", "2026-08-02", "food", 1000)],
      { expenses: [entry("j1", "2026-08-03", "transport", 2000)] },
    );
    assert.deepEqual(merged.map((e) => e.id), ["j1", "t1"], "newest first, both sources present");
  });

  it("makes an MCP-written JSON expense visible", () => {
    // The exact user-visible symptom: "record an expense of 50 BDT for food"
    // succeeded, but the dashboard total never moved.
    const merged = mergeExpenseSources([], { expenses: [entry("mcp-1", "2026-08-06", "food", 5000)] });
    assert.equal(merged.length, 1);
    assert.equal(merged[0].amountMinor, 5000);
    assert.equal(merged[0].category, "food");
  });

  it("counts an expense present in both stores exactly once", () => {
    const merged = mergeExpenseSources(
      [row("same", "2026-08-02", "food", 1000)],
      { expenses: [entry("same", "2026-08-02", "food", 1000)] },
    );
    assert.equal(merged.length, 1);
  });

  it("de-duplicates by date/amount/category when an id is missing", () => {
    const merged = mergeExpenseSources(
      [{ id: null, date: "2026-08-02", category: "food", amount_minor: 1000, currency: "BDT", description: "" }],
      { expenses: [{ date: "2026-08-02", category: "food", amountMinor: 1000, currency: "BDT" }] },
    );
    assert.equal(merged.length, 1);
  });

  it("honours the date range and category filters on the JSON side", () => {
    const finance = {
      expenses: [
        entry("in", "2026-08-15", "food", 1000),
        entry("early", "2026-07-31", "food", 1000),
        entry("late", "2026-09-01", "food", 1000),
        entry("other", "2026-08-16", "transport", 1000),
      ],
    };
    const merged = mergeExpenseSources([], finance, { startDate: "2026-08-01", endDate: "2026-08-31", category: "food" });
    assert.deepEqual(merged.map((e) => e.id), ["in"]);
  });

  it("ignores malformed JSON entries", () => {
    const merged = mergeExpenseSources([], {
      expenses: [
        entry("ok", "2026-08-02", "food", 1000),
        entry("no-date", "", "food", 1000),
        entry("bad-date", "not-a-date", "food", 1000),
        entry("zero", "2026-08-02", "food", 0),
        entry("negative", "2026-08-02", "food", -500),
      ],
    });
    assert.deepEqual(merged.map((e) => e.id), ["ok"]);
  });

  it("falls back to the document currency when an entry omits one", () => {
    const merged = mergeExpenseSources([], { currency: "USD", expenses: [{ id: "x", date: "2026-08-02", category: "food", amountMinor: 100 }] });
    assert.equal(merged[0].currency, "USD");
  });

  it("copes with absent or empty inputs", () => {
    assert.deepEqual(mergeExpenseSources([], {}), []);
    assert.deepEqual(mergeExpenseSources(undefined, undefined), []);
  });
});
