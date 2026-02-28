# Canvas V3 Phase 6 — ESM Component Registry

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static `custom-registry.tsx` (14 hardcoded components) with dynamic CDN loading. Components are fetched from `canvas-backend /api/components` and loaded at runtime from Cloudflare R2 URLs.

**Architecture:** New `ComponentBrowser` in the left sidebar fetches the component list from the backend. Dragging a component to canvas inserts a `type: 'custom'` node with `componentUrl`. `ElementRenderer` dynamically imports the component from the URL using `React.lazy`. Existing 14 components get migrated as ESM modules to R2.

**Tech Stack:** React.lazy + Suspense, dynamic ESM import, canvas-backend `/api/components`, Cloudflare R2, next.config.mjs

---

## Context

- `Sidebar.tsx` at `apps/canvas-v2/src/components/Sidebar.tsx` — left panel, currently has a "Custom Components" section using the static registry
- `ElementRenderer.tsx` at `apps/canvas-v2/src/components/ElementRenderer.tsx` — renders elements; handles `type === 'custom'` by looking up `custom-registry.tsx`
- `custom-registry.tsx` at `apps/canvas-v2/src/components/custom-registry.tsx` — static registry
- `custom-registry/` at `apps/canvas-v2/src/components/custom-registry/` — 11 component implementations
- Backend: `GET /api/components` returns `{ components: Component[] }` with `x-tenant-id` header
- Component model fields: `id`, `name`, `category`, `thumbnailUrl`, `latestVersion: { componentUrl }`, `tenantId` (null = global)
- ESM component interface: default export `React.FC<{ element: FunnelElement, onUpdate?, isPreview? }>`
- The `FunnelElement.customType` field currently holds the registry key (e.g., `"boxes"`, `"countdown"`)
- For ESM components: `FunnelElement.data` holds `{ componentUrl: string }` — we use this to load from CDN

**IMPORTANT — Read before implementing:**
- `apps/canvas-v2/src/components/custom-registry.tsx` — understand current structure
- `apps/canvas-v2/src/components/ElementRenderer.tsx` — find the `type === 'custom'` rendering block
- `apps/canvas-v2/src/components/Sidebar.tsx` — find the custom components section
- `apps/canvas-backend/src/routes/components.ts` — understand `GET /api/components` response shape

---

## Task 1: Add useComponents hook

**Files:**
- Create: `src/hooks/useComponents.ts`

**Step 1: Read `apps/canvas-backend/src/routes/components.ts`**

Understand the response shape of `GET /api/components`. It likely returns:
```json
{
  "components": [
    {
      "id": "...",
      "name": "Countdown Timer",
      "category": "Marketing",
      "thumbnailUrl": "https://...",
      "latestVersion": { "componentUrl": "https://r2.../component.js" }
    }
  ]
}
```

**Step 2: Create `src/hooks/useComponents.ts`**

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export interface RemoteComponent {
  id: string;
  name: string;
  category: string;
  thumbnailUrl: string | null;
  componentUrl: string; // from latestVersion.componentUrl
}

export function useComponents(tenantId: string) {
  const [components, setComponents] = useState<RemoteComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchComponents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/components`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch components: ${res.status}`);
      const data = await res.json();
      const raw = data.components ?? [];
      setComponents(
        raw
          .filter((c: any) => c.latestVersion?.componentUrl)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            category: c.category ?? "General",
            thumbnailUrl: c.thumbnailUrl ?? null,
            componentUrl: c.latestVersion.componentUrl,
          }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => { fetchComponents(); }, [fetchComponents]);

  return { components, loading, error };
}
```

**Step 3: Commit**
```bash
git add apps/canvas-v2/src/hooks/useComponents.ts
git commit -m "feat(canvas-v2): add useComponents hook for ESM registry"
```

---

## Task 2: Create ComponentBrowser

**Files:**
- Create: `src/components/ComponentBrowser.tsx`

**Step 1: Create `src/components/ComponentBrowser.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Search, Loader2, Package } from "lucide-react";
import { useComponents, RemoteComponent } from "../hooks/useComponents";

interface Props {
  tenantId: string;
}

