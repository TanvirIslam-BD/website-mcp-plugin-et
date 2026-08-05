// v3 normalizes every timestamp to an ISO string. (v2 additionally moved expenses
// out of the JSON document, which was wrong — the MCP server writes there too.)
export const FINANCE_SCHEMA_VERSION = 3;

// Epoch-millisecond timestamps are all digits; ISO strings always contain "-".
function numericTimestamp(column) {
  return `(typeof(${column}) IN ('integer','real') OR (${column} NOT GLOB '*[^0-9]*' AND length(${column}) >= 10))`;
}

function isoFrom(column) {
  return `strftime('%Y-%m-%dT%H:%M:%fZ', CAST(${column} AS INTEGER) / 1000.0, 'unixepoch')`;
}

export function defaultFinance() {
  return {
    incomes: [],
    recurring: [],
    budgetRules: [],
    categories: [],
    templates: [],
    categoryCatalog: [],
    alertThresholds: [50, 80, 100],
    expenseMetadata: {},
    goals: [],
    settings: {},
  };
}

export function safeFinance(value) {
  if (!value) return defaultFinance();
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...defaultFinance(), ...parsed }
      : defaultFinance();
  } catch {
    return defaultFinance();
  }
}

export function cleanText(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function categoryCatalog(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.reduce((catalog, item) => {
    const name = cleanText(item?.name ?? item, 60).toLowerCase();
    if (!name || seen.has(name)) return catalog;
    seen.add(name);
    const subcategories = Array.isArray(item?.subcategories)
      ? [...new Set(item.subcategories.map((sub) => cleanText(sub, 80)).filter(Boolean))]
      : [];
    catalog.push({ name, subcategories });
    return catalog;
  }, []);
}

// Rejects non-finite, negative, and absurdly large amounts before they reach
// the database. Shared by the dashboard forms and the AI tool calls.
export function amountToMinor(value) {
  const raw = typeof value === "number" ? String(value) : cleanText(value, 32).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const minor = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100000000000 ? minor : null;
}

export async function readFinanceState(db, userId) {
  const result = await db.execute({ sql: "SELECT data,updated_at FROM finance_state WHERE user_id = ?", args: [userId] });
  const row = result.rows[0];
  return {
    finance: safeFinance(row?.data),
    // `exists` is tracked separately because a legacy row may store a NULL
    // updated_at, which must still be matched by the compare-and-swap.
    exists: Boolean(row),
    updatedAt: row ? (row.updated_at ?? null) : null,
  };
}

async function writeFinanceState(db, userId, finance, { exists, updatedAt }) {
  const data = JSON.stringify(finance);
  let now = new Date().toISOString();
  // Guarantees the stored value changes, so a concurrent writer's
  // compare-and-swap cannot match a stale timestamp.
  if (now === updatedAt) now = new Date(Date.now() + 1).toISOString();

  if (!exists) {
    const inserted = await db.execute({
      sql: "INSERT INTO finance_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING",
      args: [userId, data, now],
    });
    return Number(inserted.rowsAffected || 0) > 0;
  }
  // `IS` rather than `=` so a NULL updated_at compares correctly.
  const updated = await db.execute({
    sql: "UPDATE finance_state SET data = ?, updated_at = ? WHERE user_id = ? AND updated_at IS ?",
    args: [data, now, userId, updatedAt],
  });
  return Number(updated.rowsAffected || 0) > 0;
}

/**
 * Reads the finance blob, applies `mutator`, and writes it back only if nobody
 * else changed it meanwhile. The mutator may run more than once, so it must be
 * safe to retry.
 */
export async function mutateFinanceState(db, userId, mutator, { retries = 4 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const state = await readFinanceState(db, userId);
    const next = (await mutator(state.finance)) || state.finance;
    if (await writeFinanceState(db, userId, next, state)) return next;
  }
  throw new Error("Could not save your changes because another update landed first. Please retry.");
}

// Best-effort: this is housekeeping, so a failure here must not block the
// request that triggered it.
async function normalizeTimestamps(db, userId) {
  try {
    await db.batch([
      { sql: `UPDATE expenses SET created_at = ${isoFrom("created_at")} WHERE user_id = ? AND ${numericTimestamp("created_at")}`, args: [userId] },
      { sql: `UPDATE budgets SET created_at = ${isoFrom("created_at")} WHERE user_id = ? AND ${numericTimestamp("created_at")}`, args: [userId] },
      { sql: `UPDATE finance_state SET updated_at = ${isoFrom("updated_at")} WHERE user_id = ? AND ${numericTimestamp("updated_at")}`, args: [userId] },
    ], "write");
  } catch (error) {
    console.error("timestamp normalization skipped", error);
  }
}

/**
 * Reads of a month's expenses must consider BOTH stores.
 *
 * The `expenses` table and `finance_state.expenses` are not a table plus a stale
 * duplicate: the MCP server owns this schema (nothing here creates those tables)
 * and writes through its own path, so an expense recorded by a connected AI
 * client can land in the JSON document rather than the table. Reading only the
 * table made those transactions invisible on the dashboard.
 *
 * De-duplication is by id, falling back to a date/amount/category signature for
 * entries written without one.
 */
export function mergeExpenseSources(sqlRows, finance, { startDate, endDate, category } = {}) {
  const fallbackCurrency = cleanText(finance?.currency, 3).toUpperCase() || "BDT";
  const wanted = category ? String(category).toLowerCase() : "";

  const fromTable = (sqlRows || []).map((row) => ({
    id: row.id == null ? "" : String(row.id),
    date: String(row.date || ""),
    category: String(row.category || ""),
    description: String(row.description || ""),
    amountMinor: Number(row.amount_minor || 0),
    currency: String(row.currency || "") || fallbackCurrency,
  }));

  const fromDocument = (Array.isArray(finance?.expenses) ? finance.expenses : [])
    .map((entry) => ({
      id: entry?.id == null ? "" : String(entry.id),
      date: String(entry?.date || ""),
      category: String(entry?.category || ""),
      description: String(entry?.description || ""),
      amountMinor: Number(entry?.amountMinor || 0),
      currency: cleanText(entry?.currency, 3).toUpperCase() || fallbackCurrency,
    }))
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.amountMinor > 0)
    .filter((entry) => (!startDate || entry.date >= startDate) && (!endDate || entry.date <= endDate))
    .filter((entry) => !wanted || entry.category.toLowerCase() === wanted);

  const seen = new Map();
  for (const expense of [...fromTable, ...fromDocument]) {
    const key = expense.id || `${expense.date}-${expense.amountMinor}-${expense.category.toLowerCase()}`;
    if (!seen.has(key)) seen.set(key, expense);
  }
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Brings a user's stored data up to FINANCE_SCHEMA_VERSION. Costs nothing once
 * done: the version marker lives in the blob the callers already read.
 *
 * Deliberately non-destructive. An earlier version of this migration moved
 * `finance.expenses` into the table and deleted the array, on the assumption it
 * was a legacy duplicate. It is not — see mergeExpenseSources — so the migration
 * now only normalizes timestamps and leaves both stores intact.
 */
export async function reconcileUserData(db, userId) {
  const { finance } = await readFinanceState(db, userId);
  if (Number(finance.schemaVersion) >= FINANCE_SCHEMA_VERSION) return finance;
  await normalizeTimestamps(db, userId);
  return mutateFinanceState(db, userId, (current) => {
    current.schemaVersion = FINANCE_SCHEMA_VERSION;
    return current;
  });
}

/** Replaces a budget row instead of stacking a new one on every save. */
export function replaceBudgetStatements({ id, userId, category, amountMinor, currency, period = "monthly", createdAt }) {
  return [
    { sql: "DELETE FROM budgets WHERE user_id = ? AND category IS ?", args: [userId, category] },
    {
      sql: "INSERT INTO budgets (id,user_id,category,amount_minor,currency,period,created_at) VALUES (?,?,?,?,?,?,?)",
      args: [id, userId, category, amountMinor, currency, period, createdAt],
    },
  ];
}
