---
name: "visual-data-ai-responses"
created: "2026-07-30T16:00:42.063Z"
status: pending
---

# Plan: Visual Data Rendering in AI Responses

## Overview

Transform raw text AI responses into rich visual components (metric cards, progress bars, SVG pie charts) for a more user-friendly data experience in the Finance Copilot chat.

## Architecture Decision

**Approach: Structured `visualData` field from backend + frontend renderer**

The backend already has structured data from tool calls (`getBudgetStatus`, `generateMonthlyReport`, `getExpenses`). Instead of trying to parse markdown on the frontend, we'll:

1. Attach a `visualData` object to the API response when relevant tool data is available
2. Keep the text `answer` field unchanged (acts as fallback/accessibility)
3. Frontend renders `visualData` as rich UI components above the text

This is more reliable than regex-parsing LLM output and doesn't require changing the LLM prompt.

## Implementation Details

### 1. Backend: Add `visualData` to API response (`site/api/ai-chat.js`)

After tool execution, inspect `usedTools` and the last tool result to build a `visualData` payload:

```javascript
// Shape of visualData:
{
  type: "budget_status" | "monthly_report" | "expense_list",
  metrics: [{ label, value, subvalue?, color? }],  // metric cards
  progress: { value, max, label, percent }?,        // budget progress bar
  pieChart: [{ label, value, color }]?,             // category breakdown
  categories: [{ name, amount, percent, color }]?   // category list
}
```

- `get_budget_status` → metrics (spent, budget, remaining) + progress bar
- `generate_monthly_report` → metrics (total, income, net) + pie chart of categories
- `get_expenses` → metrics (count, total) + category breakdown if multiple categories

Also apply to `verifiedFallbackAnswer` responses.

### 2. Frontend: Visual renderer (`site/dashboard/app.js`)

New function `renderVisualData(visualData)` returns HTML string:

- **Metric cards**: 2-4 KPI tiles in a flex row (amount, label, optional trend color)
- **Progress bar**: Reuse existing `.copilot-progress` pattern with percentage
- **Pie chart**: Inline SVG donut chart (conic-gradient via stroke-dasharray arcs)
- **Category list**: Colored dot + name + amount + bar proportional to max

### 3. Integration into chat flow

Modify `submitAiQuestion`:

```javascript
// After receiving response:
const visualHtml = body.visualData ? renderVisualData(body.visualData) : "";
appendAiMessage("assistant", body.answer, meta, chatRoot, visualHtml);
```

Modify `appendAiMessage` to accept optional `visualHtml` parameter and insert it before the text content.

### 4. CSS for visual components

New classes inside `.ai-message-body`:

- `.ai-visual-panel` — container with subtle border, rounded corners
- `.ai-metric-row` — flex row of metric cards
- `.ai-metric-card` — individual KPI (large value, small label)
- `.ai-pie-wrap` — SVG donut container
- `.ai-category-bar` — horizontal bar with label
- `.ai-progress-inline` — progress bar within chat

All with dark mode variants using existing `[data-theme="dark"]` pattern.

### 5. Visual Design

- Metric cards: colored top accent (green for positive, red for over-budget)
- Pie chart: \~120px SVG donut, max 6 slices with category colors from existing `tagColors`
- Progress bar: gradient fill matching the existing copilot-progress style
- Category bars: horizontal fill bars showing relative proportion
- Responsive: stack on narrow widths within the chat bubble
