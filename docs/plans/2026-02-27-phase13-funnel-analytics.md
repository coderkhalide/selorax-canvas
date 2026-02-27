# Phase 13: Funnel Navigation + Analytics + AI Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make funnels fully navigable end-to-end, track all visitor events, surface KPIs in the canvas editor and a dedicated analytics dashboard, and give the AI agent analytics context for data-driven suggestions.

**Architecture:** Option A — MySQL only. Events land in `ConversionEvent` table (with new `pageId`/`funnelId` columns). Analytics APIs aggregate on-demand. No new infrastructure. ClickHouse migration deferred.

**Tech Stack:** Express + Prisma + MySQL (backend), Next.js 14 App Router (dashboard + storefront), `@selorax/renderer` (packages/renderer), Mastra v1.8.0 + Claude Sonnet 4.6 (AI), Vitest (tests).

---

## Critical Rules (never break)

- `tenantId` in every Prisma query
- Analytics APIs: always filter by `tenantId` + date range
- `sendBeacon` for events — fire-and-forget, never block page navigation
- `visitorId` = UUID from `localStorage._sid` — generated once, reused across all pages
- Renderer `handleAction` is client-side only (`'use client'`)
- Never cache analytics data — always fresh MySQL reads for MVP

---

## Task 1: Add pageId + funnelId + funnelStepOrder to ConversionEvent

**Files:**
- Modify: `apps/canvas-backend/prisma/schema.prisma` (ConversionEvent model)
- Run: migration

**Context:** Analytics queries need to aggregate events by `pageId`. Without it, we can't count visitors per page. `funnelId` and `funnelStepOrder` allow funnel drop-off analysis.

**Step 1: Read the current ConversionEvent model**

Open `apps/canvas-backend/prisma/schema.prisma` and find `model ConversionEvent`. It currently has: `tenantId, experimentId, variantId, sessionId, visitorId, eventType, elementId, elementLabel, value, metadata, occurredAt`.

**Step 2: Add 3 new optional fields**

Add these lines to `ConversionEvent` model, after the existing fields:

```prisma
model ConversionEvent {
  id            String    @id @default(cuid())
  tenantId      String    @map("tenant_id")
  experimentId  String?   @map("experiment_id")
  variantId     String?   @map("variant_id")
  sessionId     String?   @map("session_id")
  visitorId     String?   @map("visitor_id")
  pageId        String?   @map("page_id")           // NEW
  funnelId      String?   @map("funnel_id")          // NEW
  funnelStepOrder Int?    @map("funnel_step_order")  // NEW
  eventType     String    @map("event_type")
  elementId     String?   @map("element_id")
  elementLabel  String?   @map("element_label")
  value         Float?
  metadata      String?   @db.Text
  occurredAt    DateTime  @default(now()) @map("occurred_at")

  @@index([tenantId])
  @@index([tenantId, pageId])       // NEW — for per-page queries
  @@index([tenantId, funnelId])     // NEW — for funnel queries
  @@map("conversion_events")
}
```

**Step 3: Run migration**

```bash
cd apps/canvas-backend
npx prisma migrate dev --name add_page_funnel_to_events
npx prisma generate
```

Expected: migration file created, client regenerated.

**Step 4: Update events flush in `src/routes/events.ts`**

In the `flushEvents` function, add the new fields to the `createMany` data mapping:

```typescript
data: events.map((e: any) => ({
  tenantId:        e.tenantId,
  experimentId:    e.experimentId ?? null,
  variantId:       e.variantId ?? null,
  sessionId:       e.sessionId ?? null,
  visitorId:       e.visitorId ?? null,
  pageId:          e.pageId ?? null,           // NEW
  funnelId:        e.funnelId ?? null,          // NEW
  funnelStepOrder: e.funnelStepOrder ?? null,   // NEW
  eventType:       e.eventType,
  elementId:       e.elementId ?? null,
  elementLabel:    e.elementLabel ?? null,
  value:           e.value ?? null,
  metadata:        e.metadata ? JSON.stringify(e.metadata) : null,
  occurredAt:      e.occurredAt ? new Date(e.occurredAt) : new Date(),
})),
```

**Step 5: Run existing tests to confirm nothing broke**

```bash
cd apps/canvas-backend && npx vitest run
```

Expected: all 156 tests pass.

---

## Task 2: Extend Serve API with funnelContext + experimentContext

**Files:**
- Modify: `apps/canvas-backend/src/routes/serve.ts`
- Create: `apps/canvas-backend/src/routes/serve.test.ts`

**Context:** The storefront needs to know if the current page is a funnel step, what the next step URL is, and whether an experiment is running. The serve endpoint returns this alongside the page tree.

**Step 1: Write failing tests**

