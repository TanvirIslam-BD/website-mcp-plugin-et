const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const token = params.get("dashboard_token");
const selectedMonth = params.get("month") || new Date().toISOString().slice(0, 7);
const MCPIZE_DASHBOARD_BRIDGE_URL = "https://expense-tracker-mcp.mcpize.run/dashboard";

function redirectToMcpizeAuth() {
  // A Vercel page cannot read MCPize's cookies or user header. Route through
  // the MCP dashboard bridge, where MCPize supplies the authenticated user id
  // and the server issues this browser a 15-minute signed dashboard session.
  const returnTo = new URL("/dashboard", location.origin);
  returnTo.searchParams.set("month", selectedMonth);
  const bridge = new URL(MCPIZE_DASHBOARD_BRIDGE_URL);
  bridge.searchParams.set("month", selectedMonth);
  bridge.searchParams.set("return_to", returnTo.toString());
  location.replace(bridge.toString());
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
    settings: "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3-.2-.1a1.7 1.7 0 0 0-2 .1 1.7 1.7 0 0 0-.8 1.7V22h-3.6v-.3a1.7 1.7 0 0 0-.8-1.7 1.7 1.7 0 0 0-2-.1l-.2.1-2-3 .1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1.2H3v-3.6h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9L4.2 7l2-3 .2.1a1.7 1.7 0 0 0 2-.1 1.7 1.7 0 0 0 .8-1.7V2h3.6v.3a1.7 1.7 0 0 0 .8 1.7 1.7 1.7 0 0 0 2 .1l.2-.1 2 3-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1.2h.1v3.6h-.1A1.7 1.7 0 0 0 19.4 15z'/>",
    wallet: "<path d='M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12'/><path d='M16 14h.01'/>",
    down: "<path d='M12 4v14'/><path d='m6 12 6 6 6-6'/>",
    up: "<path d='M12 20V6'/><path d='m6 12 6-6 6 6'/>",
    piggy: "<path d='M19 8h2v4h-2'/><path d='M4 8 2 6m3 10v3m10-3v3m-5-13c2-2 6-1 7 2 2 0 3 2 3 4 0 4-4 7-9 7s-9-3-9-7c0-3 2-5 5-6 0-2 2-3 4-3'/><path d='M9 12h.01'/>",
    search: "<circle cx='11' cy='11' r='7'/><path d='m20 20-3.5-3.5'/>",
    bell: "<path d='M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9'/><path d='M10 21h4'/>",
    plus: "<path d='M12 5v14M5 12h14'/>",
    close: "<path d='M6 6l12 12M18 6 6 18'/>",
    card: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 10h18'/>",
    flame: "<path d='M12 22c4 0 7-3 7-7 0-3-2-5-4-7 .2 2-.7 3.2-2 4-1.3-3-1-6-1-10-4 3-7 7-7 12 0 5 3 8 7 8z'/>",
    chevron: "<path d='m9 18 6-6-6-6'/>",
    eye: "<path d='M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z'/><circle cx='12' cy='12' r='3'/>",
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
  };
}

function renderMetricCards(model) {
  const balanceTrend = percentChange(model.savedMinor, Number(model.previousIncomeMinor || 0) - Number(model.previousSpentMinor || 0));
  const incomeTrend = percentChange(model.incomeMinor, model.previousIncomeMinor);
  const expenseTrend = percentChange(model.spentMinor, model.previousSpentMinor, true);
  const savingTrend = model.incomeMinor ? model.savingsRate : 0;
  const balanceSpark = model.savingsCum.length ? model.savingsCum : [1, 2, 1, 3, 4, 3, 5];
  const incomeSpark = model.incomeDaily.length ? model.incomeDaily : [1, 2, 3, 2, 4, 3, 5];
  const expenseSpark = model.expenseDaily.length ? model.expenseDaily : [1, 3, 4, 3, 2, 5, 4];
  return `
    <section class="summary-grid" aria-label="Monthly summary">
      <article class="metric-card balance">
        <span class="metric-icon">${icon("wallet")}</span>
        <label>Total Balance</label>
        <h2>${formatMoney(model.savedMinor, model.currency)}</h2>
        ${trendBadge(balanceTrend, "vs last month")}
        ${spark(balanceSpark)}
      </article>
      <article class="metric-card income">
        <span class="metric-icon">${icon("down")}</span>
        <label>Total Income</label>
        <h2>${formatMoney(model.incomeMinor, model.currency)}</h2>
        ${trendBadge(incomeTrend, "vs last month")}
        ${spark(incomeSpark, "#18b96f")}
      </article>
      <article class="metric-card expense">
        <span class="metric-icon">${icon("up")}</span>
        <label>Total Expenses</label>
        <h2>${formatMoney(model.spentMinor, model.currency)}</h2>
        ${trendBadge(expenseTrend, "vs last month", expenseTrend < 0 ? "bad" : "good")}
        ${spark(expenseSpark, "#ff4548")}
      </article>
      <article class="metric-card saving">
        <span class="metric-icon">${icon("piggy")}</span>
        <label>Total Savings</label>
        <h2>${formatMoney(model.savedMinor, model.currency)}</h2>
        ${trendBadge(savingTrend, "savings rate", "purple")}
        ${spark(balanceSpark, "#7c3fff")}
      </article>
    </section>
  `;
}

