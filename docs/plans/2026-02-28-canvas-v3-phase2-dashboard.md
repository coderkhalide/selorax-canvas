# Canvas V3 Phase 2 — Pages & Funnels Dashboard

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `/` redirect with a real home dashboard where users can browse/create pages and funnels, then navigate to the editor.

**Architecture:** New `DashboardPage` client component at `/` renders a two-tab UI (Pages | Funnels). Data fetched from `canvas-backend` REST API with `x-tenant-id` header. Navigates to `/editor/[pageId]` on click.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, canvas-backend REST (`/api/pages`, `/api/funnels`), `lucide-react`

---

## Context

- All work is inside `apps/canvas-v2/`
- Backend runs at `http://localhost:3001` (env: `NEXT_PUBLIC_BACKEND_URL`)
- Tenant ID comes from middleware `x-tenant-id` header — on the dashboard route `/` the middleware does NOT inject it yet (it only covers `/editor/*`). We'll read it server-side from headers and pass as a prop, same pattern as `/editor/[pageId]/page.tsx`.
- Backend endpoints that already exist:
  - `GET /api/pages` — returns `{ pages: Page[] }` with `x-tenant-id` header
  - `POST /api/pages` — body `{ title, type, slug? }` — returns `{ page: Page }`
  - `GET /api/funnels` — returns `{ funnels: Funnel[] }`
  - `POST /api/funnels` — body `{ name }` — returns `{ funnel: Funnel }`
  - `GET /api/funnels/:id` — returns `{ funnel: Funnel & { steps: FunnelStep[] } }`
  - `POST /api/funnels/:id/steps` — body `{ title, pageType }` — creates page + step, returns `{ step: FunnelStep, page: Page }`
- Page types: `'landing_page' | 'product_template' | 'collection' | 'funnel_step'`
- The dashboard route `/` needs the `x-tenant-id` header injected. Update `middleware.ts` to also cover `/`.

---

## Task 1: Extend middleware to cover dashboard route

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Read the file**
```
src/middleware.ts
```
The matcher currently covers `["/", "/editor/:path*"]`. The x-tenant-id injection block only runs for `/editor`. Extend it to also inject on `/`.

**Step 2: Update the middleware injection block**

Find the `if (url.pathname.startsWith("/editor"))` block and change to:
```typescript
if (url.pathname.startsWith("/editor") || url.pathname === "/") {
  const tenantId = process.env.TENANT_ID ?? "store_001";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-id", tenantId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}
```

**Step 3: Verify**
```bash
cd apps/canvas-v2 && yarn dev --port 3005
# Open http://localhost:3005/ — page should load (currently a redirect, will fix in Task 7)
```

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/middleware.ts
git commit -m "feat(canvas-v2): inject x-tenant-id header on dashboard route"
```

---

## Task 2: Create API hooks for pages and funnels

**Files:**
- Create: `src/hooks/usePages.ts`
- Create: `src/hooks/useFunnels.ts`

**Step 1: Create `src/hooks/usePages.ts`**

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export interface Page {
  id: string;
  title: string | null;
  slug: string;
  type: string;
  updatedAt: string;
  publishedVersionId: string | null;
}

export function usePages(tenantId: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/pages`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch pages: ${res.status}`);
      const data = await res.json();
      setPages(data.pages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const createPage = useCallback(async (title: string, type: string): Promise<Page | null> => {
    try {
      const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const res = await fetch(`${backendUrl}/api/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ title, type, slug: `${slug}-${Date.now()}` }),
      });
      if (!res.ok) throw new Error(`Failed to create page: ${res.status}`);
      const data = await res.json();
      const newPage: Page = data.page;
      setPages((prev) => [newPage, ...prev]);
      return newPage;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId]);

  return { pages, loading, error, createPage, refetch: fetchPages };
}
```

**Step 2: Create `src/hooks/useFunnels.ts`**

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export interface FunnelStep {
  id: string;
  order: number;
  title: string | null;
  pageId: string;
  page?: { id: string; title: string | null; slug: string; type: string };
}

export interface Funnel {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  steps?: FunnelStep[];
}

export function useFunnels(tenantId: string) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchFunnels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/funnels`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch funnels: ${res.status}`);
      const data = await res.json();
      setFunnels(data.funnels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => { fetchFunnels(); }, [fetchFunnels]);

  const createFunnel = useCallback(async (name: string): Promise<Funnel | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/funnels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Failed to create funnel: ${res.status}`);
      const data = await res.json();
      const newFunnel: Funnel = data.funnel;
      setFunnels((prev) => [newFunnel, ...prev]);
      return newFunnel;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId]);

  const addStep = useCallback(async (funnelId: string, title: string, pageType: string): Promise<FunnelStep | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/funnels/${funnelId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ title, pageType }),
      });
      if (!res.ok) throw new Error(`Failed to add step: ${res.status}`);
      const data = await res.json();
      // Refresh the full funnel list after adding a step
      await fetchFunnels();
      return data.step;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId, fetchFunnels]);

  const getFunnelWithSteps = useCallback(async (funnelId: string): Promise<Funnel | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/funnels/${funnelId}`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch funnel: ${res.status}`);
      const data = await res.json();
      return data.funnel;
    } catch (e) {
      return null;
    }
  }, [backendUrl, tenantId]);

  return { funnels, loading, error, createFunnel, addStep, getFunnelWithSteps, refetch: fetchFunnels };
}
```

**Step 3: Commit**
```bash
git add apps/canvas-v2/src/hooks/usePages.ts apps/canvas-v2/src/hooks/useFunnels.ts
git commit -m "feat(canvas-v2): add usePages and useFunnels hooks"
```

---

## Task 3: Create PageCard and PagesGrid components

**Files:**
- Create: `src/components/dashboard/PageCard.tsx`
- Create: `src/components/dashboard/PagesGrid.tsx`
- Create: `src/components/dashboard/NewPageModal.tsx`

**Step 1: Create `src/components/dashboard/PageCard.tsx`**

```tsx
"use client";
import { FileText, Globe, ChevronRight } from "lucide-react";
import { Page } from "../../hooks/usePages";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  landing_page: "Landing Page",
  product_template: "Product Template",
  collection: "Collection",
  funnel_step: "Funnel Step",
};

