# Canvas V3 Phase 5 — AI Agent (Mastra Wiring)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire the existing `AgentChat.tsx` UI to the Mastra backend agent instead of OpenRouter. AI edits appear live on canvas via Phase 4's real-time merge path. Add an AI status bar showing live operation progress.

**Architecture:** Replace `/api/funnel-agent/route.ts` with a thin proxy to `canvas-backend /api/agent/stream`. `AgentChat.tsx` UI stays unchanged. Mastra agent calls STDB reducers → Phase 4 merge propagates changes to canvas. `AIStatusBar` reads `ai_operation` STDB table.

**Tech Stack:** Next.js route handlers, SSE streaming, canvas-backend Mastra agent, SpacetimeDB `ai_operation` table

---

## Context

- `AgentChat.tsx` at `apps/canvas-v2/src/components/AgentChat.tsx` — full floating chat UI, already built
- Current API route: `apps/canvas-v2/src/app/api/funnel-agent/route.ts` — calls OpenRouter directly
- Replacement: proxy to `canvas-backend /api/agent/stream` (POST, SSE response)
- `canvas-backend` already has Mastra agent with 16 tools at `apps/canvas-backend/src/routes/ai.ts` or similar
- The streaming format from `canvas-backend` uses Vercel AI SDK SSE format — same as what AgentChat already parses
- `ai_operation` STDB table fields (camelCase): `id`, `pageId`, `tenantId`, `status`, `message`, `progress` (0–100), `createdAt`, `updatedAt`
- `AgentChat` sends: `POST /api/funnel-agent` with body `{ messages: [...], pageId?, tenantId? }`

**IMPORTANT — Read before implementing:**
- `apps/canvas-v2/src/app/api/funnel-agent/route.ts` — current implementation to understand input/output format
- `apps/canvas-v2/src/components/AgentChat.tsx` — how it calls the API and what format it expects
- `apps/canvas-backend/src/routes/ai.ts` (or wherever `/api/agent/stream` is) — what request body it expects

---

## Task 1: Read current funnel-agent route and AgentChat to understand formats

**Files to read:**
- `apps/canvas-v2/src/app/api/funnel-agent/route.ts`
- `apps/canvas-v2/src/components/AgentChat.tsx` (key section: how it calls the API)
- `apps/canvas-v2/src/hooks/useFunnelAgentMCP.ts` or similar hook

**Goal:** Understand:
1. What request body does AgentChat send to `/api/funnel-agent`?
2. What SSE format does it expect in the response?
3. What request body does `canvas-backend /api/agent/stream` expect?

This is a research task — no code changes. The findings inform Tasks 2 and 3.

---

## Task 2: Replace /api/funnel-agent route with Mastra proxy

**Files:**
- Modify: `src/app/api/funnel-agent/route.ts`

**Step 1: Understand the existing route**

The existing route streams from OpenRouter. We replace the body with a proxy to canvas-backend.

**Step 2: Rewrite the route**

