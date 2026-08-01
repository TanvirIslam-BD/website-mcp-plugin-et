const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const token = params.get("dashboard_token");
const selectedMonth = params.get("month") || new Date().toISOString().slice(0, 7);
const DASHBOARD_LOGIN_URL = "/api/dashboard-auth";

function timeGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function syncThemeSwitch() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const active = button.dataset.themeChoice === current;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function redirectToMcpizeAuth() {
  // The Vercel API starts the MCPize OAuth + PKCE flow and the /authorize
  // callback stores the resulting short-lived dashboard session securely.
  location.replace(`${DASHBOARD_LOGIN_URL}?month=${encodeURIComponent(selectedMonth)}`);
}

function authRequiredError() {
  const error = new Error("Your dashboard session is missing or expired.");
  error.code = "AUTH_REQUIRED";
  return error;
}

const colors = ["#ff4548", "#2563ff", "#ffb21c", "#22b76b", "#7c3fff", "#289bd6", "#4757d9"];
const tagColors = {
  food: ["#ff4548", "#fff0f0"],
  "food & dining": ["#ff4548", "#fff0f0"],
  groceries: ["#22b76b", "#e9fbf2"],
  shopping: ["#7c3fff", "#f2edff"],
  travel: ["#ff4548", "#fff0f0"],
  transport: ["#2563ff", "#edf3ff"],
  utilities: ["#22b76b", "#e9fbf2"],
  bills: ["#ffb21c", "#fff7e6"],
  health: ["#289bd6", "#e9f8ff"],
  income: ["#18b96f", "#e8faef"],
};

const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  "\"": "&quot;",
}[char]));

function icon(name) {
  const paths = {
    dashboard: "<path d='M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'/>",
    transactions: "<path d='M6 3h12v18H6z'/><path d='M9 7h6M9 11h6M9 15h4'/>",
    analytics: "<path d='M4 19V5m0 14h16'/><path d='m7 15 4-5 4 3 5-8'/>",
    budget: "<circle cx='12' cy='12' r='9'/><path d='M12 7v10m3-7.5c0-1.2-1.3-2-3-2s-3 .8-3 2 1.3 2 3 2 3 .8 3 2-1.3 2-3 2-3-.8-3-2'/>",
    accounts: "<path d='M4 9h16L12 4z'/><path d='M6 10v7m4-7v7m4-7v7m4-7v7M3 20h18'/>",
    categories: "<path d='M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z'/>",
    bills: "<path d='M7 3h10l2 4v14H5V7z'/><path d='M9 11h6M9 15h6'/>",
    goals: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='4'/><circle cx='12' cy='12' r='1'/>",
    advisor: "<path d='m12 2 1.5 5L18 9l-4.5 2L12 16l-1.5-5L6 9l4.5-2z'/><path d='M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'/>",
    settings: "<path d='M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z'/><circle cx='12' cy='12' r='3'/>",
    wallet: "<path d='M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12'/><path d='M16 14h.01'/>",
    down: "<path d='M12 4v14'/><path d='m6 12 6 6 6-6'/>",
    up: "<path d='M12 20V6'/><path d='m6 12 6-6 6 6'/>",
    piggy: "<path d='M19 8h2v4h-2'/><path d='M4 8 2 6m3 10v3m10-3v3m-5-13c2-2 6-1 7 2 2 0 3 2 3 4 0 4-4 7-9 7s-9-3-9-7c0-3 2-5 5-6 0-2 2-3 4-3'/><path d='M9 12h.01'/>",
    search: "<circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/>",
    bell: "<path d='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9'/><path d='M10 21h4'/>",
    plus: "<path d='M12 5v14M5 12h14'/>",
    close: "<path d='M6 6l12 12M18 6 6 18'/>",
    card: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 10h18'/>",
    lock: "<rect x='5' y='10' width='14' height='11' rx='2'/><path d='M8 10V7a4 4 0 0 1 8 0v3'/>",
    attachment: "<path d='m20.5 11.5-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9'/>",
    copy: "<rect x='9' y='9' width='13' height='13' rx='2' ry='2'/><path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'/>",
    mail: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='m3 7 9 6 9-6'/>",
    send: "<path d='m4 4 17 8-17 8 3-8z'/><path d='M7 12h14'/>",
    database: "<ellipse cx='12' cy='5' rx='8' ry='3'/><path d='M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5'/><path d='M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'/>",
    logout: "<path d='M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5'/><path d='m15 8 4 4-4 4M19 12H8'/>",
    flame: "<path d='M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-.7 3.2-2 4-1.3-3-1-6-1-10-4 3-7 7-7 12 0 5 3 8 7 8z'/>",
    chevron: "<path d='m9 18 6-6-6-6'/>",
    eye: "<path d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z'/><circle cx='12' cy='12' r='3'/>",
    sun: "<circle cx='12' cy='12' r='4'/><path d='M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'/>",
    moon: "<path d='M20 15.2A8.2 8.2 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2z'/>",
    menu: "<path d='M4 6h16M4 12h16M4 18h16'/>",
    microphone: "<rect x='9' y='3' width='6' height='12' rx='3'/><path d='M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6'/>",
    camera: "<path d='M4 7h4l1.5-2h5L16 7h4v12H4z'/><circle cx='12' cy='13' r='3.5'/>",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.dashboard}</svg>`;
}

function formatMoney(minor, currency, options = {}) {
  const value = Math.abs(Number(minor || 0)) / 100;
  const sign = Number(minor || 0) < 0 ? "-" : "";
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 0 : 2,
  });
  if (currency === "BDT") return `${sign}\u09F3${formatted}`;
  if (currency === "USD") return `${sign}$${formatted}`;
  return `${sign}${currency} ${formatted}`;
}

function monthLabel(month) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, number - 1, 1)));
}

function percentChange(current, previous, inverse = false) {
  if (!previous && !current) return 0;
  if (!previous) return current ? 100 : 0;
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const value = inverse ? -raw : raw;
  return Math.round(value * 10) / 10;
}

function daysInMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).getUTCDate();
}

function todayDay(month) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  return month === thisMonth ? now.getUTCDate() : daysInMonth(month);
}

function moneyInputValue(minor) {
  return minor ? (Number(minor) / 100).toFixed(2) : "";
}

function toneFor(value, index = 0) {
  const key = String(value || "").toLowerCase();
  return tagColors[key] || [colors[index % colors.length], "#eef3ff"];
}

function groupByDate(items, month, key = "amountMinor") {
  const totalDays = daysInMonth(month);
  const values = Array.from({ length: totalDays }, () => 0);
  for (const item of items || []) {
    const date = String(item.date || "");
    if (date.slice(0, 7) !== month) continue;
    const day = Number(date.slice(8, 10));
    if (day >= 1 && day <= totalDays) values[day - 1] += Number(item[key] || 0);
  }
  return values;
}

function cumulative(values) {
  let total = 0;
  return values.map((value) => {
    total += value;
    return total;
  });
}

function linePoints(values, width, height, padX, padY, maxValue) {
  const count = Math.max(values.length - 1, 1);
  const max = Math.max(maxValue, ...values, 1);
  return values.map((value, index) => {
    const x = padX + ((width - padX * 2) * index) / count;
    const y = height - padY - ((height - padY * 2) * value) / max;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function areaPath(points, height, padY) {
  const pairs = points.split(" ");
  if (!pairs.length) return "";
  return `M ${pairs[0]} L ${pairs.join(" L ")} L ${pairs[pairs.length - 1].split(",")[0]},${height - padY} L ${pairs[0].split(",")[0]},${height - padY} Z`;
}

function spark(values, tone = "currentColor") {
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => `${(index * 100 / Math.max(values.length - 1, 1)).toFixed(1)},${(48 - (value / max) * 38).toFixed(1)}`).join(" ");
  return `<div class="sparkline" style="color:${tone}"><svg viewBox="0 0 100 50" preserveAspectRatio="none"><polyline points="${points}"/></svg></div>`;
}

function trendBadge(value, label, mode = "good") {
  const className = mode === "bad" ? "trend bad" : mode === "purple" ? "trend purple" : "trend";
  const arrow = value >= 0 ? "▲" : "▼";
  return `<span class="${className}">${arrow} ${Math.abs(value).toFixed(1)}% <span>${esc(label)}</span></span>`;
}

async function loadDashboard() {
  const urlParams = new URLSearchParams({ month: selectedMonth });
  if (token) urlParams.set("dashboard_token", token);
  const response = await fetch(`/api/dashboard?${urlParams}`, { credentials: "same-origin" });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) throw authRequiredError();
  if (!response.ok) throw new Error(body.error || "Unable to open dashboard.");
  if (token) history.replaceState({}, "", `${location.pathname}?month=${selectedMonth}${location.hash || ""}`);
  return body;
}

function buildModel(data) {
  const currency = data.currency || "USD";
  const month = data.month || selectedMonth;
  const expenseDaily = groupByDate(data.daily || data.expenses || [], month);
  const incomeDaily = groupByDate(data.dailyIncome || data.incomes || [], month);
  const expenseCum = cumulative(expenseDaily);
  const incomeCum = cumulative(incomeDaily);
  const savingsCum = incomeCum.map((value, index) => Math.max(0, value - expenseCum[index]));
  const savedMinor = Number(data.incomeMinor || 0) - Number(data.spentMinor || 0);
  const budgetMinor = data.budgetMinor === null || data.budgetMinor === undefined ? null : Number(data.budgetMinor);
  const remainingMinor = budgetMinor === null ? null : budgetMinor - Number(data.spentMinor || 0);
  const budgetUsed = budgetMinor ? Math.round((Number(data.spentMinor || 0) / budgetMinor) * 100) : 0;
  const elapsed = Math.max(1, todayDay(month));
  const forecastMinor = Math.round((Number(data.spentMinor || 0) / elapsed) * daysInMonth(month));
  const savingsRate = data.incomeMinor ? Math.round((savedMinor / data.incomeMinor) * 100) : 0;
  const health = Math.max(38, Math.min(97, Math.round(70 + Math.min(18, Math.max(-18, savingsRate / 2)) - Math.max(0, budgetUsed - 100) / 3)));
  const hasFinancialData = Boolean(
    Number(data.spentMinor || 0) ||
    Number(data.incomeMinor || 0) ||
    budgetMinor !== null ||
    (data.expenses || []).length ||
    (data.incomes || []).length ||
    (data.categories || []).length ||
    (data.recurring || []).length ||
    (data.goals || []).length
  );
  return {
    ...data,
    currency,
    month,
    expenseDaily,
    incomeDaily,
    expenseCum,
    incomeCum,
    savingsCum,
    savedMinor,
    budgetMinor,
    remainingMinor,
    budgetUsed,
    forecastMinor,
    savingsRate,
    health,
    hasFinancialData,
  };
}

function renderMetricCards(model) {
  const balanceSpark = model.savingsCum.length ? model.savingsCum : [1, 2, 1, 3, 4, 3, 5];
  const incomeSpark = model.incomeDaily.length ? model.incomeDaily : [1, 2, 3, 2, 4, 3, 5];
  const expenseSpark = model.expenseDaily.length ? model.expenseDaily : [1, 3, 4, 3, 2, 5, 4];
  const previousSaved = Number(model.previousIncomeMinor || 0) - Number(model.previousSpentMinor || 0);
  const metrics = [
    {
      className: `balance ${model.savedMinor < 0 ? "is-negative" : ""}`,
      label: "Balance",
      value: Math.abs(model.savedMinor),
      trend: percentChange(Math.abs(model.savedMinor), Math.abs(previousSaved)),
      trendDirection: model.savedMinor >= 0 ? 1 : -1,
      favorable: model.savedMinor >= 0,
      iconName: "wallet",
      spark: balanceSpark,
      sparkTone: model.savedMinor < 0 ? "#ff334f" : "#2f63ff",
    },
    {
      className: "income",
      label: "Income",
      value: model.incomeMinor,
      trend: percentChange(model.incomeMinor, model.previousIncomeMinor),
      trendDirection: percentChange(model.incomeMinor, model.previousIncomeMinor),
      favorable: Number(model.incomeMinor || 0) >= Number(model.previousIncomeMinor || 0),
      iconName: "analytics",
      spark: incomeSpark,
      sparkTone: "#0fbd71",
    },
    {
      className: "expense",
      label: "Spent",
      value: model.spentMinor,
      trend: percentChange(model.spentMinor, model.previousSpentMinor),
      trendDirection: percentChange(model.spentMinor, model.previousSpentMinor),
      favorable: Number(model.spentMinor || 0) <= Number(model.previousSpentMinor || 0),
      iconName: "card",
      spark: expenseSpark,
      sparkTone: "#ff6a18",
    },
    {
      className: `saving ${model.savedMinor < 0 ? "is-negative" : ""}`,
      label: "Saved",
      value: model.savedMinor,
      trend: percentChange(model.savedMinor, previousSaved),
      trendDirection: model.savedMinor >= 0 ? 1 : -1,
      favorable: model.savedMinor >= 0,
      iconName: "piggy",
      spark: balanceSpark,
      sparkTone: model.savedMinor < 0 ? "#4a65ff" : "#2563ff",
    },
  ];
  return `
    <section class="summary-grid" aria-label="Monthly summary">
      ${metrics.map((metric) => `
        <article class="metric-card ${metric.className}">
          <div class="metric-card-main">
            <span class="metric-icon">${icon(metric.iconName)}</span>
            <div class="metric-copy">
              <label>${metric.label}</label>
              <h2>${formatMoney(metric.value, model.currency, { compact: true })}</h2>
              <span class="metric-trend ${metric.favorable ? "positive" : "negative"}">
                ${icon(metric.trendDirection >= 0 ? "up" : "down")}
                <b>${Math.abs(metric.trend).toFixed(1)}%</b>
                <small>vs last month</small>
              </span>
            </div>
            <span class="metric-direction ${metric.favorable ? "positive" : "negative"}">${icon(metric.favorable ? "up" : "down")}</span>
          </div>
          ${spark(metric.spark, metric.sparkTone)}
        </article>
      `).join("")}
    </section>
  `;
}

function renderHealth(model) {
  const recurringMonths = Math.max(0, Math.round((Math.max(0, model.savedMinor) / Math.max(1, model.spentMinor || 1)) * 10) / 10);
  return `
    <article class="panel financial-health" id="analytics">
      <div class="panel-head">
        <h3>Financial health</h3>
      </div>
      <div class="health-body">
        <div class="score-ring" style="--score:${model.health}%">
          <div class="inner"><b>${model.health}</b><span>/ 100</span></div>
        </div>
        <div class="health-stats">
          <div class="health-stat"><span><i class="status-dot" style="--tone:#ff4548;--tone-bg:#fff0f0">${icon("budget")}</i>Budget</span><b class="negative">${model.budgetMinor ? `${model.budgetUsed}%` : "Not set"}</b></div>
          <div class="health-stat"><span><i class="status-dot" style="--tone:#18b96f;--tone-bg:#e8faef">${icon("card")}</i>Debt</span><b class="good">Low</b></div>
          <div class="health-stat"><span><i class="status-dot" style="--tone:#06133a;--tone-bg:#f1f4f8">${icon("wallet")}</i>Emergency fund</span><b>${recurringMonths} months</b></div>
        </div>
      </div>
      <button class="panel-footer-link" data-panel="analytics">View details</button>
    </article>
  `;
}

function renderIncomeExpense(model) {
  const width = 600;
  const height = 178;
  const padX = 34;
  const padY = 24;
  const max = Math.max(...model.incomeCum, ...model.expenseCum, ...model.savingsCum, 1);
  const incomePoints = linePoints(model.incomeCum, width, height, padX, padY, max);
  const expensePoints = linePoints(model.expenseCum, width, height, padX, padY, max);
  const savingPoints = linePoints(model.savingsCum, width, height, padX, padY, max);
  const midIndex = Math.floor(model.incomeCum.length / 2);
  const midDay = `${String(midIndex + 1).padStart(2, "0")} ${monthLabel(model.month).split(" ")[0]} ${model.month.slice(0, 4)}`;
  return `
    <article class="panel large-chart" data-income-expense-chart>
      <div class="panel-head">
        <h3>Cash flow</h3>
        <div class="chart-tools">
          <div class="legend">
            <span><i style="--tone:#18b96f"></i>Income</span>
            <span><i style="--tone:#ff4548"></i>Expenses</span>
            <span><i style="--tone:#2563ff"></i>Savings</span>
          </div>
          <select class="period-select" aria-label="Chart period" data-chart-mode>
            <option value="month">This Month</option>
            <option value="daily">Daily</option>
            <option value="week">Last 7 Days</option>
          </select>
        </div>
      </div>
      <div class="income-expense-chart">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Income expense and savings chart">
          <defs>
            <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#18b96f" stop-opacity=".18"/><stop offset="1" stop-color="#18b96f" stop-opacity="0"/></linearGradient>
            <linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff4548" stop-opacity=".14"/><stop offset="1" stop-color="#ff4548" stop-opacity="0"/></linearGradient>
          </defs>
          <line class="grid-line" x1="${padX}" y1="35" x2="${width - 8}" y2="35"/>
          <line class="grid-line" x1="${padX}" y1="72" x2="${width - 8}" y2="72"/>
          <line class="grid-line" x1="${padX}" y1="109" x2="${width - 8}" y2="109"/>
          <line class="grid-line" x1="${padX}" y1="146" x2="${width - 8}" y2="146"/>
          <path class="chart-area-income" data-chart-area="income" d="${areaPath(incomePoints, height, padY)}"/>
          <path class="chart-area-expense" data-chart-area="expense" d="${areaPath(expensePoints, height, padY)}"/>
          <polyline class="chart-line income" data-chart-line="income" points="${incomePoints}"/>
          <polyline class="chart-line expense" data-chart-line="expense" points="${expensePoints}"/>
          <polyline class="chart-line saving" data-chart-line="saving" points="${savingPoints}"/>
          <line class="chart-cursor" data-chart-cursor x1="0" x2="0" y1="${padY}" y2="${height - padY}"/>
          <circle class="chart-point income" data-chart-point="income" r="4" stroke="#18b96f"/>
          <circle class="chart-point expense" data-chart-point="expense" r="4" stroke="#ff4548"/>
          <circle class="chart-point saving" data-chart-point="saving" r="4" stroke="#2563ff"/>
          <rect class="chart-hitbox" data-chart-hitbox x="${padX}" y="0" width="${width - padX * 2}" height="${height}" rx="4"/>
        </svg>
        <div class="chart-y-axis" aria-hidden="true">
          <span data-axis-label="max">${formatMoney(max, model.currency, { compact: true })}</span>
          <span data-axis-label="mid">${formatMoney(max * .66, model.currency, { compact: true })}</span>
          <span data-axis-label="low">${formatMoney(max * .33, model.currency, { compact: true })}</span>
          <span>0</span>
        </div>
        <div class="chart-x-axis" aria-hidden="true">
          <span data-x-label="start">1 ${monthLabel(model.month).split(" ")[0]}</span>
          <span data-x-label="mid">15 ${monthLabel(model.month).split(" ")[0]}</span>
          <span data-x-label="end">${daysInMonth(model.month)} ${monthLabel(model.month).split(" ")[0]}</span>
        </div>
        <div class="chart-tooltip" data-chart-tooltip>
          <b data-tip-date>${esc(midDay)}</b>
          <span><label>Income</label><strong data-tip-income style="color:#32df8b">${formatMoney(model.incomeCum[midIndex] || 0, model.currency)}</strong></span>
          <span><label>Expenses</label><strong data-tip-expense style="color:#ff7073">${formatMoney(model.expenseCum[midIndex] || 0, model.currency)}</strong></span>
          <span><label>Savings</label><strong data-tip-saving style="color:#66a0ff">${formatMoney(model.savingsCum[midIndex] || 0, model.currency)}</strong></span>
        </div>
      </div>
    </article>
  `;
}

function renderBudget(model) {
  const used = model.budgetMinor ? model.budgetUsed : 0;
  const ring = Math.max(2, Math.min(100, used));
  const isOver = model.remainingMinor !== null && model.remainingMinor < 0;
  return `
    <article class="panel budget-panel" id="budget">
      <div class="panel-head">
        <h3>Budget</h3>
        <button class="panel-menu" data-panel="budget-editor" aria-label="Edit monthly budget">•••</button>
      </div>
      <div class="budget-ring" style="--budget:${ring}%">
        <div class="inner"><b>${model.budgetMinor ? `${used}%` : "--"}</b><span>${model.budgetMinor ? "used" : "No budget"}</span></div>
      </div>
      <p class="budget-total"><b>${formatMoney(model.spentMinor, model.currency, { compact: true })}</b> of <b>${model.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "--"}</b></p>
      <p class="budget-over ${isOver ? "negative" : "positive"}">${model.remainingMinor === null ? "Set a monthly budget" : isOver ? `${formatMoney(Math.abs(model.remainingMinor), model.currency, { compact: true })} over` : `${formatMoney(model.remainingMinor, model.currency, { compact: true })} remaining`}</p>
      <button class="panel-footer-link mobile-budget-link" data-panel="budget-editor">Plan budget ${icon("chevron")}</button>
    </article>
  `;
}

function renderCategories(model) {
  const total = Math.max(model.spentMinor || 0, 1);
  let stop = 0;
  const donutStops = (model.categories || []).slice(0, 5).map((category, index) => {
    const start = stop;
    stop += (Number(category.amountMinor || 0) / total) * 100;
    return `${colors[index % colors.length]} ${start.toFixed(1)}% ${Math.min(stop, 100).toFixed(1)}%`;
  });
  if (stop < 100) donutStops.push(`#e8edf4 ${Math.max(stop, 0).toFixed(1)}% 100%`);
  const rows = (model.categories || []).slice(0, 5).map((category, index) => {
    const percentage = Math.round((Number(category.amountMinor || 0) / total) * 100);
    return `<div class="category-line"><i style="--tone:${colors[index % colors.length]}">${icon(["up", "transactions", "card", "bills", "categories"][index] || "categories")}</i><label>${esc(category.name)}</label><b><span class="category-amount">${formatMoney(category.amountMinor, model.currency, { compact: true })}</span> <small><span class="category-paren">(</span>${percentage}%<span class="category-paren">)</span></small></b></div>`;
  }).join("") || `<div class="empty-state">No category data yet.</div>`;
  return `
    <article class="panel spending-panel" id="categories">
      <div class="panel-head">
        <h3>Spending breakdown</h3>
      </div>
      <div class="spending-report">
        <div class="spending-donut" style="--segments:${donutStops.length ? `conic-gradient(${donutStops.join(",")})` : "conic-gradient(#e8edf4 0 100%)"}">
          <div><b>${formatMoney(model.spentMinor, model.currency, { compact: true })}</b><span>Total spent</span></div>
        </div>
        <div class="category-legend">${rows}</div>
      </div>
      <button class="panel-footer-link" data-panel="categories">View all categories</button>
    </article>
  `;
}

