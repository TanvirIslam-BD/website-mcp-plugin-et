<div align="center">

<img src="work/hero-banner.jpg" alt="Money Copilot AI" width="100%" />

# 💰 Money Copilot AI

### Your AI-Powered Personal Finance Command Center

**Track spending · Set budgets · Get smart insights · Chat with your money**

[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![MCP](https://img.shields.io/badge/MCP-Compatible-10b981?style=for-the-badge)](https://modelcontextprotocol.io)
[![OAuth 2.0](https://img.shields.io/badge/Auth-OAuth%202.0%20PKCE-blue?style=for-the-badge)](https://oauth.net/2/pkce/)

[Live Demo](https://www.copilotai.live) · [Dashboard](https://www.copilotai.live/dashboard) · [Privacy Policy](https://www.copilotai.live/privacy)

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
│  • No API keys or secrets in page code               │
│  • One HttpOnly cookie: signed session + AES-256-GCM │
│    encrypted MCP token (never readable by JS)        │
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
| **Sessions** | `HttpOnly; Secure; SameSite=Lax` cookies signed with HMAC-SHA256, sliding 15-minute expiry |
| **MCP token** | Encrypted with AES-256-GCM (key derived from the session secret) before it enters the cookie, so a stolen cookie yields no usable bearer token |
| **Database** | Parameterized SQL queries enforce multi-tenant data isolation |
| **Concurrency** | Compare-and-swap writes on the shared finance document prevent lost updates |
| **API Security** | LLM keys and the Resend key remain server-side, never exposed to the browser |
| **Rate Limiting** | Database-backed counters (not per-instance memory): 18 AI requests/min, 120 writes/min, 5 report emails/hour, 8 owner sign-ins per IP + 40 globally per 15 min. The IP is read from platform headers a client cannot forge |
| **CSRF** | `SameSite` cookies plus a mandatory `Origin` check on every state-changing request |
| **Response headers** | `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS site-wide; `frame-ancestors 'none'` + `X-Frame-Options: DENY` and a `script-src 'self'` / `connect-src 'self'` CSP on `/dashboard` and `/owner` |
| **Output encoding** | HTML escaped at every render sink; CSV export neutralizes `=`/`+`/`-`/`@` so a merchant name cannot become a spreadsheet formula; third-party error text is served as `text/plain` |
| **Reported figures** | Every number in the emailed report and the AI's monthly summary is derived server-side by `_monthly-summary.js`; the client sends only a month and a recipient |
| **Fail-closed checks** | A `DASHBOARD_SESSION_SECRET` under 32 characters disables sessions outright rather than accepting forgeable ones, and owner sign-in refuses to proceed if its brute-force counter is unreadable |
| **Prompt injection** | Third-party MCP tool metadata is whitespace-collapsed and stripped of forged role labels, and the system prompt states that tool metadata, tool results, and stored transaction text are data rather than instructions |
| **Owner console** | Separate scrypt-hashed credentials, `SameSite=Strict` cookie, `noindex`, mandatory `Origin` check on writes, and a session epoch that revokes all sessions on password change |

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

| Tier | Default model (env var) | Chosen when |
| :--- | :--- | :--- |
| ⚡ Fast | `gemini-2.5-flash-lite` (`FAST_MODEL`) | Quick lookups and single-line expense entry |
| 🔥 Standard | `gemini-2.5-flash` (`DEFAULT_MODEL`) | Everything not matched by another tier |
| 🧠 Advanced | `deepseek-v3.2` (`ADVANCED_MODEL`) | Comparisons, trends, forecasts, explanations — or whenever the user picks *Deep Analytics* |
| 💎 Premium | `kimi-k2.5` (`PREMIUM_MODEL`) | Planning, strategy, and advice questions |

The dashboard's Copilot setting chooses between **Automatic** (route per question)
and **Deep Analytics** (never drop below the advanced tier). If a tier's model
errors, the request retries once on `DEFAULT_MODEL`; if that also fails, the
answer is computed directly from the database and flagged `degraded`.

### Response latency

`POST /api/ai-chat` **streams** when the caller sends `Accept: text/event-stream`
(the dashboard always does), so the answer paints as it is generated instead of
after the whole completion lands. Frames are named events carrying JSON:

| Event | Payload | Meaning |
| :--- | :--- | :--- |
| `delta` | `{ text }` | Next fragment of the answer — a progressive preview |
| `retry` | `{ model }` | The tier's model failed; retrying on `DEFAULT_MODEL` |
| `done` | the full result | **Authoritative.** The client re-renders from this |
| `failed` | `{ error }` | Unrecoverable, reported in-stream because headers are already sent |

Deltas are painted as plain text, never as markup, so a half-finished markdown
fragment can't be mis-parsed mid-stream; the `done` frame is what gets rendered as
markdown. That split is also what makes a late fallback substitution safe — if the
model produced an unverified answer, `done` carries the database-derived one and
the preview is simply replaced. A caller that cannot accept an event stream still
gets the same JSON object, and the client detects this from the response
content-type and falls back automatically.

Three other things were on the critical path and are not any more:

- **Pre-flight was five serial round trips** (schema, suspension, rate limit, data
  migration, tool catalogue). Only two of them actually depend on the schema, so
  they now overlap — roughly two round trips instead of five before the model call.
- **Tool calls within a pass ran one at a time**, so "record these three expenses"
  paid three round trips end to end. They now run concurrently; overlapping writes
  to the shared finance document are safe because that path is a compare-and-swap.
- **The analytics write blocked the response.** It is now fire-and-forget.

The model pass limit is 3 (two is the normal shape: tool call, then answer); a
fourth only ever added worst-case latency.

---

## ⚙️ Environment Variables

See [.env.example](.env.example) for the annotated list.

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

# Email reports (Resend). Without RESEND_API_KEY nothing is sent and the
# endpoint reports `simulated: true`. EMAIL_FROM must be a verified domain.
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Money Copilot <reports@contact.copilotai.live>

# Owner Console (Optional)
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD_HASH=scrypt$base64url-salt$base64url-hash
OWNER_SESSION_SECRET=a-different-random-secret-min-32-chars

# Optional: public MCPize anon key for display-name/avatar lookup
MCPIZE_ANON_KEY=
# Optional: override the OAuth origin for preview deployments
DASHBOARD_ORIGIN=https://www.copilotai.live
```

Generate a scrypt password hash for the owner console:

```powershell
node -e "const {randomBytes,scryptSync}=require('crypto');const p=process.argv[1],s=randomBytes(16);console.log('scrypt$'+s.toString('base64url')+'$'+scryptSync(p,s,64).toString('base64url'))" "your-password"
```

---

## 📁 Project Structure

```
money-copilot-ai/
├── api/                            # Vercel entry points — one-line re-exports
│                                   # of site/api/*. Add a shim here for every
│                                   # new endpoint or it will not be routed.
│
├── site/api/                       # Serverless handlers (the real code)
│   ├── ai-chat.js                  #   AI conversation endpoint
│   ├── dashboard.js                #   Dashboard data API
│   ├── dashboard-auth.js           #   Starts the OAuth 2.0 PKCE flow
│   ├── dashboard-authorize.js      #   OAuth callback, mints the session
│   ├── dashboard-session.js        #   Session probe
│   ├── dashboard-logout.js         #   Session termination
│   ├── send-report-email.js        #   Email report generation (Resend)
│   ├── owner-auth.js               #   Owner sign-in & password change
│   ├── owner-monitor.js            #   Owner monitoring API
│   ├── _completion-stream.js       #   SSE parsing & tool-call delta reassembly
│   ├── _config.js                  #   Public origin / OAuth URL builders
│   ├── _db.js                      #   Turso client factory
│   ├── _dashboard-session.js       #   Cookie signing + MCP token encryption
│   ├── _finance-state.js           #   Finance document CAS + data migration
│   ├── _monitoring.js              #   Schema bootstrap & activity logging
│   ├── _owner-auth.js              #   Owner credential & session helpers
│   ├── _rate-limit.js              #   Database-backed rate limiting
│   └── _mcpize-profile.js          #   Optional profile enrichment
│
├── site/
│   ├── index.html                  # Landing page & marketing
│   ├── login.html                  # Sign-in page
│   ├── login.js                    #   Popup OAuth flow & handoff
│   ├── login-boot.js               #   Pre-paint shim for the login page
│   ├── privacy.html                # Privacy policy
│   ├── terms.html                  # Terms of service
│   ├── support.html                # Support page
│   ├── assets/                     # Logos, brand icons, images
│   ├── dashboard/
│   │   ├── index.html              #   Dashboard shell & boot screen
│   │   ├── boot.js                 #   Pre-paint theme + analytics shim
│   │   ├── authorize.html          #   OAuth popup handoff (no app bundle)
│   │   ├── handoff.js/.css         #   Handoff behaviour & standalone styles
│   │   ├── app.js                  #   Full client application (~175KB)
│   │   ├── styles.css              #   Dashboard styling (~257KB)
│   │   ├── report.css              #   Email report styles (~87KB)
│   │   └── viz.css                 #   Chart palette & layout fixes (loads last)
│   └── owner/                      # Admin monitoring console
│
├── test/                           # node:test suite (npm test)
├── .github/workflows/ci.yml        # Syntax check + tests on push and PR
├── vercel.json                     # Routing, rewrites & redirects
└── README.md
```

### Data model

This schema is **owned by the MCP server**, not by this repo — nothing here
creates the `expenses`, `budgets` or `finance_state` tables. That matters, because
an expense can be written to **either** store: the dashboard writes rows to the
`expenses` table, while a transaction recorded through a connected AI client can
land in `finance_state.expenses`. Every read path therefore merges both via
`mergeExpenseSources()`, de-duplicating by id and falling back to a
date/amount/category signature.

`finance_state` also holds everything the schema has no column for: incomes,
goals, recurring bills, the category catalogue, per-expense metadata (merchant,
payment method, tags, subcategory) and preferences. Writes to that document go
through a compare-and-swap helper, so two concurrent requests cannot silently
discard each other's changes.

`finance_state.schemaVersion` tracks per-user migrations. Version 3 normalizes
every timestamp to an ISO string and nothing else; it runs once per user, on first
read.

> **Do not "consolidate" the two expense stores.** Version 2 of this migration did
> exactly that — copying `finance_state.expenses` into the table, deleting the
> array, and dropping the merge from every read. It looks like dead duplication.
> It is not: the MCP server keeps writing there, so anything recorded through chat
> became invisible on the dashboard and absent from every total.
> `test/finance-state.test.js` guards against a repeat.

### Sign-in flow

```
/login  ──popup──▶  /api/dashboard-auth?popup=1  ──▶  MCPize consent
                                                          │
        ◀──postMessage──  /dashboard/authorize.html  ◀────┘
        │                 (handoff page, ~2KB)
        ▼
   /dashboard             assets already prefetched
```

The popup used to be redirected to `/dashboard`, so it downloaded the whole
application (~520KB of JS and CSS) and ran a full boot purely to point its opener
at the same URL — which then downloaded all of it again. The signed OAuth state now
records that the flow began in a popup, and the callback ends on a small handoff
page that `postMessage`s the opener and closes.

The parent navigates on that message, so the transition is immediate rather than
waiting for a 1-second polling tick to notice the window closed. Polling remains
only as the cancel detector, and it re-checks `/api/dashboard-session` before
reporting failure — a browser can close the popup before the message lands.

Other rough edges that are gone: a blocked popup now falls back to same-tab
navigation instead of appearing to do nothing; cancelling says so in a live region
instead of silently resetting the button; buttons restore their original markup
rather than a hardcoded copy of it; dashboard assets are prefetched when the user
hovers or focuses the sign-in button; and an already-signed-in visitor no longer
sees the form flash before being redirected.

### Chart colours

The three cash-flow series and the spending-breakdown slots come from a
validated categorical palette defined in [viz.css](site/dashboard/viz.css):
verified for lightness band, chroma floor, protanopia/deuteranopia separation and
normal-vision separation, in both light and dark modes. Series colours are
assigned in fixed order and never cycled; past the eighth slot categories fold
into a labelled "Other" row.

`viz.css` loads **after** `styles.css` and `report.css` so it is the final word on
those tokens — the two sheets before it hold ~350KB of accumulated overrides, and
an earlier layer had collapsed all three series onto near-identical greens, which
made the chart legend unreadable. `test/viz-palette.test.js` fails if that
regresses. Do not hand-pick substitutes: re-validate any change.

## 🧪 Development

```bash
npm install && npm test
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