Create `apps/canvas-backend/src/routes/serve.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, redisMock } = vi.hoisted(() => ({
  prismaMock: {
    page:        { findFirst: vi.fn(), findMany: vi.fn() },
    pageVersion: { findUnique: vi.fn() },
    funnelStep:  { findFirst: vi.fn() },
  },
  redisMock: { status: 'ready', get: vi.fn(), set: vi.fn() },
}));

vi.mock('../db',           () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: redisMock }));

import express from 'express';
import request from 'supertest';
import serveRouter from './serve';

const app = express();
app.use(express.json());
app.use('/api/serve', serveRouter);

const basePage    = { id: 'page-1', tenantId: 'tenant-a', slug: 'home', pageType: 'home', publishedVersionId: 'ver-1' };
const baseVersion = { id: 'ver-1', pageId: 'page-1', tree: JSON.stringify({ id: 'root', type: 'layout', children: [] }) };

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.status = 'ready';
  redisMock.get.mockResolvedValue(null);
  redisMock.set.mockResolvedValue('OK');
  prismaMock.page.findFirst.mockResolvedValue(basePage);
  prismaMock.pageVersion.findUnique.mockResolvedValue(baseVersion);
  prismaMock.funnelStep.findFirst.mockResolvedValue(null); // no funnel by default
});

describe('serve — funnelContext', () => {
  it('returns funnelContext: null when page is not part of a funnel', async () => {
    const res = await request(app).get('/api/serve/tenant-a/home/home');
    expect(res.status).toBe(200);
    expect(res.body.funnelContext).toBeNull();
  });

  it('returns funnelContext with nextStepUrl when page is a funnel step with a next step', async () => {
    const nextPage = { id: 'page-2', slug: 'upsell', pageType: 'funnel_step' };
    prismaMock.funnelStep.findFirst
      .mockResolvedValueOnce({ id: 'step-1', funnelId: 'funnel-1', stepOrder: 1, onSuccess: '{}', onSkip: null })
      .mockResolvedValueOnce({ id: 'step-2', funnelId: 'funnel-1', stepOrder: 2, pageId: 'page-2', onSuccess: '{}', onSkip: null, page: nextPage });

    const res = await request(app).get('/api/serve/tenant-a/home/home');
    expect(res.status).toBe(200);
    expect(res.body.funnelContext).toMatchObject({
      funnelId: 'funnel-1',
      funnelStepOrder: 1,
      nextStepUrl: '/upsell',
      isLastStep: false,
    });
  });

  it('returns funnelContext with isLastStep: true when no next step exists', async () => {
    prismaMock.funnelStep.findFirst
      .mockResolvedValueOnce({ id: 'step-3', funnelId: 'funnel-1', stepOrder: 3, onSuccess: '{"type":"link","url":"/thank-you"}', onSkip: null })
      .mockResolvedValueOnce(null); // no next step

    const res = await request(app).get('/api/serve/tenant-a/home/home');
    expect(res.body.funnelContext.isLastStep).toBe(true);
    expect(res.body.funnelContext.nextStepUrl).toBeNull();
    expect(res.body.funnelContext.onSuccess).toEqual({ type: 'link', url: '/thank-you' });
  });
});
```

**Note:** `supertest` may need installing: `cd apps/canvas-backend && npm install --save-dev supertest @types/supertest`

**Step 2: Run tests to confirm they fail**

```bash
cd apps/canvas-backend && npx vitest run src/routes/serve.test.ts
```

Expected: FAIL — `funnelContext` is undefined.

**Step 3: Implement funnelContext in serve.ts**

In `apps/canvas-backend/src/routes/serve.ts`, after fetching `version`, add funnel lookup before building `payload`:

```typescript
// After `const version = await prisma.pageVersion.findUnique(...)` line:

// Resolve funnel context
let funnelContext = null;
const funnelStep = await prisma.funnelStep.findFirst({
  where: { pageId: page.id },
});
if (funnelStep) {
  const nextStep = await prisma.funnelStep.findFirst({
    where: { funnelId: funnelStep.funnelId, stepOrder: funnelStep.stepOrder + 1 },
    include: { page: { select: { slug: true, pageType: true } } },
  });
  funnelContext = {
    funnelId:        funnelStep.funnelId,
    funnelStepOrder: funnelStep.stepOrder,
    nextStepUrl:     nextStep ? `/${nextStep.page.slug}` : null,
    isLastStep:      !nextStep,
    onSuccess:       funnelStep.onSuccess ? JSON.parse(funnelStep.onSuccess) : null,
    onSkip:          funnelStep.onSkip    ? JSON.parse(funnelStep.onSkip)    : null,
  };
}

const payload = {
  tree: JSON.parse(version.tree),
  versionId: version.id,
  pageId: page.id,
  tenantId,
  funnelContext,      // NEW
  experimentContext: null, // Phase 13 MVP: no variant assignment yet
};
```

**Step 4: Run tests**

```bash
cd apps/canvas-backend && npx vitest run src/routes/serve.test.ts
```

Expected: all 3 new tests pass.

**Step 5: Run full suite**

```bash
npx vitest run
```

Expected: all 157+ tests pass.

---

## Task 3: Extend Renderer handleAction + accept funnelContext

**Files:**
- Modify: `packages/renderer/src/PageRenderer.tsx`
- Create: `packages/renderer/src/PageRenderer.test.tsx`

**Context:** When a button has `action: { type: "nextFunnelStep" }`, the renderer needs to navigate to `nextStepUrl` and fire a `funnel_step_complete` event. `nextStepUrl` and event-firing callback come from outside via props.

**Step 1: Write failing tests**