function renderInsights(model) {
  const top = model.categories?.[0];
  const over = model.remainingMinor !== null && model.remainingMinor < 0;
  const forecastOver = model.budgetMinor && model.forecastMinor > model.budgetMinor;
  const items = [
    top ? { tone: "#2563ff", bg: "#edf3ff", title: `You spent most on ${top.name}`, body: `${formatMoney(top.amountMinor, model.currency)} is your largest category this month.`, iconName: "budget" } : null,
    over ? { tone: "#ff4548", bg: "#fff0f0", title: "Budget limit crossed", body: `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over the monthly limit.`, iconName: "up" } : { tone: "#18b96f", bg: "#e8faef", title: "Budget status is stable", body: model.budgetMinor ? `${formatMoney(model.remainingMinor, model.currency)} still available.` : "Create a monthly budget to unlock alerts.", iconName: "down" },
    forecastOver ? { tone: "#ff9f1c", bg: "#fff7e6", title: "Pace is running high", body: `Forecast is ${formatMoney(model.forecastMinor, model.currency)} by month end.`, iconName: "analytics" } : { tone: "#18b96f", bg: "#e8faef", title: "Possible monthly saving", body: `Current net is ${formatMoney(model.savedMinor, model.currency)}.`, iconName: "piggy" },
  ].filter(Boolean);
  return `
    <article class="panel insights-panel">
      <div class="panel-head">
        <h3>Smart insights</h3>
      </div>
      <div class="insight-list">
        ${items.map((item) => `<button class="insight-item" data-open-ai-chat data-ai-prefill="${esc(item.title)}"><i style="--tone:${item.tone};--tone-bg:${item.bg}">${icon(item.iconName)}</i><span><b>${esc(item.title)}</b></span>${icon("chevron")}</button>`).join("")}
      </div>
      <button class="panel-footer-link" data-open-ai-chat>Ask AI Advisor</button>
    </article>
  `;
}

function renderGoals(model) {
  const saved = Math.max(0, model.savedMinor);
  const goal = model.goals?.[0] || { name: "Savings Goal", targetMinor: Math.max(saved || 0, model.incomeMinor || 100000) };
  const goalPct = Math.min(100, Math.round((saved / Math.max(goal.targetMinor || 1, 1)) * 100));
  const budgetPct = model.budgetMinor ? Math.min(100, model.budgetUsed) : 0;
  return `
    <article class="panel goals-panel" id="goals">
      <div class="panel-head">
        <h3>Goals</h3>
        <button class="panel-link" data-panel="goal-editor">View All</button>
      </div>
      <div class="goals-list">
        <div class="goal-card">
          <div class="goal-art">${icon("piggy")}</div>
          <div><b>${esc(goal.name || "Savings Goal")}</b><small>${formatMoney(saved, model.currency)} / ${formatMoney(goal.targetMinor || 0, model.currency)}</small><div class="progress-track" style="--value:${Math.max(4, goalPct)}%"><i></i></div></div>
          <strong class="goal-percent">${goalPct}%</strong>
        </div>
        <div class="goal-card">
          <div class="goal-art">${icon("budget")}</div>
          <div><b>Budget Discipline</b><small>${model.budgetMinor ? `${model.budgetUsed}% of limit used` : "Set a monthly limit"}</small><div class="progress-track" style="--value:${Math.max(4, budgetPct)}%"><i></i></div></div>
          <strong class="goal-percent">${budgetPct}%</strong>
        </div>
      </div>
    </article>
  `;
}

