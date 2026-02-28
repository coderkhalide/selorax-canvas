# Canvas V3 Phase 1 — Foundation (SpacetimeDB Wiring) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect canvas-v2 to SpacetimeDB so `/editor/[pageId]` loads live canvas_node data from the backend, edits persist, and real-time collaboration works.

**Architecture:** Keep FunnelContext (V2 nested tree) as the live state. On page load, convert flat STDB canvas_nodes → FunnelElement tree → setElements. On every context mutation, debounce 100ms then diff prev/next trees → call STDB reducers. Remote changes from STDB subscriptions merge into context for nodes not currently being edited locally.

**Tech Stack:** spacetimedb v2.0.1, Next.js 16 App Router, FunnelContext (V2), yarn (canvas-v2 uses yarn not npm)

---

## Pre-Flight: Read These First

Before starting, read:
- `apps/canvas-v2/src/context/FunnelContext.tsx` — understand all exports: `FunnelProvider`, `useFunnel`, full context type
- `apps/canvas-dashboard/src/module_bindings/index.ts` — the generated CanvasNode type shape
- `apps/canvas-dashboard/src/utils/tree.ts` — how flat → tree conversion is done there (reference)
- `apps/canvas-dashboard/CLAUDE.md` — critical SpacetimeDB patterns (raw SQL, camelCase fields)

---

## Task 1: Install spacetimedb + Generate Bindings for canvas-v2

**Files:**
- Modify: `apps/canvas-v2/package.json`
- Modify: `Makefile`
- Create: `apps/canvas-v2/src/module_bindings/` (auto-generated)

### Step 1: Add spacetimedb to canvas-v2

```bash
cd apps/canvas-v2 && yarn add spacetimedb@^2.0.1
```

Expected: `spacetimedb@2.0.1` appears in `node_modules/`.

### Step 2: Update Makefile to include canvas-v2 in stdb-generate

Open `Makefile`. Find the `stdb-generate` target. Add canvas-v2:

```makefile
stdb-generate:
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/canvas-backend/src/module_bindings --module-path $(CURDIR)/spacetime
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/canvas-dashboard/src/module_bindings --module-path $(CURDIR)/spacetime
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/preview-server/src/module_bindings --module-path $(CURDIR)/spacetime
	spacetime generate --lang typescript --out-dir $(CURDIR)/apps/canvas-v2/src/module_bindings --module-path $(CURDIR)/spacetime
	@echo "✓ Bindings generated for backend, dashboard, preview-server, canvas-v2"
```

### Step 3: Generate bindings

```bash
make stdb-generate
```

Expected output: `✓ Bindings generated for backend, dashboard, preview-server, canvas-v2`

Verify:
```bash
ls apps/canvas-v2/src/module_bindings/
```
Expected: `index.ts`, `canvas_node_type.ts`, and other generated files matching what's in `apps/canvas-dashboard/src/module_bindings/`.

### Step 4: Add module_bindings to canvas-v2's .gitignore

Open `apps/canvas-v2/.gitignore` and add:
```
src/module_bindings/
```

### Step 5: Commit

```bash
git add Makefile apps/canvas-v2/package.json apps/canvas-v2/.gitignore
git commit -m "feat(canvas-v2): install spacetimedb and add to stdb-generate target"
```

---

## Task 2: Environment Variables + Middleware

**Files:**
- Create: `apps/canvas-v2/.env.local`
- Modify: `apps/canvas-v2/src/middleware.ts`

### Step 1: Create .env.local for canvas-v2

```bash
cat apps/canvas-dashboard/.env.local
```

Copy the STDB vars. Create `apps/canvas-v2/.env.local`:

