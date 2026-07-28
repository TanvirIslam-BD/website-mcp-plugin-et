import { createClient } from "@libsql/client";
import { createHmac, timingSafeEqual } from "node:crypto";

const DASHBOARD_COOKIE = "expense_tracker_dashboard";
const COMET_BASE_URL = "https://api.cometapi.com/v1";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "deepseek/deepseek-chat";
const ADVANCED_MODEL = process.env.ADVANCED_MODEL || "deepseek/deepseek-v3-2";
const PREMIUM_MODEL = process.env.PREMIUM_MODEL || "moonshotai/kimi-k2-5";
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 18;
const CACHE_TTL_MS = 5 * 60_000;
const rateLimits = new Map();
const responseCache = new Map();

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
    return typeof session.u === "string" && session.u && Number(session.e) > Date.now() ? session.u : null;
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

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(days).padStart(2, "0")}` };
}

function decodeFinance(value) {
  try { return JSON.parse(String(value || "{}")); } catch { return {}; }
}

function selectModel(message) {
  const text = message.toLowerCase();
  if (/\b(6[ -]?month|six[ -]?month|financial plan|all spending behavior|comprehensive plan|long.term plan)\b/.test(text)) return { model: PREMIUM_MODEL, tier: "premium" };
  if (/\b(why|abnormal|unusual|anomal|increase|decrease|trend|compare|strategy|strategies|forecast|reduce)\b/.test(text)) return { model: ADVANCED_MODEL, tier: "advanced" };
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
    { type: "function", function: { name: "get_expenses", description: "Retrieve the authenticated user's expenses for a date range and optional category. Use this for transaction totals, categories, merchants, and comparisons.", parameters: { type: "object", properties: { startDate: { type: "string", description: "YYYY-MM-DD" }, endDate: { type: "string", description: "YYYY-MM-DD" }, category: { type: "string" } }, required: ["startDate", "endDate"], additionalProperties: false } } },
    { type: "function", function: { name: "get_budget_status", description: "Retrieve the authenticated user's overall budget, spending, remaining amount, and category limits.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
    { type: "function", function: { name: "generate_monthly_report", description: "Generate a verified report for one calendar month. Use when the user asks for a monthly summary, report, or category breakdown.", parameters: { type: "object", properties: { month: { type: "string", description: "YYYY-MM" } }, required: ["month"], additionalProperties: false } } },
  ];
}

async function getExpenses(db, userId, input) {
  const startDate = validDate(input.startDate) ? input.startDate : monthRange(currentMonth()).startDate;
  const endDate = validDate(input.endDate) ? input.endDate : monthRange(currentMonth()).endDate;
  if (startDate > endDate) return { error: "startDate must be before endDate" };
  const category = safeText(input.category, 60).toLowerCase();
  const where = category ? " AND lower(category) = ?" : "";
  const args = category ? [userId, startDate, endDate, category] : [userId, startDate, endDate];
  const result = await db.execute({ sql: `SELECT id,date,category,description,amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?${where} ORDER BY date DESC, created_at DESC LIMIT 250`, args });
  const expenses = result.rows.map((row) => ({ date: row.date, category: row.category, description: row.description, amount: Number(row.amount_minor || 0) / 100, currency: row.currency }));
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return { startDate, endDate, category: category || null, count: expenses.length, total, currency: expenses[0]?.currency || "USD", expenses };
}

async function getBudgetStatus(db, userId) {
  const { startDate, endDate } = monthRange(currentMonth());
  const [budgetResult, expenseResult] = await Promise.all([
    db.execute({ sql: "SELECT category,amount_minor,currency,period FROM budgets WHERE user_id = ? ORDER BY created_at DESC", args: [userId] }),
    db.execute({ sql: "SELECT amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, startDate, endDate] }),
  ]);
  const budgets = budgetResult.rows.map((row) => ({ category: row.category, amount: Number(row.amount_minor || 0) / 100, currency: row.currency, period: row.period }));
  const currency = budgets.find((budget) => budget.category === null)?.currency || expenseResult.rows[0]?.currency || "USD";
  const spent = expenseResult.rows.filter((row) => row.currency === currency).reduce((sum, row) => sum + Number(row.amount_minor || 0), 0) / 100;
  const overall = budgets.find((budget) => budget.category === null && budget.currency === currency);
  return { month: currentMonth(), currency, spent, budget: overall?.amount ?? null, remaining: overall ? overall.amount - spent : null, usedPercent: overall?.amount ? Math.round((spent / overall.amount) * 100) : null, categoryLimits: budgets.filter((budget) => budget.category !== null) };
}

async function generateMonthlyReport(db, userId, input) {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(input.month || "") ? input.month : currentMonth();
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

async function runTool(db, userId, name, rawInput) {
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  if (name === "get_expenses") return getExpenses(db, userId, input);
  if (name === "get_budget_status") return getBudgetStatus(db, userId);
  if (name === "generate_monthly_report") return generateMonthlyReport(db, userId, input);
  return { error: `Unknown tool: ${name}` };
}

function systemPrompt() {
  return "You are Expense Tracker AI, a concise personal-finance assistant. Never invent, assume, or estimate transactions. For any financial fact, total, budget, category, or report, call the available tools first. Explain verified insights in plain language, separate facts from recommendations, give practical next actions, and format reports in compact Markdown. Do not give investment, tax, or legal advice. The tools already enforce the signed user's private data scope; never ask for or expose another user id.";
}

function answerContent(message) {
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) return message.content.map((part) => part?.text || "").join("");
  return "I could not generate an answer from the available financial data.";
}

async function callComet(model, messages, tools) {
  const response = await fetch(`${COMET_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.COMET_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 900 }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `CometAPI request failed (${response.status})`);
  return body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  const userId = verifyDashboardToken(cookieValue(req, DASHBOARD_COOKIE));
  if (!userId) return res.status(401).json({ error: "A valid dashboard session is required." });
  if (!process.env.COMET_API_KEY) return res.status(503).json({ error: "AI assistant is not configured yet." });
  if (!checkRateLimit(userId)) return res.status(429).json({ error: "Too many AI requests. Please try again in a minute." });

  const message = safeText(req.body?.message, 2000);
  if (!message) return res.status(400).json({ error: "Enter a question for the assistant." });
  const claimedUserId = safeText(req.body?.userId, 200);
  if (claimedUserId && claimedUserId !== userId) return res.status(403).json({ error: "The requested user does not match this dashboard session." });
  const modelChoice = selectModel(message);
  const cacheKey = `${userId}:${modelChoice.model}:${message.toLowerCase()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return res.status(200).json({ ...cached.value, cached: true });

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return res.status(503).json({ error: "Expense data is not configured." });

  try {
    const db = createClient({ url, authToken });
    const messages = [{ role: "system", content: systemPrompt() }, ...safeHistory(req.body?.history), { role: "user", content: message }];
    const usedTools = [];
    let activeModel = modelChoice.model;
    let completion;
    for (let pass = 0; pass < 4; pass += 1) {
      try {
        completion = await callComet(activeModel, messages, toolDefinitions());
      } catch (error) {
        if (activeModel !== DEFAULT_MODEL) {
          activeModel = DEFAULT_MODEL;
          completion = await callComet(activeModel, messages, toolDefinitions());
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
        const result = await runTool(db, userId, name, input);
        usedTools.push(name);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    const answer = answerContent(completion?.choices?.[0]?.message);
    const value = { answer, model: activeModel, usedTools: [...new Set(usedTools)], usage: completion?.usage || null, cached: false };
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    if (responseCache.size > 500) responseCache.delete(responseCache.keys().next().value);
    console.info("[ai-chat]", JSON.stringify({ userId, model: activeModel, tools: value.usedTools, usage: value.usage }));
    return res.status(200).json(value);
  } catch (error) {
    console.error("[ai-chat] request failed", error);
    return res.status(502).json({ error: "The AI assistant is temporarily unavailable. Please try again." });
  }
}
