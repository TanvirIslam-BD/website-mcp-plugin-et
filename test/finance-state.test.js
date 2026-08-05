import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FINANCE_SCHEMA_VERSION,
  amountToMinor,
  categoryCatalog,
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
  it("moves legacy JSON expenses into the expenses table exactly once", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", {
      expenses: [
        { id: "e1", date: "2026-08-01", category: "Food", description: "Lunch", amountMinor: 1500, currency: "BDT", merchant: "Cafe", paymentMethod: "bKash" },
        { id: "e2", date: "2026-08-02", category: "Travel", amountMinor: 500, currency: "BDT" },
      ],
    });

    const finance = await reconcileUserData(db, "u1");

    assert.equal(db.state.expenses.size, 2, "both legacy rows should be promoted");
    assert.equal(finance.expenses, undefined, "the duplicate JSON copy must be removed");
    assert.equal(finance.schemaVersion, FINANCE_SCHEMA_VERSION);
    // Metadata the expenses table has no column for is preserved where the
    // dashboard reads it from.
    assert.equal(finance.expenseMetadata.e1.merchant, "Cafe");
    assert.equal(finance.expenseMetadata.e1.paymentMethod, "bKash");
  });

  it("is a no-op on a second run", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { expenses: [{ id: "e1", date: "2026-08-01", amountMinor: 100, currency: "BDT", category: "Food" }] });
    await reconcileUserData(db, "u1");
    const countAfterFirst = db.state.statements.length;
    await reconcileUserData(db, "u1");
    assert.equal(db.state.expenses.size, 1);
    assert.equal(db.state.statements.length, countAfterFirst + 1, "only the version check should run");
  });

  it("skips malformed legacy rows rather than writing bad data", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", {
      expenses: [
        { id: "ok", date: "2026-08-01", amountMinor: 100, currency: "BDT", category: "Food" },
        { id: "no-date", amountMinor: 100, currency: "BDT" },
        { id: "bad-amount", date: "2026-08-01", amountMinor: -5 },
        { id: "bad-date", date: "not-a-date", amountMinor: 100 },
      ],
    });
    await reconcileUserData(db, "u1");
    assert.deepEqual([...db.state.expenses.keys()], ["ok"]);
  });

  it("converts epoch-millisecond createdAt values to ISO strings", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", {
      expenses: [{ id: "e1", date: "2026-08-01", amountMinor: 100, currency: "BDT", category: "Food", createdAt: 1785000000000 }],
    });
    await reconcileUserData(db, "u1");
    assert.equal(db.state.expenses.get("e1").createdAt, new Date(1785000000000).toISOString());
  });

  it("leaves a user with no stored data in a valid state", async () => {
    const db = createFakeDb();
    const finance = await reconcileUserData(db, "new-user");
    assert.equal(finance.schemaVersion, FINANCE_SCHEMA_VERSION);
    assert.deepEqual((await readFinanceState(db, "new-user")).finance.incomes, []);
  });
});