Create `packages/renderer/src/PageRenderer.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PageRenderer } from './PageRenderer';

const makeTree = (action: any) => ({
  id: 'root', type: 'layout', styles: '{}', children: [{
    id: 'btn', type: 'element', styles: '{}',
    props: JSON.stringify({ tag: 'button', label: 'Next Step', action }),
    children: [],
  }],
});

describe('handleAction — nextFunnelStep', () => {
  it('calls onFunnelNext when button has nextFunnelStep action', () => {
    const onFunnelNext = vi.fn();
    render(
      <PageRenderer
        tree={makeTree({ type: 'nextFunnelStep' })}
        data={{}}
        funnelContext={{ nextStepUrl: '/upsell', funnelId: 'f1', funnelStepOrder: 1, isLastStep: false, onSuccess: null, onSkip: null }}
        onEvent={vi.fn()}
        onFunnelNext={onFunnelNext}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onFunnelNext).toHaveBeenCalledOnce();
  });

  it('calls onEvent with funnel_step_complete when nextFunnelStep clicked', () => {
    const onEvent = vi.fn();
    render(
      <PageRenderer
        tree={makeTree({ type: 'nextFunnelStep' })}
        data={{}}
        funnelContext={{ nextStepUrl: '/upsell', funnelId: 'f1', funnelStepOrder: 1, isLastStep: false, onSuccess: null, onSkip: null }}
        onEvent={onEvent}
        onFunnelNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'funnel_step_complete' }));
  });

  it('calls onEvent with conversion when button has conversion action', () => {
    const onEvent = vi.fn();
    render(
      <PageRenderer
        tree={makeTree({ type: 'conversion', value: 97 })}
        data={{}}
        onEvent={onEvent}
        onFunnelNext={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Next Step'));
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'conversion', value: 97 }));
  });

  it('navigates via window.location for link action (existing behavior)', () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
    render(<PageRenderer tree={makeTree({ type: 'link', url: '/products' })} data={{}} onEvent={vi.fn()} onFunnelNext={vi.fn()} />);
    fireEvent.click(screen.getByText('Next Step'));
    // window.location.href should be set
    expect(window.location.href).toBe('/products');
  });
});
```

**Note:** Install test deps in renderer package if not present: `cd packages/renderer && npm install --save-dev @testing-library/react @testing-library/jest-dom vitest jsdom`

**Step 2: Run to confirm fail**

```bash
cd packages/renderer && npx vitest run
```

Expected: FAIL — `onFunnelNext` prop doesn't exist.

**Step 3: Update PageRenderer.tsx**

Replace the existing `PageRenderer` export and `handleAction` function:

```typescript
// Props interface
interface PageRendererProps {
  tree: any;
  data: any;
  funnelContext?: {
    funnelId: string;
    funnelStepOrder: number;
    nextStepUrl: string | null;
    isLastStep: boolean;
    onSuccess: any;
    onSkip: any;
  } | null;
  onEvent?: (event: { eventType: string; value?: number; funnelId?: string; funnelStepOrder?: number }) => void;
  onFunnelNext?: () => void;
}

export function PageRenderer({ tree, data, funnelContext, onEvent, onFunnelNext }: PageRendererProps) {
  if (!tree) return null;
  return (
    <RenderNode
      node={tree}
      data={{ ...data, funnelContext }}
      onEvent={onEvent}
      onFunnelNext={onFunnelNext}
      funnelContext={funnelContext}
    />
  );
}
```

Pass `onEvent`, `onFunnelNext`, `funnelContext` through `RenderNode` → `RenderElement` via the `data` prop or separate props (simplest: add them to `data` object).

Update `RenderElement` button case:

```typescript
case 'button': return (
  <button style={styles} onClick={() => handleAction(props.action, data?.funnelContext, data?.onEvent, data?.onFunnelNext)}>
    {text(props.label)}
  </button>
);
```

Replace `handleAction`:

```typescript
function handleAction(
  action: any,
  funnelContext: any,
  onEvent?: (e: any) => void,
  onFunnelNext?: () => void,
) {
  if (!action) return;

  if (action.type === 'link' && action.url) {
    window.location.href = action.url;
    return;
  }

  if (action.type === 'nextFunnelStep') {
    onEvent?.({
      eventType: 'funnel_step_complete',
      funnelId: funnelContext?.funnelId,
      funnelStepOrder: funnelContext?.funnelStepOrder,
    });
    onFunnelNext?.();
    return;
  }

  if (action.type === 'conversion') {
    onEvent?.({ eventType: 'conversion', value: action.value ?? 0 });
    if (action.url) window.location.href = action.url;
    return;
  }
}
```

**Step 4: Run renderer tests**

```bash
cd packages/renderer && npx vitest run
```

Expected: all tests pass.

**Step 5: Update renderer exports in `packages/renderer/src/index.ts`**

Confirm `PageRenderer` is still exported. No change needed if it was already exported.

---

## Task 4: Storefront — visitorId tracking + sendBeacon events + funnelContext

**Files:**
- Modify: `apps/storefront/app/[[...slug]]/page.tsx`
- Create: `apps/storefront/app/[[...slug]]/ClientAnalytics.tsx`

**Context:** The storefront is a Next.js Server Component — it can't use localStorage or sendBeacon directly. We create a small `'use client'` component (`ClientAnalytics`) that runs on mount to: generate/read visitorId, fire `page_view`, and provide navigation callbacks for the renderer.

**Step 1: Create ClientAnalytics.tsx**

Create `apps/storefront/app/[[...slug]]/ClientAnalytics.tsx`:

```typescript
'use client';
import { useEffect, useCallback } from 'react';
import { PageRenderer } from '@selorax/renderer';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('_sid');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('_sid', id); }
  return id;
}

function fireEvent(payload: Record<string, any>) {
  const data = JSON.stringify({ ...payload, visitorId: getVisitorId(), occurredAt: new Date().toISOString() });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(`${BACKEND}/api/events`, new Blob([data], { type: 'application/json' }));
  } else {
    fetch(`${BACKEND}/api/events`, { method: 'POST', body: data, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

interface ClientAnalyticsProps {
  tree: any;
  data: any;
  pageId: string;
  tenantId: string;
  funnelContext: any;
  experimentContext: any;
}

export default function ClientAnalytics({ tree, data, pageId, tenantId, funnelContext, experimentContext }: ClientAnalyticsProps) {
  // Fire page_view on mount
  useEffect(() => {
    fireEvent({
      eventType:       'page_view',
      tenantId,
      pageId,
      funnelId:        funnelContext?.funnelId ?? null,
      funnelStepOrder: funnelContext?.funnelStepOrder ?? null,
      experimentId:    experimentContext?.experimentId ?? null,
      variantId:       experimentContext?.variantId ?? null,
      value:           0,
    });
  }, [pageId, tenantId, funnelContext, experimentContext]);

  // Event callback for renderer
  const onEvent = useCallback((event: any) => {
    fireEvent({
      ...event,
      tenantId,
      pageId,
      funnelId:        funnelContext?.funnelId ?? null,
      funnelStepOrder: funnelContext?.funnelStepOrder ?? null,
      experimentId:    experimentContext?.experimentId ?? null,
      variantId:       experimentContext?.variantId ?? null,
    });
  }, [tenantId, pageId, funnelContext, experimentContext]);

  // Navigate to next funnel step
  const onFunnelNext = useCallback(() => {
    if (funnelContext?.nextStepUrl) {
      window.location.href = funnelContext.nextStepUrl;
    } else if (funnelContext?.onSuccess?.url) {
      window.location.href = funnelContext.onSuccess.url;
    }
  }, [funnelContext]);

  return (
    <PageRenderer
      tree={tree}
      data={data}
      funnelContext={funnelContext}
      onEvent={onEvent}
      onFunnelNext={onFunnelNext}
    />
  );
}
```

**Step 2: Update storefront page.tsx**

Replace `apps/storefront/app/[[...slug]]/page.tsx` to pass full payload to `ClientAnalytics`:

```typescript
import ClientAnalytics from './ClientAnalytics';

const BACKEND = process.env.BACKEND_URL!;

export default async function StorePage({ params }: { params: { slug?: string[] } }) {
  const slug     = params.slug ?? [];
  const tenantId = process.env.TENANT_ID!;
  const { pageType, pageSlug } = resolvePageType(slug);

  const res = await fetch(`${BACKEND}/api/serve/${tenantId}/${pageType}/${pageSlug}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6B7280' }}>
        <h1 style={{ marginBottom: 8 }}>Page not found</h1>
        <p>This page hasn&apos;t been published yet.</p>
      </div>
    );
  }

  const { tree, pageId, funnelContext, experimentContext } = await res.json();
  const data = {
    store: { name: process.env.TENANT_NAME ?? 'My Store' },
    device: 'desktop',
  };

  return (
    <ClientAnalytics
      tree={tree}
      data={data}
      pageId={pageId}
      tenantId={tenantId}
      funnelContext={funnelContext}
      experimentContext={experimentContext}
    />
  );
}

function resolvePageType(slug: string[]): { pageType: string; pageSlug: string } {
  if (!slug.length)           return { pageType: 'home',    pageSlug: 'index' };
  if (slug[0] === 'products') return { pageType: 'product', pageSlug: slug[1] ?? '' };
  if (slug[0] === 'pages')    return { pageType: 'custom',  pageSlug: slug[1] ?? '' };
  return { pageType: 'custom', pageSlug: slug.join('/') };
}
```

**Step 3: Verify TypeScript in storefront**

```bash
cd apps/storefront && npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Analytics Routes (3 endpoints)

**Files:**
- Create: `apps/canvas-backend/src/routes/analytics.ts`
- Create: `apps/canvas-backend/src/routes/analytics.test.ts`
- Modify: `apps/canvas-backend/src/index.ts` (register router)

**Context:** Three endpoints: per-page KPIs, funnel drop-off, and AI context. All aggregate `ConversionEvent` rows with raw Prisma queries. All filtered by `tenantId`. Tenant middleware is applied (reads `req.tenant`).

**Step 1: Write failing tests**