```env
NEXT_PUBLIC_SPACETIMEDB_URL=wss://maincloud.spacetimedb.com
NEXT_PUBLIC_SPACETIMEDB_DB=selorax-canvas
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Step 2: Update middleware.ts to inject x-tenant-id header

The current middleware only handles root `/`. Extend it to inject `x-tenant-id` on all `/editor/*` routes in MVP mode (hardcoded tenant for local dev, matching canvas-dashboard's pattern):

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Inject tenant header for canvas editor routes (MVP mode)
  if (url.pathname.startsWith("/editor")) {
    const tenantId = process.env.TENANT_ID ?? "store_001";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-id", tenantId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Only run cookie logic on root path
  if (url.pathname === "/") {
    const storeId = url.searchParams.get("store_id");
    const accessToken = url.searchParams.get("access_token");
    const domain = url.searchParams.get("domain");
    const slug = url.searchParams.get("slug");

    if (storeId || accessToken || domain || slug) {
      const response = NextResponse.redirect(new URL("/editor", request.url));
      if (storeId) response.cookies.set("store_id", storeId);
      if (accessToken) response.cookies.set("access_token", accessToken);
      if (domain) response.cookies.set("domain", domain);
      if (slug) response.cookies.set("slug", slug);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/editor/:path*"],
};
```

Also add `TENANT_ID=store_001` to `.env.local`.

### Step 3: Commit

```bash
git add apps/canvas-v2/.env.local apps/canvas-v2/src/middleware.ts
git commit -m "feat(canvas-v2): add env vars and tenant-id middleware"
```

---

## Task 3: Create nodeConverter.ts

**Files:**
- Create: `apps/canvas-v2/src/lib/nodeConverter.ts`

This is the heart of the integration — bidirectional conversion between FunnelElement (V2 tree) and CanvasNode (STDB flat).

### Step 1: Read the generated CanvasNode type

```bash
cat apps/canvas-v2/src/module_bindings/canvas_node_type.ts
```

Note the exact field names (they're camelCase): `id`, `pageId`, `tenantId`, `parentId`, `nodeType`, `order`, `styles`, `props`, `settings`, `lockedBy`, `componentUrl`, `componentVersion`, `componentId`.

### Step 2: Create the converter

Create `apps/canvas-v2/src/lib/nodeConverter.ts`:

```typescript
import type { FunnelElement, ElementType } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Type helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Shape matching the generated CanvasNode from module_bindings */
export interface RawCanvasNode {
  id: string;
  pageId: string;
  tenantId: string;
  parentId: string | null | undefined;
  nodeType: string;
  order: string;
  styles: string;   // JSON string
  props: string;    // JSON string
  settings: string; // JSON string
  lockedBy?: string | null;
  componentUrl?: string | null;
}

export type StdbOpType = "insert" | "update_styles" | "update_props" | "update_settings" | "move" | "delete";

