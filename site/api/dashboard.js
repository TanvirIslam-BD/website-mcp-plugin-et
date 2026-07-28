import { createClient } from "@libsql/client";
import { createHmac, timingSafeEqual } from "node:crypto";

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

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
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
      categories, expenses: scoped.slice(0, 12), daily, incomes, recurring,
      expenseMetadata: finance.expenseMetadata || {}, labels: { spent: money(spentMinor, currency), income: money(incomeMinor, currency) },
    });
  } catch (error) {
    console.error("dashboard query failed", error);
    return res.status(500).json({ error: "Dashboard is temporarily unavailable.", code: "dashboard_database_unavailable" });
  }
}
