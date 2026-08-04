const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const token = params.get("dashboard_token");
let selectedMonth = params.get("month") || new Date().toISOString().slice(0, 7);
const DASHBOARD_LOGIN_URL = "/api/dashboard-auth";
const MONEY_COPILOT_MCP_ENDPOINT = "https://expense-tracker-mcp.mcpize.run/mcp";

function localDisplayCurrency(fallbackCurrency = "") {
  const saved = (() => {
    try { return localStorage.getItem("dashboard_display_currency"); } catch { return ""; }
  })();
  if (/^[A-Z]{3}$/.test(saved || "")) return saved;

  const region = (() => {
    try { return new Intl.Locale(navigator.language).region || ""; } catch { return ""; }
  })();
  const regionalCurrency = { BD: "BDT", IN: "INR", GB: "GBP", CA: "CAD", AU: "AUD", EU: "EUR", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", PT: "EUR" }[region];
  return regionalCurrency || (/^[A-Z]{3}$/.test(fallbackCurrency) ? fallbackCurrency : "USD");
}

function setTheme(mode) {
  const theme = mode === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("expenseTrackerTheme", theme); } catch {}
  syncThemeSwitch();
}

function readLocalPreferences(fallback = {}) {
  const readBoolean = (key, defaultValue) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? defaultValue : value === "true";
    } catch { return defaultValue; }
  };
  let copilotModel = fallback.copilotModel || "gemini-2.5-flash";
  try { copilotModel = localStorage.getItem("copilot_model") || copilotModel; } catch {}
  return {
    ...fallback,
    currency: localDisplayCurrency(fallback.currency || ""),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    compactMode: readBoolean("compact_mode", fallback.compactMode === true),
    copilotModel,
    autoSuggest: readBoolean("auto_suggest", fallback.autoSuggest !== false),
    billReminders: readBoolean("bill_reminders", fallback.billReminders !== false),
    incomeReceived: readBoolean("income_received_notifications", fallback.incomeReceived !== false),
    overdueAlerts: readBoolean("overdue_alerts", fallback.overdueAlerts !== false),
    newsletter: readBoolean("newsletter_notifications", fallback.newsletter !== false),
    pushNotifications: readBoolean("push_notifications", fallback.pushNotifications === true),
    emailNotifications: readBoolean("email_notifications", fallback.emailNotifications !== false),
  };
}

function applyDashboardPreferences(preferences = {}) {
  if (preferences.theme === "dark" || preferences.theme === "light") setTheme(preferences.theme);
  document.documentElement.dataset.density = preferences.compactMode ? "compact" : "comfortable";
  try {
    if (preferences.currency) localStorage.setItem("dashboard_display_currency", preferences.currency);
    if (preferences.copilotModel) localStorage.setItem("copilot_model", preferences.copilotModel);
    localStorage.setItem("compact_mode", String(Boolean(preferences.compactMode)));
    localStorage.setItem("auto_suggest", String(preferences.autoSuggest !== false));
    localStorage.setItem("bill_reminders", String(preferences.billReminders !== false));
    localStorage.setItem("income_received_notifications", String(preferences.incomeReceived !== false));
    localStorage.setItem("overdue_alerts", String(preferences.overdueAlerts !== false));
    localStorage.setItem("newsletter_notifications", String(preferences.newsletter !== false));
    localStorage.setItem("push_notifications", String(preferences.pushNotifications === true));
    localStorage.setItem("email_notifications", String(preferences.emailNotifications !== false));
  } catch {}
}

function showNotificationOnce(key, title, body) {
  try {
    const storageKey = `money_copilot_notification:${key}`;
    if (localStorage.getItem(storageKey)) return;
    new Notification(title, { body, icon: "/assets/logo/money-copilot-app-logo.png", tag: key });
    localStorage.setItem(storageKey, new Date().toISOString());
  } catch {}
}