function renderBillsAndSubscriptions(model) {
  const recurring = (model.recurring || []).slice(0, 8);
  const bills = recurring.slice(0, 3).map((bill, index) => {
    const [tone, bg] = [["#ff9f1c", "#fff7e6"], ["#2563ff", "#edf3ff"], ["#18b96f", "#e8faef"]][index % 3];
    return `<div class="mini-row"><i class="bill-icon" style="--tone:${tone};--tone-bg:${bg}">${icon(index === 0 ? "up" : "bills")}</i><span><b>${esc(bill.merchant || bill.description || bill.category)}</b><small>${esc(bill.nextDate || bill.frequency || "Scheduled")}</small></span><strong>${formatMoney(bill.amountMinor, model.currency, { compact: true })}</strong></div>`;
  }).join("") || `<div class="empty-state">No upcoming bills.</div>`;
  const subscriptions = recurring.slice(0, 4).map((bill, index) => {
    const [tone, bg] = toneFor(bill.category, index);
    return `<div class="mini-row"><i class="subscription-icon" style="--tone:${tone};--tone-bg:${bg}">${icon("card")}</i><span><b>${esc(bill.merchant || bill.description || bill.category)}</b><small>${esc(bill.frequency || "Recurring")}</small></span><strong>${formatMoney(bill.amountMinor, model.currency, { compact: true })}</strong></div>`;
  }).join("") || `<div class="empty-state">No subscriptions tracked.</div>`;
  return `
    <div class="side-stack">
      <article class="panel mini-panel" id="bills">
        <div class="panel-head"><h3>Upcoming Bills</h3><button class="panel-link" data-panel="bills">View All</button></div>
        <div class="mini-list">${bills}</div>
      </article>
      <article class="panel mini-panel" id="subscriptions">
        <div class="panel-head"><h3>Subscriptions</h3><button class="panel-link" data-panel="bills">View All</button></div>
        <div class="mini-list">${subscriptions}</div>
      </article>
    </div>
  `;
}

function renderTransactions(model) {
  const expenses = (model.expenses || []).slice(0, 6);
  const rows = expenses.map((expense, index) => {
    const metadata = model.expenseMetadata?.[expense.id] || {};
    const [tone, bg] = toneFor(expense.category, index);
    const merchant = metadata.merchant || expense.merchant || expense.description || "Expense";
    const payment = metadata.paymentMethod || "Expense";
    const date = String(expense.date || "");
    const dateLabel = index === 0 ? "Today" : index === 1 ? "Yesterday" : date ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Recent";
    const timeLabel = metadata.time || ["09:30 AM", "07:20 PM", "08:15 PM"][index] || "";
    return `
      <tr data-search="${esc(`${expense.date} ${merchant} ${expense.category} ${payment}`.toLowerCase())}">
        <td>${esc(expense.date)}</td>
        <td><div class="tx-title"><i style="--tone:${tone};--tone-bg:${bg}">${icon(index === 0 ? "transactions" : index === 1 ? "bills" : "categories")}</i><span><b>${esc(merchant)}</b><small class="mobile-transaction-meta">${esc(dateLabel)}${timeLabel ? `, ${esc(timeLabel)}` : ""}</small></span></div></td>
        <td><span class="tag" style="--tone:${tone};--tone-bg:${bg}">${esc(expense.category)}</span></td>
        <td><span class="payment">${icon(payment.toLowerCase() === "cash" ? "wallet" : "card")}${esc(payment)}</span></td>
        <td class="amount">-${formatMoney(expense.amountMinor, model.currency)}</td>
      </tr>`;
  }).join("") || `<tr><td colspan="5"><div class="empty-state">No transactions recorded for this month.</div></td></tr>`;
  return `
    <article class="panel transactions-panel" id="transactions">
      <div class="panel-head">
        <h3>Recent Transactions</h3>
        <button class="panel-link" data-panel="transactions">View All</button>
      </div>
      <div class="transactions-wrap">
        <table class="transactions">
          <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Method</th><th class="amount">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderSidebar(model) {
  const displayName = esc(model.user?.displayName || "User");
  const profilePhotoUrl = esc(model.user?.profilePhotoUrl || "/assets/logo/icon-512.png");
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["transactions", "Transactions", "transactions"],
    ["advisor", "AI Advisor", "analysis"],
    ["database", "Manage Data", "data-management"],
    ["categories", "Categories", "categories"],
    ["budget", "Budget", "budget"],
    ["analytics", "Reports", "analytics"],
    ["mail", "Email Report", "email-report"],
    ["settings", "Settings", "settings"],
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-logo brand-logo-dark" src="/assets/logo/money-copilot-mark-dark.png" alt="">
        <img class="brand-logo brand-logo-light" src="/assets/logo/logo-mark.svg" alt="">
        <strong>Money<span>Copilot AI</span></strong>
      </div>
      <button class="sidebar-toggle" type="button" data-sidebar-toggle aria-label="Collapse sidebar" aria-expanded="true">${icon("chevron")}</button>
      <button class="sidebar-search" type="button" data-sidebar-search aria-label="Search dashboard">${icon("search")}<span>Search dashboard</span><kbd>⌘ K</kbd></button>
      <span class="nav-label">Workspace</span>
      <nav class="nav" aria-label="Dashboard navigation">
        ${nav.map(([iconName, label, panel], index) => `<button class="${index === 0 ? "active" : ""}" data-nav="${panel}" data-tooltip="${label}">${icon(iconName)}<span>${label}</span>${label === "AI Advisor" ? "<em class='pill-new'>New</em>" : ""}</button>`).join("")}
      </nav>
      ${model.hasFinancialData ? `<a class="sidebar-promo" href="/#how" aria-label="Discover Money Copilot AI features"><img src="/assets/sidebar-promo.webp" alt="Money Copilot AI — know where your money is going"></a>` : ""}
      <div class="theme-switch" role="group" aria-label="Dashboard appearance">
        <button type="button" data-theme-choice="light" aria-label="Use light theme">${icon("sun")}<span>Light</span></button>
        <button type="button" data-theme-choice="dark" aria-label="Use dark theme">${icon("moon")}<span>Dark</span></button>
      </div>
      <section class="profile-card">
        <img src="${profilePhotoUrl}" alt="${displayName} profile photo" referrerpolicy="no-referrer" data-profile-photo>
        <div><b>${displayName}</b><span>Signed dashboard</span></div>
        <button class="profile-logout" type="button" data-logout aria-label="Log out" title="Log out">${icon("logout")}</button>
      </section>
    </aside>
  `;
}

function renderHeader(model) {
  const displayName = esc(model.user?.displayName || "User");
  return `
    <header class="topbar">
      <div class="headline">
        <h1>${timeGreeting()}, ${displayName} <span class="headline-wave" aria-hidden="true">👋</span></h1>
        <p>Here’s your financial picture for ${esc(monthLabel(model.month).split(" ")[0])}.</p>
      </div>
      <div class="toolbar">
        <input class="month-input" type="month" aria-label="Select month" value="${esc(model.month)}" data-month-picker>
        <label class="input-shell">${icon("search")}<input type="search" placeholder="Search transactions" data-search></label>
        <button class="notice-button" data-panel="notifications" aria-label="Notifications">${icon("bell")}<b>${buildNotifications(model).length}</b></button>
        <div class="toolbar-actions">
          <button class="action-button" data-entry="income">${icon("plus")}Add Income</button>
          <button class="action-button primary" data-entry="expense">${icon("plus")}Add Expense</button>
        </div>
      </div>
    </header>
  `;
}

function renderMobileDashboardHeader(model) {
  const displayName = esc(model.user?.displayName || "User");
  const month = esc(monthLabel(model.month).split(" ")[0]);
  const alertCount = Math.max(2, buildNotifications(model).length);
  return `
    <header class="mobile-dashboard-header">
      <div class="mobile-statusbar" aria-hidden="true">
        <b>9:41</b>
        <span class="mobile-device-status"><i class="mobile-signal"><em></em><em></em><em></em><em></em></i><i class="mobile-wifi"></i><i class="mobile-battery"></i></span>
      </div>
      <div class="mobile-quickbar">
        <button class="mobile-menu-button" type="button" data-mobile-menu-toggle aria-label="Open dashboard menu" aria-expanded="false">${icon("menu")}</button>
        <div class="mobile-brand-title">
          <img src="/assets/logo/logo-mark.svg" width="22" height="22" alt="Money Copilot">
          <span>Money Copilot</span>
        </div>
        <div class="mobile-top-actions">
          <button class="mobile-notice-button" type="button" data-panel="notifications" aria-label="Notifications">${icon("bell")}<b>${alertCount}</b></button>
          <button class="mobile-copilot-button" type="button" data-open-ai-chat aria-label="Open Money Copilot"><img src="/assets/finance-copilot-robot.png" alt="Money Copilot AI"></button>
        </div>
      </div>
      <div class="mobile-greeting">
        <h1>${timeGreeting()},<br>${displayName} <span aria-hidden="true">👋</span></h1>
        <p>Here&rsquo;s your financial picture for ${month}.</p>
      </div>
    </header>
  `;
}

function renderMobileCopilotComposer() {
  return `
    <section class="mobile-finance-composer" aria-label="Money Copilot quick actions">
      <button class="mobile-composer-bot" type="button" data-open-ai-chat aria-label="Open Money Copilot"><img src="/assets/finance-copilot-robot.png" alt=""></button>
      <textarea rows="1" maxlength="2000" data-mobile-copilot-input placeholder="Ask or add expense..." aria-label="Ask or add an expense"></textarea>
      <button class="mobile-composer-action" type="button" data-mobile-copilot-send aria-label="Send to Money Copilot">${icon("send")}</button>
      <button class="mobile-composer-action" type="button" data-entry="expense" aria-label="Scan a receipt">${icon("camera")}</button>
    </section>
  `;
}

function renderMobileBottomNav() {
  return `
    <nav class="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
      <button class="active" type="button" data-nav="dashboard">${icon("dashboard")}<span>Dashboard</span></button>
      <button type="button" data-nav="transactions">${icon("transactions")}<span>Transactions</span></button>
      <button class="mobile-add-button" type="button" data-entry="expense" aria-label="Add expense">${icon("plus")}</button>
      <button type="button" data-nav="budget">${icon("budget")}<span>Budget</span></button>
      <button type="button" data-nav="analytics">${icon("analytics")}<span>Reports</span></button>
    </nav>
  `;
}

function renderAssistantIntegrationCta() {
  return `
    <section class="assistant-integration-cta" aria-label="Connect Money Copilot AI to an AI assistant">
      <button class="assistant-integration-dismiss" type="button" data-dismiss-integration aria-label="Hide integration promotion">${icon("close")}</button>
      <div><strong>Connect Money Copilot AI with ChatGPT or Claude</strong><span>Scan receipts, voice log, AI insights &amp; more.</span></div>
      <nav aria-label="AI integrations">
        <a href="/#how"><img src="/assets/brands/chatgpt.png" alt="">ChatGPT</a>
        <a href="/#how"><img src="/assets/brands/claude.png" alt="">Claude</a>
      </nav>
    </section>
  `;
}