export interface StdbOp {
  type: StdbOpType;
  nodeId: string;
  // insert-specific
  node?: Omit<RawCanvasNode, "lockedBy">;
  // update-specific
  styles?: string;
  props?: string;
  settings?: string;
  // move-specific
  newParentId?: string | null;
  newOrder?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ElementType → nodeType mapping
// ─────────────────────────────────────────────────────────────────────────────

const LAYOUT_TYPES: ElementType[] = ["section", "row", "col", "wrapper"];
const COMPONENT_TYPES: ElementType[] = ["custom"];

function toNodeType(type: ElementType): "layout" | "element" | "component" {
  if (LAYOUT_TYPES.includes(type)) return "layout";
  if (COMPONENT_TYPES.includes(type)) return "component";
  return "element";
}

function toElementType(nodeType: string, props: Record<string, unknown>): ElementType {
  if (nodeType === "layout") {
    const tag = props.tag as string | undefined;
    if (tag === "section" || tag === "row" || tag === "col" || tag === "wrapper") return tag;
    return "section";
  }
  if (nodeType === "component") return "custom";
  const tag = props.tag as string | undefined;
  const validTags: ElementType[] = ["headline", "paragraph", "button", "image", "video", "input", "icon", "user-checkout"];
  if (tag && validTags.includes(tag as ElementType)) return tag as ElementType;
  return "paragraph";
}

// ─────────────────────────────────────────────────────────────────────────────
// Flat → Tree
// ─────────────────────────────────────────────────────────────────────────────

export function flatNodesToTree(flatNodes: RawCanvasNode[]): FunnelElement[] {
  const nodeMap = new Map<string, FunnelElement & { _order: string; _parentId: string | null }>();

  for (const raw of flatNodes) {
    let stylesObj: Record<string, unknown> = {};
    let propsObj: Record<string, unknown> = {};
    let settingsObj: Record<string, unknown> = {};
    try { stylesObj = JSON.parse(raw.styles || "{}"); } catch {}
    try { propsObj = JSON.parse(raw.props || "{}"); } catch {}
    try { settingsObj = JSON.parse(raw.settings || "{}"); } catch {}

    const elementType = toElementType(raw.nodeType, propsObj);

    const el: FunnelElement & { _order: string; _parentId: string | null } = {
      id: raw.id,
      type: elementType,
      name: (propsObj.label as string) ?? elementType,
      content: propsObj.content as string | undefined,
      src: propsObj.src as string | undefined,
      placeholder: propsObj.placeholder as string | undefined,
      style: stylesObj as React.CSSProperties,
      tabletStyle: (settingsObj.breakpoints as any)?.md as React.CSSProperties | undefined,
      mobileStyle: (settingsObj.breakpoints as any)?.sm as React.CSSProperties | undefined,
      className: settingsObj.className as string | undefined,
      customType: settingsObj.customType as string | undefined,
      data: settingsObj.data as Record<string, unknown> | undefined,
      schemeId: settingsObj.schemeId as string | undefined,
      children: [],
      _order: raw.order,
      _parentId: raw.parentId ?? null,
    };
    nodeMap.set(raw.id, el);
  }

  // Build tree
  const roots: Array<FunnelElement & { _order: string; _parentId: string | null }> = [];

  for (const el of nodeMap.values()) {
    if (!el._parentId) {
      roots.push(el);
    } else {
      const parent = nodeMap.get(el._parentId);
      if (parent) {
        parent.children = parent.children ?? [];
        parent.children.push(el);
      } else {
        // Orphan — treat as root
        roots.push(el);
      }
    }
  }

  // Sort by order at every level
  function sortChildren(elements: FunnelElement[]): FunnelElement[] {
    return elements
      .map((el: any) => ({
        ...el,
        _order: undefined,
        _parentId: undefined,
        children: el.children?.length ? sortChildren(el.children) : undefined,
      }))
      .sort((a: any, b: any) => {
        const ao = (a as any)._order ?? "";
        const bo = (b as any)._order ?? "";
        return ao.localeCompare(bo);
      });
  }

  return sortChildren(roots as FunnelElement[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tree → Flat map (for diffing)
// ─────────────────────────────────────────────────────────────────────────────

interface FlatEntry {
  el: FunnelElement;
  parentId: string | null;
  order: string;         // zero-padded sibling index: "000000", "000001", …
  styles: string;
  props: string;
  settings: string;
  nodeType: "layout" | "element" | "component";
}

export function flattenElements(
  elements: FunnelElement[],
  parentId: string | null = null
): Map<string, FlatEntry> {
  const result = new Map<string, FlatEntry>();

  elements.forEach((el, idx) => {
    const order = String(idx).padStart(6, "0");
    const nodeType = toNodeType(el.type);

    const propsObj: Record<string, unknown> = {
      tag: el.type,
      label: el.name,
    };
    if (el.content !== undefined) propsObj.content = el.content;
    if (el.src !== undefined) propsObj.src = el.src;
    if (el.placeholder !== undefined) propsObj.placeholder = el.placeholder;

    const settingsObj: Record<string, unknown> = {};
    if (el.className) settingsObj.className = el.className;
    if (el.customType) settingsObj.customType = el.customType;
    if (el.data) settingsObj.data = el.data;
    if (el.schemeId) settingsObj.schemeId = el.schemeId;
    if (el.tabletStyle || el.mobileStyle) {
      settingsObj.breakpoints = {
        ...(el.tabletStyle ? { md: el.tabletStyle } : {}),
        ...(el.mobileStyle ? { sm: el.mobileStyle } : {}),
      };
    }

    result.set(el.id, {
      el,
      parentId,
      order,
      styles: JSON.stringify(el.style ?? {}),
      props: JSON.stringify(propsObj),
      settings: JSON.stringify(settingsObj),
      nodeType,
    });

    if (el.children?.length) {
      const childMap = flattenElements(el.children, el.id);
      for (const [id, entry] of childMap) {
        result.set(id, entry);
      }
    }
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Diff: prev tree vs next tree → STDB ops
// ─────────────────────────────────────────────────────────────────────────────

export function computeOps(
  prev: FunnelElement[],
  next: FunnelElement[],
  pageId: string,
  tenantId: string
): StdbOp[] {
  const prevMap = flattenElements(prev);
  const nextMap = flattenElements(next);
  const ops: StdbOp[] = [];

  // Inserts: in next but not prev
  for (const [id, entry] of nextMap) {
    if (!prevMap.has(id)) {
      ops.push({
        type: "insert",
        nodeId: id,
        node: {
          id,
          pageId,
          tenantId,
          parentId: entry.parentId,
          nodeType: entry.nodeType,
          order: entry.order,
          styles: entry.styles,
          props: entry.props,
          settings: entry.settings,
          componentUrl: (entry.el as any).componentUrl ?? null,
          componentVersion: null,
          componentId: null,
        },
      });
    }
  }

  // Updates and moves: in both
  for (const [id, nextEntry] of nextMap) {
    const prevEntry = prevMap.get(id);
    if (!prevEntry) continue;

    if (prevEntry.styles !== nextEntry.styles) {
      ops.push({ type: "update_styles", nodeId: id, styles: nextEntry.styles });
    }
    if (prevEntry.props !== nextEntry.props) {
      ops.push({ type: "update_props", nodeId: id, props: nextEntry.props });
    }
    if (prevEntry.settings !== nextEntry.settings) {
      ops.push({ type: "update_settings", nodeId: id, settings: nextEntry.settings });
    }
    if (prevEntry.parentId !== nextEntry.parentId || prevEntry.order !== nextEntry.order) {
      ops.push({
        type: "move",
        nodeId: id,
        newParentId: nextEntry.parentId,
        newOrder: nextEntry.order,
      });
    }
  }

  // Deletes: in prev but not next
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) {
      ops.push({ type: "delete", nodeId: id });
    }
  }

  return ops;
}
```

### Step 3: Verify it compiles

```bash
cd apps/canvas-v2 && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors related to nodeConverter.ts (there may be pre-existing errors in other files — that's ok for now).

### Step 4: Commit

```bash
git add apps/canvas-v2/src/lib/nodeConverter.ts
git commit -m "feat(canvas-v2): add nodeConverter — FunnelElement ↔ CanvasNode bidirectional"
```

---

## Task 4: Create StdbSyncProvider.tsx

**Files:**
- Create: `apps/canvas-v2/src/providers/StdbSyncProvider.tsx`

This wraps children with SpacetimeDBProvider and handles the sync loop.

### Step 1: Read the module_bindings index

```bash
cat apps/canvas-v2/src/module_bindings/index.ts | head -30
```

Note the exact import names: `DbConnection`, `tables`, and verify `tables.canvas_node` exists.

### Step 2: Create StdbSyncProvider.tsx

Create `apps/canvas-v2/src/providers/StdbSyncProvider.tsx`:

```tsx
"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { DbConnection, tables } from "@/module_bindings";
import {
  SpacetimeDBProvider,
  useTable,
  useSpacetimeDB,
} from "spacetimedb/react";
import { useFunnel } from "@/context/FunnelContext";
import {
  flatNodesToTree,
  flattenElements,
  computeOps,
  type RawCanvasNode,
} from "@/lib/nodeConverter";
import type { FunnelElement } from "@/types";

// ── Inner: runs inside SpacetimeDBProvider, has access to hooks ──────────────

function StdbSyncInner({
  pageId,
  tenantId,
}: {
  pageId: string;
  tenantId: string;
}) {
  const { elements, setElements } = useFunnel();
  const conn = useSpacetimeDB() as unknown as DbConnection | null;
  const [flatNodes] = useTable(tables.canvas_node);

  const initialized = useRef(false);
  const prevElementsRef = useRef<FunnelElement[]>([]);
  const dirtyIds = useRef<Set<string>>(new Set());
  const syncTimer = useRef<ReturnType<typeof setTimeout>>();

  // ── Initial load: flat STDB nodes → FunnelElement tree ────────────────────
  useEffect(() => {
    if (initialized.current) return;
    if (flatNodes.length === 0) return;

    const tree = flatNodesToTree([...flatNodes] as RawCanvasNode[]);
    initialized.current = true;
    prevElementsRef.current = tree;
    setElements(tree);
  }, [flatNodes, setElements]);

  // ── Remote merge: STDB changes from AI / other users ──────────────────────
  // Only runs after initialization, only for nodes not recently mutated locally
  useEffect(() => {
    if (!initialized.current) return;

    const remoteTree = flatNodesToTree([...flatNodes] as RawCanvasNode[]);
    const remoteMap = flattenElements(remoteTree);

    setElements((current: FunnelElement[]) => {
      const localMap = flattenElements(current);
      let changed = false;

      // Find remote nodes not in dirty set
      const merged = applyRemoteChanges(current, remoteMap, localMap, dirtyIds.current);
      if (merged !== current) changed = true;

      if (changed) {
        prevElementsRef.current = merged;
        return merged;
      }
      return current;
    });
  }, [flatNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced sync: local changes → STDB reducers ─────────────────────────
  const scheduleSync = useCallback(
    (nextElements: FunnelElement[]) => {
      const prev = prevElementsRef.current;
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        if (!conn) return;
        const ops = computeOps(prev, nextElements, pageId, tenantId);
        if (ops.length === 0) return;

        for (const op of ops) {
          try {
            if (op.type === "insert" && op.node) {
              conn.reducers.insertNode({
                id: op.node.id,
                pageId: op.node.pageId,
                tenantId: op.node.tenantId,
                parentId: op.node.parentId ?? "",
                nodeType: op.node.nodeType,
                order: op.node.order,
                styles: op.node.styles,
                props: op.node.props,
                settings: op.node.settings,
                componentUrl: op.node.componentUrl ?? "",
                componentVersion: "",
                componentId: "",
              });
            } else if (op.type === "update_styles" && op.styles !== undefined) {
              conn.reducers.updateNodeStyles({ nodeId: op.nodeId, styles: op.styles });
            } else if (op.type === "update_props" && op.props !== undefined) {
              conn.reducers.updateNodeProps({ nodeId: op.nodeId, props: op.props });
            } else if (op.type === "update_settings" && op.settings !== undefined) {
              conn.reducers.updateNodeSettings({ nodeId: op.nodeId, settings: op.settings });
            } else if (op.type === "move") {
              conn.reducers.moveNode({
                nodeId: op.nodeId,
                newParentId: op.newParentId ?? "",
                newOrder: op.newOrder ?? "",
              });
            } else if (op.type === "delete") {
              conn.reducers.deleteNodeCascade({ nodeId: op.nodeId });
            }
          } catch (err) {
            console.error("[StdbSync] reducer error:", op.type, err);
          }
        }

        prevElementsRef.current = nextElements;
        dirtyIds.current.clear();
      }, 100);
    },
    [conn, pageId, tenantId]
  );

  // Watch elements for local changes
  useEffect(() => {
    if (!initialized.current) return;

    // Track which node IDs changed (for merge conflict resolution)
    const nextMap = flattenElements(elements);
    const prevMap = flattenElements(prevElementsRef.current);
    for (const [id, entry] of nextMap) {
      const prev = prevMap.get(id);
      if (!prev || prev.styles !== entry.styles || prev.props !== entry.props) {
        dirtyIds.current.add(id);
      }
    }

    scheduleSync(elements);
  }, [elements, scheduleSync]);

  return null; // This component only runs sync side effects
}

// ── Remote merge helper ───────────────────────────────────────────────────────

function applyRemoteChanges(
  local: FunnelElement[],
  remoteMap: ReturnType<typeof flattenElements>,
  localMap: ReturnType<typeof flattenElements>,
  dirtyIds: Set<string>
): FunnelElement[] {
  // Simple implementation: rebuild from remote for nodes not dirty
  // For now, check if remote has new nodes not in local → need full re-render
  let hasNewRemote = false;
  for (const [id] of remoteMap) {
    if (!localMap.has(id)) {
      hasNewRemote = true;
      break;
    }
  }
  let hasDeletedRemote = false;
  for (const [id] of localMap) {
    if (!remoteMap.has(id) && !dirtyIds.has(id)) {
      hasDeletedRemote = true;
      break;
    }
  }

  if (!hasNewRemote && !hasDeletedRemote) return local;

  // Rebuild from remote, preserving dirty nodes' local state
  // This is a simplification — full CRDT merge is Phase 2
  return local; // conservative: don't overwrite on remote-only structural changes for now
}

// ── Outer: creates SpacetimeDB connection ─────────────────────────────────────

export function StdbSyncProvider({
  pageId,
  tenantId,
  children,
}: {
  pageId: string;
  tenantId: string;
  children: React.ReactNode;
}) {
  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(process.env.NEXT_PUBLIC_SPACETIMEDB_URL ?? "wss://maincloud.spacetimedb.com")
        .withDatabaseName(process.env.NEXT_PUBLIC_SPACETIMEDB_DB ?? "selorax-canvas")
        .onConnect((conn: DbConnection) => {
          console.log("[StdbSync] connected, subscribing to page:", pageId);
          conn
            .subscriptionBuilder()
            .onApplied(() => console.log("[StdbSync] subscription ready"))
            .subscribe([
              // MUST use raw SQL — query builder generates wrong column names
              `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`,
            ]);
        })
        .onDisconnect(() => console.log("[StdbSync] disconnected")),
    [pageId, tenantId]
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      <StdbSyncInner pageId={pageId} tenantId={tenantId} />
      {children}
    </SpacetimeDBProvider>
  );
}
```

### Step 3: Verify it compiles

```bash
cd apps/canvas-v2 && npx tsc --noEmit 2>&1 | grep "StdbSyncProvider"
```

Expected: No errors for this file. Fix any type errors — common issues:
- `conn.reducers.insertNode` — check exact reducer arg shape in `apps/canvas-v2/src/module_bindings/`
- `useSpacetimeDB` return type — cast with `as unknown as DbConnection | null`

### Step 4: Commit

```bash
git add apps/canvas-v2/src/providers/StdbSyncProvider.tsx
git commit -m "feat(canvas-v2): add StdbSyncProvider — STDB connection + debounced sync"
```

---

## Task 5: Create Dynamic Route `/editor/[pageId]`

**Files:**
- Create: `apps/canvas-v2/src/app/editor/[pageId]/page.tsx`
- Modify: `apps/canvas-v2/src/components/FunnelBuilder.tsx` (add pageId, tenantId props)

### Step 1: Add pageId + tenantId props to FunnelBuilder

Open `apps/canvas-v2/src/components/FunnelBuilder.tsx`.

Find the `FunnelBuilderProps` interface (line ~21):
```typescript
interface FunnelBuilderProps {
  initialProducts?: any;
  storeId?: string;
  accessToken?: string;
  domain?: string;
  slug?: string;
}
```

Add the two new props:
```typescript
interface FunnelBuilderProps {
  initialProducts?: any;
  storeId?: string;
  accessToken?: string;
  domain?: string;
  slug?: string;
  pageId?: string;    // ← add
  tenantId?: string;  // ← add
}
```

Update the function signature to accept them:
```typescript
export default function FunnelBuilder({ initialProducts, storeId, accessToken, domain, slug, pageId, tenantId }: FunnelBuilderProps) {
```

No other changes needed in FunnelBuilder — the StdbSyncProvider wraps it at the route level.

### Step 2: Create the dynamic route page

Create `apps/canvas-v2/src/app/editor/[pageId]/page.tsx`:

```tsx
import { headers } from "next/headers";
import FunnelBuilder from "@/components/FunnelBuilder";
import { StdbSyncProvider } from "@/providers/StdbSyncProvider";

interface PageParams {
  params: Promise<{ pageId: string }>;
}

export default async function EditorPage({ params }: PageParams) {
  const { pageId } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get("x-tenant-id") ?? "store_001";

  return (
    <StdbSyncProvider pageId={pageId} tenantId={tenantId}>
      <FunnelBuilder pageId={pageId} tenantId={tenantId} />
    </StdbSyncProvider>
  );
}
```

> **Note:** `FunnelProvider` is already provided at the root layout via `Providers.tsx` — do NOT add it here.

### Step 3: Start canvas-v2 and test

```bash
# In a new terminal:
npm run dev --workspace=apps/canvas-v2
```

Open: `http://localhost:3000/editor/YOUR_PAGE_ID`

(Get a real pageId by running: `curl http://localhost:3001/api/pages -H 'x-tenant-id: store_001' | jq '.[0].id'`)

Expected:
- Page loads without crashing
- Browser console shows: `[StdbSync] connected, subscribing to page: <pageId>`
- Browser console shows: `[StdbSync] subscription ready`
- If the page has nodes in STDB, they appear on the canvas

### Step 4: Commit

```bash
git add apps/canvas-v2/src/app/editor/\[pageId\]/page.tsx apps/canvas-v2/src/components/FunnelBuilder.tsx
git commit -m "feat(canvas-v2): add dynamic /editor/[pageId] route with STDB sync"
```

---

## Task 6: Test Round-Trip — Edit and Verify STDB Persistence

This task has no new files — it's a manual validation step.

### Step 1: Open the editor with a real page

```
http://localhost:3000/editor/YOUR_PAGE_ID
```

Verify canvas loads existing nodes (if any).

### Step 2: Add an element and verify it syncs to STDB

1. Drag a "Headline" from the left sidebar to the canvas
2. Wait ~200ms
3. Check STDB via the backend health/debug endpoint:

```bash
curl -X POST "https://maincloud.spacetimedb.com/v1/database/selorax-canvas/sql" \
  -H "Content-Type: text/plain" \
  -d "SELECT * FROM canvas_node WHERE page_id = 'YOUR_PAGE_ID'"
```

Expected: The new node appears in the result.

### Step 3: Edit text and verify style sync

1. Double-click the headline to edit it
2. Type some text
3. Click away
4. Run the SQL query again

Expected: The `props` column shows the updated content JSON.

### Step 4: Refresh and verify persistence

Reload `http://localhost:3000/editor/YOUR_PAGE_ID`.

Expected: The element you added is still there (loaded from STDB on mount).

### Step 5: Document any bugs found

If sync isn't working:
- Check browser console for `[StdbSync]` logs
- Check if reducer names match: open `apps/canvas-v2/src/module_bindings/` and verify `insertNode`, `updateNodeStyles`, etc. exist
- Check the `computeOps` diff isn't generating spurious ops on every render (add a console.log in the debounce callback)

---

## Task 7: Page Switcher in Header

**Files:**
- Modify: `apps/canvas-v2/src/components/Header.tsx`

This adds a page selector dropdown to the Header so users can navigate between pages.

### Step 1: Add a page-fetching hook

Create `apps/canvas-v2/src/hooks/usePageList.ts`:

```typescript
import { useState, useEffect } from "react";

export interface PageSummary {
  id: string;
  title: string;
  slug: string;
  type: string; // "homepage" | "collection" | "product" | "landing" | "funnel_step"
}

export function usePageList(tenantId: string) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    setLoading(true);
    fetch(`${backend}/api/pages`, {
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((data) => setPages(Array.isArray(data) ? data : []))
      .catch((err) => console.error("[usePageList]", err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  return { pages, loading };
}
```

### Step 2: Add PageSwitcher component inline in Header.tsx

Open `apps/canvas-v2/src/components/Header.tsx`.

Read the full file first — the Header is a large component. Find where the logo/brand is rendered (typically top-left). Add the page switcher next to it.

At the top of the file, add the import:
```typescript
import { usePageList } from "../hooks/usePageList";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText } from "lucide-react";
```

Inside the `Header` component, add:
```typescript
const router = useRouter();
// pageId and tenantId come from props — add them to HeaderProps:
// pageId?: string;
// tenantId?: string;
const { pages, loading } = usePageList(tenantId ?? "store_001");
const [showPageMenu, setShowPageMenu] = useState(false);
const currentPage = pages.find(p => p.id === pageId);
```

Update `HeaderProps` to include:
```typescript
interface HeaderProps {
  onExport: () => void;
  onImport: () => void;
  onScreenshot: () => void;
  setShowCssEditor: (show: boolean) => void;
  pageId?: string;    // ← add
  tenantId?: string;  // ← add
}
```

Add the page switcher UI in the JSX (find the existing logo area and add after it):
```tsx
{/* Page Switcher */}
<div className="relative">
  <button
    onClick={() => setShowPageMenu(!showPageMenu)}
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
  >
    <FileText size={14} />
    <span className="max-w-[140px] truncate">
      {currentPage?.title ?? (loading ? "Loading…" : "Select page")}
    </span>
    <ChevronDown size={14} className={showPageMenu ? "rotate-180" : ""} />
  </button>

  {showPageMenu && (
    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[220px] max-h-64 overflow-y-auto">
      {pages.length === 0 && (
        <div className="px-4 py-3 text-sm text-gray-400">No pages found</div>
      )}
      {pages.map((page) => (
        <button
          key={page.id}
          onClick={() => {
            router.push(`/editor/${page.id}`);
            setShowPageMenu(false);
          }}
          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${
            page.id === pageId ? "text-blue-600 font-medium bg-blue-50" : "text-gray-700"
          }`}
        >
          <FileText size={13} className="flex-shrink-0 text-gray-400" />
          <div>
            <div className="font-medium">{page.title || page.slug}</div>
            <div className="text-xs text-gray-400 capitalize">{page.type?.replace("_", " ")}</div>
          </div>
        </button>
      ))}
    </div>
  )}