function runNotificationPreferences(model) {
  const preferences = model?.preferences || {};
  if (!("Notification" in window) || Notification.permission !== "granted" || preferences.pushNotifications !== true) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const bill of model.recurring || []) {
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(bill.nextDate || "") ? new Date(`${bill.nextDate}T00:00:00`) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) continue;
    const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    const name = bill.merchant || bill.description || bill.category || "Recurring bill";
    if (preferences.overdueAlerts !== false && daysUntilDue < 0) {
      showNotificationOnce(`overdue:${bill.id || name}:${bill.nextDate}`, "Overdue bill", `${name} was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} ago.`);
    } else if (preferences.billReminders !== false && (daysUntilDue === 1 || daysUntilDue === 3)) {
      showNotificationOnce(`bill:${bill.id || name}:${bill.nextDate}:${daysUntilDue}`, "Bill reminder", `${name} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`);
    }
  }
  if (preferences.incomeReceived !== false && Number(model.incomeMinor || 0) > 0) {
    showNotificationOnce(`income:${model.month}:${model.incomeMinor}`, "Income received", `${formatMoney(model.incomeMinor, model.currency, { compact: true })} is recorded for ${monthLabel(model.month)}.`);
  }
}

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
  document.querySelectorAll("[data-mobile-theme-toggle]").forEach((button) => {
    const nextTheme = current === "dark" ? "light" : "dark";
    button.innerHTML = `${icon(nextTheme === "dark" ? "moon" : "sun")}<span>${nextTheme === "dark" ? "Dark" : "Light"}</span>`;
    button.setAttribute("aria-label", `Use ${nextTheme} theme`);
    button.setAttribute("aria-pressed", String(current === "dark"));
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

const colors = ["#019a56", "#19b9aa", "#83c968", "#087f49", "#9ee4ce", "#4ec9a0", "#5eae77"];
const tagColors = {
  food: ["#72bf61", "#edf8e9"],
  "food & dining": ["#72bf61", "#edf8e9"],
  groceries: ["#42b87a", "#e8f7ef"],
  shopping: ["#019a56", "#e7f6ee"],
  travel: ["#19b9aa", "#e5f8f5"],
  transport: ["#2ab8a2", "#e6f8f5"],
  utilities: ["#087f49", "#e5f3eb"],
  bills: ["#d6a51e", "#fff8df"],
  health: ["#42b997", "#e7f7f2"],
  income: ["#019a56", "#e7f6ee"],
};

const SUB_CATEGORIES = {
  food: ["Baby food", "Fast food", "Fruit", "Wet market", "Other"],
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
    trash: "<path d='M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6'/>",
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
    calendar: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v4M8 3v4M3 10h18'/>",
    check: "<path d='m5 12 4 4L19 6'/>",
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

const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderMonthPicker(month) {
  const [year, monthNumber] = String(month || selectedMonth).split("-").map(Number);
  const safeYear = Number.isInteger(year) ? year : new Date().getFullYear();
  const safeMonth = monthNumber >= 1 && monthNumber <= 12 ? monthNumber : 1;
  const options = MONTH_NAMES_SHORT.map((name, index) => {
    const value = `${safeYear}-${String(index + 1).padStart(2, "0")}`;
    const selected = index + 1 === safeMonth;
    return `<button type="button" role="option" aria-selected="${selected}" class="month-picker-option${selected ? " selected" : ""}" data-month-value="${value}" data-month-number="${index + 1}">${name}</button>`;
  }).join("");
  return `
    <div class="month-picker" data-month-picker data-year="${safeYear}" data-selected-month="${esc(month)}">
      <button class="month-picker-trigger" type="button" aria-label="Select month" aria-haspopup="dialog" aria-expanded="false" data-month-picker-toggle>
        <span>${esc(monthLabel(`${safeYear}-${String(safeMonth).padStart(2, "0")}`))}</span>${icon("calendar")}
      </button>
      <div class="month-picker-popover" role="dialog" aria-label="Choose dashboard month" data-month-picker-menu hidden>
        <div class="month-picker-year">
          <button type="button" aria-label="Previous year" data-month-year-step="-1">&#8249;</button>
          <strong data-month-year-label>${safeYear}</strong>
          <button type="button" aria-label="Next year" data-month-year-step="1">&#8250;</button>
        </div>
        <div class="month-picker-grid" role="listbox" aria-label="Months">${options}</div>
        <div class="month-picker-footer">
          <button type="button" data-month-clear>Current month</button>
          <button type="button" data-month-today>Today</button>
        </div>
      </div>
    </div>
  `;
}

function closeMonthPickers(except = null) {
  document.querySelectorAll("[data-month-picker]").forEach((picker) => {
    if (picker === except) return;
    picker.classList.remove("open");
    picker.querySelector("[data-month-picker-toggle]")?.setAttribute("aria-expanded", "false");
    const menu = picker.querySelector("[data-month-picker-menu]");
    if (menu) menu.hidden = true;
  });
}

function updateMonthPickerYear(picker, year) {
  if (!picker || !Number.isInteger(year)) return;
  picker.dataset.year = String(year);
  const label = picker.querySelector("[data-month-year-label]");
  if (label) label.textContent = String(year);
  const selectedMonthValue = picker.dataset.selectedMonth;
  picker.querySelectorAll("[data-month-number]").forEach((button) => {
    const value = `${year}-${String(button.dataset.monthNumber).padStart(2, "0")}`;
    button.dataset.monthValue = value;
    const selected = value === selectedMonthValue;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
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
  const preferences = data.preferences && typeof data.preferences === "object" ? data.preferences : {};
  const currency = /^[A-Z]{3}$/.test(preferences.currency || "") ? preferences.currency : localDisplayCurrency(data.currency || "USD");
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
    preferences,
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
      sparkTone: model.savedMinor < 0 ? "#ef4444" : "#019a56",
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
      sparkTone: "#019a56",
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
      sparkTone: "#019a56",
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
      sparkTone: model.savedMinor < 0 ? "#ef4444" : "#019a56",
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
            <span><i style="--tone:#078f50"></i>Income</span>
            <span><i style="--tone:#019a56"></i>Expenses</span>
            <span><i style="--tone:#20bfa0"></i>Savings</span>
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
          <circle class="chart-point income" data-chart-point="income" r="4" stroke="#078f50"/>
          <circle class="chart-point expense" data-chart-point="expense" r="4" stroke="#019a56"/>
          <circle class="chart-point saving" data-chart-point="saving" r="4" stroke="#20bfa0"/>
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
  if (model.preferences?.autoSuggest === false) {
    return `
      <article class="panel insights-panel insights-disabled">
        <div class="panel-head"><h3>Smart insights</h3></div>
        <div class="empty-state">Automatic insights are paused in Dashboard Settings.</div>
        <button class="panel-footer-link" data-panel="settings">Enable smart insights</button>
      </article>
    `;
  }
  const top = model.categories?.[0];
  const over = model.remainingMinor !== null && model.remainingMinor < 0;
  const forecastOver = model.budgetMinor && model.forecastMinor > model.budgetMinor;
  const items = [
    top ? { tone: "#18b9a6", bg: "#e6f8f4", title: `You spent most on ${top.name}`, body: `${formatMoney(top.amountMinor, model.currency)} is your largest category this month.`, iconName: "budget" } : null,
    over ? { tone: "#019a56", bg: "#e7f6ee", title: "Budget limit crossed", body: `${formatMoney(Math.abs(model.remainingMinor), model.currency)} over the monthly limit.`, iconName: "up" } : { tone: "#019a56", bg: "#e7f6ee", title: "Budget status is stable", body: model.budgetMinor ? `${formatMoney(model.remainingMinor, model.currency)} still available.` : "Create a monthly budget to unlock alerts.", iconName: "down" },
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
    const [tone, bg] = [["#d6a51e", "#fff8df"], ["#19b9aa", "#e5f8f5"], ["#019a56", "#e7f6ee"]][index % 3];
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
    const subCatHtml = metadata.subcategory 
      ? ` <span class="tag subcategory-tag" style="background: var(--line); border: 1px solid var(--line2); color: var(--text-muted); font-size: 9px; min-height: 18px; padding: 0 6px; border-radius: 4px; display: inline-flex; align-items: center; vertical-align: middle;">${esc(metadata.subcategory)}</span>`
      : "";
    return `
      <tr data-search="${esc(`${expense.date} ${merchant} ${expense.category} ${payment}`.toLowerCase())}">
        <td>${esc(expense.date)}</td>
        <td><div class="tx-title"><i style="--tone:${tone};--tone-bg:${bg}">${icon(index === 0 ? "transactions" : index === 1 ? "bills" : "categories")}</i><span><b>${esc(merchant)}</b><small class="mobile-transaction-meta">${esc(dateLabel)}${timeLabel ? `, ${esc(timeLabel)}` : ""}</small></span></div></td>
        <td><button class="tag interactive-category-btn" data-expense-id="${esc(expense.id)}" data-category="${esc(expense.category)}" style="--tone:${tone};--tone-bg:${bg}; cursor: pointer; border: none; font-family: inherit;">${esc(expense.category)}</button>${subCatHtml}</td>
        <td><span class="payment">${icon(payment.toLowerCase() === "cash" ? "wallet" : "card")}${esc(payment)}</span></td>
        <td class="amount">-${formatMoney(expense.amountMinor, model.currency)}</td>
        <td style="text-align: center;"><button type="button" class="tx-delete-btn" data-delete-expense-id="${esc(expense.id)}" aria-label="Delete expense" style="background:none; border:none; color:#ea580c; cursor:pointer; padding:6px; display:inline-flex; align-items:center; transition:opacity 0.15s; font-size:14px; opacity: 0.5; width: 28px; height: 28px; border-radius: 6px;" onmouseover="this.style.opacity=1; this.style.background='rgba(234,88,12,0.08)'" onmouseout="this.style.opacity=0.5; this.style.background='none'">${icon("trash")}</button></td>
      </tr>`;
  }).join("") || `<tr><td colspan="6"><div class="empty-state">No transactions recorded for this month.</div></td></tr>`;
  return `
    <article class="panel transactions-panel" id="transactions">
      <div class="panel-head">
        <h3>Recent Transactions</h3>
        <button class="panel-link" data-panel="transactions">View All</button>
      </div>
      <div class="transactions-wrap">
        <table class="transactions">
          <thead><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Method</th><th class="amount">Amount</th><th style="width: 44px;"></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderSidebar(model) {
  const displayName = esc(model.user?.displayName || "User");
  const profilePhotoUrl = esc(model.user?.profilePhotoUrl || "/assets/logo/money-copilot-app-logo.png");
  const nav = [
    ["dashboard", "Dashboard", "dashboard"],
    ["transactions", "Transactions", "transactions"],
    ["advisor", "AI Advisor", "analysis"],
    ["database", "Manage Data", "data-management"],
    ["categories", "Categories", "categories"],
    ["budget", "Budget", "budget"],
    ["mail", "Email Report", "email-report"],
    ["settings", "Settings", "settings"],
  ];
  return `
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-logo brand-logo-dark" src="/assets/logo/money-copilot-app-logo.png" alt="">
        <img class="brand-logo brand-logo-light" src="/assets/logo/money-copilot-app-logo.png" alt="">
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
        ${renderMonthPicker(model.month)}
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
  const profilePhotoUrl = esc(model.user?.profilePhotoUrl || "/assets/logo/money-copilot-app-logo.png");
  const month = esc(monthLabel(model.month).split(" ")[0]);
  return `
    <header class="mobile-dashboard-header">
      <div class="mobile-greeting">
        <div class="mobile-greeting-copy">
          <h1>${timeGreeting()},<br>${displayName} <span aria-hidden="true">👋</span></h1>
          <p>Here&rsquo;s your financial picture for ${month}.</p>
        </div>
        <button class="mobile-profile-button" type="button" data-mobile-menu-toggle aria-label="Open profile and navigation" aria-expanded="false">
          <img src="${profilePhotoUrl}" alt="${displayName} profile photo" referrerpolicy="no-referrer" data-profile-photo>
        </button>
      </div>
    </header>
  `;
}

function renderMobileCopilotComposer() {
  return `
    <section class="mobile-finance-composer" aria-label="Money Copilot quick actions">
      <button class="mobile-composer-bot bot-mascot" type="button" data-open-ai-chat aria-label="Open Money Copilot"><img src="/assets/logo/money-copilot-bot-mascot.png" alt=""></button>
      <textarea rows="1" maxlength="2000" data-mobile-copilot-input placeholder="Ask or add expense..." aria-label="Ask or add an expense"></textarea>
      <button class="mobile-composer-action" type="button" data-mobile-copilot-send aria-label="Send to Money Copilot">${icon("send")}</button>
      <button class="mobile-composer-action" type="button" data-entry="expense" aria-label="Scan a receipt">${icon("camera")}</button>
    </section>
  `;
}

function renderMobileBottomNav() {
  const darkTheme = document.documentElement.dataset.theme === "dark";
  return `
    <nav class="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
      <button class="active" type="button" data-nav="dashboard">${icon("dashboard")}<span>Dashboard</span></button>
      <button type="button" data-nav="transactions">${icon("transactions")}<span>Transactions</span></button>
      <button class="mobile-add-button" type="button" data-entry="expense" aria-label="Add expense">${icon("plus")}</button>
      <button type="button" data-nav="budget">${icon("budget")}<span>Budget</span></button>
      <button type="button" data-mobile-theme-toggle aria-label="Use ${darkTheme ? "light" : "dark"} theme" aria-pressed="${darkTheme}">${icon(darkTheme ? "sun" : "moon")}<span>${darkTheme ? "Light" : "Dark"}</span></button>
    </nav>
  `;
}

function renderAssistantIntegrationCta() {
  return `
    <section class="assistant-integration-cta" aria-label="Connect Money Copilot AI to an AI assistant">
      <button class="assistant-integration-dismiss" type="button" data-dismiss-integration aria-label="Hide integration promotion">${icon("close")}</button>
      <div><strong>Connect Money Copilot AI with ChatGPT or Claude</strong><span>Scan receipts, voice log, AI insights &amp; more.</span></div>
      <nav aria-label="AI integrations">
        <button type="button" data-panel="connections"><img src="/assets/brands/chatgpt.png" alt="">ChatGPT</button>
        <button type="button" data-panel="connections"><img src="/assets/brands/claude.png" alt="">Claude</button>
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
        <div class="assistant-heading" style="display: flex; align-items: center; gap: 10px;">
          <span class="copilot-logo bot-mascot" aria-hidden="true" style="width: 44px; height: 44px; display: block; flex: 0 0 auto;"><img src="/assets/logo/money-copilot-bot-mascot.png" alt="" style="width: 100%; height: auto;"></span>
          <div class="assistant-header-content" style="display: flex; flex-direction: column; gap: 3px;">
            <span class="assistant-title" style="font-size: 15px; font-weight: 700; color: #070c16; line-height: 1.2; display: block;">Money Copilot AI Assistant</span>
            <span class="assistant-status-row" style="display: flex; align-items: center; gap: 8px; margin-top: 1px;"><a class="comet-badge" href="https://www.cometapi.com/console/login?aff=mURH" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI" style="margin: 0; padding: 2px 6px;"><span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI"></a><span class="assistant-online" style="font-size: 10px;"><i></i>Online</span></span>
          </div>
        </div>
        <button type="button" class="assistant-collapse" data-ai-rail-toggle aria-label="Minimize AI Finance Assistant">−</button>
      </div>
      <div class="assistant-rail-chat ai-chat" data-ai-chat>
        <div class="assistant-alert">
          <i class="assistant-alert-icon">${icon(overBudget ? "lock" : "wallet")}</i>
          <div><b>${budgetHeadline}</b><span>${budgetContext}</span></div>
          <div class="assistant-alert-actions">
            <button type="button" data-ai-suggestion="Record an expense of 50 BDT for food">${icon("plus")}Add expense</button>
            <button type="button" data-ai-suggestion="Explain my budget status this month.">${icon("advisor")}Explain</button>
            <button type="button" data-ai-suggestion="Where can I reduce spending this month?">${icon("search")}Find savings</button>
          </div>
        </div>
        <div class="assistant-day"><span>Today</span></div>
        <div class="ai-chat-messages assistant-rail-messages" data-ai-messages>
          <div class="ai-message user"><div class="ai-message-label">You</div><div class="ai-message-body">How is my spending this month?</div><small>9:42 AM</small></div>
          <div class="ai-message assistant copilot-summary"><div class="ai-message-body"><p>Here’s your spending summary for ${esc(monthLabel(model.month).split(" ")[0])}:</p><b>Budget usage</b><div class="copilot-progress"><i style="--value:${Math.min(100, model.budgetUsed || 0)}%"></i><strong>${model.budgetMinor ? `${model.budgetUsed}%` : "--"}</strong></div><div class="copilot-budget-row"><span>${formatMoney(model.spentMinor, model.currency, { compact: true })} of ${model.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "no budget"}</span><b>${model.remainingMinor === null ? "" : overBudget ? `${formatMoney(budgetDifference, model.currency, { compact: true })} over` : `${formatMoney(model.remainingMinor, model.currency, { compact: true })} left`}</b></div><ul><li>You spent ${formatMoney(model.spentMinor, model.currency, { compact: true })} this month.</li>${topCategory ? `<li>${esc(topCategory.name)} is your top category at ${topShare}% of spending.</li>` : ""}</ul></div><small>9:42 AM</small></div>
        </div>
        ${renderAssistantIntegrationCta()}
        <form class="ai-chat-form assistant-rail-form" data-ai-chat-form>
          <div class="copilot-compose"><span class="compose-clip" aria-hidden="true">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask or add expense..." aria-label="Ask AI Finance Assistant" required></textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></div>
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
        <div class="assistant-heading" style="display: flex; align-items: center; gap: 10px;">
          <span class="copilot-logo bot-mascot" aria-hidden="true" style="width: 44px; height: 44px; display: block; flex: 0 0 auto;"><img src="/assets/logo/money-copilot-bot-mascot.png" alt="" style="width: 100%; height: auto;"></span>
          <div class="assistant-header-content" style="display: flex; flex-direction: column; gap: 3px;">
            <span class="assistant-title" style="font-size: 15px; font-weight: 700; color: #070c16; line-height: 1.2; display: block;">Money Copilot AI Assistant</span>
            <span class="assistant-status-row" style="display: flex; align-items: center; gap: 8px; margin-top: 1px;"><a class="comet-badge" href="https://www.cometapi.com/console/login?aff=mURH" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI" style="margin: 0; padding: 2px 6px;"><span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI"></a><span class="assistant-online" style="font-size: 10px;"><i></i>Online</span></span>
          </div>
        </div>
      </div>
      <div class="empty-copilot-body" data-ai-chat>
        <img class="bot-mascot-large" src="/assets/logo/money-copilot-bot-mascot.png" alt="Money Copilot">
        <h2>Hi, I’m your Money Copilot</h2>
        <p>I can help you organize expenses, build budgets, and find smarter ways to save.</p>
        <div class="empty-copilot-greeting"><span><img class="bot-mascot-tiny" src="/assets/logo/money-copilot-bot-mascot.png" alt=""></span>What would you like to do first?</div>
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
    <button class="floating-ai bot-mascot" data-open-ai-chat aria-label="Open Money Copilot"><img src="/assets/logo/money-copilot-bot-mascot.png" alt=""></button>
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
  const modalClasses = String(options.className || "").split(/\s+/);
  const isAiModal = modalClasses.includes("ai-modal");
  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-backdrop" id="dashboard-modal" role="dialog" aria-modal="true">
      <section class="modal ${options.wide ? "wide" : ""} ${options.className || ""}">
        <div class="modal-top">
          <div class="modal-heading">
            <div class="modal-title-row">${isAiModal ? '<img class="modal-title-logo" src="/assets/logo/money-copilot-app-logo.png" alt="">' : ""}<h2>${esc(title)}</h2></div>
            <p>${esc(subtitle || "")}</p>
          </div>
          <button class="modal-close" data-close aria-label="Close">${icon("close")}</button>
        </div>
        ${content}
      </section>
    </div>
  `);
  document.body.classList.add("dashboard-modal-open");
  document.body.classList.toggle("finance-copilot-open", isAiModal);
}

function closeModal() {
  document.getElementById("dashboard-modal")?.remove();
  document.body.classList.remove("dashboard-modal-open");
  document.body.classList.remove("finance-copilot-open");
}

function openConfirmModal(title, message, onConfirm) {
  closeModal();
  const html = `
    <div class="confirm-modal-body" style="padding-top: 8px;">
      <p style="color: var(--text-muted); font-size: 15px; line-height: 1.5; margin-bottom: 24px;">${esc(message)}</p>
      <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px;">
        <button type="button" class="action-button secondary" data-confirm-cancel style="background: var(--line); border: 1px solid var(--line2); color: var(--text); padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background 0.15s;">Cancel</button>
        <button type="button" class="action-button primary" data-confirm-ok style="background: #ea580c; border: 1px solid #ea580c; color: #fff; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">Confirm</button>
      </div>
    </div>
  `;
  openModal(title, "", html);
  
  const modalEl = document.getElementById("dashboard-modal");
  if (modalEl) {
    const cancelBtn = modalEl.querySelector("[data-confirm-cancel]");
    const confirmBtn = modalEl.querySelector("[data-confirm-ok]");
    
    cancelBtn?.addEventListener("click", closeModal);
    confirmBtn?.addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
  }
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

function renderMarkdownTable(tableText) {
  const lines = tableText.trim().split("\n").filter(l => l.trim().startsWith("|"));
  if (lines.length < 2) return tableText;

  const parseRow = (line) => line.split("|").slice(1, -1).map(c => c.trim());
  const header = parseRow(lines[0]);
  
  let dataRows = lines.slice(1);
  if (dataRows[0] && /^\|?\s*:?-+:?\s*\|/.test(dataRows[0])) {
    dataRows = dataRows.slice(1);
  }

  let html = '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
  header.forEach(h => { html += `<th>${h}</th>`; });
  html += '</tr></thead><tbody>';

  dataRows.forEach(rowStr => {
    const cells = parseRow(rowStr);
    if (!cells.length) return;
    html += '<tr>';
    cells.forEach(c => { html += `<td>${c}</td>`; });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function aiAnswerHtml(value) {
  let text = esc(value || "I could not generate a response.");

  // Process markdown tables first before converting line breaks
  text = text.replace(/((?:^\|.*?\|\s*$\n?)+)/gm, (match) => {
    return renderMarkdownTable(match);
  });

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
    .replace(/\n/g, "<br>")
    .replace(/<\/div><br>/g, "</div>")
    .replace(/<\/table><\/div><br>/g, "</table></div>");
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
        <div class="ai-message-label">${role === "user" ? "You" : `<span class="ai-bot-avatar bot-mascot"><img src="/assets/logo/money-copilot-bot-mascot.png" alt=""></span> Money Copilot AI`}</div>
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

function appendAiLoading(chatRoot = document, message = "Processing your data...") {
  const list = (chatRoot === document ? window.activeAiChatRoot || document : chatRoot).querySelector("[data-ai-messages]");
  if (!list) return null;
  const id = `ai-loading-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  
  const steps = [
    "Connecting to private financial database...",
    "Verifying monthly expenses & budget limits...",
    "Computing spending insights & patterns...",
    "Generating personalized recommendations..."
  ];

  list.insertAdjacentHTML("beforeend", `
    <div class="ai-message assistant ai-loading-message" id="${id}" aria-live="polite">
      <div class="ai-message-label">Money Copilot AI</div>
      <div class="ai-message-body">
        <span class="ai-typing"><i></i><i></i><i></i></span>
        <span class="ai-loading-text" data-loading-step>${esc(steps[0])}</span>
      </div>
    </div>
  `);
  
  const el = list.querySelector(`#${id}`);
  const stepText = el?.querySelector("[data-loading-step]");
  let stepIdx = 0;
  
  const timer = setInterval(() => {
    stepIdx = (stepIdx + 1) % steps.length;
    if (stepText) {
      stepText.style.opacity = "0";
      setTimeout(() => {
        if (stepText) {
          stepText.textContent = steps[stepIdx];
          stepText.style.opacity = "1";
        }
      }, 180);
    }
  }, 1600);

  if (el) el._stepTimer = timer;
  list.scrollTop = list.scrollHeight;
  return el;
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
      <a class="comet-badge comet-badge-modal" href="https://www.cometapi.com/console/login?aff=mURH" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI">
        <span>Powered by</span><img src="/assets/cometapi-logo.png" alt="CometAPI">
      </a>
      <span class="assistant-online"><i></i>Online</span>
    </div>
    <div class="empty-mobile-copilot" data-ai-chat>
      <div class="empty-mobile-copilot-intro">
        <img class="bot-mascot-large" src="/assets/logo/money-copilot-bot-mascot.png" alt="Money Copilot">
        <h2>Hi, I’m your Money Copilot</h2>
        <p>I can help you organize expenses, build budgets, and find smarter ways to save.</p>
        <div class="empty-copilot-greeting"><span><img class="bot-mascot-tiny" src="/assets/logo/money-copilot-bot-mascot.png" alt=""></span>What would you like to do first?</div>
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
      <a class="comet-badge comet-badge-modal" href="https://www.cometapi.com/console/login?aff=mURH" target="_blank" rel="noopener noreferrer" aria-label="Powered by CometAPI">
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
          <button type="button" data-ai-suggestion="Record an expense of 50 BDT for food">${icon("plus")}Add expense</button>
          <button type="button" data-ai-suggestion="Explain my budget status this month.">${icon("advisor")}Explain</button>
          <button type="button" data-ai-suggestion="Where can I reduce spending this month?">${icon("search")}Find savings</button>
        </div>
      </div>
      <div class="assistant-day"><span>Today</span></div>
      <div class="ai-chat-messages assistant-rail-messages" data-ai-messages>
        <div class="ai-message user"><div class="ai-message-label">You</div><div class="ai-message-body">How is my spending this month?</div><small>9:42 AM</small></div>
        <div class="ai-message assistant copilot-summary"><div class="ai-message-body"><p>Here’s your spending summary for ${reportMonth}:</p><b>Budget usage</b><div class="copilot-progress"><i style="--value:${Math.min(100, model?.budgetUsed || 0)}%"></i><strong>${model?.budgetMinor ? `${model.budgetUsed}%` : "--"}</strong></div><div class="copilot-budget-row"><span>${model ? formatMoney(model.spentMinor, model.currency, { compact: true }) : "--"} of ${model?.budgetMinor ? formatMoney(model.budgetMinor, model.currency, { compact: true }) : "no budget"}</span><b>${model?.remainingMinor === null || !model ? "" : overBudget ? `${formatMoney(budgetDifference, model.currency, { compact: true })} over` : `${formatMoney(model.remainingMinor, model.currency, { compact: true })} left`}</b></div><ul><li>You spent ${model ? formatMoney(model.spentMinor, model.currency, { compact: true }) : "--"} this month.</li>${topCategory ? `<li>${esc(topCategory.name)} is your top category at ${topShare}% of spending.</li>` : ""}</ul></div><small>9:42 AM</small></div>
      </div>
      </div>
      ${renderAssistantIntegrationCta()}
      <form class="ai-chat-form assistant-rail-form" data-ai-chat-form>
        <div class="copilot-compose"><span class="compose-clip" aria-hidden="true">${icon("attachment")}</span><textarea name="message" maxlength="2000" placeholder="Ask or add expense..." aria-label="Ask AI Finance Assistant" required>${esc(prefill)}</textarea><button class="assistant-send" type="submit" aria-label="Send question">${icon("send")}</button></div>
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
  const isQuickExpense = /^\s*(?:add|record|save|spent)\s+(?:[$\u09F3]\s*)?\d/i.test(message);
  const loadingMessage = appendAiLoading(chatRoot, isQuickExpense ? "Saving your expense..." : undefined);
  textarea.value = "";
  textarea.disabled = true;
  setAiSubmitLoading(button, true);
  try {
    const preferredModel = window.dashboardModel?.preferences?.copilotModel || (() => {
      try { return localStorage.getItem("copilot_model") || "gemini-2.5-flash"; } catch { return "gemini-2.5-flash"; }
    })();
    const response = await fetch("/api/ai-chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, month: selectedMonth, currency: localDisplayCurrency(window.dashboardModel?.currency), model: preferredModel }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) throw authRequiredError();
    if (!response.ok) throw new Error(body.error || "The AI assistant could not answer right now.");
    const tools = body.usedTools?.length ? `Verified with ${body.usedTools.join(", ")}` : "General guidance";
    if (loadingMessage?._stepTimer) clearInterval(loadingMessage._stepTimer);
    loadingMessage?.remove();
    appendAiMessage("assistant", body.answer, `${tools} · ${body.model}${body.cached ? " · cached" : ""}`, chatRoot, body.visualData || null);
    await refreshDashboard();
  } catch (error) {
    if (error.code === "AUTH_REQUIRED") {
      closeModal();
      redirectToMcpizeAuth();
      return;
    }
    if (loadingMessage?._stepTimer) clearInterval(loadingMessage._stepTimer);
    loadingMessage?.remove();
    appendAiMessage("assistant", localDashboardAnswer(message), "Verified dashboard data · offline response", chatRoot);
  } finally {
    if (window.activeAiChatRoot === chatRoot) window.activeAiChatRoot = null;
    textarea.disabled = false;
    setAiSubmitLoading(button, false);
    textarea.focus({ preventScroll: true });
  }
}

function getAvailableCategories(model) {
  const standard = ["food", "groceries", "shopping", "travel", "transport", "utilities", "bills", "health"];
  const existing = (model.expenses || []).map(e => e.category).filter(Boolean);
  const unique = new Set([...standard, ...existing]);
  return Array.from(unique).sort();
}

function openEditCategoryModal(expenseId, currentCategory) {
  const model = window.dashboardModel;
  const expense = (model.expenses || []).find(e => e.id === expenseId);
  const meta = model.expenseMetadata?.[expenseId] || {};
  const merchant = meta.merchant || expense?.description || "Expense";
  const date = expense?.date || "";
  const amountStr = expense ? formatMoney(expense.amountMinor, model.currency) : "";

  const available = getAvailableCategories(model);
  
  const optionsHtml = available.map(cat => 
    `<option value="${esc(cat)}" ${cat.toLowerCase() === currentCategory.toLowerCase() ? "selected" : ""}>${esc(cat)}</option>`
  ).join("");

  openModal("Update Category", "Change category for this transaction.", `
    <form data-form="edit-category" data-expense-id="${esc(expenseId)}">
      <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-weight: 600; font-size: 13px; color: #102131;">${esc(merchant)}</span>
          <span style="font-weight: 700; font-size: 13px; color: #ef4444;">-${esc(amountStr)}</span>
        </div>
        <div style="font-size: 11px; color: #64748b;">${esc(date)}</div>
      </div>
      <div class="field">
        <label>Select Category</label>
        <select name="category_select" required style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #dce9e2; background: #fff; font-family: inherit; font-size: 13px; color: #102131; box-sizing: border-box; outline: none;">
          ${optionsHtml}
          <option value="custom_new">+ Add new category...</option>
        </select>
      </div>
      <div class="field" id="edit-category-manual-field" style="display: none; margin-top: 12px;">
        <label>New Category Name</label>
        <input name="manual_category" placeholder="e.g. entertainment, education" style="width: 100%;">
      </div>
      <p class="form-error" data-error></p>
      <div class="modal-actions" style="margin-top: 20px;">
        <button type="button" class="action-button" data-close>Cancel</button>
        <button type="submit" class="action-button primary">Update Category</button>
      </div>
    </form>
  `);

  const modalEl = document.getElementById("dashboard-modal");
  if (modalEl) {
    const selectEl = modalEl.querySelector('select[name="category_select"]');
    const manualField = modalEl.querySelector('#edit-category-manual-field');
    const manualInput = modalEl.querySelector('input[name="manual_category"]');
    
    selectEl?.addEventListener("change", () => {
      if (selectEl.value === "custom_new") {
        manualField.style.display = "block";
        manualInput.required = true;
        manualInput.focus();
      } else {
        manualField.style.display = "none";
        manualInput.required = false;
        manualInput.value = "";
      }
    });
  }
}

function openEntry(kind) {
  const model = window.dashboardModel;
  const isIncome = kind === "income";
  const today = new Date().toISOString().slice(0, 10);
  
  const categoryFieldHtml = isIncome 
    ? `<div class="field"><label>Source</label><input name="category" placeholder="Salary, freelance" required></div>` 
    : `<div class="field">
        <label>Category</label>
        <select name="category_select" required style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #dce9e2; background: #fff; font-family: inherit; font-size: 13px; color: #102131; box-sizing: border-box; outline: none;">
          <option value="" disabled selected>Select category</option>
          ${getAvailableCategories(model).map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join("")}
          <option value="custom_new">+ Add new category...</option>
        </select>
        <input type="hidden" name="category" required>
        <div id="new-category-input-wrap" style="display: none; margin-top: 8px;">
          <input name="manual_category" placeholder="Enter new category name" style="width: 100%;">
        </div>
       </div>`;

  openModal(isIncome ? "Add Income" : "Add Expense", isIncome ? "Record money coming into this private workspace." : "Record a transaction with category and payment details.", `
    <form data-form="${kind}">
      <div class="form-grid">
        <div class="field"><label>Amount</label><input name="amount" inputmode="decimal" placeholder="0.00" required></div>
        <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required></div>
        ${categoryFieldHtml}
        ${isIncome ? "" : `
          <div class="field" id="subcategory-field-wrap" style="display: none;">
            <label>Sub-category</label>
            <div id="subcategory-select-container"></div>
          </div>
        `}
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

  const modalEl = document.getElementById("dashboard-modal");
  if (modalEl && !isIncome) {
    const selectEl = modalEl.querySelector('select[name="category_select"]');
    const hiddenInput = modalEl.querySelector('input[name="category"]');
    const manualWrap = modalEl.querySelector('#new-category-input-wrap');
    const manualInput = modalEl.querySelector('input[name="manual_category"]');
    const subWrap = modalEl.querySelector('#subcategory-field-wrap');
    const subContainer = modalEl.querySelector('#subcategory-select-container');
    
    const updateSubcategoryField = (categoryVal) => {
      if (!subWrap || !subContainer) return;
      const catClean = String(categoryVal || "").toLowerCase().trim();
      const subCats = SUB_CATEGORIES[catClean];
      
      if (subCats) {
        subWrap.style.display = "block";
        subContainer.innerHTML = `
          <select name="subcategory" style="width: 100%; height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid #dce9e2; background: #fff; font-family: inherit; font-size: 13px; color: #102131; box-sizing: border-box; outline: none;">
            <option value="" selected>None / General</option>
            ${subCats.map(sub => `<option value="${esc(sub)}">${esc(sub)}</option>`).join("")}
          </select>
        `;
      } else if (catClean && catClean !== "custom_new") {
        subWrap.style.display = "block";
        subContainer.innerHTML = `
          <input name="subcategory" placeholder="e.g. Baby food, Fruit (optional)" style="width: 100%;">
        `;
      } else {
        subWrap.style.display = "none";
        subContainer.innerHTML = "";
      }
    };
    
    selectEl?.addEventListener("change", () => {
      if (selectEl.value === "custom_new") {
        manualWrap.style.display = "block";
        manualInput.required = true;
        hiddenInput.value = "";
        manualInput.focus();
        updateSubcategoryField("");
      } else {
        manualWrap.style.display = "none";
        manualInput.required = false;
        manualInput.value = "";
        hiddenInput.value = selectEl.value;
        updateSubcategoryField(selectEl.value);
      }
    });
    
    manualInput?.addEventListener("input", () => {
      const cleanVal = manualInput.value.trim();
      hiddenInput.value = cleanVal;
      updateSubcategoryField(cleanVal);
    });
  }
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
    subcategory: data.get("subcategory"),
  };
  await postDashboard(payload, form);
}

function showSyncMask() {
  let mask = document.getElementById("sync-mask");
  if (!mask) {
    mask = document.createElement("div");
    mask.id = "sync-mask";
    mask.className = "sync-mask";
    mask.innerHTML = '<div class="sync-spinner"></div>';
    document.body.appendChild(mask);
  }
  mask.offsetHeight;
  mask.classList.add("active");
}

function hideSyncMask() {
  const mask = document.getElementById("sync-mask");
  if (mask) {
    mask.classList.remove("active");
  }
}

async function refreshDashboard() {
  showSyncMask();
  try {
    const savedChats = [];
    document.querySelectorAll("[data-ai-messages]").forEach((list, index) => {
      savedChats.push({ index, html: list.innerHTML });
    });

    const data = await loadDashboard();
    if (!data.preferencesConfigured) data.preferences = readLocalPreferences(data.preferences || {});
    applyDashboardPreferences(data.preferences || {});
    window.dashboardModel = buildModel(data);
    if (window.dashboardModel.hasFinancialData) renderDashboard(window.dashboardModel);
    else renderEmptyDashboard(window.dashboardModel);
    
    document.querySelectorAll("[data-ai-messages]").forEach((list, index) => {
      const saved = savedChats.find(c => c.index === index);
      if (saved && saved.html) {
        list.innerHTML = saved.html;
      }
    });

    syncThemeSwitch();
    runNotificationPreferences(window.dashboardModel);
    bindIncomeExpenseChart();
  } catch (error) {
    console.error("Failed to refresh dashboard:", error);
  } finally {
    hideSyncMask();
  }
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
    closeModal();
    await refreshDashboard();
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
  if (kind === "connections") {
    const endpoint = esc(MONEY_COPILOT_MCP_ENDPOINT);
    openModal("Connect Money Copilot", "Use your private finance tools from ChatGPT, Claude, or another MCP client.", `
      <section class="mcp-connect-card" aria-label="Money Copilot MCP connection">
        <div class="mcp-connect-head">
          <span class="mcp-connect-identity"><img src="/assets/logo/money-copilot-app-logo.png" alt=""><span><b>Money Copilot MCP</b><small>Remote MCP server</small></span></span>
          <span class="mcp-ready"><i></i>Ready</span>
        </div>
        <div class="mcp-credential-status"><i></i><span><b>Secure connection available</b><small>Each user signs in with their own OAuth session.</small></span></div>
        <div class="mcp-endpoint-field">
          <span><small>MCP Endpoint</small><code>${endpoint}</code></span>
          <button type="button" data-copy-mcp-endpoint="${endpoint}" aria-label="Copy MCP endpoint">${icon("copy")}<span>Copy</span></button>
        </div>
        <div class="mcp-auth-row"><span>${icon("lock")}Authentication</span><b>OAuth 2.0 + PKCE</b></div>
        <p class="mcp-security-note">Your MCPize owner API key is never shown here. Connected clients authorize each user separately, keeping financial workspaces isolated.</p>
      </section>

      <section class="mcp-client-section">
        <div class="mcp-client-heading"><div><h3>Choose your MCP client</h3><p>Select a client to see its connection steps.</p></div><span>3 options</span></div>
        <div class="mcp-client-grid" role="tablist" aria-label="MCP clients">
          <button class="active" type="button" role="tab" aria-selected="true" data-connect-client="chatgpt"><img src="/assets/brands/chatgpt.png" alt=""><span><b>ChatGPT</b><small>Custom MCP app</small></span>${icon("chevron")}</button>
          <button type="button" role="tab" aria-selected="false" data-connect-client="claude"><img src="/assets/brands/claude.png" alt=""><span><b>Claude</b><small>Remote connector</small></span>${icon("chevron")}</button>
          <button type="button" role="tab" aria-selected="false" data-connect-client="other"><img src="/assets/brands/mcp.png" alt=""><span><b>Any MCP client</b><small>Remote HTTP</small></span>${icon("chevron")}</button>
        </div>

        <div class="mcp-client-guide" data-connection-guide="chatgpt">
          <strong>Connect with ChatGPT</strong>
          <ol><li>Open ChatGPT Settings &gt; Apps and enable Developer Mode.</li><li>Select Create, then paste the MCP endpoint above.</li><li>Choose OAuth, complete sign-in, and scan the available tools.</li></ol>
          <small>Full write actions such as adding expenses require a supported workspace plan and permissions.</small>
        </div>
        <div class="mcp-client-guide" data-connection-guide="claude" hidden>
          <strong>Connect with Claude</strong>
          <ol><li>Open Claude integrations or connector settings.</li><li>Add a remote MCP server and paste the endpoint above.</li><li>Complete OAuth authorization, then approve the Money Copilot tools.</li></ol>
          <small>The exact menu name can vary between Claude.ai, Claude Desktop, and Claude Code.</small>
        </div>
        <div class="mcp-client-guide" data-connection-guide="other" hidden>
          <strong>Connect another MCP client</strong>
          <ol><li>Create a remote HTTP MCP connection.</li><li>Use the endpoint above as the server URL.</li><li>Choose OAuth/Bearer authentication and complete the authorization flow.</li></ol>
          <small>Use only clients that support remote MCP over HTTPS and OAuth authentication.</small>
        </div>
      </section>
    `, { wide: true, className: "connections-modal" });
    return;
  }
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
    const expenses = model.expenses || [];
    const categories = Array.from(new Set(expenses.map(e => e.category).filter(Boolean))).sort();
    const methods = Array.from(new Set(expenses.map(e => model.expenseMetadata?.[e.id]?.paymentMethod).filter(Boolean))).sort();

    const renderList = (filterText = "", selCategory = "", selMethod = "") => {
      const query = filterText.toLowerCase().trim();
      const filtered = expenses.filter(e => {
        const meta = model.expenseMetadata?.[e.id] || {};
        const merchant = (meta.merchant || e.description || "").toLowerCase();
        const cat = (e.category || "").toLowerCase();
        const desc = (e.description || "").toLowerCase();
        const pMethod = (meta.paymentMethod || "").toLowerCase();
        const matchesQuery = !query || merchant.includes(query) || cat.includes(query) || desc.includes(query) || pMethod.includes(query);
        const matchesCategory = !selCategory || cat === selCategory.toLowerCase();
        const matchesMethod = !selMethod || pMethod === selMethod.toLowerCase();
        return matchesQuery && matchesCategory && matchesMethod;
      });

      return panelRows(filtered, (expense, index) => {
        const meta = model.expenseMetadata?.[expense.id] || {};
        const [tone] = toneFor(expense.category, index);
        const cat = expense.category || "uncategorized";
        const [catTone, catBg] = toneFor(cat, index);
        const merchant = meta.merchant || expense.description || "Expense";
        const subCatHtml = meta.subcategory 
          ? ` <span class="tag subcategory-tag" style="background: var(--line); border: 1px solid var(--line2); color: var(--text-muted); font-size: 9px; min-height: 18px; padding: 0 6px; border-radius: 4px; display: inline-flex; align-items: center; vertical-align: middle;">${esc(meta.subcategory)}</span>`
          : "";
        return `<div class="plain-row" style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <span style="flex: 1; min-width: 0;"><b><i class="dot" style="--tone:${tone}"></i>${esc(merchant)}</b><small>${esc(expense.date)} - <button class="tag interactive-category-btn" data-expense-id="${esc(expense.id)}" data-category="${esc(cat)}" style="--tone:${catTone};--tone-bg:${catBg}; cursor: pointer; border: none; font-family: inherit; font-size: 9px; min-height: 18px; padding: 0 6px;">${esc(cat)}</button>${subCatHtml} - ${esc(meta.paymentMethod || "Expense")}</small></span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong class="amount">-${formatMoney(expense.amountMinor, model.currency)}</strong>
            <button type="button" class="tx-delete-btn" data-delete-expense-id="${esc(expense.id)}" aria-label="Delete expense" style="background:none; border:none; color:#ea580c; cursor:pointer; padding:6px; display:inline-flex; align-items:center; transition:opacity 0.15s; font-size:14px; opacity: 0.5; width: 28px; height: 28px; border-radius: 6px;" onmouseover="this.style.opacity=1; this.style.background='rgba(234,88,12,0.08)'" onmouseout="this.style.opacity=0.5; this.style.background='none'">${icon("trash")}</button>
          </div>
        </div>`;
      });
    };

    const filterControlsHtml = `
      <div class="tx-modal-filter-bar">
        <label class="tx-modal-search">${icon("search")}<input type="search" placeholder="Filter by merchant, category..." data-tx-filter-search></label>
        <select class="tx-modal-select" data-tx-filter-category>
          <option value="">All categories</option>
          ${categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
        </select>
        ${methods.length ? `
        <select class="tx-modal-select" data-tx-filter-method>
          <option value="">All methods</option>
          ${methods.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join("")}
        </select>` : ""}
      </div>
      <div class="tx-modal-results" data-tx-results>
        ${renderList()}
      </div>
    `;

    openModal("All Transactions", "Newest private transactions for this month.", filterControlsHtml, { wide: true });

    const modalEl = document.getElementById("dashboard-modal");
    if (modalEl) {
      const searchInput = modalEl.querySelector("[data-tx-filter-search]");
      const catSelect = modalEl.querySelector("[data-tx-filter-category]");
      const methodSelect = modalEl.querySelector("[data-tx-filter-method]");
      const resultsContainer = modalEl.querySelector("[data-tx-results]");

      const update = () => {
        if (resultsContainer) {
          resultsContainer.innerHTML = renderList(searchInput?.value || "", catSelect?.value || "", methodSelect?.value || "");
        }
      };

      searchInput?.addEventListener("input", update);
      catSelect?.addEventListener("change", update);
      methodSelect?.addEventListener("change", update);
    }
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
    const savedPreferences = model.preferences && typeof model.preferences === "object" ? model.preferences : {};
    let currentModel = "gemini-2.5-flash";
    let compactMode = false;
    let autoSuggest = true;
    let billReminders = true;
    let incomeReceived = true;
    let overdueAlerts = true;
    let newsletter = true;
    let pushNotifications = false;
    let emailNotifications = true;
    try {
      currentModel = localStorage.getItem("copilot_model") || "gemini-2.5-flash";
      compactMode = localStorage.getItem("compact_mode") === "true";
      autoSuggest = localStorage.getItem("auto_suggest") !== "false";
      billReminders = localStorage.getItem("bill_reminders") !== "false";
      incomeReceived = localStorage.getItem("income_received_notifications") !== "false";
      overdueAlerts = localStorage.getItem("overdue_alerts") !== "false";
      newsletter = localStorage.getItem("newsletter_notifications") !== "false";
      pushNotifications = localStorage.getItem("push_notifications") === "true";
      emailNotifications = localStorage.getItem("email_notifications") !== "false";
    } catch(e) {}

    currentModel = savedPreferences.copilotModel || currentModel;
    compactMode = savedPreferences.compactMode ?? compactMode;
    autoSuggest = savedPreferences.autoSuggest ?? autoSuggest;
    billReminders = savedPreferences.billReminders ?? billReminders;
    incomeReceived = savedPreferences.incomeReceived ?? incomeReceived;
    overdueAlerts = savedPreferences.overdueAlerts ?? overdueAlerts;
    newsletter = savedPreferences.newsletter ?? newsletter;
    pushNotifications = savedPreferences.pushNotifications ?? pushNotifications;
    emailNotifications = savedPreferences.emailNotifications ?? emailNotifications;

    const pushSupported = "Notification" in window;
    const pushPermission = pushSupported ? Notification.permission : "unsupported";
    const pushEnabled = pushPermission === "granted" && pushNotifications;
    const pushStatus = pushEnabled ? "Enabled" : pushPermission === "denied" ? "Blocked" : pushSupported ? "Disabled" : "Unavailable";
    const pushButtonLabel = pushEnabled ? "Disable Push" : pushPermission === "denied" ? "Review Access" : pushSupported ? "Enable Push" : "Not Supported";

    openModal("Dashboard Settings", "Manage workspace preferences, notifications, AI settings, and privacy.", `
      <form data-form="settings" class="settings-form">
        
        <!-- Section 1: Display & Preferences -->
        <div class="settings-section">
          <h4 class="settings-section-title">${icon("sparkles")} Display & Preferences</h4>
          
          <div class="settings-row">
            <div class="settings-label">
              <strong>Workspace Currency</strong>
              <small>Display currency for the dashboard and AI responses. It never filters or converts records.</small>
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

        <!-- Section 3: Notifications -->
        <div class="settings-section notification-settings-section">
          <h4 class="settings-section-title notification-settings-title">${icon("bell")} Notifications</h4>

          <div class="settings-row notification-setting-row">
            <div class="settings-label">
              <strong>Bill Reminders</strong>
              <small>3 days and 1 day before due.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="bill_reminders" aria-label="Bill reminders" ${billReminders ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row notification-setting-row">
            <div class="settings-label">
              <strong>Income Received</strong>
              <small>When income is detected.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="income_received_notifications" aria-label="Income received notifications" ${incomeReceived ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row notification-setting-row">
            <div class="settings-label">
              <strong>Overdue Alerts</strong>
              <small>When bills become overdue.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="overdue_alerts" aria-label="Overdue alerts" ${overdueAlerts ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row notification-setting-row">
            <div class="settings-label">
              <strong>Newsletter</strong>
              <small>Receive updates and tips from Money Copilot.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="newsletter_notifications" aria-label="Newsletter notifications" ${newsletter ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="settings-row notification-setting-row notification-delivery-row">
            <div class="settings-label">
              <strong>Push Notifications</strong>
              <small class="notification-status ${pushEnabled ? "is-enabled" : pushPermission === "denied" ? "is-blocked" : ""}" data-push-status>${pushStatus}</small>
            </div>
            <input type="hidden" name="push_notifications" value="${pushEnabled ? "true" : "false"}">
            <button class="notification-enable-button ${pushEnabled ? "is-enabled" : ""}" type="button" data-enable-push ${pushSupported ? "" : "disabled"}>${pushButtonLabel}</button>
          </div>

          <div class="settings-row notification-setting-row notification-delivery-row">
            <div class="settings-label">
              <strong>Email Notifications</strong>
              <small>Receive important alerts via email.</small>
            </div>
            <label class="settings-toggle">
              <input type="checkbox" name="email_notifications" aria-label="Email notifications" ${emailNotifications ? "checked" : ""}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Section 4: Privacy & Session Security -->
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
  if (form.dataset.form === "edit-category") {
    const expenseId = form.dataset.expenseId;
    const selectVal = form.elements.category_select?.value;
    const manualVal = form.elements.manual_category?.value?.trim();
    const finalCategory = selectVal === "custom_new" ? manualVal : selectVal;
    if (!finalCategory) {
      const errorEl = form.querySelector("[data-error]");
      if (errorEl) errorEl.textContent = "Please select or enter a category.";
      return;
    }
    return postDashboard({ kind: "update_expense_category", id: expenseId, category: finalCategory }, form);
  }
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
const COPILOT_RAIL_DEFAULT_WIDTH = 440;
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
    if (Number.isFinite(savedWidth) && savedWidth > 0) {
      width = savedWidth === 380 ? COPILOT_RAIL_DEFAULT_WIDTH : savedWidth;
    }
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
    profilePhoto.src = "/assets/logo/money-copilot-app-logo.png";
  }, { once: true });

  document.addEventListener("click", (event) => {
    const deleteBtn = event.target.closest("[data-delete-expense-id]");
    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteExpenseId;
      openConfirmModal("Delete Expense", "Are you sure you want to remove this expense? This action cannot be undone.", () => {
        postDashboard({ kind: "delete_expense", id }, deleteBtn);
      });
      return;
    }
    const categoryBtn = event.target.closest(".interactive-category-btn");
    if (categoryBtn) {
      const id = categoryBtn.dataset.expenseId;
      const category = categoryBtn.dataset.category;
      openEditCategoryModal(id, category);
      return;
    }
    const copyMcpEndpoint = event.target.closest("[data-copy-mcp-endpoint]");
    if (copyMcpEndpoint) {
      const endpoint = copyMcpEndpoint.dataset.copyMcpEndpoint;
      const copyEndpoint = navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(endpoint)
        : new Promise((resolve, reject) => {
            const field = document.createElement("textarea");
            field.value = endpoint;
            field.setAttribute("readonly", "");
            field.style.position = "fixed";
            field.style.opacity = "0";
            document.body.appendChild(field);
            field.select();
            const copied = document.execCommand("copy");
            field.remove();
            copied ? resolve() : reject(new Error("Clipboard is unavailable."));
          });
      copyEndpoint.then(() => {
        copyMcpEndpoint.classList.add("copied");
        copyMcpEndpoint.innerHTML = `${icon("check")}<span>Copied</span>`;
        setTimeout(() => {
          if (!copyMcpEndpoint.isConnected) return;
          copyMcpEndpoint.classList.remove("copied");
          copyMcpEndpoint.innerHTML = `${icon("copy")}<span>Copy</span>`;
        }, 1800);
      }).catch(() => {});
      return;
    }
    const connectClient = event.target.closest("[data-connect-client]");
    if (connectClient) {
      const key = connectClient.dataset.connectClient;
      const modal = connectClient.closest(".connections-modal");
      modal?.querySelectorAll("[data-connect-client]").forEach((button) => {
        const active = button === connectClient;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      modal?.querySelectorAll("[data-connection-guide]").forEach((guide) => { guide.hidden = guide.dataset.connectionGuide !== key; });
      return;
    }
    const monthPickerToggle = event.target.closest("[data-month-picker-toggle]");
    if (monthPickerToggle) {
      const picker = monthPickerToggle.closest("[data-month-picker]");
      const willOpen = !picker.classList.contains("open");
      closeMonthPickers(picker);
      picker.classList.toggle("open", willOpen);
      monthPickerToggle.setAttribute("aria-expanded", String(willOpen));
      const menu = picker.querySelector("[data-month-picker-menu]");
      if (menu) menu.hidden = !willOpen;
      if (willOpen) picker.querySelector(".month-picker-option.selected")?.focus();
      return;
    }
    const monthYearStep = event.target.closest("[data-month-year-step]");
    if (monthYearStep) {
      const picker = monthYearStep.closest("[data-month-picker]");
      updateMonthPickerYear(picker, Number(picker.dataset.year) + Number(monthYearStep.dataset.monthYearStep));
      return;
    }
    const monthOption = event.target.closest("[data-month-value]");
    if (monthOption) {
      const newMonth = monthOption.dataset.monthValue;
      selectedMonth = newMonth;
      const newParams = new URLSearchParams(location.search);
      newParams.set("month", newMonth);
      history.pushState({}, "", `${location.pathname}?${newParams}${location.hash || ""}`);
      closeMonthPickers();
      refreshDashboard();
      return;
    }
    const monthToday = event.target.closest("[data-month-today], [data-month-clear]");
    if (monthToday) {
      const newMonth = new Date().toISOString().slice(0, 7);
      selectedMonth = newMonth;
      const newParams = new URLSearchParams(location.search);
      newParams.set("month", newMonth);
      history.pushState({}, "", `${location.pathname}?${newParams}${location.hash || ""}`);
      closeMonthPickers();
      refreshDashboard();
      return;
    }
    if (!event.target.closest("[data-month-picker]")) closeMonthPickers();
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
      const menuButton = document.querySelector(".mobile-menu-button, .mobile-profile-button");
      menuButton?.setAttribute("aria-expanded", String(open));
      menuButton?.setAttribute("aria-label", open ? "Close profile and navigation" : "Open profile and navigation");
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
    const mobileThemeToggle = event.target.closest("[data-mobile-theme-toggle]");
    if (mobileThemeToggle) {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
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
    const pushButton = event.target.closest("[data-enable-push]");
    if (pushButton) {
      const row = pushButton.closest(".notification-setting-row");
      const status = row?.querySelector("[data-push-status]");
      const preference = row?.querySelector('input[name="push_notifications"]');
      if (!("Notification" in window)) {
        if (status) status.textContent = "Unavailable";
        return;
      }
      if (Notification.permission === "granted" && preference?.value === "true") {
        preference.value = "false";
        try { localStorage.setItem("push_notifications", "false"); } catch(e) {}
        if (status) {
          status.textContent = "Disabled";
          status.classList.remove("is-enabled", "is-blocked");
        }
        pushButton.textContent = "Enable Push";
        pushButton.classList.remove("is-enabled");
        return;
      }
      if (Notification.permission === "denied") {
        if (status) {
          status.textContent = "Blocked in browser settings";
          status.classList.add("is-blocked");
        }
        return;
      }
      pushButton.disabled = true;
      pushButton.textContent = "Enabling...";
      Notification.requestPermission().then((permission) => {
        const enabled = permission === "granted";
        try { localStorage.setItem("push_notifications", String(enabled)); } catch(e) {}
        if (preference) preference.value = String(enabled);
        if (status) {
          status.textContent = enabled ? "Enabled" : permission === "denied" ? "Blocked" : "Disabled";
          status.classList.toggle("is-enabled", enabled);
          status.classList.toggle("is-blocked", permission === "denied");
        }
        pushButton.textContent = enabled ? "Disable Push" : permission === "denied" ? "Review Access" : "Enable Push";
        pushButton.classList.toggle("is-enabled", enabled);
        pushButton.disabled = false;
      }).catch(() => {
        if (status) status.textContent = "Unavailable";
        pushButton.textContent = "Enable Push";
        pushButton.disabled = false;
      });
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
      openConfirmModal("Clear Data", warning, () => {
        postDashboard({ kind: all ? "clear_all" : "clear_month", month: window.dashboardModel.month }, clearData.closest(".modal"));
      });
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
      document.querySelector(".mobile-menu-button, .mobile-profile-button")?.setAttribute("aria-expanded", "false");
      document.querySelectorAll(".nav button, .mobile-bottom-nav [data-nav]").forEach((button) => button.classList.toggle("active", button.dataset.nav === nav.dataset.nav));
      if (nav.dataset.nav === "analysis") {
        const rail = document.querySelector(".assistant-rail");
        if (rail && getComputedStyle(rail).display !== "none") {
          rail.classList.remove("collapsed");
          rail.querySelector("textarea[name=message]")?.focus();
        } else openAiChat();
        return;
      }
      const navPopup = {
        transactions: "transactions",
        categories: "categories",
        budget: "budget-editor",
      }[nav.dataset.nav];
      if (navPopup) {
        openPanel(navPopup);
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
        } else if (res.simulated) {
          openModal("Report Generated ✉️", "Email dispatch status.", `
            <div class="report-success-state">
              <div class="success-icon">${icon("mail")}</div>
              <p>Financial report for <b>${esc(monthLabel(model.month))}</b> was generated for <b>${esc(email)}</b>.</p>
              <div class="settings-section" style="margin-top:12px; text-align:left; background:#fffbe6; border:1px solid #ffe58f; border-radius:10px; padding:12px;">
                <small style="color:#d48806; font-size:12px; line-height:1.4; display:block;"><strong>💡 Server Configuration Required:</strong><br>To deliver real emails directly to your inbox, add your <code>RESEND_API_KEY</code> environment variable in your Vercel project deployment settings.</small>
              </div>
              <div class="modal-actions" style="margin-top:14px; width:100%;">
                <button type="button" class="action-button primary" onclick="closeModal()" style="width:100%;">Understood</button>
              </div>
            </div>
          `, { wide: false });
        } else {
          openModal("Report Delivered! ✉️", "Your private financial summary has been sent.", `
            <div class="report-success-state">
              <div class="success-icon">${icon("check")}</div>
              <p>Financial report for <b>${esc(monthLabel(model.month))}</b> has been delivered to <b>${esc(email)}</b>!</p>
              <p style="font-size:12px; color:#64748b; margin-top:4px;">Please check your email inbox and spam folder.</p>
              <div class="modal-actions" style="margin-top:14px; width:100%;">
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
      const settings = {
        currency,
        theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
        compactMode: Boolean(compact),
        copilotModel: modelName,
        autoSuggest: Boolean(autoSuggest),
        billReminders: Boolean(form.elements.bill_reminders?.checked),
        incomeReceived: Boolean(form.elements.income_received_notifications?.checked),
        overdueAlerts: Boolean(form.elements.overdue_alerts?.checked),
        newsletter: Boolean(form.elements.newsletter_notifications?.checked),
        pushNotifications: form.elements.push_notifications?.value === "true",
        emailNotifications: Boolean(form.elements.email_notifications?.checked),
      };

      try {
        if (modelName) localStorage.setItem("copilot_model", modelName);
        if (currency) localStorage.setItem("dashboard_display_currency", currency);
        localStorage.setItem("compact_mode", String(Boolean(compact)));
        localStorage.setItem("auto_suggest", String(Boolean(autoSuggest)));
        localStorage.setItem("bill_reminders", String(Boolean(form.elements.bill_reminders?.checked)));
        localStorage.setItem("income_received_notifications", String(Boolean(form.elements.income_received_notifications?.checked)));
        localStorage.setItem("overdue_alerts", String(Boolean(form.elements.overdue_alerts?.checked)));
        localStorage.setItem("newsletter_notifications", String(Boolean(form.elements.newsletter_notifications?.checked)));
        localStorage.setItem("push_notifications", String(settings.pushNotifications));
        localStorage.setItem("email_notifications", String(Boolean(form.elements.email_notifications?.checked)));
      } catch(e) {}

      postDashboard({ kind: "settings", settings }, form);
      return;
    }
    submitPanelForm(form);
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-search]")) filterDashboard(event.target.value);
    if (event.target.matches('input[name="compact_mode"]')) {
      document.documentElement.dataset.density = event.target.checked ? "compact" : "comfortable";
    }
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
    if (event.key === "Escape") {
      closeMonthPickers();
      closeModal();
    }
  });
}

loadDashboard()
  .then((data) => {
    if (!data.preferencesConfigured) data.preferences = readLocalPreferences(data.preferences || {});
    applyDashboardPreferences(data.preferences || {});
    window.dashboardModel = buildModel(data);
    if (window.dashboardModel.hasFinancialData) renderDashboard(window.dashboardModel);
    else renderEmptyDashboard(window.dashboardModel);
    syncThemeSwitch();
    try {
      localStorage.removeItem("expenseTrackerSidebar");
    } catch {}
    app.classList.remove("sidebar-collapsed");
    initializeAssistantRailResize();
    bindEvents();
    window.addEventListener("popstate", () => {
      const newParams = new URLSearchParams(location.search);
      const newMonth = newParams.get("month") || new Date().toISOString().slice(0, 7);
      if (newMonth !== selectedMonth) {
        selectedMonth = newMonth;
        refreshDashboard();
      }
    });
    runNotificationPreferences(window.dashboardModel);
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