```typescript
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tenantId = req.headers.get("x-tenant-id") ?? body.tenantId ?? "store_001";

  // Proxy to canvas-backend Mastra agent
  const upstream = await fetch(`${BACKEND_URL}/api/agent/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": tenantId,
    },
    body: JSON.stringify({
      messages: body.messages ?? [],
      pageId: body.pageId,
      tenantId,
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    return new Response(JSON.stringify({ error: err }), {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Pass SSE stream through directly
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
```

**Step 3: Check canvas-backend /api/agent/stream route**

Read `apps/canvas-backend/src/routes/ai.ts` or wherever the agent stream endpoint lives. Make sure:
- It accepts `{ messages, pageId, tenantId }`
- It streams SSE in Vercel AI SDK format (or the same format AgentChat expects)
- It has the 16 Mastra tools available

If the request body format differs from what we're sending, adjust the proxy body in Step 2.

**Step 4: Test basic connectivity**
```bash
curl -X POST http://localhost:3005/api/funnel-agent \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What elements are on this page?"}],"pageId":"test","tenantId":"store_001"}'
# Should see SSE stream lines starting with data: {...}
```

**Step 5: Commit**
```bash
git add apps/canvas-v2/src/app/api/funnel-agent/route.ts
git commit -m "feat(canvas-v2): proxy AI agent to Mastra backend instead of OpenRouter"
```

---

## Task 3: Pass pageId and tenantId to AgentChat

**Files:**
- Modify: `src/components/AgentChat.tsx`
- Modify: `src/components/FunnelBuilder.tsx`

**Step 1: Read AgentChat.tsx to understand its props**

Look for the component's props interface. It likely takes no `pageId`/`tenantId` props currently.

**Step 2: Add pageId and tenantId props to AgentChat**

```typescript
interface AgentChatProps {
  pageId?: string;
  tenantId?: string;
  // ... existing props
}
```

**Step 3: Pass pageId/tenantId in the API call inside AgentChat**

Find where AgentChat calls `POST /api/funnel-agent`. Add `pageId` and `tenantId` to the request body:

```typescript
const res = await fetch("/api/funnel-agent", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-tenant-id": tenantId ?? "store_001",
  },
  body: JSON.stringify({
    messages,
    pageId,
    tenantId,
    // ... other existing fields
  }),
});
```

**Step 4: Pass props from FunnelBuilder to AgentChat**

In `FunnelBuilder.tsx`, find where `<AgentChat />` is rendered and add:
```tsx
<AgentChat pageId={pageId} tenantId={tenantId} />
```

(`FunnelBuilder` already receives `pageId` and `tenantId` as props from Phase 1.)

**Step 5: Verify in browser**
- Open editor at `http://localhost:3005/editor/[pageId]`
- Click the purple "AI Agent" button (bottom-right) to open the chat
- Type "What is on this page?" and press Enter
- Should see streaming response from Mastra agent
- Type "Add a blue headline that says Hello World" and press Enter
- Should see the element appear on the canvas within ~2-3 seconds (via Phase 4 real-time merge)

**Step 6: Commit**
```bash
git add apps/canvas-v2/src/components/AgentChat.tsx apps/canvas-v2/src/components/FunnelBuilder.tsx
git commit -m "feat(canvas-v2): pass pageId/tenantId to AgentChat for Mastra agent context"
```

---

## Task 4: Add AI Status Bar

**Files:**
- Create: `src/components/AIStatusBar.tsx`
- Modify: `src/components/EditorLayout.tsx`

**Step 1: Create `src/components/AIStatusBar.tsx`**

```tsx
"use client";
import { useTable } from "spacetimedb/react";
import { tables } from "../module_bindings";
import { useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

interface Props {
  pageId: string;
  tenantId: string;
}

export function AIStatusBar({ pageId, tenantId }: Props) {
  const [allOps] = useTable(tables.ai_operation);

  // Get the latest active (non-completed, non-failed) op for this page
  const activeOp = useMemo(() => {
    const pageOps = allOps.filter(
      (op) =>
        op.pageId === pageId &&
        op.tenantId === tenantId &&
        op.status !== "completed" &&
        op.status !== "failed"
    );
    // Sort by createdAt descending, take the latest
    return pageOps.sort((a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    )[0] ?? null;
  }, [allOps, pageId, tenantId]);

  // Also show recently completed/failed ops briefly
  const recentFinished = useMemo(() => {
    const now = Date.now();
    return allOps.find(
      (op) =>
        op.pageId === pageId &&
        op.tenantId === tenantId &&
        (op.status === "completed" || op.status === "failed") &&
        new Date(op.updatedAt ?? 0).getTime() > now - 5000 // within last 5s
    ) ?? null;
  }, [allOps, pageId, tenantId]);

  const op = activeOp ?? recentFinished;
  if (!op) return null;

  const isActive = op.status !== "completed" && op.status !== "failed";
  const isComplete = op.status === "completed";
  const isFailed = op.status === "failed";

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 text-sm border-t transition-all ${
        isActive
          ? "bg-blue-50 border-blue-200 text-blue-700"
          : isComplete
          ? "bg-green-50 border-green-200 text-green-700"
          : "bg-red-50 border-red-200 text-red-700"
      }`}
    >
      {isActive && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
      {isComplete && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
      {isFailed && <XCircle className="w-4 h-4 flex-shrink-0" />}
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
      <span className="flex-1 truncate">{op.message ?? "AI is working..."}</span>
      {isActive && typeof op.progress === "number" && op.progress > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${op.progress}%` }}
            />
          </div>
          <span className="text-xs font-mono tabular-nums">{op.progress}%</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add AIStatusBar to EditorLayout.tsx**

Read `EditorLayout.tsx` to find the bottom of the editor layout (below the canvas area).

Add the import:
```typescript
import { AIStatusBar } from "./AIStatusBar";
```

Add the component below the canvas area:
```tsx
{pageId && tenantId && (
  <AIStatusBar pageId={pageId} tenantId={tenantId} />
)}
```

Make sure `EditorLayout` receives `pageId` and `tenantId` as props. If it doesn't, add them:
- Add to `EditorLayoutProps` interface
- Pass from `FunnelBuilder.tsx`

**Step 3: Verify**
- Open editor at `http://localhost:3005/editor/[pageId]`
- Use AgentChat to ask AI to "add a red button"
- While AI is working, should see blue status bar at the bottom of canvas with progress
- After completion, bar turns green briefly then disappears

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/components/AIStatusBar.tsx apps/canvas-v2/src/components/EditorLayout.tsx
git commit -m "feat(canvas-v2): add AI status bar reading from STDB ai_operation table"
```
