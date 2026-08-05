import { mergeExpenseSources, readFinanceState } from "./_finance-state.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function validMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(days).padStart(2, "0")}`, days };
}

export function monthLabel(month) {
  if (!validMonth(month)) return month;
  const [year, monthNumber] = month.split("-").map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

export function formatMoney(minor, currency) {
  const value = Number(minor || 0) / 100;
  const prefix = currency === "BDT" ? "৳" : currency === "USD" ? "$" : `${currency} `;
  return `${value < 0 ? "-" : ""}${prefix}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * The one place a month's figures are derived from stored data.
 *
 * Anything that reports numbers to the user — the emailed report, the AI's
 * monthly summary — reads them from here rather than from a request body, so a
 * caller cannot dictate what the totals say.
 */
export async function monthlySummary(db, userId, month, fallbackCurrency = "BDT") {
  const targetMonth = validMonth(month) ? month : currentMonth();
  const { startDate, endDate } = monthRange(targetMonth);

  const [expenseResult, budgetResult, financeState] = await Promise.all([
    db.execute({
      sql: "SELECT id,date,category,description,amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC",
      args: [userId, startDate, endDate],
    }),
    db.execute({ sql: "SELECT category,amount_minor,currency FROM budgets WHERE user_id = ? ORDER BY created_at DESC", args: [userId] }),
    readFinanceState(db, userId),
  ]);

  const finance = financeState.finance;
  // Both stores, so a total never silently omits what the MCP server recorded.
  const expenses = mergeExpenseSources(expenseResult.rows, finance, { startDate, endDate })
    .map((expense) => ({ ...expense, category: expense.category || "uncategorized" }));

  const overallBudget = budgetResult.rows.find((row) => row.category === null);
  const preferredCurrency = typeof finance.settings?.currency === "string" && /^[A-Z]{3}$/.test(finance.settings.currency)
    ? finance.settings.currency
    : "";
  const currency = preferredCurrency
    || (overallBudget ? String(overallBudget.currency) : "")
    || expenses[0]?.currency
    || finance.currency
    || fallbackCurrency;

  const spentMinor = expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
  const incomes = (finance.incomes || []).filter((income) => String(income.date || "").slice(0, 7) === targetMonth);
  const incomeMinor = incomes.reduce((sum, income) => sum + Number(income.amountMinor || 0), 0);

  let budgetMinor = overallBudget ? Number(overallBudget.amount_minor || 0) : null;
  if (budgetMinor === null && finance.budgetMinor) budgetMinor = Number(finance.budgetMinor);

  const categoryTotals = expenses.reduce((totals, expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + expense.amountMinor;
    return totals;
  }, {});
  const categories = Object.entries(categoryTotals)
    .map(([category, amountMinor]) => ({ category, amountMinor }))
    .sort((a, b) => b.amountMinor - a.amountMinor);

  return {
    month: targetMonth,
    monthLabel: monthLabel(targetMonth),
    currency,
    expenseCount: expenses.length,
    spentMinor,
    incomeMinor,
    // Saved is only meaningful when income was recorded; never show a "saving"
    // that is really just an absence of income data.
    savedMinor: incomeMinor > 0 ? Math.max(0, incomeMinor - spentMinor) : 0,
    netCashFlowMinor: incomeMinor - spentMinor,
    budgetMinor: budgetMinor ?? null,
    remainingMinor: budgetMinor === null ? null : budgetMinor - spentMinor,
    usedPercent: budgetMinor ? Math.max(0, Math.round((spentMinor / budgetMinor) * 100)) : null,
    categories,
    largestExpenses: expenses.slice().sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 8),
  };
}