function renderHealth(model) {
  const recurringMonths = Math.max(0, Math.round((Math.max(0, model.savedMinor) / Math.max(1, model.spentMinor || 1)) * 10) / 10);
  return `
    <article class="panel financial-health" id="analytics">
      <div class="panel-head">
        <h3>Financial Health Score</h3>
        <span class="tiny-icon">${icon("eye")}</span>
      </div>
      <div class="health-body">
        <div class="score-ring" style="--score:${model.health}%">
          <div class="inner"><b>${model.health}</b><span>${model.health >= 80 ? "Excellent" : model.health >= 60 ? "Good" : "Needs care"}</span></div>
        </div>
        <div class="health-stats">
          <div class="health-stat"><span><i class="status-dot" style="--tone:#18b96f;--tone-bg:#e8faef">${icon("down")}</i>Savings Rate</span><b>${model.savingsRate}%</b></div>
          <div class="health-stat"><span><i class="status-dot" style="--tone:#ff4548;--tone-bg:#fff0f0">${icon("budget")}</i>Budget Used</span><b>${model.budgetMinor ? `${model.budgetUsed}%` : "Not set"}</b></div>
          <div class="health-stat"><span><i class="status-dot" style="--tone:#2563ff;--tone-bg:#edf3ff">${icon("wallet")}</i>Emergency Fund</span><b>${recurringMonths} Months</b></div>
          <div class="health-stat"><span><i class="status-dot" style="--tone:#ffb21c;--tone-bg:#fff7e6">${icon("card")}</i>Debt Level</span><b class="good">Low</b></div>
        </div>
      </div>
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
        <h3>Income vs Expense</h3>
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
          <text class="axis-label" data-axis-label="max" x="0" y="38">${formatMoney(max, model.currency, { compact: true })}</text>
          <text class="axis-label" data-axis-label="mid" x="0" y="75">${formatMoney(max * .66, model.currency, { compact: true })}</text>
          <text class="axis-label" data-axis-label="low" x="0" y="112">${formatMoney(max * .33, model.currency, { compact: true })}</text>
          <text class="axis-label" x="0" y="149">0</text>
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
          <text class="axis-label" data-x-label="start" x="${padX}" y="172">1 ${monthLabel(model.month).split(" ")[0]}</text>
          <text class="axis-label" data-x-label="mid" x="${width / 2 - 18}" y="172">15 ${monthLabel(model.month).split(" ")[0]}</text>
          <text class="axis-label" data-x-label="end" x="${width - 78}" y="172">${daysInMonth(model.month)} ${monthLabel(model.month).split(" ")[0]}</text>
        </svg>
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
        <h3>Budget Overview</h3>
      </div>
      <div class="budget-ring" style="--budget:${ring}%">
        <div class="inner"><b>${model.budgetMinor ? `${used}%` : "--"}</b><span>${model.budgetMinor ? `of ${formatMoney(model.budgetMinor, model.currency, { compact: true })}` : "No budget"}</span></div>
      </div>
      <div class="budget-values">
        <span><small>Spent</small><b class="${isOver ? "negative" : ""}">${formatMoney(model.spentMinor, model.currency, { compact: true })}</b></span>
        <span><small>Budget</small><b>${model.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "--"}</b></span>
        <span><small>Remaining</small><b class="${isOver ? "negative" : ""}">${model.remainingMinor === null ? "--" : formatMoney(model.remainingMinor, model.currency, { compact: true })}</b></span>
      </div>
      <div class="budget-footer">
        <div class="alert-pill">${icon(isOver ? "up" : "down")} ${model.budgetMinor ? (isOver ? `Budget exceeded by ${Math.max(0, used - 100)}%` : `${formatMoney(model.remainingMinor, model.currency)} remaining`) : "Set a monthly budget"}</div>
        <button class="wide-button" data-panel="budget-editor">View Budget</button>
      </div>
    </article>
  `;
}

