import { createClient } from "@libsql/client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { ensureMonitoringTables, recordActivity, userControl } from "./_monitoring.js";

const DASHBOARD_COOKIE = "expense_tracker_dashboard";
const COMET_BASE_URL = "https://api.cometapi.com/v1";
// CometAPI's available model identifiers are provider-normalized. Keep these
// defaults aligned with its /v1/models catalogue, while env vars can override.
const FAST_MODEL = process.env.FAST_MODEL || "gemini-2.5-flash-lite";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "gemini-2.5-flash";
const ADVANCED_MODEL = process.env.ADVANCED_MODEL || "deepseek-v3.2";
const PREMIUM_MODEL = process.env.PREMIUM_MODEL || "kimi-k2.5";
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 18;
const CACHE_TTL_MS = 5 * 60_000;
const MCP_ENDPOINT = "https://expense-tracker-mcp.mcpize.run/mcp";
const rateLimits = new Map();
const responseCache = new Map();
const mcpCatalogCache = new Map();

function verifyDashboardToken(token) {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!token || !secret) return null;
  const [payload, received, ...extra] = token.split(".");
  if (!payload || !received || extra.length) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof session.u !== "string" || !session.u || Number(session.e) <= Date.now()) return null;
    return { userId: session.u, mcpAccessToken: typeof session.mt === "string" ? session.mt : "" };
  } catch {
    return null;
  }
}

function cookieValue(req, name) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
}

function safeText(value, limit = 2000) {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, limit) : "";
}

function safeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).map((entry) => ({
    role: entry?.role === "assistant" ? "assistant" : "user",
    content: safeText(entry?.content, 900),
  })).filter((entry) => entry.content);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function validMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(days).padStart(2, "0")}` };
}

function decodeFinance(value) {
  try { return JSON.parse(String(value || "{}")); } catch { return {}; }
}

function selectModel(message) {
  // Always use the default Gemini Flash model and let it choose tools dynamically
  return { model: DEFAULT_MODEL, tier: "standard" };
}

function checkRateLimit(userId) {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now - entry.startedAt >= RATE_WINDOW_MS) {
    rateLimits.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_REQUESTS_PER_WINDOW;
}

function toolDefinitions() {
  return [
    { type: "function", function: { name: "get_latest_expense", description: "Retrieve the authenticated user's single most recent expense across all dates. Always use this for latest expense, last expense, or most recent transaction questions.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
    { type: "function", function: { name: "get_expenses", description: "Retrieve the authenticated user's expenses for a date range and optional category. If the user gives no date, use the dashboard month supplied in the system context.", parameters: { type: "object", properties: { startDate: { type: "string", description: "YYYY-MM-DD" }, endDate: { type: "string", description: "YYYY-MM-DD" }, category: { type: "string" } }, additionalProperties: false } } },
    { type: "function", function: { name: "add_expense", description: "Record a new expense transaction for the user. Use whenever user asks to add, record, save, or spent an expense (e.g., 'Add 500 bus rent expense', 'spent 50 on coffee').", parameters: { type: "object", properties: { amount: { type: "number", description: "Expense amount e.g. 500" }, category: { type: "string", description: "Expense category e.g. Travel, Food, Transport, Rent" }, date: { type: "string", description: "YYYY-MM-DD" }, merchant: { type: "string" }, description: { type: "string" }, paymentMethod: { type: "string" }, currency: { type: "string" } }, required: ["amount"], additionalProperties: false } } },
    { type: "function", function: { name: "get_incomes", description: "Retrieve recorded income entries for a date range.", parameters: { type: "object", properties: { startDate: { type: "string", description: "YYYY-MM-DD" }, endDate: { type: "string", description: "YYYY-MM-DD" } }, additionalProperties: false } } },
    { type: "function", function: { name: "add_income", description: "Record a new income entry for the user. Use whenever user asks to add or record income.", parameters: { type: "object", properties: { amount: { type: "number", description: "Income amount" }, source: { type: "string", description: "Source of income e.g. Salary, Freelance" }, date: { type: "string", description: "YYYY-MM-DD" }, description: { type: "string" }, currency: { type: "string" } }, required: ["amount", "source"], additionalProperties: false } } },
    { type: "function", function: { name: "get_budget_status", description: "Retrieve the authenticated user's overall budget, spending, remaining amount, and category limits for the dashboard month.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
    { type: "function", function: { name: "set_budget", description: "Set or update monthly budget limits for overall account or specific category. Use whenever user asks to set or change a budget.", parameters: { type: "object", properties: { amount: { type: "number", description: "Monthly limit amount" }, category: { type: "string", description: "Optional category name" }, currency: { type: "string" } }, required: ["amount"], additionalProperties: false } } },
    { type: "function", function: { name: "get_goals", description: "Retrieve savings goals and targets.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
    { type: "function", function: { name: "add_goal", description: "Create or update a primary savings goal.", parameters: { type: "object", properties: { name: { type: "string" }, target: { type: "number" }, currency: { type: "string" } }, required: ["name", "target"], additionalProperties: false } } },
    { type: "function", function: { name: "get_recurring_expenses", description: "Retrieve upcoming recurring bills and subscriptions.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
    { type: "function", function: { name: "add_recurring_expense", description: "Add a recurring bill or subscription.", parameters: { type: "object", properties: { merchant: { type: "string" }, amount: { type: "number" }, category: { type: "string" }, frequency: { type: "string" }, nextDate: { type: "string", description: "YYYY-MM-DD" }, currency: { type: "string" } }, required: ["merchant", "amount"], additionalProperties: false } } },
    { type: "function", function: { name: "generate_monthly_report", description: "Generate a verified report for one calendar month. Use when the user asks for a monthly summary, report, or category breakdown.", parameters: { type: "object", properties: { month: { type: "string", description: "YYYY-MM" } }, required: ["month"], additionalProperties: false } } },
  ];
}

async function callMcp(accessToken, method, params = {}) {
  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: randomUUID(), method, params }),
  });
  const raw = await response.text();
  let body = {};
  try { body = JSON.parse(raw); } catch {
    const data = raw.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
    try { body = data ? JSON.parse(data) : {}; } catch { body = {}; }
  }
  if (!response.ok || body?.error) throw new Error(body?.error?.message || `MCPize ${method} failed (${response.status}).`);
  return body?.result ?? body;
}

async function mcpToolDefinitions(accessToken) {
  const key = createHmac("sha256", "mcp-tool-catalog").update(accessToken).digest("hex");
  const cached = mcpCatalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const result = await callMcp(accessToken, "tools/list");
  const value = (result?.tools || []).map((tool) => ({
    type: "function",
    function: {
      name: safeText(tool.name, 64),
      description: safeText(tool.description || tool.title || `Run ${tool.name}`, 1200),
      parameters: tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object", properties: {} },
    },
  })).filter((tool) => tool.function.name);
  mcpCatalogCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

async function runMcpTool(accessToken, name, input) {
  const result = await callMcp(accessToken, "tools/call", { name, arguments: input });
  return result?.structuredContent || result?.content || result;
}

async function getLatestExpense(db, userId) {
  const [sqlResult, financeResult] = await Promise.all([
    db.execute({
      sql: "SELECT id,date,category,description,amount_minor,currency FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 1",
      args: [userId],
    }),
    db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] })
  ]);
  const row = sqlResult.rows[0];
  const finance = decodeFinance(financeResult.rows[0]?.data);
  const jsonLatest = (finance.expenses || [])[0];

  if (!row && !jsonLatest) return { expense: null };
  if (jsonLatest && (!row || jsonLatest.date >= row.date)) {
    return {
      expense: {
        id: jsonLatest.id,
        date: jsonLatest.date,
        category: jsonLatest.category,
        description: jsonLatest.description,
        amount: Number(jsonLatest.amountMinor || 0) / 100,
        currency: jsonLatest.currency || finance.currency || "BDT",
      }
    };
  }

  return {
    expense: {
      id: row.id,
      date: row.date,
      category: row.category,
      description: row.description,
      amount: Number(row.amount_minor || 0) / 100,
      currency: row.currency,
    },
  };
}

async function getExpenses(db, userId, input, dashboardMonth) {
  const fallbackRange = monthRange(dashboardMonth);
  const currentMonthRange = monthRange(new Date().toISOString().slice(0, 7));
  const startDate = validDate(input.startDate) ? input.startDate : (fallbackRange.startDate < currentMonthRange.startDate ? fallbackRange.startDate : currentMonthRange.startDate);
  const endDate = validDate(input.endDate) ? input.endDate : (fallbackRange.endDate > currentMonthRange.endDate ? fallbackRange.endDate : currentMonthRange.endDate);

  const category = safeText(input.category, 60).toLowerCase();

  const [sqlResult, financeResult] = await Promise.all([
    db.execute({
      sql: `SELECT id,date,category,description,amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?${category ? " AND lower(category) = ?" : ""} ORDER BY date DESC, created_at DESC LIMIT 250`,
      args: category ? [userId, startDate, endDate, category] : [userId, startDate, endDate]
    }),
    db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] })
  ]);

  const finance = decodeFinance(financeResult.rows[0]?.data);
  const sqlExpenses = sqlResult.rows.map((row) => ({ id: row.id, date: row.date, category: row.category, description: row.description, amount: Number(row.amount_minor || 0) / 100, currency: row.currency }));
  
  const jsonExpenses = (finance.expenses || [])
    .filter(e => e.date >= startDate && e.date <= endDate)
    .filter(e => !category || String(e.category || "").toLowerCase() === category)
    .map(e => ({ id: e.id, date: e.date, category: e.category, description: e.description, amount: Number(e.amountMinor || 0) / 100, currency: e.currency || finance.currency || "BDT" }));

  const map = new Map();
  [...sqlExpenses, ...jsonExpenses].forEach(e => {
    if (!map.has(e.id || `${e.date}-${e.amount}-${e.category}`)) {
      map.set(e.id || `${e.date}-${e.amount}-${e.category}`, e);
    }
  });

  const expenses = Array.from(map.values()).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    startDate,
    endDate,
    category: category || null,
    count: expenses.length,
    total,
    currency: expenses[0]?.currency || finance.currency || "BDT",
    expenses
  };
}

async function addExpense(db, userId, input, dashboardMonth) {
  const amount = Number(input.amount || 0);
  if (amount <= 0) return { error: "Expense amount must be greater than 0" };
  const date = validDate(input.date) ? input.date : new Date().toISOString().slice(0, 10);
  const description = safeText(input.description || input.merchant || input.category || "Expense", 200);
  let category = safeText(input.category || "", 60);

  if (!category || category.toLowerCase() === "general") {
    const text = `${description} ${input.merchant || ""}`.toLowerCase();
    if (/\b(bus|train|taxi|uber|rent|fare|flight|travel|ride|transport|rickshaw)\b/.test(text)) category = "Travel";
    else if (/\b(food|burger|pizza|coffee|lunch|dinner|cafe|restaurant|eat|snack)\b/.test(text)) category = "Food";
    else if (/\b(shop|cloth|shirt|pants|grocer|buy|bought)\b/.test(text)) category = "Shopping";
    else if (/\b(bill|electricity|water|wifi|net|recharge|phone)\b/.test(text)) category = "Bills & Utilities";
    else category = "General";
  }

  const merchant = safeText(input.merchant, 100);
  const paymentMethod = safeText(input.paymentMethod || "bKash", 50);
  const tags = safeText(input.tags, 100);
  const currency = safeText(input.currency || "BDT", 3).toUpperCase();
  const id = randomUUID();
  const amountMinor = Math.round(amount * 100);

  // 1. Insert into SQL expenses table
  await db.execute({
    sql: "INSERT INTO expenses (id, user_id, date, category, description, merchant, payment_method, tags, amount_minor, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [id, userId, date, category, description, merchant, paymentMethod, tags, amountMinor, currency, Date.now()],
  });

  // 2. Sync to finance_state JSON
  const financeResult = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(financeResult.rows[0]?.data);
  finance.expenses = finance.expenses || [];
  const entry = { id, date, category, description, merchant, paymentMethod, tags, amountMinor, currency, createdAt: Date.now() };
  finance.expenses.unshift(entry);

  await db.execute({
    sql: "INSERT INTO finance_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    args: [userId, JSON.stringify(finance), Date.now()],
  });

  return { success: true, message: `Recorded expense of ${currency} ${amount.toFixed(2)} for ${category} on ${date}`, expense: { id, date, category, description, amount, currency } };
}

async function getIncomes(db, userId, input, dashboardMonth) {
  const fallbackRange = monthRange(dashboardMonth);
  const startDate = validDate(input.startDate) ? input.startDate : fallbackRange.startDate;
  const endDate = validDate(input.endDate) ? input.endDate : fallbackRange.endDate;
  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  const incomes = (finance.incomes || []).filter(e => e.date >= startDate && e.date <= endDate);
  const total = incomes.reduce((s, e) => s + (Number(e.amountMinor || 0) / 100), 0);
  return { startDate, endDate, count: incomes.length, total, incomes };
}

async function addIncome(db, userId, input) {
  const amount = Number(input.amount || 0);
  if (amount <= 0) return { error: "Income amount must be greater than 0" };
  const date = validDate(input.date) ? input.date : new Date().toISOString().slice(0, 10);
  const source = safeText(input.source || "Salary", 60);
  const description = safeText(input.description || source, 200);
  const currency = safeText(input.currency || "BDT", 3).toUpperCase();

  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  finance.incomes = finance.incomes || [];
  const entry = { id: randomUUID(), date, source, description, amountMinor: Math.round(amount * 100), currency };
  finance.incomes.unshift(entry);

  await db.execute({
    sql: "INSERT INTO finance_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    args: [userId, JSON.stringify(finance), Date.now()],
  });

  return { success: true, message: `Recorded income of ${currency} ${amount.toFixed(2)} from ${source}`, income: entry };
}

async function getBudgetStatus(db, userId, dashboardMonth) {
  const { startDate, endDate } = monthRange(dashboardMonth);
  const [budgetResult, expenseResult, financeResult] = await Promise.all([
    db.execute({ sql: "SELECT category,amount_minor,currency,period FROM budgets WHERE user_id = ? ORDER BY created_at DESC", args: [userId] }),
    db.execute({ sql: "SELECT amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, startDate, endDate] }),
    db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] }),
  ]);

  const finance = decodeFinance(financeResult.rows[0]?.data);
  const sqlBudgets = budgetResult.rows.map((row) => ({ category: row.category, amount: Number(row.amount_minor || 0) / 100, currency: row.currency, period: row.period }));
  
  const currency = sqlBudgets.find((b) => b.category === null)?.currency || finance.currency || expenseResult.rows[0]?.currency || "BDT";
  
  let overallAmount = sqlBudgets.find((b) => b.category === null && b.currency === currency)?.amount;
  if ((overallAmount === undefined || overallAmount === null) && finance.budgetMinor) {
    overallAmount = Number(finance.budgetMinor) / 100;
  }
  if (overallAmount === undefined) overallAmount = null;

  const spent = expenseResult.rows.filter((row) => row.currency === currency).reduce((sum, row) => sum + Number(row.amount_minor || 0), 0) / 100;
  const remaining = overallAmount !== null ? overallAmount - spent : null;
  const usedPercent = overallAmount ? Math.round((spent / overallAmount) * 100) : null;

  return {
    month: dashboardMonth,
    currency,
    spent,
    budget: overallAmount,
    remaining,
    usedPercent,
    categoryLimits: sqlBudgets.filter((b) => b.category !== null)
  };
}

async function setBudget(db, userId, input, dashboardMonth) {
  const amount = Number(input.amount || 0);
  if (amount <= 0) return { error: "Budget limit must be greater than 0" };
  const category = input.category ? safeText(input.category, 60) : null;
  const currency = safeText(input.currency || "BDT", 3).toUpperCase();
  const amountMinor = Math.round(amount * 100);
  const id = randomUUID();

  await db.execute({
    sql: "INSERT INTO budgets (id, user_id, category, amount_minor, currency, period, created_at) VALUES (?, ?, ?, ?, ?, 'monthly', ?)",
    args: [id, userId, category, amountMinor, currency, Date.now()],
  });

  return { success: true, message: `Set ${category ? `${category} ` : "overall "}monthly budget to ${currency} ${amount.toFixed(2)}` };
}

async function getGoals(db, userId) {
  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  return { goals: finance.goals || [] };
}

async function addGoal(db, userId, input) {
  const name = safeText(input.name || "Savings Goal", 100);
  const target = Number(input.target || 0);
  if (target <= 0) return { error: "Target amount must be greater than 0" };
  const currency = safeText(input.currency || "BDT", 3).toUpperCase();

  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  finance.goals = finance.goals || [];
  const goal = { id: randomUUID(), name, targetMinor: Math.round(target * 100), savedMinor: 0, currency };
  finance.goals = [goal];

  await db.execute({
    sql: "INSERT INTO finance_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    args: [userId, JSON.stringify(finance), Date.now()],
  });

  return { success: true, message: `Updated savings goal "${name}" with target ${currency} ${target.toFixed(2)}`, goal };
}

async function getRecurringExpenses(db, userId) {
  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  return { recurring: finance.recurring || [] };
}

async function addRecurringExpense(db, userId, input) {
  const merchant = safeText(input.merchant || input.category || "Subscription", 100);
  const amount = Number(input.amount || 0);
  if (amount <= 0) return { error: "Amount must be greater than 0" };
  const category = safeText(input.category || "Subscriptions", 60);
  const frequency = safeText(input.frequency || "Monthly", 30);
  const nextDate = validDate(input.nextDate) ? input.nextDate : new Date().toISOString().slice(0, 10);
  const currency = safeText(input.currency || "BDT", 3).toUpperCase();

  const result = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
  const finance = decodeFinance(result.rows[0]?.data);
  finance.recurring = finance.recurring || [];
  const item = { id: randomUUID(), merchant, category, amountMinor: Math.round(amount * 100), frequency, nextDate, currency };
  finance.recurring.push(item);

  await db.execute({
    sql: "INSERT INTO finance_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    args: [userId, JSON.stringify(finance), Date.now()],
  });

  return { success: true, message: `Added recurring bill for ${merchant} (${currency} ${amount.toFixed(2)} / ${frequency})`, item };
}

async function generateMonthlyReport(db, userId, input, dashboardMonth = currentMonth()) {
  const month = validMonth(input.month) ? input.month : dashboardMonth;
  const { startDate, endDate } = monthRange(month);
  const [expenseResult, financeResult, budgetResult] = await Promise.all([
    db.execute({ sql: "SELECT date,category,description,amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC", args: [userId, startDate, endDate] }),
    db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] }),
    db.execute({ sql: "SELECT category,amount_minor,currency FROM budgets WHERE user_id = ? ORDER BY created_at DESC", args: [userId] }),
  ]);
  const finance = decodeFinance(financeResult.rows[0]?.data);
  const expenses = expenseResult.rows.map((row) => ({ date: row.date, category: row.category, description: row.description, amount: Number(row.amount_minor || 0) / 100, currency: row.currency }));
  const currency = expenseResult.rows[0]?.currency || finance.incomes?.find((income) => String(income.date).startsWith(month))?.currency || "USD";
  const scoped = expenses.filter((expense) => expense.currency === currency);
  const categories = Object.entries(scoped.reduce((totals, expense) => { totals[expense.category] = (totals[expense.category] || 0) + expense.amount; return totals; }, {})).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  const income = (finance.incomes || []).filter((entry) => String(entry.date).startsWith(month) && entry.currency === currency).reduce((sum, entry) => sum + Number(entry.amountMinor || 0) / 100, 0);
  const spent = scoped.reduce((sum, expense) => sum + expense.amount, 0);
  const budget = budgetResult.rows.find((row) => row.category === null && row.currency === currency);
  return { month, currency, expenseCount: scoped.length, spent, income, netCashFlow: income - spent, budget: budget ? Number(budget.amount_minor || 0) / 100 : null, categories, largestExpenses: scoped.slice().sort((a, b) => b.amount - a.amount).slice(0, 8) };
}

async function runTool(db, userId, name, rawInput, dashboardMonth) {
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  if (name === "get_latest_expense") return getLatestExpense(db, userId);
  if (name === "get_expenses") return getExpenses(db, userId, input, dashboardMonth);
  if (name === "add_expense") return addExpense(db, userId, input, dashboardMonth);
  if (name === "get_incomes") return getIncomes(db, userId, input, dashboardMonth);
  if (name === "add_income") return addIncome(db, userId, input);
  if (name === "get_budget_status") return getBudgetStatus(db, userId, dashboardMonth);
  if (name === "set_budget") return setBudget(db, userId, input, dashboardMonth);
  if (name === "get_goals") return getGoals(db, userId);
  if (name === "add_goal") return addGoal(db, userId, input);
  if (name === "get_recurring_expenses") return getRecurringExpenses(db, userId);
  if (name === "add_recurring_expense") return addRecurringExpense(db, userId, input);
  if (name === "generate_monthly_report") return generateMonthlyReport(db, userId, input, dashboardMonth);
  return { error: `Unknown tool: ${name}` };
}

function systemPrompt(currentDate, dashboardMonth) {
  return `You are Money Copilot, a concise personal-finance assistant. Current date: ${currentDate}. Dashboard month: ${dashboardMonth}. Use a date explicitly stated by the user first; otherwise interpret "this month" and date-less monthly questions as ${dashboardMonth}. For "latest" or "last expense", call get_latest_expense. Never invent, assume, or estimate transactions. Always use the provided tools to fetch or modify financial data â€” never answer financial questions without calling the relevant tool first. When the user asks to add, record, save, or spent an expense, call add_expense immediately with the amount and infer the category from the description. When the user asks to add income, call add_income. For budget questions, call get_budget_status. For reports or summaries, call generate_monthly_report. Ask a concise follow-up only when required fields are missing or ambiguous. Explain verified insights in plain language, separate facts from recommendations, give practical next actions, and format reports in compact Markdown. Do not give investment, tax, or legal advice. The server enforces the signed user's private data scope; never ask for or expose another user id.`;
}

