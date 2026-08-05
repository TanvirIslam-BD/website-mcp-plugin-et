/**
 * Minimal in-memory stand-in for the libSQL client, matching only the handful of
 * statement shapes the finance-state helpers issue. Enough to exercise the
 * compare-and-swap and migration logic without a real database.
 */
export function createFakeDb() {
  const state = {
    financeState: new Map(), // userId -> { data, updated_at }
    expenses: new Map(),     // id -> row
    budgets: [],             // rows, newest first
    statements: [],
    // Test hook: runs before each write, e.g. to simulate a concurrent update.
    beforeWrite: null,
  };

  function run({ sql, args = [] }) {
    state.statements.push(sql.trim().split(/\s+/).slice(0, 4).join(" "));

    if (/^SELECT .*FROM expenses WHERE user_id = \? AND date >= \? AND date <= \?/.test(sql)) {
      const [userId, from, to] = args;
      const rows = [...state.expenses.values()]
        .filter((row) => row.userId === userId && row.date >= from && row.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((row) => ({
          id: row.id, date: row.date, category: row.category, description: row.description,
          amount_minor: row.amountMinor, currency: row.currency, created_at: row.createdAt,
        }));
      return { rows, rowsAffected: 0 };
    }

    if (/^SELECT .*FROM budgets WHERE user_id = \?/.test(sql)) {
      const rows = state.budgets
        .filter((row) => row.userId === args[0])
        .map((row) => ({ category: row.category, amount_minor: row.amountMinor, currency: row.currency, period: "monthly" }));
      return { rows, rowsAffected: 0 };
    }

    if (/^SELECT data,updated_at FROM finance_state/.test(sql)) {
      const row = state.financeState.get(args[0]);
      return { rows: row ? [{ data: row.data, updated_at: row.updated_at }] : [], rowsAffected: 0 };
    }

    if (/^INSERT INTO finance_state/.test(sql)) {
      const [userId, data, updatedAt] = args;
      if (state.financeState.has(userId)) return { rows: [], rowsAffected: 0 };
      state.financeState.set(userId, { data, updated_at: updatedAt });
      return { rows: [], rowsAffected: 1 };
    }

    if (/^UPDATE finance_state SET data/.test(sql)) {
      const [data, updatedAt, userId, expected] = args;
      const row = state.financeState.get(userId);
      if (!row || row.updated_at !== expected) return { rows: [], rowsAffected: 0 };
      state.financeState.set(userId, { data, updated_at: updatedAt });
      return { rows: [], rowsAffected: 1 };
    }

    if (/^UPDATE (expenses|budgets|finance_state) SET (created_at|updated_at)/.test(sql)) {
      return { rows: [], rowsAffected: 0 }; // timestamp normalization: no-op here
    }

    if (/^INSERT OR IGNORE INTO expenses/.test(sql)) {
      const [id, userId, amountMinor, currency, category, description, date, createdAt] = args;
      if (!state.expenses.has(id)) {
        state.expenses.set(id, { id, userId, amountMinor, currency, category, description, date, createdAt });
      }
      return { rows: [], rowsAffected: 1 };
    }

    throw new Error(`fake-db: unhandled statement: ${sql}`);
  }

  return {
    state,
    async execute(statement) {
      if (state.beforeWrite && !/^SELECT/.test(statement.sql.trim())) await state.beforeWrite();
      return run(statement);
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        results.push(run(typeof statement === "string" ? { sql: statement } : statement));
      }
      return results;
    },
    seedFinance(userId, finance, updatedAt = "2026-01-01T00:00:00.000Z") {
      state.financeState.set(userId, { data: JSON.stringify(finance), updated_at: updatedAt });
    },
    seedExpense(userId, { id, date, category = "food", description = "", amountMinor, currency = "BDT", createdAt = "2026-01-01T00:00:00.000Z" }) {
      state.expenses.set(id, { id, userId, date, category, description, amountMinor, currency, createdAt });
    },
    seedBudget(userId, { category = null, amountMinor, currency = "BDT" }) {
      state.budgets.unshift({ userId, category, amountMinor, currency });
    },
    readFinance(userId) {
      const row = state.financeState.get(userId);
      return row ? JSON.parse(row.data) : null;
    },
  };
}