const TYPE_COLORS: Record<string, string> = {
  landing_page: "bg-blue-100 text-blue-700",
  product_template: "bg-green-100 text-green-700",
  collection: "bg-purple-100 text-purple-700",
  funnel_step: "bg-orange-100 text-orange-700",
};

export function PageCard({ page }: { page: Page }) {
  const label = TYPE_LABELS[page.type] ?? page.type;
  const color = TYPE_COLORS[page.type] ?? "bg-gray-100 text-gray-700";
  const edited = new Date(page.updatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <Link
      href={`/editor/${page.id}`}
      className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition-all flex flex-col gap-3"
    >
      {/* Thumbnail placeholder */}
      <div className="w-full h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center border border-gray-100">
        <FileText className="w-8 h-8 text-gray-300" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate text-sm leading-tight">
            {page.title || page.slug}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{edited}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
          {label}
        </span>
        {page.publishedVersionId && (
          <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
            <Globe className="w-3 h-3" /> Live
          </span>
        )}
      </div>
    </Link>
  );
}
```

**Step 2: Create `src/components/dashboard/NewPageModal.tsx`**

```tsx
"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";

const PAGE_TYPES = [
  { value: "landing_page", label: "Landing Page", desc: "Standalone marketing page" },
  { value: "product_template", label: "Product Template", desc: "Product detail page template" },
  { value: "collection", label: "Collection", desc: "Category or collection page" },
  { value: "funnel_step", label: "Funnel Step", desc: "Step in a conversion funnel" },
];

interface Props {
  onClose: () => void;
  onCreate: (title: string, type: string) => Promise<void>;
}

