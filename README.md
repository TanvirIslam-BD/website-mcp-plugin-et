# Expense Tracker AI web dashboard

The dashboard is a Vercel static frontend with protected serverless functions.
It uses the existing Turso/libSQL expense data and a signed dashboard session;
the AI assistant never accepts a user id from the browser.

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

## AI endpoint

`POST /api/ai-chat`

```json
{ "message": "How much did I spend on restaurants this month?", "month": "2026-07" }
```

The route derives the user from the signed `expense_tracker_dashboard` cookie,
then lets the model call only these private data tools:

- `get_expenses`
- `get_latest_expense`
- `get_budget_status`
- `generate_monthly_report`

Short verified lookups use Flash-Lite, normal reports use Flash, comparison,
anomaly, and savings questions use the advanced model, and longer financial
plans use the premium model. Routine requests preload verified database data
to avoid a second model round trip. If a specialized model fails, the request
downgrades to the default model.

The route includes an in-memory per-user rate limit, five-minute answer cache,
bounded tool loops, prompt sanitization, and server-side usage logging.

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