function answerContent(message) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.map((part) => part?.text || "").join("");
  return "I could not generate an answer from the available financial data.";
}

async function callComet(model, messages, tools) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${COMET_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.COMET_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        ...(Array.isArray(tools) && tools.length ? { tools, tool_choice: "auto" } : {}),
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || `CometAPI request failed (${response.status})`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackMoney(amount, currency) {
  const value = Number(amount || 0);
  const prefix = currency === "BDT" ? "à§³" : currency === "USD" ? "$" : `${currency} `;
  return `${value < 0 ? "-" : ""}${prefix}${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function verifiedFallbackAnswer(db, userId, message, dashboardMonth) {
  const requestedMonth = message.match(/\b(20\d{2}-(0[1-9]|1[0-2]))\b/)?.[1] || dashboardMonth;
  if (/\b(last|latest|most recent)\b.*\b(expense|transaction|purchase)\b|\b(expense|transaction|purchase)\b.*\b(last|latest|most recent)\b/i.test(message)) {
    const latest = (await getLatestExpense(db, userId)).expense;
    return latest
      ? `## Latest expense\n\n- **${latest.description || latest.category}**\n- Amount: **${fallbackMoney(latest.amount, latest.currency)}**\n- Category: **${latest.category}**\n- Date: **${latest.date}**`
      : "You do not have any recorded expenses yet.";
  }
  const report = await generateMonthlyReport(db, userId, { month: requestedMonth }, dashboardMonth);
  const top = report.categories[0];
  const question = message.toLowerCase();
  const categoryLines = report.categories.slice(0, 3).map((item) => `- ${item.category}: ${fallbackMoney(item.amount, report.currency)}`).join("\n") || "- No expenses recorded";
  const budgetLine = report.budget === null
    ? "No overall monthly budget has been set yet."
    : `${fallbackMoney(report.spent, report.currency)} spent from a ${fallbackMoney(report.budget, report.currency)} budget (${Math.round((report.spent / Math.max(report.budget, 1)) * 100)}% used).`;
  const reportRemaining = report.budget === null ? null : report.budget - report.spent;

  if (/saving|reduce|cut|where can i/.test(question)) {
    const target = top ? Math.round(top.amount * .1) : 0;
    return `## Verified saving idea\n\n${top ? `Your largest category is **${top.category}** at **${fallbackMoney(top.amount, report.currency)}**. Reducing it by 10% could free about **${fallbackMoney(target, report.currency)}**.` : "Record a few expenses first and I can identify the best saving opportunity."}\n\n${budgetLine}`;
  }
  if (/budget|plan/.test(question)) {
    return `## Budget check â€” ${report.month}\n\n${budgetLine}\n\n**Next step:** ${report.budget === null ? "set an overall monthly limit, then add category limits for your largest expenses." : reportRemaining < 0 ? "pause discretionary spending in the largest category until the next budget period." : "reserve the remaining balance for essentials and savings."}`;
  }
  if (/report|summary|month|spend|expense|how much|why|explain/.test(question)) {
    return `## Monthly spending â€” ${report.month}\n\n- Total spent: **${fallbackMoney(report.spent, report.currency)}** across **${report.expenseCount}** expenses\n- Income recorded: **${fallbackMoney(report.income, report.currency)}**\n- Net cash flow: **${fallbackMoney(report.netCashFlow, report.currency)}**\n\n### Top categories\n${categoryLines}\n\n${budgetLine}`;
  }
  return `I can verify your expenses, budgets, and monthly reports. For ${report.month}, you have recorded **${fallbackMoney(report.spent, report.currency)}** in expenses. Ask me for a monthly report, a category breakdown, or savings ideas.`;
}