export function NewPageModal({ onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("landing_page");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    await onCreate(title.trim(), type);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Page</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Page Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Summer Sale Landing Page"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Page Type</label>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => setType(pt.value)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    type === pt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900">{pt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{pt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Page
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create `src/components/dashboard/PagesGrid.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { usePages } from "../../hooks/usePages";
import { PageCard } from "./PageCard";
import { NewPageModal } from "./NewPageModal";
import { useRouter } from "next/navigation";

export function PagesGrid({ tenantId }: { tenantId: string }) {
  const { pages, loading, error, createPage } = usePages(tenantId);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  const filtered = pages.filter((p) =>
    (p.title ?? p.slug).toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (title: string, type: string) => {
    const page = await createPage(title, type);
    if (page) router.push(`/editor/${page.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Page
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
      {error && (
        <div className="text-center py-20 text-red-500 text-sm">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">No pages yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create your first page
          </button>
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((page) => (
            <PageCard key={page.id} page={page} />
          ))}
        </div>
      )}

      {showModal && (
        <NewPageModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
```

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/components/dashboard/
git commit -m "feat(canvas-v2): add PageCard, PagesGrid, NewPageModal components"
```

---

## Task 4: Create FunnelRow, FunnelsList, and NewFunnelModal

**Files:**
- Create: `src/components/dashboard/FunnelRow.tsx`
- Create: `src/components/dashboard/NewFunnelModal.tsx`
- Create: `src/components/dashboard/FunnelsList.tsx`

**Step 1: Create `src/components/dashboard/FunnelRow.tsx`**

```tsx
"use client";
import { useState } from "react";
import { ChevronRight, Plus, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Funnel, FunnelStep } from "../../hooks/useFunnels";
import Link from "next/link";

interface Props {
  funnel: Funnel;
  onAddStep: (funnelId: string, title: string, pageType: string) => Promise<void>;
}

export function FunnelRow({ funnel, onAddStep }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepTitle, setStepTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const steps: FunnelStep[] = funnel.steps ?? [];

  const handleAddStep = async () => {
    if (!stepTitle.trim()) return;
    setLoading(true);
    await onAddStep(funnel.id, stepTitle.trim(), "funnel_step");
    setLoading(false);
    setStepTitle("");
    setShowAddStep(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">F</span>
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900 text-sm">{funnel.name}</p>
            <p className="text-xs text-gray-400">{steps.length} step{steps.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          {/* Step Flow */}
          {steps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {steps
                .sort((a, b) => a.order - b.order)
                .map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <Link
                      href={`/editor/${step.pageId}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 transition-colors"
                    >
                      <span className="w-4 h-4 bg-blue-200 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-700">
                        {idx + 1}
                      </span>
                      {step.title ?? step.page?.title ?? step.page?.slug ?? "Untitled"}
                    </Link>
                    {idx < steps.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                ))}
              <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs text-green-600 font-medium">Done</span>
              </div>
            </div>
          )}
          {steps.length === 0 && (
            <p className="text-sm text-gray-400 mb-4">No steps yet. Add your first step.</p>
          )}

          {/* Add Step */}
          {showAddStep ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStep()}
                placeholder="Step name (e.g. Landing, Checkout, Upsell)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddStep}
                disabled={!stepTitle.trim() || loading}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
              </button>
              <button
                onClick={() => { setShowAddStep(false); setStepTitle(""); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddStep(true)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add Step
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create `src/components/dashboard/NewFunnelModal.tsx`**

```tsx
"use client";
import { useState } from "react";
import { X, Loader2 } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function NewFunnelModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    await onCreate(name.trim());
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Funnel</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Funnel Name</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Summer Sale Funnel"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Funnel
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create `src/components/dashboard/FunnelsList.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { useFunnels } from "../../hooks/useFunnels";
import { FunnelRow } from "./FunnelRow";
import { NewFunnelModal } from "./NewFunnelModal";

export function FunnelsList({ tenantId }: { tenantId: string }) {
  const { funnels, loading, error, createFunnel, addStep } = useFunnels(tenantId);
  const [showModal, setShowModal] = useState(false);

  const handleAddStep = async (funnelId: string, title: string, pageType: string) => {
    await addStep(funnelId, title, pageType);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-gray-500">{funnels.length} funnel{funnels.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New Funnel
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}
      {error && <div className="text-center py-20 text-red-500 text-sm">{error}</div>}
      {!loading && !error && funnels.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-400 text-sm mb-4">No funnels yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Create your first funnel
          </button>
        </div>
      )}
      {!loading && funnels.length > 0 && (
        <div className="flex flex-col gap-3">
          {funnels.map((funnel) => (
            <FunnelRow key={funnel.id} funnel={funnel} onAddStep={handleAddStep} />
          ))}
        </div>
      )}

      {showModal && (
        <NewFunnelModal
          onClose={() => setShowModal(false)}
          onCreate={createFunnel}
        />
      )}
    </div>
  );
}
```

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/components/dashboard/
git commit -m "feat(canvas-v2): add FunnelRow, FunnelsList, NewFunnelModal components"
```

---

## Task 5: Create DashboardPage and replace the home route

**Files:**
- Create: `src/components/dashboard/DashboardPage.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Create `src/components/dashboard/DashboardPage.tsx`**

```tsx
"use client";
import { useState } from "react";
import { LayoutGrid, GitMerge } from "lucide-react";
import { PagesGrid } from "./PagesGrid";
import { FunnelsList } from "./FunnelsList";
import Image from "next/image";
import Link from "next/link";

type Tab = "pages" | "funnels";

export function DashboardPage({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<Tab>("pages");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
            <span className="font-bold text-white text-sm">S</span>
          </div>
          <Image width={400} height={200} src="/selorax.png" alt="SeloraX" className="w-36 h-7" />
        </div>
        <div className="text-xs text-gray-400 font-mono">
          tenant: {tenantId}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your pages and conversion funnels</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-8">
          <button
            onClick={() => setTab("pages")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "pages"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Pages
          </button>
          <button
            onClick={() => setTab("funnels")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === "funnels"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <GitMerge className="w-4 h-4" /> Funnels
          </button>
        </div>

        {tab === "pages" && <PagesGrid tenantId={tenantId} />}
        {tab === "funnels" && <FunnelsList tenantId={tenantId} />}
      </main>
    </div>
  );
}
```

**Step 2: Replace `src/app/page.tsx`**

```tsx
import { headers } from "next/headers";
import { DashboardPage } from "../components/dashboard/DashboardPage";

export default async function Home() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") ?? "store_001";
  return <DashboardPage tenantId={tenantId} />;
}
```

**Step 3: Commit**
```bash
git add apps/canvas-v2/src/components/dashboard/DashboardPage.tsx apps/canvas-v2/src/app/page.tsx
git commit -m "feat(canvas-v2): add Pages & Funnels dashboard at /"
```

---

## Task 6: Add "← Dashboard" back link in editor Header

**Files:**
- Modify: `src/components/Header.tsx`

The Header already has the page switcher dropdown. Add a small back-to-dashboard link to the left of the logo area.

**Step 1: Add import**

In `Header.tsx`, add to the import block:
```typescript
import { Home } from "lucide-react";
import Link from "next/link";
```

**Step 2: Add the link**

Inside the `<header>` JSX, right before the logo `<div className="w-8 h-8 bg-gradient-to-br...">`, add:

```tsx
<Link
  href="/"
  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors mr-1"
  title="Back to Dashboard"
>
  <Home className="w-4 h-4" />
</Link>
```

**Step 3: Verify manually**
- Open `http://localhost:3005/editor/SOME_PAGE_ID`
- Should see a home icon on the left of the header
- Click it → goes to `http://localhost:3005/`
- Should see the dashboard with pages and funnels tabs

**Step 4: Commit**
```bash
git add apps/canvas-v2/src/components/Header.tsx
git commit -m "feat(canvas-v2): add dashboard back-link in editor header"
```

---

## Task 7: Check /api/funnels/:id/steps endpoint exists in backend

**Files:**
- Read: `apps/canvas-backend/src/routes/funnels.ts`

**Step 1: Check if `POST /api/funnels/:id/steps` is implemented**

Read the funnels route file and look for a `router.post('/:id/steps', ...)` handler.

**If it exists:** skip to commit.

**If it does NOT exist:** add it.

**Step 2 (only if missing): Add the endpoint to `apps/canvas-backend/src/routes/funnels.ts`**

```typescript
// POST /api/funnels/:id/steps — create a page and add it as next step
router.post('/:id/steps', async (req, res) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { id: funnelId } = req.params;
  const { title, pageType = 'funnel_step' } = req.body;

  if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header required' });
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    // Count existing steps to determine order
    const existingSteps = await prisma.funnelStep.count({ where: { funnelId } });

    // Create slug from title
    const baseSlug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const slug = `${baseSlug}-${Date.now()}`;

    // Create page + step in a transaction
    const [page, step] = await prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: { tenantId, title, slug, type: pageType },
      });
      const step = await tx.funnelStep.create({
        data: { funnelId, pageId: page.id, title, order: existingSteps },
        include: { page: true },
      });
      return [page, step];
    });

    res.json({ step, page });
  } catch (err) {
    console.error('[funnels] addStep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 3: Commit (if modified)**
```bash
git add apps/canvas-backend/src/routes/funnels.ts
git commit -m "feat(backend): add POST /api/funnels/:id/steps endpoint"
```

---

## Task 8: End-to-end verification

**Step 1: Start all services**
```bash
npm run dev:local
```

**Step 2: Test pages dashboard**
- Open `http://localhost:3005/`
- Should see the dashboard (Pages tab active)
- Should see existing pages from backend (if any)
- Click "New Page" → fill title → pick type → "Create Page" → should redirect to editor

**Step 3: Test funnels dashboard**
- Click "Funnels" tab
- Should see existing funnels
- Click "New Funnel" → name it → "Create Funnel" → appears in list
- Click the funnel row to expand → "Add Step" → name it → should create page + step → step appears in flow
- Click a step card → should navigate to editor for that page

**Step 4: Test back navigation**
- In editor (`/editor/[pageId]`) → click home icon → returns to dashboard

**Step 5: Commit any fixes**
```bash
git add -p
git commit -m "fix(canvas-v2): phase 2 verification fixes"
```
