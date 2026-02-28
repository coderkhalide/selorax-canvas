# Canvas V3 Phase 3 — Preview & Storefront Links

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Preview, View Live, and Publish buttons to the editor header so users can see their work in the preview-server (live STDB state) and storefront (published version).

**Architecture:** Three buttons in `Header.tsx`. Preview opens `preview-server:3004/[pageId]`. View Live opens `storefront:3003/[slug]`. Publish calls `canvas-backend POST /api/pages/:id/publish`. All env-var driven URLs.

**Tech Stack:** Next.js 15, canvas-backend REST, environment variables

---

## Context

- The Header currently has a "Publish" button that calls the old Shopify-style `updateProductTemplate`. We replace it with one that calls `canvas-backend /api/pages/:id/publish`.
- The header also has a "Live Preview" button that opens `https://${domain}/products/${slug}` — this is for the old Shopify flow. We keep it but add the new preview-server and storefront buttons.
- `pageId` and `tenantId` are already passed to `Header` as props from `FunnelBuilder.tsx`.
- Backend endpoint: `POST /api/pages/:id/publish` — triggers STDB → MySQL → Redis pipeline, returns `{ success: true, page: Page }`.
- Page slug for storefront: we need to fetch it from the page list (already available in `usePageList` hook which Header imports).
- Preview server URL: `process.env.NEXT_PUBLIC_PREVIEW_URL` (default `http://localhost:3004`)
- Storefront URL: `process.env.NEXT_PUBLIC_STOREFRONT_URL` (default `http://localhost:3003`)

---

## Task 1: Add env vars to .env.local

**Files:**
- Modify: `apps/canvas-v2/.env.local`

**Step 1: Add to `apps/canvas-v2/.env.local`**
```env
NEXT_PUBLIC_PREVIEW_URL=http://localhost:3004
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3003
```

**Step 2: Commit**
```bash
# Note: .env.local is gitignored — document the change in .env.example instead
```

**Step 3: Update `.env.example` if it exists**

Check if `apps/canvas-v2/.env.example` or a root `.env.example` mentions canvas-v2 env vars. Add the two new vars there.

```bash
git add .env.example  # only if it exists and was modified
git commit -m "docs: add PREVIEW_URL and STOREFRONT_URL env vars to example"
```

---

## Task 2: Create usePublish hook

**Files:**
- Create: `src/hooks/usePublish.ts`

**Step 1: Create `src/hooks/usePublish.ts`**

```typescript
"use client";
import { useState, useCallback } from "react";

export type PublishStatus = "idle" | "publishing" | "success" | "error";

export function usePublish(pageId: string | undefined, tenantId: string | undefined) {
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const publish = useCallback(async (): Promise<boolean> => {
    if (!pageId || !tenantId) {
      setError("Missing pageId or tenantId");
      return false;
    }
    setStatus("publishing");
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Publish failed: ${res.status}`);
      }
      setStatus("success");
      // Auto-reset to idle after 3s
      setTimeout(() => setStatus("idle"), 3000);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setError(msg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
      return false;
    }
  }, [backendUrl, pageId, tenantId]);

  return { publish, status, error };
}
```

**Step 2: Commit**
```bash
git add apps/canvas-v2/src/hooks/usePublish.ts
git commit -m "feat(canvas-v2): add usePublish hook"
```

---

## Task 3: Add Preview, View Live, and Publish buttons to Header

**Files:**
- Modify: `src/components/Header.tsx`

The goal is to add three clearly labeled action buttons in the header's right section, **only when `pageId` is present** (we're in the editor, not the dashboard).

**Step 1: Add imports to Header.tsx**

```typescript
import { usePublish } from "../hooks/usePublish";
```

Also add these lucide icons (check if already imported; add any missing):
```typescript
import { Globe, Play } from "lucide-react";
```

**Step 2: Add usePublish hook call**

Inside the `Header` component function, after the `usePageList` line:
```typescript
const { publish, status: publishStatus } = usePublish(pageId, tenantId);
```

**Step 3: Add preview and storefront URL helpers**

After the hook:
```typescript
const previewUrl = process.env.NEXT_PUBLIC_PREVIEW_URL ?? "http://localhost:3004";
const storefrontUrl = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3003";
const currentPageSlug = currentPage?.slug;

const handleOpenPreview = () => {
  if (!pageId) return;
  window.open(`${previewUrl}/${pageId}`, "_blank");
};

const handleOpenStorefront = () => {
  if (!currentPageSlug) return;
  window.open(`${storefrontUrl}/${currentPageSlug}`, "_blank");
};

const handleBackendPublish = async () => {
  const ok = await publish();
  window.dispatchEvent(new CustomEvent("show-toast", {
    detail: {
      message: ok ? "Published successfully!" : "Publish failed",
      type: ok ? "success" : "error",
    },
  }));
};
```

**Step 4: Add the three buttons in JSX**

Find the existing Publish button (around line 840–851 in Header.tsx). **Before** it, add the three new buttons. These should only show when `pageId` is present:

```tsx
{pageId && (
  <div className="flex items-center gap-2 border-r border-gray-200 pr-3 mr-1">
    {/* Preview — live STDB state */}
    <button
      onClick={handleOpenPreview}
      title="Open in Preview Server (live, unpublished)"
      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
    >
      <Play className="w-3.5 h-3.5" />
      Preview
    </button>

    {/* View Live — published storefront */}
    <button
      onClick={handleOpenStorefront}
      disabled={!currentPageSlug}
      title="Open published page on Storefront"
      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Globe className="w-3.5 h-3.5" />
      View Live
    </button>

    {/* Publish to backend */}
    <button
      onClick={handleBackendPublish}
      disabled={publishStatus === "publishing"}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        publishStatus === "success"
          ? "bg-green-500 text-white"
          : publishStatus === "error"
          ? "bg-red-500 text-white"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      } disabled:opacity-50`}
    >
      {publishStatus === "publishing" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {publishStatus === "success" ? "Published!" : publishStatus === "error" ? "Failed" : publishStatus === "publishing" ? "Publishing..." : "Publish"}
    </button>
  </div>
)}
```

**Step 5: Verify**
- Open editor at `http://localhost:3005/editor/[pageId]`
- Should see Preview, View Live, Publish buttons in header
- Click Preview → should open `http://localhost:3004/[pageId]` in new tab
- Click Publish → should call backend, show success/error toast
- Click View Live (after publish) → should open storefront

**Step 6: Commit**
```bash
git add apps/canvas-v2/src/components/Header.tsx
git commit -m "feat(canvas-v2): add Preview, View Live, and Publish buttons to editor header"
```

---

## Task 4: Verify preview-server and storefront handle canvas-v2 page IDs

**Step 1: Check preview-server route**

The preview-server at `apps/preview-server/src/app/[pageId]/page.tsx` should already handle pageIds from STDB. Read the file to confirm.

**Step 2: Check storefront route**

The storefront at `apps/storefront/src/app/` likely handles slug-based routes. Read the route file to confirm what URL format it expects.

**Step 3: Test end-to-end**
1. Open dashboard at `http://localhost:3005/`
2. Click a page to open editor
3. Make a small change (add a text element)
4. Click Preview → verify preview-server shows current STDB state
5. Click Publish → wait for success
6. Click View Live → verify storefront shows published version

**Step 4: Fix any issues found during testing**
```bash
git add -p
git commit -m "fix(canvas-v2): preview/storefront integration fixes"
```
