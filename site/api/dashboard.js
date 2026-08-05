import { randomUUID } from "node:crypto";
import { database } from "./_db.js";
import { sameOriginRequest } from "./_config.js";
import { readDashboardSession, refreshDashboardSession } from "./_dashboard-session.js";
import { cleanDisplayName, cleanProfilePhoto, readMcpizeProfile } from "./_mcpize-profile.js";
import { ensureMonitoringTables, recordActivity, userControl } from "./_monitoring.js";
import { consumeRateLimit } from "./_rate-limit.js";
import {
  amountToMinor,
  categoryCatalog,
  cleanText,
  mutateFinanceState,
  readFinanceState,
  reconcileUserData,
  replaceBudgetStatements,
} from "./_finance-state.js";

const WRITE_RATE_LIMIT = { limit: 120, windowMs: 60_000 };

function money(minor, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((minor || 0) / 100);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function validMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || "");
}

function decodeBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return typeof body === "object" ? body : {};
}

function safeSettings(value) {
  const settings = value && typeof value === "object" ? value : {};
  const currency = cleanText(settings.currency, 3).toUpperCase();
  const theme = settings.theme === "dark" ? "dark" : settings.theme === "light" ? "light" : "";
  const copilotModel = ["auto", "fast", "standard", "advanced", "premium"].includes(settings.copilotModel)
    ? settings.copilotModel
    : "auto";
  return {
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "",
    theme,
    compactMode: settings.compactMode === true,
    copilotModel,
    autoSuggest: settings.autoSuggest !== false,
    billReminders: settings.billReminders !== false,
    incomeReceived: settings.incomeReceived !== false,
    overdueAlerts: settings.overdueAlerts !== false,
    newsletter: settings.newsletter !== false,
    pushNotifications: settings.pushNotifications === true,
    emailNotifications: settings.emailNotifications !== false,
  };
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from, to: `${month}-${String(last).padStart(2, "0")}`, days: last };
}

function previousMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function inMonth(entry, month) {
  return String(entry?.date || "").slice(0, 7) === month;
}