export function ComponentBrowser({ tenantId }: Props) {
  const { components, loading, error } = useComponents(tenantId);
  const [search, setSearch] = useState("");

  const filtered = components.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const byCategory = filtered.reduce<Record<string, RemoteComponent[]>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  const handleDragStart = (e: React.DragEvent, component: RemoteComponent) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        elementType: "custom",
        variantData: {
          customType: component.id,
          data: { componentUrl: component.componentUrl },
          name: component.name,
        },
      })
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-4 text-center text-xs text-red-500">{error}</div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="px-3 py-4 text-center text-xs text-gray-400">
        No components in registry yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative px-2">
        <Search className="w-3.5 h-3.5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search components..."
          className="w-full pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {category}
          </p>
          <div className="flex flex-col gap-0.5">
            {items.map((component) => (
              <div
                key={component.id}
                draggable
                onDragStart={(e) => handleDragStart(e, component)}
                className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-grab active:cursor-grabbing group"
              >
                {component.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={component.thumbnailUrl}
                    alt={component.name}
                    className="w-8 h-8 rounded object-cover border border-gray-100"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                    <Package className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <span className="text-xs text-gray-700 font-medium group-hover:text-gray-900">
                  {component.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add apps/canvas-v2/src/components/ComponentBrowser.tsx
git commit -m "feat(canvas-v2): add ComponentBrowser with drag-to-canvas support"
```

---

## Task 3: Add Components tab to Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Read the current Sidebar.tsx**

Identify the tab/section structure. Currently there are tabs or sections: Layout, Grid, Basic, Media, Custom Components.

**Step 2: Add ComponentBrowser as a new tab**

Add `ComponentBrowser` as a new tab in the sidebar. The exact implementation depends on the existing tab structure.

Import `ComponentBrowser`:
```typescript
import { ComponentBrowser } from "./ComponentBrowser";
```

Add a `tenantId` prop to `Sidebar` if it doesn't already have one:
```typescript
interface SidebarProps {
  tenantId?: string;
  // ... existing props
}
```

Add the Components tab. If the sidebar uses a tab-button pattern:
```tsx
// Add to the tab buttons:
<button
  onClick={() => setActiveTab("components")}
  className={`... ${activeTab === "components" ? "active styles" : "inactive styles"}`}
>
  <Package className="w-4 h-4" />
  <span>Components</span>
</button>

// Add to the tab content:
{activeTab === "components" && (
  <ComponentBrowser tenantId={tenantId ?? "store_001"} />
)}
```

**Step 3: Pass tenantId from FunnelBuilder to Sidebar**

In `FunnelBuilder.tsx`, find the `<Sidebar />` render and add:
```tsx
<Sidebar tenantId={tenantId} ... />
```

**Step 4: Verify**
- Open editor at `http://localhost:3005/editor/[pageId]`
- Should see a "Components" tab in the left sidebar
- Click it — should show components fetched from backend
- If no components in registry yet: shows "No components in registry yet"

**Step 5: Commit**
```bash
git add apps/canvas-v2/src/components/Sidebar.tsx apps/canvas-v2/src/components/FunnelBuilder.tsx
git commit -m "feat(canvas-v2): add Components tab to sidebar with ComponentBrowser"
```

---

## Task 4: Update ElementRenderer for dynamic ESM loading

**Files:**
- Modify: `src/components/ElementRenderer.tsx`
- Modify: `next.config.mjs`

**Step 1: Read the custom rendering block in ElementRenderer.tsx**

Find where `type === 'custom'` is handled. It currently does a registry lookup:
```typescript
// something like:
const registry = useCustomRegistry();
const Comp = registry[element.customType];
```

**Step 2: Update the custom component handling**

Add dynamic ESM loading for components that have a `componentUrl` in their `data`:

```tsx
import { lazy, Suspense, memo } from "react";

// Cache of loaded component modules (avoid re-importing on every render)
const componentCache = new Map<string, React.LazyExoticComponent<any>>();

function getRemoteComponent(url: string) {
  if (!componentCache.has(url)) {
    componentCache.set(
      url,
      lazy(() =>
        import(/* @vite-ignore */ url).catch((err) => {
          console.error("[ElementRenderer] Failed to load component:", url, err);
          return { default: () => <div className="p-2 text-xs text-red-500">Failed to load component</div> };
        })
      )
    );
  }
  return componentCache.get(url)!;
}
```

In the `type === 'custom'` rendering block, check for `componentUrl` in `element.data`:

```tsx
// In the custom element rendering section:
if (element.type === "custom") {
  const componentUrl = element.data?.componentUrl as string | undefined;

  if (componentUrl) {
    // ESM remote component
    const RemoteComp = getRemoteComponent(componentUrl);
    return (
      <Suspense fallback={<div className="p-4 text-xs text-gray-400 animate-pulse">Loading component...</div>}>
        <RemoteComp
          element={element}
          onUpdate={onUpdate}
          isPreview={isPreview}
        />
      </Suspense>
    );
  }

  // Fall back to static registry for backwards compatibility (old customType-based components)
  // ... existing static registry lookup code stays here
}
```

**Step 3: Update next.config.mjs to allow cross-origin ESM**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow dynamic imports from external URLs (R2 CDN)
    externalDir: true,
  },
  // Allow images from R2 and other domains
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.r2.dev" },
    ],
  },
};

export default nextConfig;
```

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/components/ElementRenderer.tsx apps/canvas-v2/next.config.mjs
git commit -m "feat(canvas-v2): add dynamic ESM loading in ElementRenderer for remote components"
```

---

## Task 5: Migrate existing 14 custom components to ESM (migration script)

**Files:**
- Create: `scripts/migrate-components.ts` (in the canvas-v2 app dir, or monorepo root scripts/)

**Step 1: Understand what needs to happen**

Each of the 14 components in `custom-registry/` needs to:
1. Be wrapped as a standalone ESM file with the correct export signature
2. Uploaded to Cloudflare R2 (using the backend's upload endpoint or directly)
3. Registered in MySQL `Component` table via `POST /api/components`

The ESM wrapper format:
```typescript
// Each component exports a default function with this signature:
export default function ComponentName({ element, onUpdate, isPreview }) {
  // component implementation
}
```

**Step 2: Create the migration script**

Create `apps/canvas-v2/scripts/migrate-components.ts`:

```typescript
#!/usr/bin/env tsx
/**
 * Migrates existing 14 custom components from static registry to ESM + MySQL.
 *
 * For each component:
 * 1. Reads the component source
 * 2. Wraps it in ESM-compatible format
 * 3. Uploads to backend (which stores in R2)
 * 4. Registers in MySQL Component table
 *
 * Usage: npx tsx scripts/migrate-components.ts
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const TENANT_ID = process.env.TENANT_ID ?? "store_001";

// Component definitions to migrate (name, category, the static registry key)
const COMPONENTS = [
  { key: "boxes", name: "Boxes Grid", category: "Layout" },
  { key: "quotes", name: "Testimonial Quotes", category: "Social Proof" },
  { key: "sequence", name: "Steps Sequence", category: "Content" },
  { key: "steps", name: "Numbered Steps", category: "Content" },
  { key: "video-card", name: "Video Card", category: "Media" },
  { key: "list", name: "Feature List", category: "Content" },
  { key: "carousel", name: "Image Carousel", category: "Media" },
  { key: "countdown", name: "Countdown Timer", category: "Marketing" },
  { key: "slider", name: "Custom Slider", category: "Media" },
  { key: "marquee", name: "Scrolling Marquee", category: "Marketing" },
  { key: "category", name: "Category Grid", category: "E-commerce" },
  { key: "gallery", name: "Image Gallery", category: "Media" },
  { key: "accordion", name: "Accordion FAQ", category: "Content" },
  { key: "html", name: "Custom HTML", category: "Advanced" },
];

async function migrateComponent(comp: typeof COMPONENTS[0]) {
  console.log(`Migrating: ${comp.name}...`);

  // Post to backend to register
  const res = await fetch(`${BACKEND_URL}/api/components`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-id": TENANT_ID,
    },
    body: JSON.stringify({
      name: comp.name,
      category: comp.category,
      // componentUrl will be set when the actual ESM file is uploaded
      // For now, register metadata only
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Failed to register ${comp.name}:`, err);
    return;
  }

  const data = await res.json();
  console.log(`  Registered: ${comp.name} (id: ${data.component?.id})`);
}

