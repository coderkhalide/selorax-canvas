# Phase 13: Funnel Navigation + Analytics + AI Insights — Design

**Date:** 2026-02-27

## Goal

Make funnels fully functional end-to-end: visitors navigate through funnel steps, every action is tracked, KPIs surface in the canvas editor and a dedicated analytics page, and the AI agent reads performance data to suggest and apply improvements.

## Architecture: Option A (Lightweight MySQL)

All events land in the existing `ConversionEvent` MySQL table. Analytics APIs aggregate on-demand with raw SQL. No new infrastructure. ClickHouse migration deferred until event volume justifies it.

---

## Feature 1: Funnel Navigation

### Serve API extension (`serve.ts`)

When serving a page that belongs to a funnel, the API returns additional context:

```typescript
{
  tree,
  versionId,
  pageId,
  tenantId,
  // NEW — null if page is not a funnel step
  funnelContext: {
    funnelId: string,
    funnelStepOrder: number,
    nextStepUrl: string | null,   // resolved slug of next step's page
    isLastStep: boolean,
    onSuccess: object | null,     // JSON action for last step
    onSkip: object | null,
  } | null,
  // NEW — null if no active experiment on this page
  experimentContext: {
    experimentId: string,
    variantId: string,
    isControl: boolean,
  } | null,
}
```

**Resolution logic:**
1. `prisma.funnelStep.findFirst({ where: { pageId, tenantId } })` — check if page is a funnel step
2. If found, get next step: `findFirst({ where: { funnelId, stepOrder: currentStep + 1 } })`
3. Resolve next step's page slug for `nextStepUrl`
4. Check Redis for active experiment: `exp:page:{tenantId}:{pageId}` → assign visitor to variant by `trafficWeight`

### Renderer action types (`packages/renderer/src/PageRenderer.tsx`)

Extend `handleAction`:

```typescript
type Action =
  | { type: 'link'; url: string }
  | { type: 'nextFunnelStep' }           // navigate to nextStepUrl + fire funnel_step_complete
  | { type: 'conversion'; value: number } // fire conversion event + navigate
```

`nextFunnelStep` reads `nextStepUrl` from page context (passed as prop from storefront).

### Storefront (`apps/storefront/`)

```typescript
// On mount — fire page_view
sendBeacon('/api/events', { eventType: 'page_view', visitorId, pageId, funnelId, ... })

// visitorId — UUID persisted in localStorage
const visitorId = localStorage.getItem('_sid') ?? crypto.randomUUID()
localStorage.setItem('_sid', visitorId)
```

### Visitor session tracking

- `visitorId`: UUID in `localStorage._sid`, generated on first visit
- Sent with every event
- Enables cross-page funnel tracking in `ConversionEvent` table

### Conditional routing (MVP)

`FunnelStep.onSuccess` is a JSON field — for MVP supports:
- `{ type: "nextFunnelStep" }` → go to next step
- `{ type: "link", url: "/thank-you" }` → navigate to URL

Future: `{ type: "conditionalBranch", conditions: [...] }` — same field, no schema change.

---

## Feature 2: Analytics Tracking

### Events fired

| Event | Where | When |
|-------|-------|------|
| `page_view` | Storefront client | On mount via `sendBeacon` |
| `funnel_step_complete` | Renderer `handleAction` | CTA with `nextFunnelStep` action |
| `conversion` | Renderer `handleAction` | Button with `action.value > 0` |
| `experiment_impression` | Storefront client | When variant is served |

### Event payload (all events)

```typescript
{
  visitorId: string,        // localStorage UUID
  tenantId: string,
  pageId: string,
  funnelId: string | null,
  funnelStepOrder: number | null,
  experimentId: string | null,
  variantId: string | null,
  eventType: string,
  value: number,            // $ for conversions, 0 otherwise
  occurredAt: string,       // ISO timestamp
}
```

Delivery: `navigator.sendBeacon('/api/events')` — fire-and-forget, survives page navigation.

---

## Feature 3: Analytics APIs

### `GET /api/analytics/pages/:pageId?days=30`

```typescript
{
  visitors: number,
  conversions: number,
  conversionRate: number,       // %
  conversionValue: number,      // total $
  experimentLift: {
    control: { visitors, conversionRate },
    variant: { visitors, conversionRate },
    lift: number,               // % improvement
  } | null
}
```

Implementation: raw MySQL aggregations on `ConversionEvent` filtered by `tenantId + pageId + date range`.

### `GET /api/analytics/funnels/:funnelId?days=30`

```typescript
{
  funnelId, name,
  steps: [
    { stepOrder, pageId, name, visitors, dropOff: number }  // dropOff = %
  ],
  totalConversions: number,
  totalRevenue: number,
}
```