function csvCell(value) {
  let text = String(value ?? "");
  // Spreadsheet applications execute a cell that begins with one of these, so a
  // merchant name like `=HYPERLINK(...)` would run on open. Neutralize it with a
  // leading apostrophe, which Excel and Sheets treat as "this is text".
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvDocument(rows) {
  const headers = ["type", "date", "description", "category", "subcategory", "amount", "currency", "merchant", "payment_method", "tags"];
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // SameSite=Lax already blocks cross-site POSTs; this is the second lock.
  if (req.method === "POST" && !sameOriginRequest(req)) return res.status(403).json({ error: "Origin not allowed." });

  const session = readDashboardSession(req);
  if (!session) return res.status(401).json({ error: "A valid dashboard link is required." });
  const userId = session.userId;
  refreshDashboardSession(res, session);

  const db = database();
  if (!db) return res.status(500).json({ error: "Dashboard database is not configured.", code: "dashboard_database_not_configured" });

  try {
    await ensureMonitoringTables(db);
    const control = await userControl(db, userId);
    if (control.status === "suspended") {
      return res.status(403).json({ error: "This account has been suspended. Contact support if you believe this is a mistake.", code: "account_suspended" });
    }
    if (req.method === "POST") {
      const quota = await consumeRateLimit(db, `dashboard-write:${userId}`, WRITE_RATE_LIMIT);
      if (!quota.allowed) {
        res.setHeader("Retry-After", String(quota.retryAfterSeconds));
        return res.status(429).json({ error: "Too many changes at once. Please try again in a moment." });
      }
    }
    await reconcileUserData(db, userId);

    if (req.method === "GET" && req.query.export === "csv") {
      const month = validMonth(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
      const range = monthRange(month);
      const all = req.query.scope === "all";
      const expenseResult = await db.execute({
        sql: `SELECT id,date,category,description,amount_minor,currency FROM expenses WHERE user_id = ?${all ? "" : " AND date >= ? AND date <= ?"} ORDER BY date DESC`,
        args: all ? [userId] : [userId, range.from, range.to],
      });
      const { finance } = await readFinanceState(db, userId);
      const incomes = (finance.incomes || []).filter((income) => all || inMonth(income, month));
      const expenseRows = expenseResult.rows.map((row) => {
        const meta = finance.expenseMetadata?.[row.id] || {};
        return ["expense", row.date, row.description, row.category, meta.subcategory || "", (Number(row.amount_minor || 0) / 100).toFixed(2), row.currency, meta.merchant || "", meta.paymentMethod || "", (meta.tags || []).join("|")];
      });
      const incomeRows = incomes.map((income) => ["income", income.date, income.notes || income.source || "Income", income.source || "income", "", (Number(income.amountMinor || 0) / 100).toFixed(2), income.currency, "", "", ""]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="expense-tracker-${all ? "all-data" : month}.csv"`);
      await recordActivity(db, { userId, source: "dashboard", eventType: "data_exported", detail: { scope: all ? "all" : "month", month } });
      return res.status(200).send(`﻿${csvDocument([...expenseRows, ...incomeRows])}`);
    }

    if (req.method === "POST") {
      const body = decodeBody(req.body);
      const kind = body.kind;
      const amount = amountToMinor(body.amount);
      const target = amountToMinor(body.target);
      const date = cleanText(body.date, 10);
      const currency = cleanText(body.currency, 3).toUpperCase();
      const category = cleanText(body.category, 60).toLowerCase();
      const description = cleanText(body.description, 240);
      const now = new Date().toISOString();
      await recordActivity(db, { userId, source: "dashboard", eventType: `${cleanText(kind, 40) || "unknown"}_requested`, detail: { month: cleanText(body.month, 7) } });

      if (kind === "clear_all") {
        await db.batch([
          { sql: "DELETE FROM expenses WHERE user_id = ?", args: [userId] },
          { sql: "DELETE FROM budgets WHERE user_id = ?", args: [userId] },
          { sql: "DELETE FROM finance_state WHERE user_id = ?", args: [userId] },
        ], "write");
        return res.status(200).json({ ok: true });
      }

      if (kind === "clear_month") {
        const month = validMonth(body.month) ? body.month : null;
        if (!month) return res.status(400).json({ error: "Choose a valid month." });
        const range = monthRange(month);
        const ids = await db.execute({ sql: "SELECT id FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, range.from, range.to] });
        const removed = new Set(ids.rows.map((row) => String(row.id)));
        await db.execute({ sql: "DELETE FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, range.from, range.to] });
        await mutateFinanceState(db, userId, (finance) => {
          finance.incomes = (finance.incomes || []).filter((income) => !inMonth(income, month));
          finance.expenseMetadata = Object.fromEntries(Object.entries(finance.expenseMetadata || {}).filter(([id]) => !removed.has(id)));
          return finance;
        });
        return res.status(200).json({ ok: true });
      }

      if (kind === "settings") {
        const finance = await mutateFinanceState(db, userId, (current) => {
          current.settings = safeSettings(body.settings);
          return current;
        });
        await recordActivity(db, { userId, source: "dashboard", eventType: "settings_updated", detail: { theme: finance.settings.theme, currency: finance.settings.currency, copilotModel: finance.settings.copilotModel } });
        return res.status(200).json({ ok: true, settings: finance.settings });
      }

      if (kind === "budget") {
        if (!amount || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "Enter a positive budget amount and 3-letter currency code." });
        await db.batch(replaceBudgetStatements({
          id: randomUUID(), userId, category: null, amountMinor: amount, currency, createdAt: now,
        }), "write");
        return res.status(201).json({ ok: true });
      }

      if (kind === "goal") {
        if (!target || !/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: "Enter a positive goal amount and 3-letter currency code." });
        await mutateFinanceState(db, userId, (finance) => {
          finance.goals = Array.isArray(finance.goals) ? finance.goals : [];
          finance.goals[0] = {
            id: finance.goals[0]?.id || randomUUID(),
            name: cleanText(body.name, 80) || "Savings goal",
            targetMinor: target,
            currency,
            updatedAt: now,
          };
          return finance;
        });
        return res.status(201).json({ ok: true });
      }

      if (kind === "delete_expense") {
        const id = cleanText(body.id, 80);
        if (!id) return res.status(400).json({ error: "Missing transaction ID." });
        await db.execute({
          sql: "DELETE FROM expenses WHERE id = ? AND user_id = ?",
          args: [id, userId],
        });
        await mutateFinanceState(db, userId, (finance) => {
          if (finance.expenseMetadata && typeof finance.expenseMetadata === "object") delete finance.expenseMetadata[id];
          return finance;
        });
        return res.status(200).json({ ok: true });
      }

      if (kind === "create_category") {
        const name = cleanText(body.category, 60).toLowerCase();
        const subcategory = cleanText(body.subcategory, 80);
        if (!name) return res.status(400).json({ error: "Enter a category name." });
        const { finance: existing } = await readFinanceState(db, userId);
        if (categoryCatalog(existing.categoryCatalog).some((item) => item.name === name)) {
          return res.status(400).json({ error: "This category already exists." });
        }
        await mutateFinanceState(db, userId, (finance) => {
          const catalog = categoryCatalog(finance.categoryCatalog);
          if (!catalog.some((item) => item.name === name)) catalog.push({ name, subcategories: subcategory ? [subcategory] : [] });
          finance.categoryCatalog = catalog;
          return finance;
        });
        return res.status(201).json({ ok: true });
      }

      if (kind === "rename_category") {
        const previous = cleanText(body.previousCategory, 60).toLowerCase();
        const next = cleanText(body.category, 60).toLowerCase();
        if (!previous || !next) return res.status(400).json({ error: "Enter both category names." });
        const { finance: existing } = await readFinanceState(db, userId);
        if (previous !== next && categoryCatalog(existing.categoryCatalog).some((item) => item.name === next)) {
          return res.status(400).json({ error: "A category with that name already exists." });
        }
        await db.execute({ sql: "UPDATE expenses SET category = ? WHERE category = ? AND user_id = ?", args: [next, previous, userId] });
        await mutateFinanceState(db, userId, (finance) => {
          const catalog = categoryCatalog(finance.categoryCatalog);
          const current = catalog.find((item) => item.name === previous);
          if (current) current.name = next;
          else if (!catalog.some((item) => item.name === next)) catalog.push({ name: next, subcategories: [] });
          finance.categoryCatalog = categoryCatalog(catalog);
          return finance;
        });
        return res.status(200).json({ ok: true });
      }

      if (kind === "create_subcategory" || kind === "rename_subcategory" || kind === "delete_subcategory") {
        const targetCategory = cleanText(body.category, 60).toLowerCase();
        const previous = cleanText(body.previousSubcategory, 80);
        const next = cleanText(body.subcategory, 80);
        if (!targetCategory || (kind !== "delete_subcategory" && !next)) return res.status(400).json({ error: "Enter a category and sub-category name." });
        if (kind !== "create_subcategory" && !previous) return res.status(400).json({ error: "Select a sub-category first." });

        const { finance: existing } = await readFinanceState(db, userId);
        const existingGroup = categoryCatalog(existing.categoryCatalog).find((item) => item.name === targetCategory);
        if (kind === "create_subcategory" && existingGroup?.subcategories.some((item) => item.toLowerCase() === next.toLowerCase())) {
          return res.status(400).json({ error: "This sub-category already exists." });
        }

        await mutateFinanceState(db, userId, (finance) => {
          const catalog = categoryCatalog(finance.categoryCatalog);
          let group = catalog.find((item) => item.name === targetCategory);
          if (!group) { group = { name: targetCategory, subcategories: [] }; catalog.push(group); }
          if (kind === "create_subcategory") {
            if (!group.subcategories.some((item) => item.toLowerCase() === next.toLowerCase())) group.subcategories.push(next);
          } else {
            group.subcategories = group.subcategories.filter((item) => item !== previous);
            if (kind === "rename_subcategory") group.subcategories.push(next);
            finance.expenseMetadata = finance.expenseMetadata && typeof finance.expenseMetadata === "object" ? finance.expenseMetadata : {};
            for (const metadata of Object.values(finance.expenseMetadata)) {
              if (metadata?.subcategory !== previous) continue;
              if (kind === "rename_subcategory") metadata.subcategory = next;
              else delete metadata.subcategory;
            }
          }
          finance.categoryCatalog = categoryCatalog(catalog);
          return finance;
        });
        return res.status(200).json({ ok: true });
      }

      if (kind === "update_expense_category") {
        const id = cleanText(body.id, 80);
        const newCategory = cleanText(body.category, 60).toLowerCase();
        const subcategory = cleanText(body.subcategory, 80);
        if (!id || !newCategory) {
          return res.status(400).json({ error: "Expense ID and category are required." });
        }
        await db.execute({
          sql: "UPDATE expenses SET category = ? WHERE id = ? AND user_id = ?",
          args: [newCategory, id, userId],
        });
        await mutateFinanceState(db, userId, (finance) => {
          finance.expenseMetadata = finance.expenseMetadata && typeof finance.expenseMetadata === "object" ? finance.expenseMetadata : {};
          const metadata = { ...(finance.expenseMetadata[id] || {}) };
          if (subcategory) metadata.subcategory = subcategory;
          else delete metadata.subcategory;
          if (Object.keys(metadata).length) finance.expenseMetadata[id] = metadata;
          else delete finance.expenseMetadata[id];
          return finance;
        });
        return res.status(200).json({ ok: true });
      }

      if (!["expense", "income"].includes(kind) || !amount || !validDate(date) || !/^[A-Z]{3}$/.test(currency)) {
        return res.status(400).json({ error: "Enter a positive amount, valid date, and 3-letter currency code." });
      }

      if (kind === "expense") {
        if (!category) return res.status(400).json({ error: "Choose an expense category." });
        const expenseId = randomUUID();
        await db.execute({
          sql: "INSERT INTO expenses (id,user_id,amount_minor,currency,category,description,date,created_at) VALUES (?,?,?,?,?,?,?,?)",
          args: [expenseId, userId, amount, currency, category, description || "Expense", date, now],
        });

        const merchant = cleanText(body.merchant, 80);
        const paymentMethod = cleanText(body.paymentMethod, 40);
        const subcategory = cleanText(body.subcategory, 80);
        const tags = Array.isArray(body.tags)
          ? body.tags.map((tag) => cleanText(tag, 30)).filter(Boolean).slice(0, 8)
          : cleanText(body.tags, 120).split(",").map((tag) => cleanText(tag, 30)).filter(Boolean).slice(0, 8);
        if (merchant || paymentMethod || tags.length || subcategory) {
          await mutateFinanceState(db, userId, (finance) => {
            finance.expenseMetadata = finance.expenseMetadata && typeof finance.expenseMetadata === "object" ? finance.expenseMetadata : {};
            finance.expenseMetadata[expenseId] = { merchant, paymentMethod, tags, subcategory };
            return finance;
          });
        }
      } else {
        await mutateFinanceState(db, userId, (finance) => {
          finance.incomes = Array.isArray(finance.incomes) ? finance.incomes : [];
          finance.incomes.push({
            id: randomUUID(),
            amountMinor: amount,
            currency,
            source: cleanText(body.source, 80) || category || "Income",
            date,
            notes: description,
            createdAt: now,
          });
          return finance;
        });
      }
      return res.status(201).json({ ok: true });
    }

    const month = validMonth(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const current = monthRange(month);
    const previous = previousMonth(month);
    const previousRange = monthRange(previous);

    const [expenseResult, previousExpenseResult, budgetResult, financeState] = await Promise.all([
      db.execute({ sql: "SELECT id,date,category,description,amount_minor,currency,created_at FROM expenses WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 200", args: [userId, current.from, current.to] }),
      db.execute({ sql: "SELECT amount_minor,currency FROM expenses WHERE user_id = ? AND date >= ? AND date <= ?", args: [userId, previousRange.from, previousRange.to] }),
      db.execute({ sql: "SELECT category,amount_minor,currency FROM budgets WHERE user_id = ? ORDER BY created_at DESC", args: [userId] }),
      readFinanceState(db, userId),
    ]);

    const finance = financeState.finance;
    // The expenses table is the single source of truth; the JSON blob only
    // carries per-expense metadata now.
    const expenses = expenseResult.rows.map((row) => ({
      id: row.id,
      date: row.date,
      category: row.category,
      description: row.description,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
    }));

    const budgets = budgetResult.rows.map((row) => ({ category: row.category, amountMinor: Number(row.amount_minor), currency: row.currency }));
    const currency = budgets.find((budget) => budget.category === null)?.currency || finance.currency || expenses[0]?.currency || finance.incomes?.[0]?.currency || "BDT";
    const spentMinor = expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);

    const incomes = (finance.incomes || []).filter((income) => inMonth(income, month));
    const previousIncomes = (finance.incomes || []).filter((income) => inMonth(income, previous));
    const incomeMinor = incomes.reduce((sum, income) => sum + Number(income.amountMinor || 0), 0);
    const previousIncomeMinor = previousIncomes.reduce((sum, income) => sum + Number(income.amountMinor || 0), 0);
    const previousSpentMinor = previousExpenseResult.rows.reduce((sum, row) => sum + Number(row.amount_minor || 0), 0);

    let overallBudgetMinor = budgets.find((budget) => budget.category === null)?.amountMinor;
    if ((overallBudgetMinor === undefined || overallBudgetMinor === null) && finance.budgetMinor) {
      overallBudgetMinor = Number(finance.budgetMinor);
    }
    if (overallBudgetMinor === undefined) overallBudgetMinor = null;

    const categories = Object.entries(expenses.reduce((totals, expense) => {
      totals[expense.category] = (totals[expense.category] || 0) + expense.amountMinor;
      return totals;
    }, {})).map(([name, amountMinor]) => ({ name, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
    const daily = Object.entries(expenses.reduce((days, expense) => {
      days[expense.date] = (days[expense.date] || 0) + expense.amountMinor;
      return days;
    }, {})).map(([date, amountMinor]) => ({ date, amountMinor })).sort((a, b) => a.date.localeCompare(b.date));
    const dailyIncome = Object.entries(incomes.reduce((days, income) => {
      days[income.date] = (days[income.date] || 0) + Number(income.amountMinor || 0);
      return days;
    }, {})).map(([date, amountMinor]) => ({ date, amountMinor })).sort((a, b) => a.date.localeCompare(b.date));
    const recurring = (finance.recurring || []).filter((entry) => entry.active);

    const storedProfileResult = await db.execute({
      sql: "SELECT display_name,profile_photo_url FROM app_users WHERE user_id = ? LIMIT 1",
      args: [userId],
    });
    const storedProfile = {
      displayName: cleanDisplayName(storedProfileResult.rows[0]?.display_name),
      profilePhotoUrl: cleanProfilePhoto(storedProfileResult.rows[0]?.profile_photo_url),
    };
    const mcpizeProfile = session.displayName && session.profilePhotoUrl
      ? { displayName: "", profilePhotoUrl: "" }
      : await readMcpizeProfile(userId);
    const resolvedProfile = {
      displayName: session.displayName || mcpizeProfile.displayName || storedProfile.displayName || "",
      profilePhotoUrl: session.profilePhotoUrl || mcpizeProfile.profilePhotoUrl || storedProfile.profilePhotoUrl || "",
    };

    await recordActivity(db, {
      userId,
      source: "dashboard",
      eventType: "dashboard_viewed",
      detail: { month },
      displayName: resolvedProfile.displayName,
      profilePhotoUrl: resolvedProfile.profilePhotoUrl,
    });

    return res.status(200).json({
      user: {
        displayName: resolvedProfile.displayName || "User",
        profilePhotoUrl: resolvedProfile.profilePhotoUrl,
      },
      month,
      previousMonth: previous,
      daysInMonth: current.days,
      currency,
      spentMinor,
      incomeMinor,
      previousSpentMinor,
      previousIncomeMinor,
      budgetMinor: overallBudgetMinor ?? null,
      categories,
      expenses,
      daily,
      dailyIncome,
      incomes,
      recurring,
      goals: Array.isArray(finance.goals) ? finance.goals : [],
      expenseMetadata: finance.expenseMetadata || {},
      categoryCatalog: categoryCatalog(finance.categoryCatalog),
      alertThresholds: Array.isArray(finance.alertThresholds) ? finance.alertThresholds : [50, 80, 100],
      preferences: safeSettings(finance.settings),
      preferencesConfigured: Boolean(finance.settings && Object.keys(finance.settings).length),
      labels: { spent: money(spentMinor, currency), income: money(incomeMinor, currency) },
    });
  } catch (error) {
    console.error("dashboard query failed", error);
    return res.status(500).json({ error: "Dashboard is temporarily unavailable.", code: "dashboard_database_unavailable" });
  }
}