function renderAiAssistantRail(model) {
  const topCategory = model.categories?.[0];
  const topShare = topCategory && model.spentMinor ? Math.round((Number(topCategory.amountMinor || 0) / Math.max(1, Number(model.spentMinor))) * 100) : 0;
  const overBudget = model.remainingMinor !== null && model.remainingMinor < 0;
  const budgetDifference = Math.abs(Number(model.remainingMinor || 0));
  const budgetHeadline = model.budgetMinor
    ? overBudget
      ? `You’re <strong>${formatMoney(budgetDifference, model.currency, { compact: true })}</strong> over budget`
      : `<strong>${formatMoney(model.remainingMinor, model.currency, { compact: true })}</strong> remains in your budget`
    : "Set a budget to unlock alerts";
  const budgetContext = topCategory
    ? `${esc(topCategory.name)} drove most of this month’s spending.`
    : "Record expenses to unlock category insights.";

  return `
    <aside class="assistant-rail" id="finance-copilot-panel" aria-label="AI Finance Assistant">
      <div class="assistant-resizer" data-ai-rail-resizer role="separator" aria-controls="finance-copilot-panel" aria-orientation="vertical" aria-label="Resize Money Copilot panel" aria-valuemin="280" aria-valuemax="560" aria-valuenow="300" tabindex="0" title="Drag to resize. Use arrow keys for precision."><span aria-hidden="true"></span></div>
      <div class="assistant-rail-header">
        <div class="assistant-heading">
          <span class="assistant-title"><span class="copilot-logo" aria-hidden="true"><img src="/assets/finance-copilot-robot.png" alt=""></span> Money Copilot</span>
          <span class="assistant-status-row"><a class="comet-badge" href="https://www.cometapi.com/" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI"><span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI"></a><span class="assistant-online"><i></i>Online</span></span>
        </div>
        <button type="button" class="assistant-collapse" data-ai-rail-toggle aria-label="Minimize AI Finance Assistant">−</button>
      </div>
      <div class="assistant-rail-chat ai-chat" data-ai-chat>
        <div class="assistant-alert">
          <i class="assistant-alert-icon">${icon(overBudget ? "lock" : "wallet")}</i>
          <div><b>${budgetHeadline}</b><span>${budgetContext}</span></div>
          <div class="assistant-alert-actions">
            <button type="button" data-ai-suggestion="Explain my budget status this month.">${icon("advisor")}Explain</button>
            <button type="button" data-ai-suggestion="Where can I reduce spending this month?">${icon("search")}Find savings</button>
            <button type="button" data-ai-suggestion="Help me plan next month's budget.">${icon("bills")}Plan budget</button>
          </div>
        </div>
        <div class="assistant-day"><span>Today</span></div>
        <div class="ai-chat-messages assistant-rail-messages" data-ai-messages>
          <div class="ai-message user"><div class="ai-message-body">How is my spending this month?</div><small>9:42 AM</small></div>
          <div class="ai-message assistant copilot-summary"><div class="ai-message-body"><p>Here’s your spending summary for ${esc(monthLabel(model.month).split(" ")[0])}:</p><b>Budget usage</b><div class="copilot-progress"><i style="--value:${Math.min(100, model.budgetUsed || 0)}%"></i><strong>${model.budgetMinor ? `${model.budgetUsed}%` : "--"}</strong></div><div class="copilot-budget-row"><span>${formatMoney(model.spentMinor, model.currency, { compact: true })} of ${model.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "no budget"}</span><b>${model.remainingMinor === null ? "" : overBudget ? `${formatMoney(budgetDifference, model.currency, { compact: true })} over` : `${formatMoney(model.remainingMinor, model.currency, { compact: true })} left`}</b></div><ul><li>You spent ${formatMoney(model.spentMinor, model.currency, { compact: true })} this month.</li>${topCategory ? `<li>${esc(topCategory.name)} is your top category at ${topShare}% of spending.</li>` : ""}</ul></div><small>9:42 AM</small></div>
        </div>
        ${renderAssistantIntegrationCta()}
        <form class="ai-chat-form assistant-rail-form" data-ai-chat-form>
          <div class="copilot-compose"><span class="compose-clip" aria-hidden="true">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask about your money..." aria-label="Ask AI Finance Assistant" required></textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></div>
          <small>▣ Private · Uses only connected financial data</small>
        </form>
      </div>
    </aside>
  `;
}

function renderEmptyAssistantRail() {
  return `
    <aside class="assistant-rail empty-assistant-rail" id="finance-copilot-panel" aria-label="Money Copilot onboarding">
      <div class="assistant-resizer" data-ai-rail-resizer role="separator" aria-controls="finance-copilot-panel" aria-orientation="vertical" aria-label="Resize Money Copilot panel" aria-valuemin="280" aria-valuemax="560" aria-valuenow="300" tabindex="0" title="Drag to resize. Use arrow keys for precision."><span aria-hidden="true"></span></div>
      <div class="assistant-rail-header">
        <div class="assistant-heading">
          <span class="assistant-title"><span class="copilot-logo" aria-hidden="true"><img src="/assets/finance-copilot-robot.png" alt=""></span> Money Copilot</span>
          <span class="assistant-status-row"><a class="comet-badge" href="https://www.cometapi.com/" target="_blank" rel="noopener noreferrer"><span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI"></a><span class="assistant-online"><i></i>Online</span></span>
        </div>
      </div>
      <div class="empty-copilot-body" data-ai-chat>
        <img src="/assets/finance-copilot-robot.png" alt="Money Copilot">
        <h2>Hi, I’m your Money Copilot</h2>
        <p>I can help you organize expenses, build budgets, and find smarter ways to save.</p>
        <div class="empty-copilot-greeting"><span><img src="/assets/finance-copilot-robot.png" alt=""></span>What would you like to do first?</div>
        <div class="empty-divider"><span>Suggested questions</span></div>
        <div class="empty-questions">
          <button type="button" data-entry="expense">${icon("transactions")}Add my first expense</button>
          <button type="button" data-panel="budget-editor">${icon("budget")}Create a starter budget</button>
          <button type="button" data-ai-suggestion="How does Money Copilot AI protect my privacy?">${icon("lock")}How does privacy work?</button>
        </div>
        <div class="ai-chat-messages empty-ai-messages" data-ai-messages></div>
      </div>
      <div class="empty-copilot-compose">
        <form data-ai-chat-form><span class="compose-clip">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask Money Copilot..." aria-label="Ask Money Copilot" required></textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></form>
        <small>${icon("lock")} Private · Uses only data you approve</small>
      </div>
    </aside>
  `;
}

function renderEmptyHeader(model) {
  const displayName = esc(model.user?.displayName || "User");
  const firstName = displayName.split(/\s+/)[0];
  return `
    <header class="topbar empty-topbar">
      <div class="headline">
        <h1>Welcome, ${firstName}</h1>
        <p>Let’s build your first financial picture.</p>
      </div>
      <div class="toolbar">
        <label class="input-shell">${icon("search")}<input type="search" placeholder="Search transactions" data-search></label>
        <button class="notice-button" aria-label="Notifications">${icon("bell")}<b>0</b></button>
        <button class="empty-manual-action" data-entry="expense">Enter expenses manually</button>
      </div>
    </header>
  `;
}

function renderEmptyDashboard(model) {
  app.className = "dashboard-shell empty-dashboard";
  app.innerHTML = `
    ${renderSidebar(model)}
    <main class="main empty-dashboard-main">
      ${renderEmptyHeader(model)}
      <div class="empty-onboarding-grid">
        <div class="empty-onboarding-left">
          <section class="empty-hero">
            <div class="empty-hero-copy">
              <h2>Use Money Copilot AI <span>wherever</span> you chat</h2>
              <p>Install secure expense tools in ChatGPT or Claude.<br>Share only the details you choose and keep your dashboard up to date.</p>
              <div class="empty-hero-actions"><a href="/#how">View integrations ${icon("chevron")}</a><a class="empty-secondary-link" href="/#how">How it works</a></div>
              <small>${icon("lock")}Private by design&nbsp; · &nbsp;Nothing is imported automatically</small>
            </div>
          </section>
          <section class="empty-connect panel">
            <div class="empty-section-heading"><h3>Use Money Copilot AI with your AI</h3><p>Add our tools where you already have conversations.</p></div>
            <div class="empty-client-grid">
              <article class="empty-client-card"><div class="client-logo brand-logo-card chatgpt-mark"><img src="/assets/brands/chatgpt.png" alt=""></div><div><h3>ChatGPT <em>Recommended</em></h3><p>Install the Money Copilot AI plugin and save expenses when you choose to invoke it.</p></div><a class="client-connect primary" href="/#how">Use with ChatGPT ${icon("chevron")}</a><small>${icon("lock")}Install plugin · OAuth protected</small></article>
              <article class="empty-client-card"><div class="client-logo brand-logo-card claude-mark"><img src="/assets/brands/claude.png" alt=""></div><div><h3>Claude</h3><p>Connect our remote MCP tools and send selected expense details to your dashboard.</p></div><a class="client-connect" href="/#how">Use with Claude ${icon("chevron")}</a><small>${icon("lock")}Connect via MCP · OAuth protected</small></article>
            </div>
          </section>
          <section class="empty-how panel"><h3>How it works</h3><div><span><b>1</b><strong>Install or connect<small>Add Money Copilot AI tools</small></strong></span><i></i><span><b>2</b><strong>Approve access<small>Choose permitted actions</small></strong></span><i></i><span><b>3</b><strong>Save as you chat<small>Invoke the tool when needed</small></strong></span></div></section>
          <section class="empty-client-strip"><span>Works with your favorite AI clients and MCP tools</span><div><span class="brand-item"><img src="/assets/brands/chatgpt.png" alt="">ChatGPT</span><i></i><span class="brand-item"><img src="/assets/brands/claude.png" alt="">Claude</span><i></i><span class="brand-item"><img src="/assets/brands/gemini.png" alt="">Gemini</span><i></i><span class="brand-item"><img src="/assets/brands/grok.png" alt="">Grok</span><i></i><span class="brand-item"><img src="/assets/brands/cursor.png" alt="">Cursor</span><i></i><span class="brand-item"><img src="/assets/brands/mcp.png" alt="">Any MCP Client</span></div></section>
        </div>
        <aside class="empty-preview panel">
          <div class="panel-head"><h3>See it in action</h3><a href="/assets/dashboard/expense-tracker-ai-promo.png" target="_blank" aria-label="Open preview">${icon("chevron")}</a></div>
          <img src="/assets/dashboard/expense-tracker-ai-promo.png" alt="Money Copilot AI dashboard and chat experience preview">
          <a href="/#demo">Preview the ChatGPT experience</a>
        </aside>
      </div>
    </main>
    ${renderEmptyAssistantRail()}
  `;
}

function renderDashboard(model) {
  app.className = "dashboard-shell";
  app.innerHTML = `
    ${renderSidebar(model)}
    <button class="mobile-menu-backdrop" type="button" data-mobile-menu-toggle aria-label="Close dashboard menu"></button>
    <section class="main">
      ${renderMobileDashboardHeader(model)}
      ${renderHeader(model)}
      ${renderMetricCards(model)}
      <section class="content-grid">
        ${renderIncomeExpense(model)}
        ${renderBudget(model)}
        ${renderCategories(model)}
        ${renderHealth(model)}
        ${renderInsights(model)}
        ${renderTransactions(model)}
      </section>
    </section>
    ${renderAiAssistantRail(model)}
    <button class="floating-ai" data-open-ai-chat aria-label="Open Money Copilot"><img src="/assets/finance-copilot-robot.png" alt=""></button>
    ${renderMobileCopilotComposer()}
    ${renderMobileBottomNav()}
  `;
}

function buildNotifications(model) {
  const notes = [];
  if (model.budgetMinor && model.budgetUsed >= 50) notes.push({ title: `Budget ${model.budgetUsed}% used`, body: model.remainingMinor < 0 ? `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over budget.` : `${formatMoney(model.remainingMinor, model.currency)} remaining.` });
  if (model.forecastMinor > (model.budgetMinor || Infinity)) notes.push({ title: "Forecast warning", body: `Projected spend is ${formatMoney(model.forecastMinor, model.currency)}.` });
  if ((model.recurring || []).length) notes.push({ title: "Recurring charges", body: `${model.recurring.length} active recurring item(s) in this workspace.` });
  if (!notes.length) notes.push({ title: "All clear", body: "No budget alerts for this month." });
  return notes;
}