function buildVisualData(toolName, toolResult, currency) {
  if (!toolResult || toolResult.error) return null;
  const fmt = (v) => Number(v || 0).toFixed(2);
  if (toolName === "get_budget_status") {
    const r = toolResult;
    const cur = r.currency || currency || "USD";
    const metrics = [
      { label: "Spent", value: fmt(r.spent), currency: cur, color: "#ff4548" },
      { label: "Budget", value: r.budget !== null ? fmt(r.budget) : null, currency: cur, color: "#2563ff" },
      { label: "Remaining", value: r.remaining !== null ? fmt(r.remaining) : null, currency: cur, color: r.remaining < 0 ? "#ff4548" : "#18b96f" },
    ].filter((m) => m.value !== null);
    const progress = r.budget ? { value: r.spent, max: r.budget, percent: r.usedPercent || 0, label: "Budget Used" } : null;
    const categories = (r.categoryLimits || []).slice(0, 6).map((c) => ({ name: c.category, limit: c.amount, currency: c.currency }));
    return { type: "budget_status", metrics, progress, categories: categories.length ? categories : null };
  }
  if (toolName === "generate_monthly_report") {
    const r = toolResult;
    const cur = r.currency || currency || "USD";
    const categories = Array.isArray(r.categories) ? r.categories : [];
    const metrics = [
      { label: "Total Spent", value: fmt(r.spent), currency: cur, color: "#ff4548" },
      { label: "Income", value: fmt(r.income), currency: cur, color: "#18b96f" },
      { label: "Net Cash Flow", value: fmt(r.netCashFlow), currency: cur, color: r.netCashFlow >= 0 ? "#18b96f" : "#ff4548" },
    ];
    if (r.budget !== null) metrics.push({ label: "Budget", value: fmt(r.budget), currency: cur, color: "#2563ff" });
    const total = categories.reduce((s, c) => s + c.amount, 0) || 1;
    const pieColors = ["#ff4548", "#2563ff", "#18b96f", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];
    const pieChart = categories.slice(0, 7).map((c, i) => ({
      label: c.category, value: c.amount, percent: Math.round((c.amount / total) * 100), color: pieColors[i % pieColors.length],
    }));
    return { type: "monthly_report", metrics, pieChart: pieChart.length ? pieChart : null };
  }
  if (toolName === "get_expenses") {
    const r = toolResult;
    if (!r.count) return null;
    const cur = r.currency || currency || "USD";
    const metrics = [
      { label: "Transactions", value: String(r.count), color: "#2563ff" },
      { label: "Total", value: fmt(r.total), currency: cur, color: "#ff4548" },
    ];
    const byCategory = {};
    (r.expenses || []).forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCat = cats[0]?.[1] || 1;
    const pieColors = ["#ff4548", "#2563ff", "#18b96f", "#f59e0b", "#8b5cf6", "#ec4899"];
    const pieChart = cats.map(([name, amount], i) => ({
      label: name, value: amount, percent: Math.round((amount / (r.total || 1)) * 100), color: pieColors[i % pieColors.length],
    }));
    return { type: "expense_list", metrics, pieChart: pieChart.length > 1 ? pieChart : null };
  }
  return null;
}

