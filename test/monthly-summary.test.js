import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney, monthLabel, monthRange, monthlySummary, validMonth } from "../site/api/_monthly-summary.js";
import { createFakeDb } from "./fake-db.js";

function seededDb() {
  const db = createFakeDb();
  db.seedFinance("u1", {
    schemaVersion: 2,
    settings: { currency: "BDT" },
    incomes: [
      { id: "i1", date: "2026-08-01", amountMinor: 500000, currency: "BDT" },
      { id: "i2", date: "2026-07-15", amountMinor: 900000, currency: "BDT" },
    ],
  });
  db.seedBudget("u1", { category: null, amountMinor: 400000, currency: "BDT" });
  db.seedExpense("u1", { id: "e1", date: "2026-08-02", category: "food", amountMinor: 150000 });
  db.seedExpense("u1", { id: "e2", date: "2026-08-03", category: "transport", amountMinor: 50000 });
  db.seedExpense("u1", { id: "e3", date: "2026-08-04", category: "food", amountMinor: 25000 });
  db.seedExpense("u1", { id: "old", date: "2026-07-20", category: "food", amountMinor: 999900 });
  return db;
}

describe("month helpers", () => {
  it("validates YYYY-MM", () => {
    for (const good of ["2026-01", "2026-12"]) assert.equal(validMonth(good), true);
    for (const bad of ["2026-00", "2026-13", "2026-1", "26-01", "", null, "2026-08-01"]) {
      assert.equal(validMonth(bad), false, `${bad} should be rejected`);
    }
  });

  it("computes an inclusive range covering the whole month", () => {
    assert.deepEqual(monthRange("2026-02"), { startDate: "2026-02-01", endDate: "2026-02-28", days: 28 });
    assert.deepEqual(monthRange("2028-02"), { startDate: "2028-02-01", endDate: "2028-02-29", days: 29 });
    assert.deepEqual(monthRange("2026-12"), { startDate: "2026-12-01", endDate: "2026-12-31", days: 31 });
  });

  it("labels months for display", () => {
    assert.equal(monthLabel("2026-08"), "August 2026");
    assert.equal(monthLabel("nope"), "nope");
  });

  it("formats minor units with the right symbol", () => {
    assert.equal(formatMoney(150000, "BDT"), "৳1,500.00");
    assert.equal(formatMoney(150000, "USD"), "$1,500.00");
    assert.equal(formatMoney(150000, "EUR"), "EUR 1,500.00");
    assert.equal(formatMoney(-2500, "USD"), "-$25.00");
    assert.equal(formatMoney(0, "USD"), "$0.00");
  });
});

describe("monthlySummary", () => {
  it("totals only the requested month", async () => {
    const summary = await monthlySummary(await seededDb(), "u1", "2026-08");
    assert.equal(summary.spentMinor, 225000, "July's expense must not be counted");
    assert.equal(summary.incomeMinor, 500000);
    assert.equal(summary.expenseCount, 3);
  });

  it("derives budget, remaining and used percentage from stored data", async () => {
    const summary = await monthlySummary(await seededDb(), "u1", "2026-08");
    assert.equal(summary.budgetMinor, 400000);
    assert.equal(summary.remainingMinor, 175000);
    assert.equal(summary.usedPercent, 56);
  });

  it("reports over-budget as a negative remaining", async () => {
    const db = seededDb();
    db.seedExpense("u1", { id: "big", date: "2026-08-05", category: "shopping", amountMinor: 300000 });
    const summary = await monthlySummary(db, "u1", "2026-08");
    assert.equal(summary.remainingMinor, -125000);
    assert.ok(summary.usedPercent > 100);
  });

  it("groups categories and orders them by spend", async () => {
    const summary = await monthlySummary(await seededDb(), "u1", "2026-08");
    assert.deepEqual(summary.categories, [
      { category: "food", amountMinor: 175000 },
      { category: "transport", amountMinor: 50000 },
    ]);
  });

  it("computes saved as income minus spend, never negative", async () => {
    const summary = await monthlySummary(await seededDb(), "u1", "2026-08");
    assert.equal(summary.savedMinor, 275000);
    assert.equal(summary.netCashFlowMinor, 275000);

    const db = seededDb();
    db.seedExpense("u1", { id: "huge", date: "2026-08-06", category: "rent", amountMinor: 900000 });
    const overspent = await monthlySummary(db, "u1", "2026-08");
    assert.equal(overspent.savedMinor, 0, "overspending is not negative saving");
    assert.ok(overspent.netCashFlowMinor < 0, "net cash flow still shows the shortfall");
  });

  it("reports no saving when no income was recorded", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { schemaVersion: 2, incomes: [] });
    db.seedExpense("u1", { id: "e1", date: "2026-08-01", amountMinor: 1000 });
    const summary = await monthlySummary(db, "u1", "2026-08");
    assert.equal(summary.savedMinor, 0, "absent income must not read as saving");
  });

  it("returns null budget fields when no budget is set", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { schemaVersion: 2 });
    db.seedExpense("u1", { id: "e1", date: "2026-08-01", amountMinor: 1000 });
    const summary = await monthlySummary(db, "u1", "2026-08");
    assert.equal(summary.budgetMinor, null);
    assert.equal(summary.remainingMinor, null);
    assert.equal(summary.usedPercent, null);
  });

  it("prefers the user's saved currency preference", async () => {
    const db = createFakeDb();
    db.seedFinance("u1", { schemaVersion: 2, settings: { currency: "USD" } });
    db.seedExpense("u1", { id: "e1", date: "2026-08-01", amountMinor: 1000, currency: "BDT" });
    assert.equal((await monthlySummary(db, "u1", "2026-08")).currency, "USD");
  });

  it("falls back to the current month for an invalid month", async () => {
    const summary = await monthlySummary(createFakeDb(), "u1", "not-a-month");
    assert.equal(validMonth(summary.month), true);
  });

  it("is empty but well-formed for a user with no data", async () => {
    const summary = await monthlySummary(createFakeDb(), "u1", "2026-08");
    assert.equal(summary.spentMinor, 0);
    assert.equal(summary.expenseCount, 0);
    assert.deepEqual(summary.categories, []);
    assert.equal(summary.monthLabel, "August 2026");
  });
});
