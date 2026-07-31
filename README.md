# Money Copilot AI web dashboard

Money Copilot AI is a Vercel-hosted personal-finance dashboard with protected
serverless functions, responsive light/dark themes, and a mobile-first Copilot
experience. It uses the existing Turso/libSQL expense data and a signed,
HTTP-only dashboard session; the AI assistant never accepts a user id from the
browser.

## Dashboard experience

- Responsive desktop and mobile dashboards with light and dark themes.
- Dynamic time-based greeting, financial overview, reports, budgets, recent
  transactions, and smart insights.
- Mobile Money Copilot panel with a scrollable chat history, compact response
  cards, and a fixed composer only when no modal is open.
- Email report flow that opens a prefilled mail draft containing the selected
  month's spending, income, cash-flow, and budget status.
- Authenticated MCPize OAuth sign-in for each private dashboard session.

## AI assistant setup

Configure these production environment variables in Vercel:

```text
COMET_API_KEY=your-secret-key
FAST_MODEL=gemini-2.5-flash-lite
DEFAULT_MODEL=gemini-2.5-flash
ADVANCED_MODEL=deepseek-v3.2
PREMIUM_MODEL=kimi-k2.5
```

The assistant uses CometAPI's OpenAI-compatible endpoint at
`https://api.cometapi.com/v1`. The key is read only by `/api/ai-chat` and is
never bundled into the dashboard JavaScript.

The production deployment also requires the dashboard session variables from
`.env.example`:

```text
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
DASHBOARD_SESSION_SECRET=a-long-random-secret-shared-with-the-dashboard-session
```

## MCPize connection

Dashboard sign-in uses MCPize OAuth with PKCE against the hosted expense
tracker MCP server. After authorization, the dashboard retains the MCP access
token only inside its signed, HTTP-only session cookie, allowing server-side
Money Copilot requests to call MCPize as the signed-in user.

The OAuth client metadata is served from `/dashboard/client-metadata.json` and
the callback is `/authorize`. Users should sign out and sign back in after an
MCP authentication change or deployment that changes the session format.

## AI endpoint

`POST /api/ai-chat`

```json
{ "message": "How much did I spend on restaurants this month?", "month": "2026-07" }
```

The route derives the signed-in user and MCP access token from the signed
`expense_tracker_dashboard` cookie. It discovers the live MCPize tool catalog
with `tools/list` and lets the model invoke it through authenticated
`tools/call` requests. This gives Money Copilot access to the complete tool
catalog, including expense, income, budget, recurring expense, category,
alert, import/export, forecasting, comparison, and report operations.

Examples include `add_expense`, `update_expense`, `delete_expense`,
`add_income`, `set_budget`, `set_recurring_expense`, `manage_categories`,
`get_budget_status`, `full_budget_report`, and `export_expenses`.

Short verified lookups use Flash-Lite, normal reports use Flash, comparison,
anomaly, and savings questions use the advanced model, and longer financial
plans use the premium model. Routine requests preload verified database data
to avoid a second model round trip. If a specialized model fails, the request
downgrades to the default model.

The route includes an in-memory per-user rate limit, bounded tool loops,
prompt sanitization, and server-side usage logging. Responses for authenticated
MCP tool sessions are not answer-cached, so write actions are never skipped by
a cached response.

## Owner monitoring console

The private owner console is available at `/owner/login` and its monitoring
page is `/owner/monitor`. It uses a separate signed, HTTP-only session and does
not accept a customer dashboard or MCPize login as owner authorization.

Configure these production-only Vercel variables:

```text
OWNER_EMAIL=owner@example.com
OWNER_PASSWORD_HASH=scrypt$base64url-salt$base64url-hash
OWNER_SESSION_SECRET=a-different-random-secret-of-at-least-32-characters
```

Generate a compatible password hash locally (replace the final argument with
your chosen password):

```powershell
node -e "const {randomBytes,scryptSync}=require('crypto');const p=process.argv[1],s=randomBytes(16);console.log('scrypt$'+s.toString('base64url')+'$'+scryptSync(p,s,64).toString('base64url'))" "your-password"
```

The console shows aggregate operational counts and metadata-only activity. It
does not display transaction descriptions or financial amounts. Suspending an
account is audited and enforced by both the Vercel dashboard/AI API and the MCP
data boundary.