function needsFinancialData(message) {
  return /\b(expense|spend|spent|transaction|purchase|income|budget|saving|category|merchant|report|summary|cash flow|balance|bill|subscription|forecast)\b/i.test(message);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  const session = verifyDashboardToken(cookieValue(req, DASHBOARD_COOKIE));
  if (!session) return res.status(401).json({ error: "A valid dashboard session is required." });
  const { userId, mcpAccessToken } = session;
  if (!process.env.COMET_API_KEY) return res.status(503).json({ error: "AI assistant is not configured yet." });
  if (!checkRateLimit(userId)) return res.status(429).json({ error: "Too many AI requests. Please try again in a minute." });

  const message = safeText(req.body?.message, 2000);
  if (!message) return res.status(400).json({ error: "Enter a question for the assistant." });
  const dashboardMonth = validMonth(req.body?.month) ? req.body.month : currentMonth();
  const currentDate = new Date().toISOString().slice(0, 10);
  const claimedUserId = safeText(req.body?.userId, 200);
  if (claimedUserId && claimedUserId !== userId) return res.status(403).json({ error: "The requested user does not match this dashboard session." });
  const modelChoice = selectModel(message);
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return res.status(503).json({ error: "Expense data is not configured." });

  try {
    const db = createClient({ url, authToken });
    await ensureMonitoringTables(db);
    const control = await userControl(db, userId);
    if (control.status === "suspended") return res.status(403).json({ error: "This account has been suspended.", code: "account_suspended" });
    const cacheKey = `${userId}:${dashboardMonth}:${modelChoice.model}:${message.toLowerCase()}`;
    const cached = mcpAccessToken ? null : responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      await recordActivity(db, { userId, source: "dashboard_ai", eventType: "ai_answer_cached", detail: { model: cached.value.model, month: dashboardMonth } });
      return res.status(200).json({ ...cached.value, cached: true });
    }
    const availableTools = mcpAccessToken ? await mcpToolDefinitions(mcpAccessToken) : toolDefinitions();
    const messages = [
      { role: "system", content: systemPrompt(currentDate, dashboardMonth) },
      ...safeHistory(req.body?.history),
      { role: "user", content: message },
    ];
    const usedTools = [];
    let lastToolName = null;
    let lastToolResult = null;
    let activeModel = modelChoice.model;
    let completion;
    for (let pass = 0; pass < 4; pass += 1) {
      try {
        completion = await callComet(activeModel, messages, availableTools);
      } catch (error) {
        if (activeModel !== DEFAULT_MODEL) {
          activeModel = DEFAULT_MODEL;
          completion = await callComet(activeModel, messages, availableTools);
        } else throw error;
      }
      const assistant = completion?.choices?.[0]?.message;
      messages.push({ role: "assistant", content: assistant?.content || "", tool_calls: assistant?.tool_calls || undefined });
      const calls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];
      if (!calls.length) break;
      for (const call of calls.slice(0, 3)) {
        let input = {};
        try { input = JSON.parse(call.function?.arguments || "{}"); } catch { input = {}; }
        const name = safeText(call.function?.name, 64);
        const result = mcpAccessToken
          ? await runMcpTool(mcpAccessToken, name, input)
          : await runTool(db, userId, name, input, dashboardMonth);
        usedTools.push(name);
        lastToolName = name;
        lastToolResult = result;
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    if (needsFinancialData(message) && !usedTools.length) throw new Error("The model returned an unverified financial answer.");
    const answer = answerContent(completion?.choices?.[0]?.message);
    const visualData = buildVisualData(lastToolName, lastToolResult, null) || undefined;
    const value = { answer, model: activeModel, usedTools: [...new Set(usedTools)], usage: completion?.usage || null, visualData, cached: false };
    if (!mcpAccessToken) {
      responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
      if (responseCache.size > 500) responseCache.delete(responseCache.keys().next().value);
    }
    console.info("[ai-chat]", JSON.stringify({ userId, model: activeModel, tools: value.usedTools, usage: value.usage }));
    await recordActivity(db, { userId, source: "dashboard_ai", eventType: "ai_question_answered", detail: { model: activeModel, tools: value.usedTools, month: dashboardMonth } });
    return res.status(200).json(value);
  } catch (error) {
    console.error("[ai-chat] request failed", error);
    try {
      const fallbackDb = createClient({ url, authToken });
      const answer = await verifiedFallbackAnswer(fallbackDb, userId, message, dashboardMonth);
      const fallbackReport = await generateMonthlyReport(fallbackDb, userId, { month: dashboardMonth }, dashboardMonth).catch(() => null);
      const visualData = buildVisualData("generate_monthly_report", fallbackReport, null) || undefined;
      return res.status(200).json({
        answer,
        model: "verified-dashboard-fallback",
        usedTools: ["generate_monthly_report"],
        usage: null,
        visualData,
        cached: false,
        fallback: true,
      });
    } catch (fallbackError) {
      console.error("[ai-chat] fallback failed", fallbackError);
      return res.status(502).json({ error: "The AI assistant is temporarily unavailable. Please try again." });
    }
  }
}