</div>
```

Also add a click-outside handler to close the menu:
```typescript
useEffect(() => {
  if (!showPageMenu) return;
  const handler = () => setShowPageMenu(false);
  setTimeout(() => window.addEventListener("click", handler), 0);
  return () => window.removeEventListener("click", handler);
}, [showPageMenu]);
```

### Step 3: Pass pageId + tenantId to Header from FunnelBuilder

Open `apps/canvas-v2/src/components/FunnelBuilder.tsx`.

Find where `<Header />` is rendered and add the props:
```tsx
<Header
  onExport={handleExport}
  onImport={handleImportClick}
  onScreenshot={handleScreenshot}
  setShowCssEditor={setShowCssEditor}
  pageId={pageId}        // ← add
  tenantId={tenantId}    // ← add
/>
```

### Step 4: Test

```
http://localhost:3000/editor/YOUR_PAGE_ID
```

Expected: Header shows the current page name in a dropdown. Clicking opens a list of pages. Selecting a different page navigates to `/editor/[otherId]` and loads that page's canvas.

### Step 5: Commit

```bash
git add apps/canvas-v2/src/hooks/usePageList.ts apps/canvas-v2/src/components/Header.tsx apps/canvas-v2/src/components/FunnelBuilder.tsx
git commit -m "feat(canvas-v2): add page switcher dropdown in Header"
```

---

## Phase 1 Done — Verification Checklist

Before calling Phase 1 complete, verify all of these manually:

- [ ] `yarn dev` in canvas-v2 starts without errors on a free port (e.g., 3005)
- [ ] `/editor/[realPageId]` loads and shows `[StdbSync] subscription ready` in console
- [ ] If the page has STDB nodes, they render on the canvas
- [ ] Dragging a new element → it appears in STDB (verified via curl)
- [ ] Editing an element text → props updated in STDB
- [ ] Refreshing the page → element is still there (loaded from STDB)
- [ ] Header shows page switcher dropdown with page list from backend
- [ ] Selecting a different page navigates and loads that page's canvas
- [ ] TypeScript compiles: `npx tsc --noEmit` shows no new errors

---

## Troubleshooting

**"insertNode is not a function"** — Check generated bindings. The reducer name may differ. Run:
```bash
grep -r "insertNode\|insert_node" apps/canvas-v2/src/module_bindings/
```

**"flatNodes is always empty"** — Subscription may not be applying. Check:
- Raw SQL uses correct column names (`page_id`, `tenant_id` in snake_case)
- `onApplied` fires (add console.log)
- STDB URL and DB name in `.env.local` are correct

**TypeScript errors in StdbSyncProvider** — The `conn.reducers.*` call signatures depend on the exact generated types. Check `apps/canvas-v2/src/module_bindings/` for the exact reducer input types and adjust the calls.

**Elements flicker / reset on every STDB update** — The remote merge in `applyRemoteChanges` is intentionally conservative for Phase 1. If remote-only changes are being dropped, that's expected — full merge is Phase 2.

---

## Next: Phase 2

Phase 2 plan will cover:
- Rubber-band selection port from canvas-dashboard
- Right-click context menu (group/ungroup, bring-to-front, lock)
- Live cursors (active_cursor STDB table)
- Funnel builder sidebar tab
- Publish button → backend REST
- AI operation status bar (ai_operation STDB table)