function renderCategories(model) {
  const total = Math.max(model.spentMinor || 0, 1);
  let start = 0;
  const segments = (model.categories || []).slice(0, 6).map((category, index) => {
    const pct = (category.amountMinor / total) * 100;
    const end = start + pct;
    const segment = `${colors[index % colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return segment;
  });
  if (start < 100) segments.push(`#e5ebf3 ${start.toFixed(2)}% 100%`);
  const rows = (model.categories || []).slice(0, 6).map((category, index) => {
    const pct = Math.round((category.amountMinor / total) * 100);
    return `<div class="category-line"><label><i class="dot" style="--tone:${colors[index % colors.length]}"></i>${esc(category.name)}</label><b>${pct}%</b><span>${formatMoney(category.amountMinor, model.currency, { compact: true })}</span></div>`;
  }).join("") || `<div class="empty-state">No category data yet.</div>`;
  return `
    <article class="panel spending-panel" id="categories">
      <div class="panel-head">
        <h3>Spending by Category</h3>
      </div>
      <div class="category-body">
        <div class="donut" style="--donut:conic-gradient(${segments.join(",")})">
          <div class="inner"><b>${formatMoney(model.spentMinor, model.currency, { compact: true })}</b><span>Total</span></div>
        </div>
        <div class="category-legend">${rows}</div>
      </div>
      <button class="wide-button" data-panel="categories">View All Categories</button>
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
        <h3>AI Insights</h3>
        <button class="panel-link" data-panel="analysis">View Full Analysis</button>
      </div>
      <div class="insight-list">
        ${items.map((item) => `<div class="insight-item"><i style="--tone:${item.tone};--tone-bg:${item.bg}">${icon(item.iconName)}</i><span><b>${esc(item.title)}</b><span>${esc(item.body)}</span></span></div>`).join("")}
      </div>
      <button class="wide-button" data-panel="analysis">View Full Analysis</button>
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
  const expenses = (model.expenses || []).slice(0, 8);
  const rows = expenses.map((expense, index) => {
    const metadata = model.expenseMetadata?.[expense.id] || {};
    const [tone, bg] = toneFor(expense.category, index);
    const merchant = metadata.merchant || expense.description || "Expense";
    const payment = metadata.paymentMethod || "Expense";
    return `
      <tr data-search="${esc(`${expense.date} ${merchant} ${expense.category} ${payment}`.toLowerCase())}">
        <td>${esc(expense.date)}</td>
        <td><div class="tx-title"><i class="tx-avatar" style="--tone:${tone};--tone-bg:${bg}">${esc(String(merchant).charAt(0).toUpperCase())}</i><span><b>${esc(merchant)}</b><span>${esc(expense.description || expense.category)}</span></span></div></td>
        <td><span class="tag" style="--tone:${tone};--tone-bg:${bg}">${esc(expense.category)}</span></td>
        <td><span class="payment"><i>${esc(payment.slice(0, 4).toUpperCase())}</i>${esc(payment)}</span></td>
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
          <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Payment Method</th><th class="amount">Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderSidebar(model) {
  const streak = model.savingsRate > 0 ? Math.max(1, Math.min(30, Math.round(model.savingsRate / 2))) : 0;
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["transactions", "Transactions", "transactions"],
    ["analytics", "Analytics", "analytics"],
    ["budget", "Budget", "budget"],
    ["accounts", "Accounts", "accounts"],
    ["categories", "Categories", "categories"],
    ["bills", "Bills", "bills"],
    ["goals", "Goals", "goals"],
    ["advisor", "AI Advisor", "analysis"],
    ["settings", "Settings", "settings"],
  ];
  return `
    <aside class="sidebar">
      <div class="brand"><img src="/assets/logo/icon-512.png" alt=""><strong>Expense<span>Tracker AI</span></strong></div>
      <nav class="nav" aria-label="Dashboard navigation">
        ${nav.map(([iconName, label, panel], index) => `<button class="${index === 0 ? "active" : ""}" data-nav="${panel}">${icon(iconName)}<span>${label}</span>${label === "AI Advisor" ? "<em class='pill-new'>New</em>" : ""}</button>`).join("")}
      </nav>
      <section class="streak-card">
        <div class="streak-label"><i class="flame">${icon("flame")}</i>Saving Streak</div>
        <b>${streak} Days</b>
        <p>${streak ? "Keep it up. Your net position is improving." : "Record income to start your streak."}</p>
        <div class="streak-bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      </section>
      <section class="profile-card">
        <img src="/assets/logo/icon-512.png" alt="">
        <div><b>Private User</b><span>Signed dashboard</span></div>
        ${icon("chevron")}
      </section>
    </aside>
  `;
}

function renderHeader(model) {
  const savedMore = percentChange(model.savedMinor, Number(model.previousIncomeMinor || 0) - Number(model.previousSpentMinor || 0));
  return `
    <header class="topbar">
      <div class="headline">
        <h1>Good Morning, Private User!</h1>
        <p>${savedMore >= 0 ? `You saved <strong>${Math.abs(savedMore).toFixed(0)}%</strong> more than last month. Keep it up!` : `Your private financial overview for ${esc(monthLabel(model.month))}.`}</p>
      </div>
      <div class="toolbar">
        <input class="month-input" type="month" aria-label="Select month" value="${esc(model.month)}" data-month-picker>
        <label class="input-shell">${icon("search")}<input type="search" placeholder="Search anything..." data-search><span class="kbd">Ctrl K</span></label>
        <button class="notice-button" data-panel="notifications" aria-label="Notifications">${icon("bell")}<b>${buildNotifications(model).length}</b></button>
        <div class="toolbar-actions">
          <button class="action-button" data-entry="income">${icon("plus")}Add Income</button>
          <button class="action-button primary" data-entry="expense">${icon("plus")}Add Expense</button>
        </div>
      </div>
    </header>
  `;
}

function renderDashboard(model) {
  app.className = "dashboard-shell";
  app.innerHTML = `
    ${renderSidebar(model)}
    <section class="main">
      ${renderHeader(model)}
      ${renderMetricCards(model)}
      <section class="content-grid">
        ${renderHealth(model)}
        ${renderIncomeExpense(model)}
        ${renderBudget(model)}
        ${renderCategories(model)}
        ${renderInsights(model)}
        ${renderGoals(model)}
        ${renderBillsAndSubscriptions(model)}
        ${renderTransactions(model)}
      </section>
    </section>
    <aside class="marketing-rail" aria-label="Expense Tracker AI promotion">
      <a class="promo-card" href="/" aria-label="Open Expense Tracker AI home">
        <img src="/assets/dashboard/expense-tracker-ai-promo.png" alt="Expense Tracker AI marketing preview">
      </a>
    </aside>
    <button class="floating-add" data-entry="expense" aria-label="Add expense">${icon("plus")}</button>
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
      <section class="modal ${options.wide ? "wide" : ""}">
        <div class="modal-top">
          <div><h2>${esc(title)}</h2><p>${esc(subtitle || "")}</p></div>
          <button class="modal-close" data-close aria-label="Close">${icon("close")}</button>
        </div>
        ${content}
      </section>
    </div>
  `);
}

function closeModal() {
  document.getElementById("dashboard-modal")?.remove();
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
  if (kind === "notifications") {
    openModal("Notifications", "Budget alerts and workspace reminders.", panelRows(buildNotifications(model), (item) => `<div class="plain-row"><span><b>${esc(item.title)}</b><small>${esc(item.body)}</small></span>${icon("bell")}</div>`));
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
    openModal("Dashboard Settings", "Current private session and display settings.", `
      <div class="panel-metrics">
        <div class="panel-metric"><span>Month</span><b>${esc(monthLabel(model.month))}</b></div>
        <div class="panel-metric"><span>Currency</span><b>${esc(model.currency)}</b></div>
        <div class="panel-metric"><span>Privacy</span><b>Signed session</b></div>
      </div>
      <p>This dashboard only loads data through the signed MCP dashboard session. The browser never chooses a user id.</p>
    `);
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

function bindEvents() {
  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target.id === "dashboard-modal") closeModal();
    const entry = event.target.closest("[data-entry]");
    if (entry) {
      openEntry(entry.dataset.entry);
      return;
    }
    const panel = event.target.closest("[data-panel]");
    if (panel) {
      openPanel(panel.dataset.panel);
      return;
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      document.querySelectorAll(".nav button").forEach((button) => button.classList.toggle("active", button === nav));
      const target = document.getElementById(nav.dataset.nav);
      if (target) target.scrollIntoView({ block: "start" });
      else openPanel(nav.dataset.nav);
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
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
    renderDashboard(window.dashboardModel);
    bindEvents();
    bindIncomeExpenseChart();
  })
  .catch((error) => {
    if (error.code === "AUTH_REQUIRED") {
      redirectToMcpizeAuth();
      return;
    }
    app.className = "error-card";
    app.innerHTML = `<h1>Dashboard unavailable</h1><p>${esc(error.message)}</p><p>Open a fresh dashboard link from Expense Tracker MCP.</p>`;
  });
