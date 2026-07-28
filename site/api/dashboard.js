import { createClient } from "@libsql/client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const COOKIE = "expense_tracker_dashboard";

function verifyToken(token) {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!token || !secret) return null;
  const [payload, received, ...extra] = token.split(".");
  if (!payload || !received || extra.length) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(received); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof value.u === "string" && value.u && Number.isFinite(value.e) && value.e > Date.now() ? value.u : null;
  } catch { return null; }
}

function cookieValue(req) {
  return req.headers.cookie?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1];
}

function money(minor, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((minor || 0) / 100);
}

function cleanText(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function amountMinor(value) {
  const raw = typeof value === "number" ? String(value) : cleanText(value, 32).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const minor = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(minor) && minor > 0 && minor <= 100000000000 ? minor : null;
}

function decodeBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  return typeof body === "object" ? body : {};
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Referrer-Policy", "no-referrer");
  const userId = verifyToken(req.query.dashboard_token) || verifyToken(cookieValue(req));
  if (!userId) return res.status(401).json({ error: "A valid dashboard link is required." });
  if (req.query.dashboard_token) {
    res.setHeader("Set-Cookie", `${COOKIE}=${req.query.dashboard_token}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax`);
  }
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return res.status(500).json({ error: "Dashboard database is not configured.", code: "dashboard_database_not_configured" });
  try {
    const db = createClient({ url, authToken });
    if (req.method === "POST") {
      const body = decodeBody(req.body);
      const kind = body.kind;
      const amount = amountMinor(body.amount);
      const target = amountMinor(body.target);
      const date = cleanText(body.date, 10);
      const currency = cleanText(body.currency, 3).toUpperCase();
      const category = cleanText(body.category, 60).toLowerCase();
      const description = cleanText(body.description, 240);
      if (kind === "budget") {
        if (!amount || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "Enter a positive budget amount and 3-letter currency code." });
        const now = new Date().toISOString();
        await db.execute({
          sql: "INSERT INTO budgets (id,user_id,category,amount_minor,currency,period,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,category) DO UPDATE SET amount_minor=excluded.amount_minor,currency=excluded.currency,period=excluded.period,created_at=excluded.created_at",
          args: [randomUUID(), userId, null, amount, currency, "monthly", now],
        });
        return res.status(201).json({ ok: true });
      }
      if (kind === "goal") {
        if (!target || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "Enter a positive goal amount and 3-letter currency code." });
        const now = new Date().toISOString();
        const existing = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
        let finance = { incomes: [], recurring: [], budgetRules: [], categories: [], templates: [], alertThresholds: [50, 80, 100], expenseMetadata: {}, goals: [] };
        if (existing.rows[0]?.data) {
          try { finance = { ...finance, ...JSON.parse(String(existing.rows[0].data)) }; } catch { /* Use safe defaults. */ }
        }
        finance.goals = Array.isArray(finance.goals) ? finance.goals : [];
        finance.goals[0] = { id: finance.goals[0]?.id || randomUUID(), name: cleanText(body.name, 80) || "Savings goal", targetMinor: target, currency, updatedAt: now };
        await db.execute({ sql: "INSERT INTO finance_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at", args: [userId, JSON.stringify(finance), now] });
        return res.status(201).json({ ok: true });
      }
      if (!["expense", "income"].includes(kind) || !amount || !validDate(date) || !/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({ error: "Enter a positive amount, valid date, and 3-letter currency code." });
      }
      const now = new Date().toISOString();
      if (kind === "expense") {
        if (!category) return res.status(400).json({ error: "Choose an expense category." });
        await db.execute({
          sql: "INSERT INTO expenses (id,user_id,amount_minor,currency,category,description,date,created_at) VALUES (?,?,?,?,?,?,?,?)",
          args: [randomUUID(), userId, amount, currency, category, description || "Expense", date, now],
        });
      } else {
        const existing = await db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] });
        let finance = { incomes: [], recurring: [], budgetRules: [], categories: [], templates: [], alertThresholds: [50, 80, 100], expenseMetadata: {} };
        if (existing.rows[0]?.data) {
          try { finance = { ...finance, ...JSON.parse(String(existing.rows[0].data)) }; } catch { /* Use safe defaults. */ }
        }
        finance.incomes = Array.isArray(finance.incomes) ? finance.incomes : [];
        finance.incomes.push({ id: randomUUID(), amountMinor: amount, currency, source: cleanText(body.source, 80) || "Income", date, notes: description, createdAt: now });
        await db.execute({
          sql: "INSERT INTO finance_state (user_id,data,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
          args: [userId, JSON.stringify(finance), now],
        });
      }
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      return res.status(201).json({ ok: true });
    }
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month || "") ? req.query.month : new Date().toISOString().slice(0, 7);
    const from = `${month}-01`; const to = `${month}-31`;
    const [expenseResult, budgetResult, financeResult] = await Promise.all([
      db.execute({ sql: "SELECT id,date,category,description,amount_minor,currency,created_at FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 200", args: [userId, from, to] }),
      db.execute({ sql: "SELECT category,amount_minor,currency FROM budgets WHERE user_id = ?", args: [userId] }),
      db.execute({ sql: "SELECT data FROM finance_state WHERE user_id = ?", args: [userId] }),
    ]);
    const expenses = expenseResult.rows.map((row) => ({ id: row.id, date: row.date, category: row.category, description: row.description, amountMinor: Number(row.amount_minor), currency: row.currency }));
    const budgets = budgetResult.rows.map((row) => ({ category: row.category, amountMinor: Number(row.amount_minor), currency: row.currency }));
    const finance = financeResult.rows[0]?.data ? JSON.parse(String(financeResult.rows[0].data)) : { incomes: [] };
    const currency = budgets.find((budget) => budget.category === null)?.currency || expenses[0]?.currency || finance.incomes?.[0]?.currency || "USD";
    const scoped = expenses.filter((expense) => expense.currency === currency);
    const spentMinor = scoped.reduce((sum, expense) => sum + expense.amountMinor, 0);
    const incomes = (finance.incomes || []).filter((income) => income.currency === currency && String(income.date).slice(0, 7) === month);
    const incomeMinor = incomes.reduce((sum, income) => sum + Number(income.amountMinor || 0), 0);
    const overallBudget = budgets.find((budget) => budget.category === null && budget.currency === currency);
    const categories = Object.entries(scoped.reduce((map, expense) => ({ ...map, [expense.category]: (map[expense.category] || 0) + expense.amountMinor }), {}))
      .map(([name, amountMinor]) => ({ name, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    const daily = Object.entries(scoped.reduce((days, expense) => {
      days[expense.date] = (days[expense.date] || 0) + expense.amountMinor;
      return days;
    }, {})).map(([date, amountMinor]) => ({ date, amountMinor })).sort((a, b) => a.date.localeCompare(b.date));
    const recurring = (finance.recurring || []).filter((entry) => entry.active && entry.currency === currency);
    return res.status(200).json({
      month, currency, spentMinor, incomeMinor, budgetMinor: overallBudget?.amountMinor ?? null,
      categories, expenses: scoped.slice(0, 200), daily, incomes, recurring, goals: Array.isArray(finance.goals) ? finance.goals : [],
      expenseMetadata: finance.expenseMetadata || {}, labels: { spent: money(spentMinor, currency), income: money(incomeMinor, currency) },
    });
  } catch (error) {
    console.error("dashboard query failed", error);
    return res.status(500).json({ error: "Dashboard is temporarily unavailable.", code: "dashboard_database_unavailable" });
  }
}
