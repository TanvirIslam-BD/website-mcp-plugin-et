<div align="center">

<img src="work/hero-banner.jpg" alt="Money Copilot AI" width="100%" />

# 💰 Money Copilot AI

### Your AI-Powered Personal Finance Command Center

**Track spending · Set budgets · Get smart insights · Chat with your money**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![MCP](https://img.shields.io/badge/MCP-Compatible-10b981?style=for-the-badge)](https://modelcontextprotocol.io)
[![OAuth 2.0](https://img.shields.io/badge/Auth-OAuth%202.0%20PKCE-blue?style=for-the-badge)](https://oauth.net/2/pkce/)

[Live Demo](https://money-copilot.vercel.app) · [Dashboard](https://money-copilot.vercel.app/dashboard) · [Privacy Policy](https://money-copilot.vercel.app/privacy)

</div>

---

## ✨ What is Money Copilot AI?

Money Copilot AI is a **full-stack personal finance platform** that combines a beautiful, responsive dashboard with an intelligent AI assistant — so you can track every dollar, stay within budget, and make smarter financial decisions through natural conversation.

> **Use it where you already chat.** Money Copilot AI integrates with **ChatGPT**, **Claude**, **Gemini**, **Grok**, **Cursor**, and any **MCP-compatible client** — so you can log expenses, check budgets, and get financial advice without leaving your workflow.

---

## 🖼️ Screenshots

### Desktop Dashboard — Light & Dark Themes

| Light Theme | Dark Theme |
| :---: | :---: |
| ![Light Mode Dashboard](work/dashboard-report-light.png) | ![Dark Mode Dashboard](work/dashboard-report-dark.png) |

### Mobile Experience & Landing Page

| Mobile Dashboard | Landing Page |
| :---: | :---: |
| ![Mobile Dashboard](work/dashboard-report-mobile.png) | ![Landing Page](work/home-live-desktop-visible.png) |

---

## 🚀 Feature Highlights

### 📊 Financial Dashboard

| Feature | Description |
| :--- | :--- |
| **Balance, Income, Spent & Saved Cards** | At-a-glance metric cards with sparkline trends and month-over-month comparison |
| **Cash Flow Chart** | Interactive SVG line chart tracking income, expenses, and savings over the month |
| **Budget Ring** | Circular progress visualization showing real-time budget usage with over/under indicators |
| **Spending Breakdown** | Category-level donut chart with percentage split (Food, Transport, Bills, etc.) |
| **Financial Health Score** | Composite 0–100 score evaluating budget adherence, debt ratio, and emergency fund |
| **Smart Insights** | Auto-generated actionable tips — top category analysis, budget alerts, and saving opportunities |
| **Recent Transactions** | Searchable, sortable transaction table with merchant, category, method, and amount columns |
| **Goals & Savings Tracker** | Track progress toward financial goals with visual progress bars |
| **Bills & Subscriptions** | Recurring payment manager with due dates, amounts, and auto-pay status |
| **Month Picker** | Custom year/month picker to browse historical financial data |

### 🤖 Money Copilot — AI Finance Assistant

| Feature | Description |
| :--- | :--- |
| **Natural Language Chat** | Ask "How much did I spend on dining out?" and get instant answers from your real data |
| **Budget Planning** | "Help me plan next month's budget" — conversational budget creation and editing |
| **Smart Suggestions** | Pre-built quick actions: Explain budget, Find savings, Plan budget |
| **Rich Visual Responses** | AI replies include metric cards, progress bars, bar charts, and pie charts |
| **Multi-Model Routing** | Auto-selects optimal model tier (Flash-Lite → Flash → Advanced → Premium) per query |
| **MCP Tool Execution** | Adds/updates expenses, sets budgets, generates reports, and exports CSV — all through chat |
| **Resizable Panel** | Drag-to-resize the copilot rail (280–560px) for the perfect workspace balance |
| **Desktop Rail + Mobile Modal** | Persistent sidebar on desktop, full-screen modal on mobile |

### 🔗 AI Platform Integrations

Works with your favorite AI assistants via the **Model Context Protocol (MCP)**:

| Platform | Integration |
| :---: | :---: |
| **ChatGPT** | Plugin install with OAuth |
| **Claude** | Remote MCP tools connection |
| **Gemini** | MCP-compatible client |
| **Grok** | MCP-compatible client |
| **Cursor** | MCP-compatible client |
| **Any MCP Client** | Standard MCP protocol |

### 🎨 Design & UX

| Feature | Description |
| :--- | :--- |
| **Light & Dark Themes** | System-aware auto-detection + manual toggle with smooth transitions |
| **Glassmorphism UI** | Frosted glass sidebar, translucent panels, and gradient accents |
| **Animated Boot Screen** | Orbital animation loader with 3-step progress (Secure access → Syncing → Insights) |
| **Dynamic Greetings** | Time-based "Good morning/afternoon/evening" with user's first name |
| **Responsive Design** | Pixel-perfect from 320px phones to 2560px ultrawide monitors |
| **WCAG Compliant** | 44px touch targets, keyboard navigation, ARIA labels, safe-area insets |
| **Email Reports** | One-click monthly spending report email with income, expenses, and budget metrics |
| **Notification System** | Budget alerts, forecast warnings, and recurring charge reminders |

---

## 🔒 Security Architecture

Money Copilot AI is designed with **zero-trust security** — your financial data never leaks.

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER (Client)                  │
│  • No API keys or tokens stored                      │
│  • Signed HttpOnly cookies only                      │
│  • XSS-safe HTML escaping                            │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS + HMAC-SHA256 signed cookie
┌───────────────────────▼─────────────────────────────┐
│              VERCEL SERVERLESS (Backend)              │
│  • OAuth 2.0 PKCE flow (S256 code_challenge)         │
│  • crypto.timingSafeEqual cookie verification         │
│  • Parameterized SQL (WHERE user_id = ?)             │
│  • Rate limiting (18 req/min)                        │
│  • Prompt sanitization                               │
│  • API keys strictly server-side                     │
└───────────────────────┬─────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │  Turso   │  │ CometAPI │  │ MCPize   │
    │ (libSQL) │  │  (LLM)   │  │ (Tools)  │
    └──────────┘  └──────────┘  └──────────┘
```

| Layer | Protection |
| :--- | :--- |
| **Authentication** | OAuth 2.0 PKCE with S256 `code_challenge` + `code_verifier` |
| **Sessions** | `HttpOnly; Secure; SameSite=Lax` cookies signed with HMAC-SHA256 |
| **Database** | Parameterized SQL queries enforce multi-tenant data isolation |
| **API Security** | All MCP tokens and LLM keys remain server-side, never exposed to browser |
| **Rate Limiting** | 18 requests/minute per session with automatic fallback |

---

## 🤖 AI Chat Endpoint

```
POST /api/ai-chat
```

```json
{
  "message": "How much did I spend on food this month?",
  "month": "2026-08"
}
```

The endpoint authenticates via the signed `expense_tracker_dashboard` cookie, discovers the user's MCP tool catalog, and executes tools including:

| Tool | Action |
| :--- | :--- |
| `add_expense` | Log a new expense with amount, category, merchant, and method |
| `update_expense` | Modify existing transaction details |
| `set_budget` | Create or update monthly budget limits |
| `full_budget_report` | Generate detailed spending vs. budget analysis |
| `export_expenses` | Export transaction data as CSV |

**Smart model routing** automatically picks the right model tier:

| Tier | Model | Use Case |
| :--- | :--- | :--- |
| ⚡ Flash-Lite | `gemini-2.5-flash-lite` | Quick lookups and simple queries |
| 🔥 Flash | `gemini-2.5-flash` | Reports and summaries |
| 🧠 Advanced | `deepseek-v3.2` | Trend comparisons and analysis |
| 💎 Premium | `kimi-k2.5` | Complex financial planning |

---

## ⚙️ Environment Variables

```env
# LLM & Model Routing (CometAPI)
COMET_API_KEY=your-secret-key
FAST_MODEL=gemini-2.5-flash-lite
DEFAULT_MODEL=gemini-2.5-flash
ADVANCED_MODEL=deepseek-v3.2
PREMIUM_MODEL=kimi-k2.5

# Database & Session
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
DASHBOARD_SESSION_SECRET=a-long-random-secret-min-32-chars

# Owner Console (Optional)
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD_HASH=scrypt$base64url-salt$base64url-hash
OWNER_SESSION_SECRET=a-different-random-secret-min-32-chars
```

Generate a scrypt password hash for the owner console:

```powershell
node -e "const {randomBytes,scryptSync}=require('crypto');const p=process.argv[1],s=randomBytes(16);console.log('scrypt$'+s.toString('base64url')+'$'+scryptSync(p,s,64).toString('base64url'))" "your-password"
```

---

## 📁 Project Structure

```
money-copilot-ai/
├── api/                            # Vercel Serverless Functions
│   ├── ai-chat.js                  #   AI conversation endpoint
│   ├── dashboard.js                #   Dashboard data API
│   ├── dashboard-auth.js           #   Session authentication
│   ├── dashboard-authorize.js      #   OAuth 2.0 PKCE flow
│   ├── dashboard-logout.js         #   Session termination
│   ├── send-report-email.js        #   Email report generation
│   ├── owner-auth.js               #   Admin authentication
│   └── owner-monitor.js            #   Admin monitoring API
│
├── site/
│   ├── index.html                  # Landing page & marketing
│   ├── privacy.html                # Privacy policy
│   ├── terms.html                  # Terms of service
│   ├── support.html                # Support page
│   ├── assets/                     # Logos, brand icons, images
│   ├── dashboard/
│   │   ├── index.html              #   Dashboard shell & boot screen
│   │   ├── app.js                  #   Full client application (141KB)
│   │   ├── styles.css              #   Dashboard styling (229KB)
│   │   └── report.css              #   Email report styles
│   └── owner/                      # Admin monitoring console
│
├── vercel.json                     # Routing, rewrites & redirects
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Vanilla JS, CSS, HTML — zero framework overhead |
| **Backend** | Vercel Serverless Functions (Node.js) |
| **Database** | Turso (libSQL) — edge-replicated SQLite |
| **AI/LLM** | CometAPI (OpenAI-compatible multi-model gateway) |
| **Auth** | OAuth 2.0 PKCE + HMAC-SHA256 signed cookies |
| **Protocol** | Model Context Protocol (MCP) for AI tool integration |
| **Hosting** | Vercel Edge Network |
| **Fonts** | Inter (Google Fonts) |

---

## 📜 License

This project is proprietary. All rights reserved.

---

<div align="center">

**Built with 💚 by [Money Copilot AI](https://money-copilot.vercel.app)**

*Your money. Your data. Your AI copilot.*

</div>