### `GET /api/analytics/ai-context/:pageId?days=30`

Stripped payload for AI agent:
```typescript
{
  page: { id, name, slug },
  stats: { visitors, conversions, conversionRate, conversionValue },
  topDropOffStep: FunnelStep | null,
  worstConversionRate: number,
  recentEvents: ConversionEvent[],  // last 100 rows
}
```

### Tenant isolation

All queries: `WHERE tenant_id = ?` always. Date range: `AND occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`.

---

## Feature 4: Analytics UI

### A) Stats strip in canvas editor (right panel)

Shown when a page has been published (has `publishedVersionId`). Displays last 30 days:

```
┌─────────────────────────────────────────────┐
│  👁 1,240  •  ⚡ 15% CVR  •  💰 $18,042       │
│  [View Full Analytics →]                    │
└─────────────────────────────────────────────┘
```

Location: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/AnalyticsStrip.tsx`

### B) Dedicated analytics page (`/analytics/[pageId]`)

Location: `apps/canvas-dashboard/src/app/analytics/[pageId]/page.tsx`

**Sections:**
1. **KPI cards** — Visitors, Conversions, Conv. Rate, Revenue (4 cards)
2. **Funnel visualization** (if page is a funnel step) — horizontal step flow with drop-off %
3. **Experiment results** (if active experiment) — Control vs Variant table with lift badge
4. **AI Suggestions** — cards with "Apply as A/B Test" / "Apply Directly" buttons

### C) Funnel analytics page (`/analytics/funnels/[funnelId]`)

Location: `apps/canvas-dashboard/src/app/analytics/funnels/[funnelId]/page.tsx`

Full funnel visualization accessible from the funnels list.

---

## Feature 5: AI Suggestions + Auto-Experiment

### New Mastra tool: `get_page_analytics`

```typescript
// src/mastra/tools/get-page-analytics.ts
// Calls GET /api/analytics/ai-context/:pageId
// Returns stats + recentEvents for the AI to reason about
```

### Agent instructions (updated)

Before suggesting changes:
1. Call `get_canvas_screenshot` — see the visual
2. Call `get_page_analytics` — see the numbers
3. Identify the highest-impact change
4. Ask user permission before applying anything

### Two suggestion modes

**Low-risk (copy, color, font):**
```
"Your H1 has 71% bounce. I suggest: 'Start Free Today — No Credit Card'
in #7C3AED. Apply directly? [Yes / No]"
```
→ On Yes: `update_node_props` + `update_node_styles`

**Structural (layout, new section):**
```
"75% drop-off on upsell. I want to test a 2-column layout with social proof.
Create an A/B test? [Yes / No]"
```
→ On Yes: `duplicate_page` + `create_experiment` with 50/50 split

### AI change logging

Every applied change writes to `AiAnalysisResult`:
```typescript
{
  pageId, tenantId,
  summary: "Changed H1 to #7C3AED based on 71% bounce",
  beforeStats: { visitors, conversionRate },
  appliedAt: Date,
}
```
Becomes training data for future suggestions.

---

## Files Changed

### New (backend)
- `src/routes/analytics.ts` — 3 new endpoints
- `src/mastra/tools/get-page-analytics.ts` — AI tool

### Modified (backend)
- `src/routes/serve.ts` — add `funnelContext` + `experimentContext`
- `src/index.ts` — register analytics router
- `src/mastra/agents/canvas-agent.ts` — add `get_page_analytics` tool + updated instructions
- `src/mastra/mcp/server.ts` — add tool

### New (dashboard)
- `src/app/analytics/[pageId]/page.tsx` + components
- `src/app/analytics/funnels/[funnelId]/page.tsx`
- `src/app/canvas/[pageId]/components/panels/AnalyticsStrip.tsx`

### Modified (dashboard)
- `src/app/canvas/[pageId]/components/panels/RightPanel.tsx` — add AnalyticsStrip

### Modified (storefront)
- `app/[[...slug]]/page.tsx` — pass funnelContext to renderer, fire page_view, generate visitorId

### Modified (renderer)
- `packages/renderer/src/PageRenderer.tsx` — extend handleAction, accept funnelContext prop

---

## KPIs Tracked (MVP)

- Visitors (unique `visitorId` count per page per period)
- Conversions (count of `conversion` events)
- Conversion Rate (conversions / visitors × 100)
- Conversion Value (sum of `value` field on `conversion` events)
- Funnel Drop-off (visitors at step N vs step N-1)
- Experiment Lift (variant CVR vs control CVR)

## Out of Scope (ClickHouse migration)

- Time on page (requires separate start/end events — not tracked in MVP)
- Heatmaps
- Real-time dashboards
- Cohort analysis