Create `apps/canvas-backend/src/routes/analytics.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    conversionEvent: {
      findMany:  vi.fn(),
      groupBy:   vi.fn(),
      aggregate: vi.fn(),
      count:     vi.fn(),
    },
    funnelStep: { findMany: vi.fn() },
    funnel:     { findFirst: vi.fn() },
    experiment: { findFirst: vi.fn() },
    $queryRaw:  vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import express from 'express';
import request from 'supertest';
import analyticsRouter from './analytics';

const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => { req.tenant = { id: 'tenant-a' }; next(); });
app.use('/api/analytics', analyticsRouter);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/analytics/pages/:pageId', () => {
  it('returns KPIs for a page with visitors and conversions', async () => {
    // visitors = distinct visitorId count on page_view events
    // conversions = count of conversion events
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 1240 }])   // page_view distinct visitorIds
      .mockResolvedValueOnce([{ conversions: 186, total_value: 18042 }]); // conversions

    const res = await request(app).get('/api/analytics/pages/page-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.visitors).toBe(1240);
    expect(res.body.conversions).toBe(186);
    expect(res.body.conversionRate).toBeCloseTo(15.0, 0);
    expect(res.body.conversionValue).toBe(18042);
  });

  it('returns conversionRate: 0 when no visitors', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 0 }])
      .mockResolvedValueOnce([{ conversions: 0, total_value: 0 }]);

    const res = await request(app).get('/api/analytics/pages/page-1?days=30');
    expect(res.body.conversionRate).toBe(0);
  });
});

describe('GET /api/analytics/funnels/:funnelId', () => {
  it('returns funnel steps with visitor counts and drop-off percentages', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'funnel-1', name: 'Main Funnel',
      steps: [
        { stepOrder: 1, pageId: 'page-1', name: 'Opt-in' },
        { stepOrder: 2, pageId: 'page-2', name: 'Upsell' },
        { stepOrder: 3, pageId: 'page-3', name: 'Thank You' },
      ],
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ page_id: 'page-1', visitors: 1240 }])
      .mockResolvedValueOnce([{ page_id: 'page-2', visitors: 744 }])
      .mockResolvedValueOnce([{ page_id: 'page-3', visitors: 186 }])
      .mockResolvedValueOnce([{ conversions: 186, total_value: 18042 }]);

    const res = await request(app).get('/api/analytics/funnels/funnel-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.steps[0].dropOff).toBe(0);
    expect(res.body.steps[1].dropOff).toBeCloseTo(40.0, 0);
    expect(res.body.totalConversions).toBe(186);
    expect(res.body.totalRevenue).toBe(18042);
  });
});

describe('GET /api/analytics/ai-context/:pageId', () => {
  it('returns stats + recentEvents for AI consumption', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 500 }])
      .mockResolvedValueOnce([{ conversions: 50, total_value: 4850 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([{ id: 'evt-1', eventType: 'page_view' }]);

    const res = await request(app).get('/api/analytics/ai-context/page-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.stats.visitors).toBe(500);
    expect(res.body.recentEvents).toHaveLength(1);
  });
});
```

**Step 2: Run to confirm fail**

```bash
cd apps/canvas-backend && npx vitest run src/routes/analytics.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `src/routes/analytics.ts`**

```typescript
// Analytics API — aggregates ConversionEvent rows for KPI dashboards
// Uses tenantMiddleware — req.tenant is set
import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';

