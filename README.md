# Expense Tracker AI web dashboard

The dashboard is a Vercel static frontend with protected serverless functions.
It uses the existing Turso/libSQL expense data and a signed dashboard session;
the AI assistant never accepts a user id from the browser.

## AI assistant setup

Configure these production environment variables in Vercel:

```text
COMET_API_KEY=your-secret-key
DEFAULT_MODEL=deepseek/deepseek-chat
ADVANCED_MODEL=deepseek/deepseek-v3-2
PREMIUM_MODEL=moonshotai/kimi-k2-5
```

The assistant uses CometAPI's OpenAI-compatible endpoint at
`https://api.cometapi.com/v1`. The key is read only by `/api/ai-chat` and is
never bundled into the dashboard JavaScript.

## AI endpoint

`POST /api/ai-chat`

```json
{ "message": "How much did I spend on restaurants this month?" }
```

The route derives the user from the signed `expense_tracker_dashboard` cookie,
then lets the model call only these private data tools:

- `get_expenses`
- `get_budget_status`
- `generate_monthly_report`

Simple requests use the default DeepSeek model. Comparison, anomaly, and
savings questions use the advanced model; longer financial-plan requests use
the premium model. If an advanced/premium model fails, the request downgrades
to the default model.

The route includes an in-memory per-user rate limit, five-minute answer cache,
bounded tool loops, prompt sanitization, and server-side usage logging.