function openModal(title, subtitle, content, options = {}) {
  closeModal();
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="dashboard-modal" role="dialog" aria-modal="true">
      <section class="modal ${options.wide ? "wide" : ""} ${options.className || ""}">
        <div class="modal-top">
          <div><h2>${esc(title)}</h2><p>${esc(subtitle || "")}</p></div>
          <button class="modal-close" data-close aria-label="Close">${icon("close")}</button>
        </div>
        ${content}
      </section>
    </div>
  `);
  document.body.classList.add("dashboard-modal-open");
  document.body.classList.toggle("finance-copilot-open", String(options.className || "").split(/\s+/).includes("ai-modal"));
}

function closeModal() {
  document.getElementById("dashboard-modal")?.remove();
  document.body.classList.remove("dashboard-modal-open");
  document.body.classList.remove("finance-copilot-open");
}

function fmtVisualAmount(value, currency) {
  const v = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";
  const formatted = v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (currency === "BDT") return `${sign}\u09F3${formatted}`;
  if (currency === "USD") return `${sign}$${formatted}`;
  if (currency) return `${sign}${currency} ${formatted}`;
  return `${sign}${formatted}`;
}

function renderVisualData(data) {
  if (!data) return "";
  let html = '<div class="ai-visual-panel">';

  if (data.metrics?.length) {
    html += '<div class="ai-metric-row">';
    for (const m of data.metrics) {
      const displayValue = m.currency ? fmtVisualAmount(m.value, m.currency) : m.value;
      html += `<div class="ai-metric-card" style="--accent:${esc(m.color || "#2563ff")}"><span class="ai-metric-value">${esc(displayValue)}</span><span class="ai-metric-label">${esc(m.label)}</span></div>`;
    }
    html += '</div>';
  }

  if (data.progress) {
    const p = data.progress;
    const overBudget = p.percent > 100;
    const barColor = overBudget ? "#ff4548" : p.percent > 80 ? "#f59e0b" : "#18b96f";
    html += `<div class="ai-progress-block"><div class="ai-progress-head"><span>${esc(p.label)}</span><strong style="color:${barColor}">${p.percent}%</strong></div><div class="ai-progress-track"><div class="ai-progress-fill" style="width:${Math.min(100, p.percent)}%;background:${barColor}"></div></div></div>`;
  }

  if (data.pieChart?.length) {
    const total = data.pieChart.reduce((s, c) => s + c.value, 0) || 1;
    let cumulative = 0;
    let arcs = "";
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    for (const slice of data.pieChart) {
      const fraction = slice.value / total;
      const dashLen = fraction * circumference;
      const dashOffset = -cumulative * circumference;
      arcs += `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${slice.color}" stroke-width="16" stroke-dasharray="${dashLen} ${circumference - dashLen}" stroke-dashoffset="${dashOffset}" />`;
      cumulative += fraction;
    }
    html += '<div class="ai-pie-section">';
    html += `<div class="ai-pie-wrap"><svg viewBox="0 0 100 100" class="ai-pie-svg">${arcs}</svg></div>`;
    html += '<div class="ai-pie-legend">';
    for (const slice of data.pieChart) {
      const displayVal = data.metrics?.[0]?.currency ? fmtVisualAmount(slice.value, data.metrics[0].currency) : slice.value;
      html += `<div class="ai-legend-item"><i style="background:${esc(slice.color)}"></i><span>${esc(slice.label)}</span><b>${esc(String(displayVal))}</b><small>${slice.percent}%</small></div>`;
    }
    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

function aiAnswerHtml(value) {
  let text = esc(value || "I could not generate a response.");
  return text
    .replace(/^#### (.*?)$/gm, "<h5 class='ai-heading'>$1</h5>")
    .replace(/^### (.*?)$/gm, "<h4 class='ai-heading'>$1</h4>")
    .replace(/^## (.*?)$/gm, "<h3 class='ai-heading'>$1</h3>")
    .replace(/^# (.*?)$/gm, "<h2 class='ai-heading'>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^---$/gm, "<hr class='ai-hr'>")
    .replace(/^[\*\-] (.*?)$/gm, "<div class='ai-bullet'>• $1</div>")
    .replace(/\n/g, "<br>");
}

function appendAiMessage(role, content, meta = "", chatRoot = document, visualData = null) {
  const list = (chatRoot === document ? window.activeAiChatRoot || document : chatRoot).querySelector("[data-ai-messages]");
  if (!list) return;
  const visualHtml = role === "assistant" ? renderVisualData(visualData) : "";
  const msgId = `msg-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  
  let actionToolbar = "";
  if (role === "assistant") {
    actionToolbar = `
      <div class="ai-message-footer">
        <button type="button" class="ai-action-btn" data-copy-msg="${msgId}">${icon("copy")} <span>Copy</span></button>
        <div class="ai-rating-btns">
          <button type="button" class="ai-rate-btn" data-rate="up" title="Helpful">👍</button>
          <button type="button" class="ai-rate-btn" data-rate="down" title="Not helpful">👎</button>
        </div>
      </div>
    `;
  }

  list.insertAdjacentHTML("beforeend", `
    <div class="ai-message ${role}" id="${msgId}">
      <div class="ai-message-header">
        <div class="ai-message-label">${role === "user" ? "You" : `<span class="ai-bot-avatar"><img src="/assets/finance-copilot-robot.png" alt=""></span> Money Copilot AI`}</div>
        ${meta ? `<small class="ai-meta-tag" title="${esc(meta)}">${esc(meta)}</small>` : ""}
      </div>
      <div class="ai-message-body">${visualHtml}${role === "user" ? esc(content) : aiAnswerHtml(content)}</div>
      ${actionToolbar}
    </div>
  `);

  const message = list.lastElementChild;
  if (role === "assistant" && message) {
    list.scrollTo({ top: Math.max(0, message.offsetTop - 8), behavior: "smooth" });
  }
}

function appendAiLoading(chatRoot = document) {
  const list = (chatRoot === document ? window.activeAiChatRoot || document : chatRoot).querySelector("[data-ai-messages]");
  if (!list) return null;
  const id = `ai-loading-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  list.insertAdjacentHTML("beforeend", `
    <div class="ai-message assistant ai-loading-message" id="${id}" aria-live="polite">
      <div class="ai-message-label">Money Copilot AI</div>
      <div class="ai-message-body"><span class="ai-typing"><i></i><i></i><i></i></span><span>Processing your data....</span></div>
    </div>
  `);
  list.scrollTop = list.scrollHeight;
  return list.querySelector(`#${id}`);
}

function setAiSubmitLoading(button, isLoading) {
  if (!button) return;
  if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
  button.disabled = isLoading;
  button.classList.toggle("is-loading", isLoading);
  if (isLoading) {
    button.innerHTML = button.classList.contains("assistant-send")
      ? `<span class="button-spinner" aria-hidden="true"></span><span class="sr-only">Sending</span>`
      : `<span class="button-spinner" aria-hidden="true"></span><span>Thinking...</span>`;
  } else {
    button.innerHTML = button.dataset.idleHtml;
  }
}

function openEmptyAiChat(prefill = "") {
  openModal("Money Copilot", "Build your first financial picture with guided, private help.", `
    <div class="copilot-modal-status empty-copilot-status">
      <a class="comet-badge comet-badge-modal" href="https://www.cometapi.com/" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI">
        <span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI">
      </a>
      <span class="assistant-online"><i></i>Online</span>
    </div>
    <div class="empty-mobile-copilot" data-ai-chat>
      <div class="empty-mobile-copilot-intro">
        <img src="/assets/finance-copilot-robot.png" alt="Money Copilot">
        <h2>Hi, I’m your Money Copilot</h2>
        <p>I can help you organize expenses, build budgets, and find smarter ways to save.</p>
        <div class="empty-copilot-greeting"><span><img src="/assets/finance-copilot-robot.png" alt=""></span>What would you like to do first?</div>
      </div>
      <div class="empty-divider"><span>Suggested questions</span></div>
      <div class="empty-questions">
        <button type="button" data-entry="expense">${icon("transactions")}Add my first expense</button>
        <button type="button" data-panel="budget-editor">${icon("budget")}Create a starter budget</button>
        <button type="button" data-ai-suggestion="How does Money Copilot AI protect my privacy?">${icon("lock")}How does privacy work?</button>
      </div>
      <div class="ai-chat-messages empty-ai-messages" data-ai-messages></div>
      <form class="empty-mobile-copilot-compose" data-ai-chat-form>
        <div><span class="compose-clip" aria-hidden="true">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask Money Copilot..." aria-label="Ask Money Copilot" required>${esc(prefill)}</textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></div>
        <small>${icon("lock")} Private · Uses only data you approve</small>
      </form>
    </div>
  `, { wide: false, className: "ai-modal empty-ai-modal" });
}

function openAiChat(prefill = "") {
  const model = window.dashboardModel;
  if (!model?.hasFinancialData) {
    openEmptyAiChat(prefill);
    return;
  }
  const topCategory = model?.categories?.[0];
  const topShare = topCategory && model?.spentMinor ? Math.round((Number(topCategory.amountMinor || 0) / Math.max(1, Number(model.spentMinor))) * 100) : 0;
  const overBudget = model?.remainingMinor !== null && Number(model?.remainingMinor || 0) < 0;
  const budgetDifference = Math.abs(Number(model?.remainingMinor || 0));
  const budgetHeadline = model?.budgetMinor
    ? overBudget
      ? `You’re <strong>${formatMoney(budgetDifference, model.currency, { compact: true })}</strong> over budget`
      : `<strong>${formatMoney(model.remainingMinor, model.currency, { compact: true })}</strong> remains in your budget`
    : "Set a budget to unlock alerts";
  const budgetContext = topCategory
    ? `${esc(topCategory.name)} drove most of this month’s spending.`
    : "Record expenses to unlock category insights.";
  const reportMonth = model ? esc(monthLabel(model.month).split(" ")[0]) : esc(monthLabel(selectedMonth).split(" ")[0]);

  openModal("Money Copilot", "Get verified answers from your private expense data.", `
    <div class="copilot-modal-status">
      <a class="comet-badge comet-badge-modal" href="https://www.cometapi.com/" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI">
        <span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI">
      </a>
      <span class="assistant-online"><i></i>Online</span>
    </div>
    <div class="ai-chat" data-ai-chat>
      <div class="ai-chat-scroll">
      <div class="assistant-alert">
        <i class="assistant-alert-icon">${icon(overBudget ? "lock" : "wallet")}</i>
        <div><b>${budgetHeadline}</b><span>${budgetContext}</span></div>
        <div class="assistant-alert-actions">
          <button type="button" data-ai-suggestion="Explain my budget status this month.">${icon("advisor")}Explain</button>
          <button type="button" data-ai-suggestion="Where can I reduce spending this month?">${icon("search")}Find savings</button>
          <button type="button" data-ai-suggestion="Help me plan next month's budget.">${icon("bills")}Plan budget</button>
        </div>
      </div>
      <div class="assistant-day"><span>Today</span></div>
      <div class="ai-chat-messages assistant-rail-messages" data-ai-messages>
        <div class="ai-message user"><div class="ai-message-body">How is my spending this month?</div><small>9:42 AM</small></div>
        <div class="ai-message assistant copilot-summary"><div class="ai-message-body"><p>Here’s your spending summary for ${reportMonth}:</p><b>Budget usage</b><div class="copilot-progress"><i style="--value:${Math.min(100, model?.budgetUsed || 0)}%"></i><strong>${model?.budgetMinor ? `${model.budgetUsed}%` : "--"}</strong></div><div class="copilot-budget-row"><span>${model ? formatMoney(model.spentMinor, model.currency, { compact: true }) : "--"} of ${model?.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "no budget"}</span><b>${model?.remainingMinor === null || !model ? "" : overBudget ? `${formatMoney(budgetDifference, model.currency, { compact: true })} over` : `${formatMoney(model.remainingMinor, model.currency, { compact: true })} left`}</b></div><ul><li>You spent ${model ? formatMoney(model.spentMinor, model.currency, { compact: true }) : "--"} this month.</li>${topCategory ? `<li>${esc(topCategory.name)} is your top category at ${topShare}% of spending.</li>` : ""}</ul></div><small>9:42 AM</small></div>
      </div>
      </div>
      ${renderAssistantIntegrationCta()}
      <form class="ai-chat-form assistant-rail-form" data-ai-chat-form>
        <div class="copilot-compose"><span class="compose-clip" aria-hidden="true">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask about your money..." aria-label="Ask AI Finance Assistant" required>${esc(prefill)}</textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></div>
        <small>▣ Private · Uses only connected financial data</small>
      </form>
    </div>
  `, { wide: false, className: "ai-modal" });
}

function openMobileCopilotAndSend(message) {
  const text = String(message || "").trim();
  if (!text) {
    openAiChat();
    return;
  }
  openAiChat(text);
  requestAnimationFrame(() => {
    const form = document.querySelector(".ai-modal [data-ai-chat-form]");
    if (form) submitAiQuestion(form);
  });
}

function localDashboardAnswer(message) {
  const model = window.dashboardModel;
  if (!model) return "I couldn’t load your private dashboard data yet. Please refresh the dashboard and try again.";
  const question = String(message || "").toLowerCase();
  const top = model.categories?.[0];
  const topShare = top && model.spentMinor ? Math.round((Number(top.amountMinor || 0) / Math.max(1, Number(model.spentMinor))) * 100) : 0;
  const reportMonth = monthLabel(model.month);
  const budgetStatus = model.budgetMinor
    ? model.remainingMinor < 0
      ? `You are **${formatMoney(Math.abs(model.remainingMinor), model.currency)} over** your ${formatMoney(model.budgetMinor, model.currency)} budget.`
      : `You have **${formatMoney(model.remainingMinor, model.currency)} remaining** from your ${formatMoney(model.budgetMinor, model.currency)} budget.`
    : "You have not set an overall monthly budget yet.";

  if (/saving|reduce|cut|where can i/.test(question)) {
    const opportunity = Math.round(Number(top?.amountMinor || 0) * .1);
    return top
      ? `## Verified saving idea\n\nYour largest category is **${top.name}** at **${formatMoney(top.amountMinor, model.currency)}** (${topShare}% of spending). Reducing it by 10% could save about **${formatMoney(opportunity, model.currency)}**.\n\n${budgetStatus}`
      : "Record a few expenses first and I’ll identify the strongest saving opportunity.";
  }
  if (/budget|plan/.test(question)) {
    return `## Budget check — ${reportMonth}\n\n${budgetStatus}\n\n**Next step:** ${model.remainingMinor !== null && model.remainingMinor < 0 ? "pause discretionary spending in your largest category until the next budget period." : "set aside part of your remaining amount for savings and essentials."}`;
  }
  const categories = (model.categories || []).slice(0, 3).map((item) => `- ${item.name}: **${formatMoney(item.amountMinor, model.currency)}**`).join("\n") || "- No expenses recorded";
  return `## Monthly spending — ${reportMonth}\n\n- Total spent: **${formatMoney(model.spentMinor, model.currency)}**\n- Income recorded: **${formatMoney(model.incomeMinor, model.currency)}**\n- Net cash flow: **${formatMoney(model.savedMinor, model.currency)}**\n\n### Top categories\n${categories}\n\n${budgetStatus}`;
}

async function submitAiQuestion(form) {
  const textarea = form.querySelector("textarea[name=message]");
  const button = form.querySelector("button[type=submit]");
  const chatRoot = form.closest("[data-ai-chat]") || document;
  window.activeAiChatRoot = chatRoot;
  const message = String(textarea?.value || "").trim();
  if (!message) return;
  appendAiMessage("user", message, "", chatRoot);
  const loadingMessage = appendAiLoading(chatRoot);
  textarea.value = "";
  textarea.disabled = true;
  setAiSubmitLoading(button, true);
  try {
    const response = await fetch("/api/ai-chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, month: selectedMonth }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw authRequiredError();
    if (!response.ok) throw new Error(body.error || "The AI assistant could not answer right now.");
    const tools = body.usedTools?.length ? `Verified with ${body.usedTools.join(", ")}` : "General guidance";
    loadingMessage?.remove();
    appendAiMessage("assistant", body.answer, `${tools} · ${body.model}${body.cached ? " · cached" : ""}`, chatRoot, body.visualData || null);
  } catch (error) {
    if (error.code === "AUTH_REQUIRED") {
      closeModal();
      redirectToMcpizeAuth();
      return;
    }
    loadingMessage?.remove();
    appendAiMessage("assistant", localDashboardAnswer(message), "Verified dashboard data · offline response", chatRoot);
  } finally {
    if (window.activeAiChatRoot === chatRoot) window.activeAiChatRoot = null;
    textarea.disabled = false;
    setAiSubmitLoading(button, false);
    textarea.focus();
  }
}

function openEntry(kind) {
  const model = window.dashboardModel;
  const isIncome = kind === "income";
  const today = new Date().toISOString().slice(0, 10);
  openModal(isIncome ? "Add Income" : "Add Expense", isIncome ? "Record money coming into this private workspace." : "Record a transaction with category and payment details.", `
    <form data-form="${kind}">
      <div class="form-grid">
        <div class="field"><label>Amount</label><input name="amount" inputmode="decimal" placeholder="0.00" required></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required></div>
        <div class="field"><label>${isIncome ? "Source" : "Category"}</label><input name="category" placeholder="${isIncome ? "Salary, freelance" : "Food, travel"}" required></div>
        <div class="field"><label>Currency</label><input name="currency" value="${esc(model.currency)}" maxlength="3" required></div>
        ${isIncome ? "" : `<div class="field"><label>Merchant</label><input name="merchant" placeholder="Vendor or shop"></div><div class="field"><label>Payment Method</label><select name="paymentMethod"><option>bKash</option><option>Nagad</option><option>Visa</option><option>Cash</option><option>Bank Transfer</option></select></div>`}
        <div class="field full"><label>${isIncome ? "Notes" : "Description"}</label><input name="description" placeholder="Optional details"></div>
        ${isIncome ? "" : `<div class="field full"><label>Tags</label><input name="tags" placeholder="optional, comma separated"></div>`}
      </div>
      <p class="form-error" data-error></p>
      <div class="modal-actions">
        <button type="button" class="action-button" data-close>Cancel</button>
        <button type="submit" class="action-button primary">Save ${isIncome ? "Income" : "Expense"}</button>
      </div>
    </form>
  `);
}

async function submitEntry(form) {
  const kind = form.dataset.form;
  const data = new FormData(form);
  const payload = {
    kind,
    amount: data.get("amount"),
    date: data.get("date"),
    category: data.get("category"),
    source: data.get("category"),
    currency: String(data.get("currency") || "").toUpperCase(),
    description: data.get("description"),
    merchant: data.get("merchant"),
    paymentMethod: data.get("paymentMethod"),
    tags: data.get("tags"),
  };
  await postDashboard(payload, form);
}

async function postDashboard(payload, form) {
  const error = form?.querySelector("[data-error]");
  if (error) error.textContent = "";
  try {
    const response = await fetch("/api/dashboard", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw authRequiredError();
    if (!response.ok) throw new Error(body.error || "Could not save changes.");
    location.reload();
  } catch (err) {
    if (err.code === "AUTH_REQUIRED") {
      redirectToMcpizeAuth();
      return;
    }
    if (error) error.textContent = err.message;
  }
}

function panelRows(items, render) {
  return items.length ? `<div class="plain-list">${items.map(render).join("")}</div>` : `<div class="empty-state">Nothing to show yet.</div>`;
}

function openPanel(kind) {
  const model = window.dashboardModel;
  if (!model) return;
  if (kind === "email-report") {
    const month = monthLabel(model.month);
    let savedEmail = "";
    try { savedEmail = localStorage.getItem("user_email") || ""; } catch (e) {}
    const userEmail = model.user?.email || savedEmail || "";
    const spentStr = formatMoney(model.spentMinor, model.currency);
    const budgetStr = model.budgetMinor ? formatMoney(model.budgetMinor, model.currency) : "No budget set";
    const remainingStr = model.remainingMinor === null ? "N/A" : model.remainingMinor < 0 ? `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over` : `${formatMoney(model.remainingMinor, model.currency)} remaining`;
    const budgetUsedStr = model.budgetMinor ? `${model.budgetUsed}%` : "0%";
    const isOver = model.remainingMinor < 0;

    openModal("Email your report", "Send a private spending and budget summary directly to your inbox.", `
      <form data-form="email-report" class="email-report-form">
        <div class="field">
          <label for="report-email">Recipient Email Address</label>
          <div class="input-with-icon">
            ${icon("mail")}
            <input id="report-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(userEmail)}" required>
          </div>
        </div>

        <div class="email-report-card">
          <div class="email-report-card-header">
            <span class="report-badge">${icon("sparkles")} ${esc(month)} Financial Summary</span>
          </div>
          <div class="email-report-grid">
            <div class="report-stat">
              <span>Total Spent</span>
              <strong class="spent">${esc(spentStr)}</strong>
            </div>
            <div class="report-stat">
              <span>Monthly Budget</span>
              <strong class="budget">${esc(budgetStr)}</strong>
            </div>
            <div class="report-stat">
              <span>Budget Used</span>
              <strong class="used">${esc(budgetUsedStr)}</strong>
            </div>
            <div class="report-stat">
              <span>Remaining</span>
              <strong class="remaining ${isOver ? 'over-budget' : 'under-budget'}">${esc(remainingStr)}</strong>
            </div>
          </div>
        </div>

        <p class="form-error" data-error></p>
        <div class="modal-actions">
          <button type="submit" class="action-button primary send-report-btn">
            ${icon("mail")} Send Report via Email
          </button>
        </div>
      </form>
    `, { wide: false });
    return;
  }
  if (kind === "notifications") {
    openModal("Notifications", "Budget alerts and workspace reminders.", panelRows(buildNotifications(model), (item) => `<div class="plain-row"><span><b>${esc(item.title)}</b><small>${esc(item.body)}</small></span>${icon("bell")}</div>`), { className: "notifications-modal" });
    return;
  }
  if (kind === "categories") {
    openModal("All Categories", "Category totals for the selected month.", panelRows(model.categories || [], (category, index) => {
      const pct = Math.round((category.amountMinor / Math.max(model.spentMinor, 1)) * 100);
      const [tone, bg] = toneFor(category.name, index);
      return `<div class="plain-row"><span><b><i class="dot" style="--tone:${tone}"></i>${esc(category.name)}</b><small>${pct}% of monthly expenses</small></span><strong>${formatMoney(category.amountMinor, model.currency)}</strong></div>`;
    }), { wide: true });
    return;
  }
  if (kind === "transactions") {
    openModal("All Transactions", "Newest private transactions for this month.", panelRows(model.expenses || [], (expense, index) => {
      const meta = model.expenseMetadata?.[expense.id] || {};
      const [tone] = toneFor(expense.category, index);
      return `<div class="plain-row"><span><b><i class="dot" style="--tone:${tone}"></i>${esc(meta.merchant || expense.description || "Expense")}</b><small>${esc(expense.date)} - ${esc(expense.category)} - ${esc(meta.paymentMethod || "Expense")}</small></span><strong class="amount">-${formatMoney(expense.amountMinor, model.currency)}</strong></div>`;
    }), { wide: true });
    return;
  }
  if (kind === "bills") {
    openModal("Recurring Bills", "Upcoming recurring expenses from your MCP data.", panelRows(model.recurring || [], (bill) => `<div class="plain-row"><span><b>${esc(bill.merchant || bill.description || bill.category)}</b><small>${esc(bill.frequency || "Recurring")} - ${esc(bill.nextDate || "Scheduled")}</small></span><strong>${formatMoney(bill.amountMinor, model.currency)}</strong></div>`));
    return;
  }
  if (kind === "analysis") {
    openModal("AI Financial Analysis", "A deeper read of this month's spending signals.", `
      <div class="panel-metrics">
        <div class="panel-metric"><span>Forecast Spend</span><b>${formatMoney(model.forecastMinor, model.currency)}</b></div>
        <div class="panel-metric"><span>Savings Rate</span><b>${model.savingsRate}%</b></div>
        <div class="panel-metric"><span>Budget Used</span><b>${model.budgetMinor ? `${model.budgetUsed}%` : "Not set"}</b></div>
      </div>
      ${panelRows([
        { title: "Largest category", body: model.categories?.[0] ? `${model.categories[0].name} at ${formatMoney(model.categories[0].amountMinor, model.currency)}.` : "No category data yet." },
        { title: "Budget pressure", body: model.remainingMinor === null ? "Set a budget to unlock usage alerts." : model.remainingMinor < 0 ? `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over budget.` : `${formatMoney(model.remainingMinor, model.currency)} still available.` },
        { title: "Cash flow", body: `Net cash flow is ${formatMoney(model.savedMinor, model.currency)}.` },
      ], (item) => `<div class="plain-row"><span><b>${esc(item.title)}</b><small>${esc(item.body)}</small></span>${icon("advisor")}</div>`)}
    `, { wide: true });
    return;
  }
  if (kind === "budget-editor") {
    openModal("Monthly Budget", "Update the overall monthly budget limit.", `
      <form data-form="budget">
        <div class="form-grid">
          <div class="field"><label>Monthly limit</label><input name="amount" inputmode="decimal" value="${esc(moneyInputValue(model.budgetMinor))}" required></div>
          <div class="field"><label>Currency</label><input name="currency" value="${esc(model.currency)}" maxlength="3" required></div>
        </div>
        <p class="form-error" data-error></p>
        <div class="modal-actions"><button type="submit" class="action-button primary">Save Budget</button></div>
      </form>
    `);
    return;
  }
  if (kind === "goal-editor") {
    const goal = model.goals?.[0] || {};
    openModal("Savings Goal", "Update the primary dashboard goal.", `
      <form data-form="goal">
        <div class="form-grid">
          <div class="field full"><label>Goal name</label><input name="name" value="${esc(goal.name || "Savings Goal")}" required></div>
          <div class="field"><label>Target amount</label><input name="target" inputmode="decimal" value="${esc(moneyInputValue(goal.targetMinor))}" required></div>
          <div class="field"><label>Currency</label><input name="currency" value="${esc(model.currency)}" maxlength="3" required></div>
        </div>
        <p class="form-error" data-error></p>
        <div class="modal-actions"><button type="submit" class="action-button primary">Save Goal</button></div>
      </form>
    `);
    return;
  }
  if (kind === "accounts") {
    const accounts = [
      ["Main Balance", model.savedMinor, "Income minus expenses"],
      ["Budget Remaining", model.remainingMinor ?? 0, model.budgetMinor ? "Available monthly budget" : "No budget configured"],
      ["Monthly Outflow", -model.spentMinor, "Expense liability this month"],
    ];
    openModal("Accounts Overview", "Derived from your private income, budget, and expense records.", panelRows(accounts, ([name, amount, note]) => `<div class="plain-row"><span><b>${esc(name)}</b><small>${esc(note)}</small></span><strong class="${amount < 0 ? "amount" : "amount positive"}">${formatMoney(amount, model.currency)}</strong></div>`));
    return;
  }
  if (kind === "settings") {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    let currentModel = "gemini-2.5-flash";
    let compactMode = false;
    let autoSuggest = true;
    try {
      currentModel = localStorage.getItem("copilot_model") || "gemini-2.5-flash";
      compactMode = localStorage.getItem("compact_mode") === "true";
      autoSuggest = localStorage.getItem("auto_suggest") !== "false";
    } catch(e) {}

    openModal("Dashboard Settings", "Manage workspace preferences, AI model engine, currency, and privacy.", `
      <form data-form="settings" class="settings-form">
        
        <!-- Section 1: Display & Preferences -->
        <div class="settings-section">
          <h4 class="settings-section-title">${icon("sparkles")} Display & Preferences</h4>
          
          <div class="settings-row">
            <div class="settings-label">
              <strong>Workspace Currency</strong>
              <small>Default currency used for budgets, expenses, and AI calculations.</small>
            </div>
            <select name="currency" class="settings-select" data-setting="currency">
              <option value="BDT" ${model.currency === "BDT" ? "selected" : ""}>BDT (৳) - Bangladeshi Taka</option>
              <option value="USD" ${model.currency === "USD" ? "selected" : ""}>USD ($) - US Dollar</option>
              <option value="EUR" ${model.currency === "EUR" ? "selected" : ""}>EUR (€) - Euro</option>
              <option value="GBP" ${model.currency === "GBP" ? "selected" : ""}>GBP (£) - British Pound</option>
              <option value="INR" ${model.currency === "INR" ? "selected" : ""}>INR (₹) - Indian Rupee</option>
              <option value="CAD" ${model.currency === "CAD" ? "selected" : ""}>CAD ($) - Canadian Dollar</option>
            </select>
          </div>

          <div class="settings-row">
            <div class="settings-label">
              <strong>Appearance Theme</strong>
              <small>Choose between Light and Dark interface theme.</small>
            </div>
            <div class="settings-pill-group">
              <button type="button" class="settings-pill ${currentTheme === 'light' ? 'active' : ''}" data-theme-set="light">☀️ Light</button>
              <button type="button" class="settings-pill ${currentTheme === 'dark' ? 'active' : ''}" data-theme-set="dark">🌙 Dark</button>
            </div>
          </div>

          <div class="settings-row">
            <div class="settings-label">
              <strong>Compact Layout Density</strong>
              <small>Use tighter spacing for transaction lists and budget panels.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="compact_mode" ${compactMode ? "checked" : ""} data-setting="compact">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Section 2: Money Copilot AI Intelligence -->
        <div class="settings-section">
          <h4 class="settings-section-title">${icon("advisor")} Money Copilot AI Settings</h4>
          
          <div class="settings-row">
            <div class="settings-label">
              <strong>AI Model Engine</strong>
              <small>Select the AI model used for real-time chat & insights.</small>
            </div>
            <select name="copilot_model" class="settings-select" data-setting="model">
              <option value="gemini-2.5-flash" ${currentModel === "gemini-2.5-flash" ? "selected" : ""}>Gemini 2.5 Flash (Ultra Fast)</option>
              <option value="gemini-2.5-pro" ${currentModel === "gemini-2.5-pro" ? "selected" : ""}>Gemini 2.5 Pro (Deep Analytics)</option>
            </select>
          </div>

          <div class="settings-row">
            <div class="settings-label">
              <strong>Auto-Generate Smart Insights</strong>
              <small>Automatically summarize budget alerts on workspace load.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="auto_suggest" ${autoSuggest ? "checked" : ""} data-setting="auto_suggest">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Section 3: Privacy & Session Security -->
        <div class="settings-section">
          <h4 class="settings-section-title">${icon("lock")} Privacy & Session Security</h4>
          
          <div class="settings-info-card">
            <div class="info-row"><span>Authentication</span><strong>OAuth 2.0 PKCE Signed Session</strong></div>
            <div class="info-row"><span>User Account</span><strong>${esc(model.user?.displayName || "Connected Account")}</strong></div>
            <div class="info-row"><span>Data Isolation</span><strong>Private Signed Session (No Shared DB)</strong></div>
          </div>
        </div>

        <p class="form-error" data-error></p>
        
        <div class="modal-actions" style="margin-top: 10px;">
          <button type="submit" class="action-button primary" style="width:100%;">${icon("sparkles")} Save Preferences</button>
        </div>
      </form>
    `, { wide: true });
    return;
  }
  if (kind === "data-management") {
    const month = esc(model.month);
    openModal("Manage Your Data", "Export or permanently remove only your signed-in dashboard data.", `
      <div class="data-management-grid">
        <section class="data-action-card">
          <i>${icon("database")}</i><div><h3>Export data</h3><p>Download a portable CSV copy of your transactions and income.</p></div>
          <div class="data-action-buttons"><a class="action-button export-btn" href="/api/dashboard?export=csv&scope=month&month=${month}">${icon("sparkles")} Export this month</a><a class="action-button export-btn" href="/api/dashboard?export=csv&scope=all&month=${month}">${icon("sparkles")} Export all data</a></div>
        </section>
        <section class="data-action-card danger-soft">
          <i>${icon("transactions")}</i><div><h3>Clear this month</h3><p>Deletes expenses and income from ${esc(monthLabel(model.month))}. Budgets, goals, and recurring settings stay intact.</p></div>
          <button class="action-button danger" type="button" data-clear-data="month">Clear this month</button>
        </section>
        <section class="data-action-card danger-soft">
          <i>${icon("logout")}</i><div><h3>Clear all financial data</h3><p>Permanently deletes every expense, income, budget, goal, recurring item, and saved category for this account.</p></div>
          <button class="action-button danger" type="button" data-clear-data="all">Clear all data</button>
        </section>
      </div>
      <p class="form-error" data-error></p>
    `, { wide: true });
  }
}

function submitPanelForm(form) {
  const data = new FormData(form);
  if (form.dataset.form === "budget") {
    return postDashboard({ kind: "budget", amount: data.get("amount"), currency: String(data.get("currency") || "").toUpperCase() }, form);
  }
  if (form.dataset.form === "goal") {
    return postDashboard({ kind: "goal", name: data.get("name"), target: data.get("target"), currency: String(data.get("currency") || "").toUpperCase() }, form);
  }
  return submitEntry(form);
}

function chartDataset(model, mode = "month") {
  const monthName = monthLabel(model.month).split(" ")[0];
  const year = model.month.slice(0, 4);
  let start = 0;
  let income = model.incomeCum;
  let expense = model.expenseCum;
  let saving = model.savingsCum;
  let labels = income.map((_, index) => `${index + 1} ${monthName} ${year}`);
  if (mode === "daily") {
    income = model.incomeDaily;
    expense = model.expenseDaily;
    saving = model.incomeDaily.map((value, index) => Math.max(0, value - (model.expenseDaily[index] || 0)));
  }
  if (mode === "week") {
    const end = Math.min(todayDay(model.month), model.incomeDaily.length);
    start = Math.max(0, end - 7);
    income = model.incomeDaily.slice(start, end);
    expense = model.expenseDaily.slice(start, end);
    saving = income.map((value, index) => Math.max(0, value - (expense[index] || 0)));
  }
  labels = income.map((_, index) => `${start + index + 1} ${monthName} ${year}`);
  return { income, expense, saving, labels, startDay: start + 1 };
}

function setChartText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
}

function updateIncomeExpenseChart(mode = "month", selectedIndex) {
  const model = window.dashboardModel;
  const root = document.querySelector("[data-income-expense-chart]");
  if (!model || !root) return;
  const width = 600;
  const height = 178;
  const padX = 34;
  const padY = 24;
  const data = chartDataset(model, mode);
  const max = Math.max(...data.income, ...data.expense, ...data.saving, 1);
  const count = Math.max(data.income.length, data.expense.length, data.saving.length, 1);
  const safeIndex = Math.max(0, Math.min(selectedIndex ?? Math.floor((count - 1) / 2), count - 1));
  const incomePoints = linePoints(data.income, width, height, padX, padY, max);
  const expensePoints = linePoints(data.expense, width, height, padX, padY, max);
  const savingPoints = linePoints(data.saving, width, height, padX, padY, max);
  const x = padX + ((width - padX * 2) * safeIndex) / Math.max(count - 1, 1);
  const yFor = (value) => height - padY - ((height - padY * 2) * Number(value || 0)) / max;
  const tooltip = root.querySelector("[data-chart-tooltip]");
  const chart = root.querySelector(".income-expense-chart");

  root.querySelector('[data-chart-line="income"]')?.setAttribute("points", incomePoints);
  root.querySelector('[data-chart-line="expense"]')?.setAttribute("points", expensePoints);
  root.querySelector('[data-chart-line="saving"]')?.setAttribute("points", savingPoints);
  root.querySelector('[data-chart-area="income"]')?.setAttribute("d", areaPath(incomePoints, height, padY));
  root.querySelector('[data-chart-area="expense"]')?.setAttribute("d", areaPath(expensePoints, height, padY));
  const cursor = root.querySelector("[data-chart-cursor]");
  if (cursor) {
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
  }
  const points = [
    ["income", data.income[safeIndex]],
    ["expense", data.expense[safeIndex]],
    ["saving", data.saving[safeIndex]],
  ];
  for (const [name, value] of points) {
    const point = root.querySelector(`[data-chart-point="${name}"]`);
    if (!point) continue;
    point.setAttribute("cx", x);
    point.setAttribute("cy", yFor(value));
  }
  setChartText(root, '[data-axis-label="max"]', formatMoney(max, model.currency, { compact: true }));
  setChartText(root, '[data-axis-label="mid"]', formatMoney(max * .66, model.currency, { compact: true }));
  setChartText(root, '[data-axis-label="low"]', formatMoney(max * .33, model.currency, { compact: true }));
  setChartText(root, '[data-x-label="start"]', data.labels[0] ? data.labels[0].replace(` ${model.month.slice(0, 4)}`, "") : "");
  setChartText(root, '[data-x-label="mid"]', data.labels[Math.floor((count - 1) / 2)] ? data.labels[Math.floor((count - 1) / 2)].replace(` ${model.month.slice(0, 4)}`, "") : "");
  setChartText(root, '[data-x-label="end"]', data.labels[count - 1] ? data.labels[count - 1].replace(` ${model.month.slice(0, 4)}`, "") : "");
  setChartText(root, "[data-tip-date]", data.labels[safeIndex] || "");
  setChartText(root, "[data-tip-income]", formatMoney(data.income[safeIndex] || 0, model.currency));
  setChartText(root, "[data-tip-expense]", formatMoney(data.expense[safeIndex] || 0, model.currency));
  setChartText(root, "[data-tip-saving]", formatMoney(data.saving[safeIndex] || 0, model.currency));

  if (tooltip && chart) {
    const percent = count > 1 ? safeIndex / (count - 1) : .5;
    const chartWidth = chart.getBoundingClientRect().width || 1;
    const tipWidth = tooltip.offsetWidth || 124;
    const left = Math.max(8, Math.min(chartWidth - tipWidth - 8, padX / width * chartWidth + percent * ((width - padX * 2) / width * chartWidth) - tipWidth / 2));
    tooltip.style.left = `${left}px`;
  }
}

function bindIncomeExpenseChart() {
  const root = document.querySelector("[data-income-expense-chart]");
  const model = window.dashboardModel;
  if (!root || !model) return;
  const select = root.querySelector("[data-chart-mode]");
  const hitbox = root.querySelector("[data-chart-hitbox]");
  const mode = () => select?.value || "month";
  const indexFromEvent = (event) => {
    const box = hitbox.getBoundingClientRect();
    const data = chartDataset(model, mode());
    const count = Math.max(data.income.length, data.expense.length, data.saving.length, 1);
    const ratio = Math.max(0, Math.min(1, (event.clientX - box.left) / Math.max(1, box.width)));
    return Math.round(ratio * Math.max(count - 1, 0));
  };
  updateIncomeExpenseChart(mode());
  hitbox?.addEventListener("pointermove", (event) => updateIncomeExpenseChart(mode(), indexFromEvent(event)));
  hitbox?.addEventListener("pointerdown", (event) => updateIncomeExpenseChart(mode(), indexFromEvent(event)));
  hitbox?.addEventListener("pointerleave", () => updateIncomeExpenseChart(mode()));
  select?.addEventListener("change", () => updateIncomeExpenseChart(mode()));
}

function filterDashboard(query) {
  const needle = String(query || "").trim().toLowerCase();
  document.querySelectorAll(".transactions tbody tr[data-search]").forEach((row) => {
    row.style.display = !needle || row.dataset.search.includes(needle) ? "" : "none";
  });
}

const COPILOT_RAIL_WIDTH_KEY = "expenseTrackerCopilotWidth";
const COPILOT_RAIL_DEFAULT_WIDTH = 300;
const COPILOT_RAIL_MIN_WIDTH = 280;
const COPILOT_RAIL_MAX_WIDTH = 560;

function copilotRailBounds() {
  const sidebarWidth = document.querySelector(".sidebar")?.getBoundingClientRect().width || 224;
  const availableWidth = window.innerWidth - sidebarWidth - 720;
  return {
    min: COPILOT_RAIL_MIN_WIDTH,
    max: Math.max(COPILOT_RAIL_MIN_WIDTH, Math.min(COPILOT_RAIL_MAX_WIDTH, availableWidth)),
  };
}

function initializeAssistantRailResize() {
  const rail = document.querySelector(".assistant-rail");
  const handle = rail?.querySelector("[data-ai-rail-resizer]");
  if (!rail || !handle) return;

  let width = COPILOT_RAIL_DEFAULT_WIDTH;
  try {
    const savedWidth = Number(localStorage.getItem(COPILOT_RAIL_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth > 0) width = savedWidth;
  } catch {}

  const applyWidth = (nextWidth, { persist = false } = {}) => {
    const bounds = copilotRailBounds();
    width = Math.round(Math.min(bounds.max, Math.max(bounds.min, Number(nextWidth) || COPILOT_RAIL_DEFAULT_WIDTH)));
    app.style.setProperty("--assistant-rail-width", `${width}px`);
    handle.setAttribute("aria-valuemin", String(bounds.min));
    handle.setAttribute("aria-valuemax", String(bounds.max));
    handle.setAttribute("aria-valuenow", String(width));
    handle.setAttribute("aria-valuetext", `${width} pixels wide`);
    if (persist) {
      try { localStorage.setItem(COPILOT_RAIL_WIDTH_KEY, String(width)); } catch {}
    }
  };

  applyWidth(width);

  let dragStartX = 0;
  let dragStartWidth = width;
  let activePointerId = null;

  const finishResize = (event) => {
    if (activePointerId === null || (event.pointerId !== undefined && event.pointerId !== activePointerId)) return;
    activePointerId = null;
    document.body.classList.remove("is-resizing-copilot");
    handle.classList.remove("is-active");
    applyWidth(width, { persist: true });
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartWidth = rail.getBoundingClientRect().width || width;
    handle.setPointerCapture?.(event.pointerId);
    document.body.classList.add("is-resizing-copilot");
    handle.classList.add("is-active");
  });

  handle.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) return;
    applyWidth(dragStartWidth + dragStartX - event.clientX);
  });

  handle.addEventListener("pointerup", finishResize);
  handle.addEventListener("pointercancel", finishResize);
  handle.addEventListener("lostpointercapture", finishResize);

  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 32 : 16;
    let nextWidth = width;
    if (event.key === "ArrowLeft") nextWidth += step;
    else if (event.key === "ArrowRight") nextWidth -= step;
    else if (event.key === "Home") nextWidth = copilotRailBounds().min;
    else if (event.key === "End") nextWidth = copilotRailBounds().max;
    else return;
    event.preventDefault();
    applyWidth(nextWidth, { persist: true });
  });

  handle.addEventListener("dblclick", () => applyWidth(COPILOT_RAIL_DEFAULT_WIDTH, { persist: true }));
  window.addEventListener("resize", () => applyWidth(width));
}

function bindEvents() {
  const profilePhoto = document.querySelector("[data-profile-photo]");
  profilePhoto?.addEventListener("error", () => {
    profilePhoto.removeAttribute("data-profile-photo");
    profilePhoto.src = "/assets/logo/icon-512.png";
  }, { once: true });

  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target.id === "dashboard-modal") closeModal();
    const mobileMenuToggle = event.target.closest("[data-mobile-menu-toggle]");
    if (mobileMenuToggle) {
      const open = app.classList.toggle("mobile-menu-open");
      const menuButton = document.querySelector(".mobile-menu-button");
      menuButton?.setAttribute("aria-expanded", String(open));
      menuButton?.setAttribute("aria-label", open ? "Close dashboard menu" : "Open dashboard menu");
      return;
    }
    const entry = event.target.closest("[data-entry]");
    if (entry) {
      openEntry(entry.dataset.entry);
      return;
    }
    const aiChat = event.target.closest("[data-open-ai-chat]");
    if (aiChat) {
      openAiChat(aiChat.dataset.aiPrefill || "");
      return;
    }
    const mobileCopilotSend = event.target.closest("[data-mobile-copilot-send]");
    if (mobileCopilotSend) {
      openMobileCopilotAndSend(document.querySelector("[data-mobile-copilot-input]")?.value);
      return;
    }
    const dismissIntegration = event.target.closest("[data-dismiss-integration]");
    if (dismissIntegration) {
      dismissIntegration.closest(".assistant-integration-cta")?.classList.add("is-dismissed");
      return;
    }
    const aiRailToggle = event.target.closest("[data-ai-rail-toggle]");
    if (aiRailToggle) {
      const rail = document.querySelector(".assistant-rail");
      rail?.classList.toggle("collapsed");
      aiRailToggle.setAttribute("aria-label", rail?.classList.contains("collapsed") ? "Expand AI Finance Assistant" : "Minimize AI Finance Assistant");
      return;
    }
    const sidebarToggle = event.target.closest("[data-sidebar-toggle]");
    if (sidebarToggle) {
      const collapsed = app.classList.toggle("sidebar-collapsed");
      sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
      sidebarToggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      try { localStorage.setItem("expenseTrackerSidebar", collapsed ? "collapsed" : "expanded"); } catch {}
      return;
    }
    const themeChoice = event.target.closest("[data-theme-choice]");
    if (themeChoice) {
      const theme = themeChoice.dataset.themeChoice === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem("expenseTrackerTheme", theme); } catch {}
      syncThemeSwitch();
      return;
    }
    if (event.target.closest("[data-sidebar-search]")) {
      document.querySelector("[data-search]")?.focus();
      return;
    }
    const suggestion = event.target.closest("[data-ai-suggestion]");
    if (suggestion) {
      const input = suggestion.closest("[data-ai-chat]")?.querySelector("textarea[name=message]") || document.querySelector("[data-ai-chat-form] textarea[name=message]");
      if (input) {
        input.value = suggestion.dataset.aiSuggestion || "";
        input.focus();
      }
      return;
    }
    const copyBtn = event.target.closest("[data-copy-msg]");
    if (copyBtn) {
      const msgId = copyBtn.dataset.copyMsg;
      const msgEl = document.getElementById(msgId);
      const text = msgEl?.querySelector(".ai-message-body")?.innerText || "";
      if (text) {
        try {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = `${icon("check")} <span>Copied!</span>`;
            setTimeout(() => {
              copyBtn.innerHTML = `${icon("copy")} <span>Copy</span>`;
            }, 2000);
          });
        } catch(e) {}
      }
      return;
    }
    const rateBtn = event.target.closest("[data-rate]");
    if (rateBtn) {
      const group = rateBtn.closest(".ai-rating-btns");
      if (group) {
        group.querySelectorAll(".ai-rate-btn").forEach(b => b.classList.remove("active"));
        rateBtn.classList.add("active");
      }
      return;
    }
    const themeBtn = event.target.closest("[data-theme-set]");
    if (themeBtn) {
      const mode = themeBtn.dataset.themeSet;
      setTheme(mode);
      const parent = themeBtn.closest(".settings-pill-group");
      if (parent) {
        parent.querySelectorAll(".settings-pill").forEach(b => b.classList.remove("active"));
        themeBtn.classList.add("active");
      }
      return;
    }
    const copilotModel = event.target.closest("[data-copilot-model]");
    if (copilotModel) {
      document.querySelectorAll("[data-copilot-model]").forEach((button) => button.classList.toggle("active", button === copilotModel));
      document.querySelector(".empty-copilot-compose textarea")?.setAttribute("placeholder", `Ask ${copilotModel.dataset.copilotModel} Money Copilot...`);
      return;
    }
    if (event.target.closest("[data-empty-copilot-start]")) {
      document.querySelector(".empty-copilot-compose textarea")?.focus();
      return;
    }
    if (event.target.closest("[data-logout]")) {
      location.assign("/api/dashboard-logout");
      return;
    }
    const clearData = event.target.closest("[data-clear-data]");
    if (clearData) {
      const all = clearData.dataset.clearData === "all";
      const warning = all
        ? "Permanently delete ALL financial data for this account? This cannot be undone."
        : `Permanently delete expenses and income for ${monthLabel(window.dashboardModel.month)}? This cannot be undone.`;
      if (window.confirm(warning)) postDashboard({ kind: all ? "clear_all" : "clear_month", month: window.dashboardModel.month }, clearData.closest(".modal"));
      return;
    }
    const panel = event.target.closest("[data-panel]");
    if (panel) {
      openPanel(panel.dataset.panel);
      return;
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      app.classList.remove("mobile-menu-open");
      document.querySelector(".mobile-menu-button")?.setAttribute("aria-expanded", "false");
      document.querySelectorAll(".nav button, .mobile-bottom-nav [data-nav]").forEach((button) => button.classList.toggle("active", button.dataset.nav === nav.dataset.nav));
      if (nav.dataset.nav === "analysis") {
        const rail = document.querySelector(".assistant-rail");
        if (rail && getComputedStyle(rail).display !== "none") {
          rail.classList.remove("collapsed");
          rail.querySelector("textarea[name=message]")?.focus();
        } else openAiChat();
        return;
      }
      const target = document.getElementById(nav.dataset.nav);
      if (target) target.scrollIntoView({ block: "start" });
      else openPanel(nav.dataset.nav);
    }
  });

  document.addEventListener("submit", (event) => {
    const aiForm = event.target.closest("[data-ai-chat-form]");
    if (aiForm) {
      event.preventDefault();
      submitAiQuestion(aiForm);
      return;
    }
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === "email-report") {
      const email = form.elements.email?.value.trim();
      if (!email) return;

      try { localStorage.setItem("user_email", email); } catch(e) {}

      const submitBtn = form.querySelector(".send-report-btn");
      const errorEl = form.querySelector("[data-error]");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `${icon("loader")} Sending report...`;
      }
      if (errorEl) errorEl.textContent = "";

      const model = window.dashboardModel;
      const payload = {
        recipientEmail: email,
        month: monthLabel(model.month),
        currency: model.currency,
        spentFormatted: formatMoney(model.spentMinor, model.currency),
        budgetFormatted: model.budgetMinor ? formatMoney(model.budgetMinor, model.currency) : "No budget set",
        budgetUsed: model.budgetMinor ? model.budgetUsed : 0,
        remainingFormatted: model.remainingMinor === null ? "N/A" : model.remainingMinor < 0 ? `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over budget` : `${formatMoney(model.remainingMinor, model.currency)} remaining`,
        incomeFormatted: formatMoney(model.incomeMinor, model.currency),
        savedFormatted: formatMoney(model.savedMinor, model.currency),
        categories: (model.categories || []).map(c => ({ name: c.name, amountFormatted: formatMoney(c.amountMinor, model.currency) })),
        displayName: model.user?.displayName || "User"
      };

      fetch("/api/send-report-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(res => {
        if (res.error) {
          if (errorEl) errorEl.textContent = res.error;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `${icon("mail")} Send Report via Email`;
          }
        } else {
          openModal("Report Sent! ✉️", "Your private financial summary has been delivered.", `
            <div class="report-success-state">
              <div class="success-icon">${icon("check")}</div>
              <p>Financial report for <b>${esc(monthLabel(model.month))}</b> has been dispatched to <b>${esc(email)}</b>.</p>
              <div class="modal-actions" style="margin-top:12px; width:100%;">
                <button type="button" class="action-button primary" onclick="closeModal()" style="width:100%;">Done</button>
              </div>
            </div>
          `, { wide: false });
        }
      })
      .catch(err => {
        if (errorEl) errorEl.textContent = "Network error. Please try again.";
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${icon("mail")} Send Report via Email`;
        }
      });
      return;
    }
    if (form.dataset.form === "settings") {
      const currency = form.elements.currency?.value;
      const modelName = form.elements.copilot_model?.value;
      const compact = form.elements.compact_mode?.checked;
      const autoSuggest = form.elements.auto_suggest?.checked;

      try {
        if (modelName) localStorage.setItem("copilot_model", modelName);
        localStorage.setItem("compact_mode", String(Boolean(compact)));
        localStorage.setItem("auto_suggest", String(Boolean(autoSuggest)));
      } catch(e) {}

      if (currency && currency !== window.dashboardModel?.currency) {
        postDashboard({ kind: "budget", amount: window.dashboardModel?.budgetMinor ? window.dashboardModel.budgetMinor / 100 : 0, currency }, form);
        return;
      }

      openModal("Preferences Saved! ✨", "Your workspace settings have been updated.", `
        <div class="report-success-state">
          <div class="success-icon">${icon("check")}</div>
          <p>Your dashboard settings have been applied successfully.</p>
          <div class="modal-actions" style="margin-top:12px; width:100%;">
            <button type="button" class="action-button primary" onclick="closeModal(); location.reload();" style="width:100%;">Apply & Reload</button>
          </div>
        </div>
      `, { wide: false });
      return;
    }
    submitPanelForm(form);
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-search]")) filterDashboard(event.target.value);
  });

  document.addEventListener("change", (event) => {
    if (!event.target.matches("[data-month-picker]")) return;
    const month = event.target.value || selectedMonth;
    location.href = `${location.pathname}?month=${encodeURIComponent(month)}`;
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.matches("[data-mobile-copilot-input]") && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      openMobileCopilotAndSend(event.target.value.trim());
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("[data-search]")?.focus();
    }
    if (event.key === "Escape") closeModal();
  });
}

loadDashboard()
  .then((data) => {
    window.dashboardModel = buildModel(data);
    if (window.dashboardModel.hasFinancialData) renderDashboard(window.dashboardModel);
    else renderEmptyDashboard(window.dashboardModel);
    syncThemeSwitch();
    try {
      if (localStorage.getItem("expenseTrackerSidebar") === "collapsed") app.classList.add("sidebar-collapsed");
    } catch {}
    initializeAssistantRailResize();
    bindEvents();
    bindIncomeExpenseChart();
  })
  .catch((error) => {
    if (error.code === "AUTH_REQUIRED") {
      redirectToMcpizeAuth();
      return;
    }
    app.className = "error-card";
    app.innerHTML = `<h1>Dashboard unavailable</h1><p>${esc(error.message)}</p><p>Open a fresh dashboard link from Money Copilot MCP.</p>`;
  });