const router = Router();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// GET /api/analytics/pages/:pageId?days=30
router.get('/pages/:pageId', async (req, res) => {
  const tenant  = getTenant(req);
  const pageId  = req.params.pageId;
  const days    = parseInt(req.query.days as string ?? '30', 10);
  const since   = daysAgo(days);

  try {
    const [visitorsResult, conversionsResult] = await Promise.all([
      prisma.$queryRaw<[{ visitors: number }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id = ${tenant.id}
          AND page_id   = ${pageId}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: number; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    res.json({
      visitors,
      conversions,
      conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
      conversionValue: totalValue,
      experimentLift:  null, // Phase 13 MVP — experiment lift deferred
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/funnels/:funnelId?days=30
router.get('/funnels/:funnelId', async (req, res) => {
  const tenant   = getTenant(req);
  const funnelId = req.params.funnelId;
  const days     = parseInt(req.query.days as string ?? '30', 10);
  const since    = daysAgo(days);

  try {
    const funnel = await prisma.funnel.findFirst({
      where:   { id: funnelId, tenantId: tenant.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!funnel) return res.status(404).json({ error: 'Funnel not found' });

    // Get visitor count per step
    const stepCounts = await Promise.all(
      funnel.steps.map(step =>
        prisma.$queryRaw<[{ visitors: number }]>`
          SELECT COUNT(DISTINCT visitor_id) as visitors
          FROM conversion_events
          WHERE tenant_id  = ${tenant.id}
            AND page_id    = ${step.pageId}
            AND event_type = 'page_view'
            AND occurred_at >= ${since}
        `.then(r => ({ pageId: step.pageId, visitors: Number(r[0]?.visitors ?? 0) }))
      )
    );

    const convResult = await prisma.$queryRaw<[{ conversions: number; total_value: number }]>`
      SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
      FROM conversion_events
      WHERE tenant_id  = ${tenant.id}
        AND funnel_id  = ${funnelId}
        AND event_type = 'conversion'
        AND occurred_at >= ${since}
    `;

    const firstStepVisitors = stepCounts[0]?.visitors ?? 0;

    res.json({
      funnelId: funnel.id,
      name:     funnel.name,
      steps: funnel.steps.map((step, i) => {
        const visitors = stepCounts[i]?.visitors ?? 0;
        const prev     = stepCounts[i - 1]?.visitors ?? firstStepVisitors;
        const dropOff  = i === 0 ? 0 : prev > 0 ? Math.round(((prev - visitors) / prev) * 1000) / 10 : 0;
        return { stepOrder: step.stepOrder, pageId: step.pageId, name: step.name, visitors, dropOff };
      }),
      totalConversions: Number(convResult[0]?.conversions ?? 0),
      totalRevenue:     Number(convResult[0]?.total_value  ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/ai-context/:pageId?days=30
router.get('/ai-context/:pageId', async (req, res) => {
  const tenant = getTenant(req);
  const pageId = req.params.pageId;
  const days   = parseInt(req.query.days as string ?? '30', 10);
  const since  = daysAgo(days);

  try {
    const [visitorsResult, conversionsResult, recentEvents] = await Promise.all([
      prisma.$queryRaw<[{ visitors: number }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id = ${tenant.id}
          AND page_id   = ${pageId}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: number; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${tenant.id}
          AND page_id    = ${pageId}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
      prisma.conversionEvent.findMany({
        where:   { tenantId: tenant.id, pageId },
        orderBy: { occurredAt: 'desc' },
        take:    100,
      }),
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    res.json({
      stats: {
        visitors,
        conversions,
        conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
        conversionValue: totalValue,
      },
      recentEvents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Step 4: Register router in `src/index.ts`**

Add after existing route registrations:

```typescript
import analyticsRouter from './routes/analytics';
// ...
app.use('/api/analytics', tenantMiddleware, analyticsRouter);
```

**Step 5: Run tests**

```bash
cd apps/canvas-backend && npx vitest run src/routes/analytics.test.ts
```

Expected: all tests pass.

**Step 6: Run full suite**

```bash
npx vitest run
```

Expected: all tests pass.

---

## Task 6: AnalyticsStrip in Canvas Editor

**Files:**
- Create: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/AnalyticsStrip.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/RightPanel.tsx`

**Context:** A thin strip at the top of the right panel showing last-30-day KPIs for a published page. Only shown when `page.publishedVersionId` is not null. Fetches from `/api/analytics/pages/:pageId`.

**Step 1: Create AnalyticsStrip.tsx**

```typescript
'use client';
import { useEffect, useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

interface Stats {
  visitors: number;
  conversions: number;
  conversionRate: number;
  conversionValue: number;
}

interface AnalyticsStripProps {
  pageId: string;
  tenantId: string;
  isPublished: boolean;
}

export default function AnalyticsStrip({ pageId, tenantId, isPublished }: AnalyticsStripProps) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!isPublished) return;
    fetch(`${BACKEND}/api/analytics/pages/${pageId}?days=30`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, [pageId, tenantId, isPublished]);

  if (!isPublished || !stats) return null;

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  const fmtMoney = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="analytics-strip">
      <div className="analytics-strip-stats">
        <span title="Unique visitors (30d)">👁 {fmt(stats.visitors)}</span>
        <span title="Conversion rate (30d)">⚡ {stats.conversionRate}%</span>
        <span title="Total revenue (30d)">💰 {fmtMoney(stats.conversionValue)}</span>
      </div>
      <a
        href={`/analytics/${pageId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="analytics-strip-link"
      >
        View Full Analytics →
      </a>
    </div>
  );
}
```

**Step 2: Add CSS to globals.css**

In `apps/canvas-dashboard/src/app/globals.css`, add:

```css
/* Analytics Strip */
.analytics-strip {
  background: #12141f;
  border: 1px solid #1e2130;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.analytics-strip-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9CA3AF;
}
.analytics-strip-stats span {
  white-space: nowrap;
}
.analytics-strip-link {
  font-size: 11px;
  color: #7C3AED;
  text-decoration: none;
}
.analytics-strip-link:hover { text-decoration: underline; }
```

**Step 3: Update RightPanel.tsx**

Add `AnalyticsStrip` at the top of the panel, above the node properties. The panel already receives `node` and `tenantId`. Pass a new `pagePublishedVersionId` prop:

```typescript
import AnalyticsStrip from './AnalyticsStrip';

interface RightPanelProps {
  node: any;
  conn: any;
  tenantId: string;
  pageId: string;             // NEW
  isPublished: boolean;       // NEW — true if page.publishedVersionId !== null
}

export default function RightPanel({ node, conn, tenantId, pageId, isPublished }: RightPanelProps) {
  // ... existing code ...
  return (
    <div className="panel-right">
      <AnalyticsStrip pageId={pageId} tenantId={tenantId} isPublished={isPublished} />
      {/* rest of existing panel */}
    </div>
  );
}
```

**Step 4: Update CanvasPage.tsx to pass new props to RightPanel**

In `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx`, find where `<RightPanel>` is rendered and add `pageId={pageId}` and `isPublished={!!page?.publishedVersionId}`. The `page` data is available from the page server component props.

**Step 5: Verify TypeScript**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: Analytics Dashboard Pages

**Files:**
- Create: `apps/canvas-dashboard/src/app/analytics/[pageId]/page.tsx`
- Create: `apps/canvas-dashboard/src/app/analytics/[pageId]/components/KpiCards.tsx`
- Create: `apps/canvas-dashboard/src/app/analytics/[pageId]/components/FunnelChart.tsx`
- Create: `apps/canvas-dashboard/src/app/analytics/[pageId]/components/ExperimentResults.tsx`
- Create: `apps/canvas-dashboard/src/app/analytics/[pageId]/components/AiSuggestions.tsx`
- Create: `apps/canvas-dashboard/src/app/analytics/funnels/[funnelId]/page.tsx`

**Context:** Server Components that fetch analytics data and render KPI cards, funnel drop-off visualization, and AI suggestions panel.

**Step 1: Create `/analytics/[pageId]/page.tsx` (Server Component)**

```typescript
import KpiCards       from './components/KpiCards';
import FunnelChart    from './components/FunnelChart';
import AiSuggestions  from './components/AiSuggestions';

const BACKEND  = process.env.BACKEND_URL!;
const TENANT   = process.env.TENANT_ID!;

export default async function PageAnalytics({ params }: { params: { pageId: string } }) {
  const pageId = params.pageId;
  const headers = { 'x-tenant-id': TENANT };

  const [statsRes, funnelRes] = await Promise.all([
    fetch(`${BACKEND}/api/analytics/pages/${pageId}?days=30`, { headers }),
    fetch(`${BACKEND}/api/analytics/pages/${pageId}/funnel?days=30`, { headers }).catch(() => null),
  ]);

  const stats  = statsRes.ok  ? await statsRes.json()  : null;
  const funnel = funnelRes?.ok ? await funnelRes.json() : null;

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#F9FAFB' }}>
        Page Analytics
      </h1>

      {stats && <KpiCards stats={stats} />}

      {funnel && <FunnelChart funnel={funnel} />}

      <AiSuggestions pageId={pageId} tenantId={TENANT} />
    </div>
  );
}
```

**Step 2: Create KpiCards.tsx**

```typescript
export default function KpiCards({ stats }: { stats: any }) {
  const cards = [
    { label: 'Visitors',         value: stats.visitors.toLocaleString(),               sub: 'last 30 days' },
    { label: 'Conversions',      value: stats.conversions.toLocaleString(),             sub: 'completed goals' },
    { label: 'Conversion Rate',  value: `${stats.conversionRate}%`,                    sub: 'visitors → goal' },
    { label: 'Revenue',          value: `$${stats.conversionValue.toLocaleString()}`,  sub: 'total attributed' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: '#12141f', border: '1px solid #1e2130', borderRadius: 8, padding: '20px 24px' }}>
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{c.label}</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#F9FAFB', marginBottom: 2 }}>{c.value}</p>
          <p style={{ fontSize: 11, color: '#4B5563' }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create FunnelChart.tsx**

Renders a horizontal funnel visualization with drop-off percentage between each step:

```typescript
export default function FunnelChart({ funnel }: { funnel: any }) {
  if (!funnel?.steps?.length) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB', marginBottom: 16 }}>
        Funnel: {funnel.name}
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {funnel.steps.map((step: any, i: number) => (
          <div key={step.pageId} style={{ display: 'flex', alignItems: 'center' }}>
            {/* Step box */}
            <div style={{ background: '#12141f', border: '1px solid #1e2130', borderRadius: 8, padding: '16px 20px', minWidth: 140, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Step {step.stepOrder}</p>
              <p style={{ fontSize: 13, color: '#F9FAFB', marginBottom: 4, fontWeight: 600 }}>{step.name ?? `Step ${step.stepOrder}`}</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#a78bfa' }}>{step.visitors.toLocaleString()}</p>
              <p style={{ fontSize: 10, color: '#6B7280' }}>visitors</p>
            </div>
            {/* Drop-off arrow */}
            {i < funnel.steps.length - 1 && (
              <div style={{ textAlign: 'center', padding: '0 8px' }}>
                <p style={{ fontSize: 10, color: '#EF4444', marginBottom: 4 }}>↓ {step.dropOff}% left</p>
                <p style={{ fontSize: 18, color: '#4B5563' }}>→</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 24 }}>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Total conversions: <strong style={{ color: '#F9FAFB' }}>{funnel.totalConversions.toLocaleString()}</strong></span>
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Total revenue: <strong style={{ color: '#34D399' }}>${funnel.totalRevenue.toLocaleString()}</strong></span>
      </div>
    </div>
  );
}
```

**Step 4: Create AiSuggestions.tsx (client component)**

```typescript
'use client';
import { useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export default function AiSuggestions({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const [loading, setLoading]   = useState(false);
  const [response, setResponse] = useState('');

  const askAI = async () => {
    setLoading(true);
    setResponse('');
    const res = await fetch(`${BACKEND}/api/ai/canvas`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body:    JSON.stringify({
        message: `Analyze page ${pageId}. First call get_page_analytics and get_canvas_screenshot to understand performance. Then give me your top 1-2 improvement suggestions with specific changes. Ask permission before applying anything.`,
        tenantId,
      }),
    });

    const reader   = res.body?.getReader();
    const decoder  = new TextDecoder();
    if (!reader) return;
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) setResponse(prev => prev + decoder.decode(value));
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F9FAFB', marginBottom: 12 }}>
        AI Suggestions
      </h2>
      {!response && (
        <button
          onClick={askAI}
          disabled={loading}
          style={{ background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 20px', cursor: loading ? 'wait' : 'pointer', fontSize: 13 }}
        >
          {loading ? 'Analyzing...' : 'Analyze this page with AI'}
        </button>
      )}
      {response && (
        <div style={{ background: '#12141f', border: '1px solid #7C3AED', borderRadius: 8, padding: 20, fontSize: 13, color: '#D1D5DB', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {response}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create `/analytics/funnels/[funnelId]/page.tsx`**

Similar structure to page analytics but using funnel endpoint:

```typescript
import FunnelChart from '../../[pageId]/components/FunnelChart';

const BACKEND = process.env.BACKEND_URL!;
const TENANT  = process.env.TENANT_ID!;

export default async function FunnelAnalytics({ params }: { params: { funnelId: string } }) {
  const res = await fetch(
    `${BACKEND}/api/analytics/funnels/${params.funnelId}?days=30`,
    { headers: { 'x-tenant-id': TENANT } }
  );
  if (!res.ok) return <div style={{ padding: 40, color: '#6B7280' }}>Funnel not found.</div>;

  const funnel = await res.json();
  return (
    <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24, color: '#F9FAFB' }}>
        Funnel Analytics: {funnel.name}
      </h1>
      <FunnelChart funnel={funnel} />
    </div>
  );
}
```

**Step 6: Verify TypeScript**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit
```

Expected: no errors.

---

## Task 8: get_page_analytics AI Tool + Wire

**Files:**
- Create: `apps/canvas-backend/src/mastra/tools/get-page-analytics.ts`
- Create: `apps/canvas-backend/src/mastra/tools/analytics-tool.test.ts`
- Modify: `apps/canvas-backend/src/mastra/tools/index.ts`
- Modify: `apps/canvas-backend/src/mastra/agents/canvas-agent.ts`
- Modify: `apps/canvas-backend/src/mastra/mcp/server.ts`

**Context:** The AI agent needs to read page analytics before suggesting changes. This tool calls the existing `/api/analytics/ai-context/:pageId` endpoint.

**Step 1: Write failing test**

Create `apps/canvas-backend/src/mastra/tools/analytics-tool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw:       vi.fn(),
    conversionEvent: { findMany: vi.fn() },
  },
}));

vi.mock('../../db', () => ({ prisma: prismaMock }));

import { getPageAnalyticsTool } from './get-page-analytics';

beforeEach(() => vi.clearAllMocks());

describe('get_page_analytics', () => {
  it('returns stats and recent events for a page', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 500 }])
      .mockResolvedValueOnce([{ conversions: 50, total_value: 4850 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([
      { id: 'e1', eventType: 'page_view', occurredAt: new Date() },
    ]);

    const result = await getPageAnalyticsTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      days:      30,
    } as any);

    expect(result.stats.visitors).toBe(500);
    expect(result.stats.conversions).toBe(50);
    expect(result.stats.conversionRate).toBeCloseTo(10.0, 0);
    expect(result.recentEvents).toHaveLength(1);
  });

  it('returns conversionRate 0 when no visitors', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 0 }])
      .mockResolvedValueOnce([{ conversions: 0, total_value: 0 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([]);

    const result = await getPageAnalyticsTool.execute({ tenant_id: 'tenant-a', page_id: 'page-1', days: 30 } as any);
    expect(result.stats.conversionRate).toBe(0);
  });
});
```

**Step 2: Run to confirm fail**

```bash
cd apps/canvas-backend && npx vitest run src/mastra/tools/analytics-tool.test.ts
```

**Step 3: Implement `get-page-analytics.ts`**

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

function daysAgo(days: number): Date {
  const d = new Date(); d.setDate(d.getDate() - days); return d;
}

export const getPageAnalyticsTool = createTool({
  id: 'get_page_analytics',
  description: 'Get analytics data for a page — visitors, conversion rate, revenue, and recent events. Always call this before making design suggestions.',
  inputSchema: z.object({
    tenant_id: z.string().describe('Tenant ID — required for isolation'),
    page_id:   z.string().describe('Page ID to get analytics for'),
    days:      z.number().optional().default(30).describe('Lookback window in days (default 30)'),
  }),
  outputSchema: z.object({
    stats:        z.object({
      visitors:        z.number(),
      conversions:     z.number(),
      conversionRate:  z.number(),
      conversionValue: z.number(),
    }),
    recentEvents: z.array(z.any()),
  }),
  execute: async (context) => {
    const { tenant_id, page_id, days = 30 } = context as any;
    const since = daysAgo(days);

    const [visitorsResult, conversionsResult, recentEvents] = await Promise.all([
      prisma.$queryRaw<[{ visitors: number }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id  = ${tenant_id}
          AND page_id    = ${page_id}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: number; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${tenant_id}
          AND page_id    = ${page_id}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
      prisma.conversionEvent.findMany({
        where:   { tenantId: tenant_id, pageId: page_id },
        orderBy: { occurredAt: 'desc' },
        take:    100,
      }),
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    return {
      stats: {
        visitors,
        conversions,
        conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
        conversionValue: totalValue,
      },
      recentEvents,
    };
  },
});
```

**Step 4: Export from index.ts**

Add to `apps/canvas-backend/src/mastra/tools/index.ts`:
```typescript
export { getPageAnalyticsTool } from './get-page-analytics';
```

**Step 5: Wire into agent and MCP**

In `canvas-agent.ts`, add to `tools` object:
```typescript
getPageAnalytics: tools.getPageAnalyticsTool,
```

Update instructions — add after the VISUAL INSPECTION section:
```
ANALYTICS-DRIVEN SUGGESTIONS:
- ALWAYS call get_page_analytics + get_canvas_screenshot BEFORE suggesting any change
- Low-risk changes (copy, color): propose directly, ask "Apply directly? [Yes/No]"
- Structural changes (layout, new sections): propose as A/B test, ask "Create A/B test? [Yes/No]"
- NEVER apply anything without explicit user permission
- Log every applied change: include before/after stats in your response
```

In `mcp/server.ts`, add:
```typescript
getPageAnalytics: tools.getPageAnalyticsTool,
```

**Step 6: Run full test suite**

```bash
cd apps/canvas-backend && npx vitest run
```

Expected: all tests pass (157+ total).

**Step 7: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Verification: Full Funnel Flow

After all tasks complete, verify the end-to-end flow manually:

1. Create 3 pages: `opt-in` (pageType: funnel_step), `upsell` (funnel_step), `thank-you` (funnel_step)
2. Add CTA buttons with `action: { type: "nextFunnelStep" }` on opt-in and upsell pages
3. Create funnel: steps = [opt-in → upsell → thank-you]
4. Publish all 3 pages
5. Open storefront: `localhost:3003/opt-in` — click CTA → lands on `/upsell` → click CTA → lands on `/thank-you`
6. Check `conversion_events` table: should have `page_view` events for all 3 steps with same `visitorId` and `funnelId`
7. Open `localhost:3002/analytics/[opt-in pageId]` — see visitors and CVR
8. Run AI analysis — agent calls `get_page_analytics` + `get_canvas_screenshot`, returns suggestions