async function main() {
  console.log("Starting component migration...");
  for (const comp of COMPONENTS) {
    await migrateComponent(comp);
  }
  console.log("Done!");
}

main().catch(console.error);
```

**Note:** Full ESM migration (build + R2 upload) is complex and requires a build pipeline. This script registers the component metadata. The actual ESM build and upload of each component is done separately per component as a future build step.

**Step 3: Run the migration script**
```bash
cd apps/canvas-v2 && npx tsx scripts/migrate-components.ts
```

Expected output:
```
Starting component migration...
Migrating: Boxes Grid...
  Registered: Boxes Grid (id: xxx)
...
Done!
```

**Step 4: Verify in ComponentBrowser**
- Open editor, click Components tab in sidebar
- Should now see 14 components listed (without ESM URLs yet — they'll show loading state if dragged)

**Step 5: Commit**
```bash
git add apps/canvas-v2/scripts/migrate-components.ts
git commit -m "feat(canvas-v2): add component migration script to register 14 components in MySQL"
```

---

## Task 6: End-to-end verification

**Step 1: Test static registry fallback still works**
- Open editor at `http://localhost:3005/editor/[pageId]`
- From the left sidebar, drag one of the old "Custom Components" (from the static section)
- It should still render correctly (ESM loading path is skipped, falls back to static registry)

**Step 2: Test drag from ComponentBrowser**
- Click the Components tab in left sidebar
- Drag a component onto the canvas
- It should appear as a `type: 'custom'` placeholder
- If the component has no `componentUrl` in MySQL yet, it shows "Loading component..." or falls back gracefully

**Step 3: Test with a real ESM component (if one exists in R2)**
- If any component has a real `componentUrl` registered, drag it
- Should dynamically import and render from R2

**Step 4: Commit any fixes**
```bash
git add -p
git commit -m "fix(canvas-v2): phase 6 ESM component verification fixes"
```
