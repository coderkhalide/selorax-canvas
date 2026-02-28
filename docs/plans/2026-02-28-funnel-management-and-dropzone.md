# Funnel Management + Drop Zone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a standalone `/funnels` management UI (listing + detail pages with step CRUD) and improve canvas drop zones with "Drop Here" hints, better visual indicators, and drag-from-panel support.

**Architecture:** 6 independent tasks — backend step CRUD routes, dashboard home update, funnels listing page, funnel detail page, drop zone visual improvements, panel drag support. Backend uses existing Express + Prisma. Frontend uses Next.js 14 Server Components + client mutations with `router.refresh()`.

**Tech Stack:** Next.js 14 App Router, Express + Prisma, @dnd-kit/core, CSS custom properties

---

## Context

**Key files to understand before starting:**
- `apps/canvas-backend/src/routes/funnels.ts` — existing CRUD (GET/POST/PATCH/DELETE funnels, no step-level routes)
- `apps/canvas-backend/src/routes/funnels.test.ts` — existing test file (5 tests, add to it)
- `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/FunnelBuilder.tsx` — existing canvas panel (DO NOT change)
- `apps/canvas-dashboard/src/app/globals.css` — shared CSS with custom properties
- `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx` — `handleDragEnd` around line 95
- `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/ElementsPanel.tsx` — ELEMENT_DEFS with defaultProps/defaultStyles already defined
- `apps/canvas-dashboard/src/context/CanvasContext.tsx` — `insertNode` accepts `Omit<CanvasNode, 'id'> & { id?: string }`

**Critical architecture rules:**
- `tenant_id` in every backend query (via `getTenant(req)`)
- Server Components fetch backend using `NEXT_PUBLIC_BACKEND_URL` env var + `cache: 'no-store'`
- Tenant ID in server components: `headers().get('x-tenant-id') ?? 'store_001'`
- After client mutations: call `router.refresh()` to re-fetch server component data
- Never use `subscribeToAllTables()` — not relevant here (funnels are MySQL-only)

---

## Task 1: Backend Step CRUD Routes

**Goal:** Add `POST/PATCH/DELETE /api/funnels/:id/steps/:stepId` routes so the frontend can manage individual steps.

**Files:**
- Modify: `apps/canvas-backend/src/routes/funnels.ts`
- Modify: `apps/canvas-backend/src/routes/funnels.test.ts`

**Step 1: Add 3 step routes to funnels.ts**

Add these routes at the end of `apps/canvas-backend/src/routes/funnels.ts`, before `export default router;`:

```typescript
// POST /api/funnels/:id/steps — add a step to an existing funnel
router.post('/:id/steps', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const funnel = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      include: { steps: true },
    });
    if (!funnel) return res.status(404).json({ error: 'Not found' });

    const { pageId, stepType, name, stepOrder, onSuccess, onSkip } = req.body;
    const step = await prisma.funnelStep.create({
      data: {
        funnelId: req.params.id,
        pageId:   pageId ?? '',
        stepOrder: stepOrder ?? funnel.steps.length,
        stepType:  stepType ?? 'landing',
        name:      name ?? `Step ${funnel.steps.length + 1}`,
        onSuccess: JSON.stringify(onSuccess ?? { action: 'next' }),
        onSkip:    onSkip ? JSON.stringify(onSkip) : null,
      },
    });
    res.status(201).json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/funnels/:id/steps/:stepId — update a step
router.patch('/:id/steps/:stepId', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const funnel = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!funnel) return res.status(404).json({ error: 'Not found' });

    const { pageId, stepType, name, stepOrder, onSuccess, onSkip } = req.body;
    const step = await prisma.funnelStep.update({
      where: { id: req.params.stepId },
      data: {
        ...(pageId    !== undefined && { pageId }),
        ...(stepType  !== undefined && { stepType }),
        ...(name      !== undefined && { name }),
        ...(stepOrder !== undefined && { stepOrder }),
        ...(onSuccess !== undefined && { onSuccess: JSON.stringify(onSuccess) }),
        ...(onSkip    !== undefined && { onSkip: JSON.stringify(onSkip) }),
      },
    });
    res.json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/funnels/:id/steps/:stepId — remove a step
router.delete('/:id/steps/:stepId', async (req, res) => {
  try {
    const tenant  = getTenant(req);
    const funnel  = await prisma.funnel.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!funnel) return res.status(404).json({ error: 'Not found' });
    await prisma.funnelStep.delete({ where: { id: req.params.stepId } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
```

**Step 2: Write tests**

Open `apps/canvas-backend/src/routes/funnels.test.ts`. Look at the existing mock setup and add a new `describe` block at the end of the file:

```typescript
describe('Funnel Step CRUD', () => {
  it('POST /api/funnels/:id/steps — adds step and returns 201', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1', tenantId: 't1', name: 'Test', goal: null,
      status: 'draft', aiGenerated: false, aiPrompt: null,
      createdAt: new Date(), publishedAt: null, steps: [],
    });
    prismaMock.funnelStep.create.mockResolvedValue({
      id: 'step-1', funnelId: 'f1', pageId: 'page-1',
      stepOrder: 0, stepType: 'landing', name: 'Step 1',
      onSuccess: '{"action":"next"}', onSkip: null,
    });

    const res = await request(app)
      .post('/api/funnels/f1/steps')
      .set('x-tenant-id', 't1')
      .send({ pageId: 'page-1', stepType: 'landing', name: 'Step 1' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('step-1');
  });

  it('PATCH /api/funnels/:id/steps/:stepId — updates step', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'f1', tenantId: 't1', name: 'Test', goal: null,
      status: 'draft', aiGenerated: false, aiPrompt: null,
      createdAt: new Date(), publishedAt: null,
    });
    prismaMock.funnelStep.update.mockResolvedValue({
      id: 'step-1', funnelId: 'f1', pageId: 'page-2',
      stepOrder: 0, stepType: 'checkout', name: 'Checkout',
      onSuccess: '{"action":"next"}', onSkip: null,
    });

    const res = await request(app)
      .patch('/api/funnels/f1/steps/step-1')
      .set('x-tenant-id', 't1')
      .send({ stepType: 'checkout', name: 'Checkout', pageId: 'page-2' });

    expect(res.status).toBe(200);
    expect(res.body.stepType).toBe('checkout');
  });

  it('DELETE /api/funnels/:id/steps/:stepId — returns 404 for wrong tenant', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null); // wrong tenant

    const res = await request(app)
      .delete('/api/funnels/f1/steps/step-1')
      .set('x-tenant-id', 'wrong-tenant');

    expect(res.status).toBe(404);
  });
});
```

**Step 3: Run tests**

```bash
cd apps/canvas-backend && npx vitest run src/routes/funnels.test.ts
```

Expected: all tests pass (original 5 + new 3 = 8 total)

**Step 4: Commit**

```bash
git add apps/canvas-backend/src/routes/funnels.ts apps/canvas-backend/src/routes/funnels.test.ts
git commit -m "feat: add funnel step CRUD routes (POST/PATCH/DELETE)"
```

---

## Task 2: Dashboard Home Page Navigation

**Goal:** Update the home page to link to `/funnels` and provide access to the canvas editor.

**Files:**
- Modify: `apps/canvas-dashboard/src/app/page.tsx`

**Step 1: Replace the dark home page with a proper dashboard hub**

Full replacement of `apps/canvas-dashboard/src/app/page.tsx`:

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F3F4F6',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 40px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: '#2D2F8F', letterSpacing: '-0.5px' }}>
          SeloraX
        </span>
        <span style={{ fontSize: 14, color: '#9CA3AF' }}>Canvas</span>
      </header>

      <main style={{ padding: '48px 40px', maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Dashboard
        </h1>
        <p style={{ color: '#6B7280', marginBottom: 40, fontSize: 15 }}>
          Manage your pages, funnels, and experiments.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <DashboardCard
            href="/funnels"
            icon="🔀"
            title="Funnels"
            description="Build multi-step sales funnels from your pages"
            color="#2D2F8F"
          />
          <DashboardCard
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}/api/pages`}
            icon="📄"
            title="Pages API"
            description="Browse pages via the REST API"
            color="#F47920"
            external
          />
          <DashboardCard
            href="/analytics/funnels/demo"
            icon="📊"
            title="Analytics"
            description="Funnel conversion rates and drop-off analysis"
            color="#10B981"
          />
        </div>
      </main>
    </div>
  );
}

function DashboardCard({
  href, icon, title, description, color, external,
}: {
  href: string; icon: string; title: string; description: string; color: string; external?: boolean;
}) {
  const style: React.CSSProperties = {
    display: 'block', padding: '24px',
    background: '#fff', border: '1px solid #E5E7EB',
    borderRadius: 12, textDecoration: 'none',
    transition: 'box-shadow 0.15s ease',
    cursor: 'pointer',
  };
  const inner = (
    <>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>{description}</p>
      <span style={{
        display: 'inline-block', marginTop: 16,
        fontSize: 12, fontWeight: 600, color,
      }}>Open →</span>
    </>
  );
  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{inner}</a>;
  }
  return <Link href={href} style={style}>{inner}</Link>;
}
```

**Step 2: Verify no tests for page.tsx (there are none)**

**Step 3: Commit**

```bash
git add apps/canvas-dashboard/src/app/page.tsx
git commit -m "feat: update dashboard home page with navigation cards"
```

---

## Task 3: Funnels Listing Page

**Goal:** Create `/funnels` page with card grid, + New Funnel button, and delete action.

**Files to create:**
- `apps/canvas-dashboard/src/app/funnels/page.tsx`
- `apps/canvas-dashboard/src/app/funnels/components/FunnelList.tsx`
- `apps/canvas-dashboard/src/app/funnels/components/CreateFunnelModal.tsx`
- `apps/canvas-dashboard/src/app/funnels/components/FunnelCard.tsx`
- Add CSS to `apps/canvas-dashboard/src/app/globals.css`

**Step 1: Create the Server Component `funnels/page.tsx`**

```tsx
import { headers } from 'next/headers';
import FunnelList from './components/FunnelList';

async function fetchFunnels(tenantId: string) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${backend}/api/funnels`, {
      headers: { 'x-tenant-id': tenantId },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function FunnelsPage() {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id') ?? 'store_001';
  const funnels  = await fetchFunnels(tenantId);

  return <FunnelList initialFunnels={funnels} tenantId={tenantId} />;
}
```

**Step 2: Create `FunnelList.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CreateFunnelModal from './CreateFunnelModal';
import FunnelCard from './FunnelCard';

export interface FunnelSummary {
  id: string; name: string; status: string;
  steps: { id: string; pageId: string }[];
  createdAt: string;
}

export default function FunnelList({
  initialFunnels, tenantId,
}: { initialFunnels: FunnelSummary[]; tenantId: string }) {
  const router     = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const deleteFunnel = async (id: string) => {
    if (!confirm('Delete this funnel? This cannot be undone.')) return;
    setDeleting(id);
    await fetch(`${backend}/api/funnels/${id}`, {
      method:  'DELETE',
      headers: { 'x-tenant-id': tenantId },
    });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="funnels-page">
      <div className="funnels-page-header">
        <div>
          <Link href="/" className="funnels-back-link">← Dashboard</Link>
          <h1 className="funnels-page-title">Funnels</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Funnel
        </button>
      </div>

      {initialFunnels.length === 0 ? (
        <div className="funnels-empty-state">
          <p>No funnels yet.</p>
          <p>Create your first funnel to get started.</p>
        </div>
      ) : (
        <div className="funnels-grid">
          {initialFunnels.map(f => (
            <FunnelCard
              key={f.id}
              funnel={f}
              onDelete={deleteFunnel}
              deleting={deleting === f.id}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateFunnelModal
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            router.push(`/funnels/${id}`);
          }}
        />
      )}
    </div>
  );
}
```

**Step 3: Create `FunnelCard.tsx`**

```tsx
'use client';
import Link from 'next/link';
import type { FunnelSummary } from './FunnelList';

const STATUS_COLORS: Record<string, string> = {
  draft:    'var(--text-tertiary)',
  live:     '#10B981',
  archived: '#9CA3AF',
};

export default function FunnelCard({
  funnel, onDelete, deleting,
}: { funnel: FunnelSummary; onDelete: (id: string) => void; deleting: boolean }) {
  const stepCount  = funnel.steps?.length ?? 0;
  const firstPageId = funnel.steps?.[0]?.pageId;
  const previewBase = 'http://localhost:3004';

  return (
    <div className={`funnel-card${deleting ? ' funnel-card-deleting' : ''}`}>
      <div className="funnel-card-top">
        <span className="funnel-card-status" style={{ color: STATUS_COLORS[funnel.status] ?? STATUS_COLORS.draft }}>
          ● {funnel.status}
        </span>
      </div>
      <h3 className="funnel-card-name">{funnel.name}</h3>
      <p className="funnel-card-meta">
        {stepCount === 0 ? 'No steps yet' : `${stepCount} step${stepCount > 1 ? 's' : ''}`}
      </p>
      <div className="funnel-card-actions">
        <Link href={`/funnels/${funnel.id}`} className="btn btn-secondary btn-sm">
          Edit
        </Link>
        {firstPageId && (
          <a
            href={`${previewBase}/${firstPageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Preview
          </a>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(funnel.id)}
          disabled={deleting}
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Create `CreateFunnelModal.tsx`**

```tsx
'use client';
import { useState } from 'react';

export default function CreateFunnelModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleCreate = async () => {
    if (!name.trim()) { setError('Funnel name is required'); return; }
    setLoading(true);
    setError('');
    const res = await fetch(`${backend}/api/funnels`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body:    JSON.stringify({ name: name.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      const f = await res.json();
      onCreated(f.id);
    } else {
      setError('Failed to create funnel. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Funnel</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Funnel Name</label>
            <input
              autoFocus
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Summer Sale Funnel"
            />
            {error && <p className="field-error">{error}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? 'Creating...' : 'Create Funnel'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Add CSS to `globals.css`**

Append to the end of `apps/canvas-dashboard/src/app/globals.css`:

```css
/* ── Funnels Pages ── */
.funnels-page {
  min-height: 100vh; background: var(--bg-app);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 0;
}
.funnels-page-header {
  display: flex; align-items: flex-end; justify-content: space-between;
  padding: 40px 48px 24px;
  border-bottom: 1px solid var(--border); background: var(--bg-panel);
}
.funnels-back-link {
  display: block; font-size: 13px; color: var(--text-tertiary);
  text-decoration: none; margin-bottom: 4px;
}
.funnels-back-link:hover { color: var(--text-primary); }
.funnels-page-title { font-size: 26px; font-weight: 700; color: var(--text-primary); }
.funnels-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 16px; padding: 32px 48px;
}
.funnels-empty-state {
  padding: 80px 48px; text-align: center; color: var(--text-tertiary);
  font-size: 15px; line-height: 1.8;
}

/* Funnel Card */
.funnel-card {
  background: var(--bg-panel); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
  transition: box-shadow 0.15s ease; position: relative;
}
.funnel-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
.funnel-card-deleting { opacity: 0.5; pointer-events: none; }
.funnel-card-top { margin-bottom: 8px; }
.funnel-card-status { font-size: 11px; font-weight: 600; text-transform: capitalize; }
.funnel-card-name { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
.funnel-card-meta { font-size: 13px; color: var(--text-tertiary); margin-bottom: 16px; }
.funnel-card-actions { display: flex; gap: 6px; flex-wrap: wrap; }

/* Funnel Detail Page */
.funnel-detail-page {
  min-height: 100vh; background: var(--bg-app);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.funnel-detail-header {
  padding: 32px 48px 24px; background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}
.funnel-detail-title-row {
  display: flex; align-items: center; gap: 12; margin-top: 8px;
}
.funnel-detail-name { font-size: 26px; font-weight: 700; color: var(--text-primary); }

/* Funnel Steps Flow */
.funnel-steps-flow { padding: 32px 48px; max-width: 800px; }
.funnel-steps-empty {
  color: var(--text-tertiary); font-size: 14px; padding: 40px 0; text-align: center;
}
.funnel-flow-item { display: flex; flex-direction: column; }
.funnel-flow-connector {
  text-align: center; padding: 8px 0; color: var(--text-tertiary);
  font-size: 20px; line-height: 1;
}
.funnel-step-card {
  background: var(--bg-panel); border: 1px solid var(--border); border-radius: 10px;
  padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.funnel-step-card-left {
  display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;
}
.funnel-step-number { font-size: 11px; font-weight: 600; color: var(--text-tertiary); white-space: nowrap; }
.funnel-step-icon { font-size: 20px; }
.funnel-step-info { flex: 1; min-width: 0; }
.funnel-step-name { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); }
.funnel-step-page { display: block; font-size: 12px; color: var(--text-tertiary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.funnel-step-type-badge {
  font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px;
  white-space: nowrap; text-transform: capitalize;
}
.funnel-step-actions { display: flex; gap: 6px; flex-shrink: 0; }
.funnel-add-step-btn {
  margin-top: 16px; padding: 12px 24px;
  background: none; border: 2px dashed var(--border);
  border-radius: 8px; cursor: pointer; font-size: 14px;
  color: var(--text-tertiary); width: 100%;
  transition: all 0.15s ease;
}
.funnel-add-step-btn:hover { border-color: var(--brand-navy); color: var(--brand-navy); }

/* Shared Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--bg-panel); border-radius: 12px;
  width: 480px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px 0; margin-bottom: 20px;
}
.modal-header h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.modal-close-btn {
  background: none; border: none; cursor: pointer;
  font-size: 16px; color: var(--text-tertiary); padding: 4px;
}
.modal-close-btn:hover { color: var(--text-primary); }
.modal-body { padding: 0 24px; }
.modal-footer {
  padding: 20px 24px; border-top: 1px solid var(--border);
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;
}

/* Form Fields */
.field-group { margin-bottom: 16px; }
.field-label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.field-input, .field-select {
  width: 100%; padding: 8px 12px;
  background: var(--bg-app); border: 1px solid var(--border);
  border-radius: 6px; font-size: 14px; color: var(--text-primary); outline: none;
}
.field-input:focus, .field-select:focus { border-color: var(--brand-navy); }
.field-error { font-size: 12px; color: #EF4444; margin-top: 4px; }

/* Button variants */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; text-decoration: none; transition: opacity 0.1s ease; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--brand-navy); color: #fff; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-secondary { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { background: var(--border); }
.btn-danger { background: #FEE2E2; color: #EF4444; border: 1px solid #FECACA; }
.btn-danger:hover:not(:disabled) { background: #FECACA; }
.btn-sm { padding: 5px 10px; font-size: 12px; }
```

**Step 6: Run the backend to verify the `/api/funnels` route works**

```bash
# In one terminal:
npm run dev --workspace=apps/canvas-backend

# In another, test the route:
curl -s http://localhost:3001/api/funnels -H "x-tenant-id: store_001" | head -c 200
```

Expected: JSON array (empty if no funnels, or an array of funnel objects)

**Step 7: Commit**

```bash
git add apps/canvas-dashboard/src/app/funnels/ apps/canvas-dashboard/src/app/globals.css
git commit -m "feat: add /funnels listing page with card grid and create modal"
```

---

## Task 4: Funnel Detail Page

**Goal:** Create `/funnels/[funnelId]` page showing step flow with edit/preview/configure/remove actions.

**Files to create:**
- `apps/canvas-dashboard/src/app/funnels/[funnelId]/page.tsx`
- `apps/canvas-dashboard/src/app/funnels/[funnelId]/components/FunnelDetailView.tsx`
- `apps/canvas-dashboard/src/app/funnels/[funnelId]/components/AddStepModal.tsx`
- `apps/canvas-dashboard/src/app/funnels/[funnelId]/components/ConfigureStepModal.tsx`

**Step 1: Create the Server Component**

Create `apps/canvas-dashboard/src/app/funnels/[funnelId]/page.tsx`:

```tsx
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import FunnelDetailView from './components/FunnelDetailView';

const backend = () => process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

async function fetchFunnel(funnelId: string, tenantId: string) {
  try {
    const res = await fetch(`${backend()}/api/funnels/${funnelId}`, {
      headers: { 'x-tenant-id': tenantId }, cache: 'no-store',
    });
    return res.ok ? res.json() : null;
  } catch { return null; }
}

async function fetchPages(tenantId: string) {
  try {
    const res = await fetch(`${backend()}/api/pages`, {
      headers: { 'x-tenant-id': tenantId }, cache: 'no-store',
    });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function FunnelDetailPage({ params }: { params: { funnelId: string } }) {
  const headersList = headers();
  const tenantId    = headersList.get('x-tenant-id') ?? 'store_001';

  const [funnel, pages] = await Promise.all([
    fetchFunnel(params.funnelId, tenantId),
    fetchPages(tenantId),
  ]);

  if (!funnel) notFound();

  return <FunnelDetailView funnel={funnel} pages={pages} tenantId={tenantId} />;
}
```

**Step 2: Create `FunnelDetailView.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddStepModal from './AddStepModal';
import ConfigureStepModal from './ConfigureStepModal';

export interface FunnelStep {
  id: string; pageId: string; stepOrder: number;
  stepType: string; name: string; onSuccess: string;
}
export interface Page { id: string; name: string; slug: string; pageType?: string; }
interface Funnel { id: string; name: string; status: string; steps: FunnelStep[]; }

const STEP_ICONS: Record<string, string> = {
  landing: '🏠', checkout: '💳', upsell: '⬆️', downsell: '⬇️', thankyou: '✅',
};
const STEP_COLORS: Record<string, string> = {
  landing: '#2D2F8F', checkout: '#F47920', upsell: '#10B981', downsell: '#F59E0B', thankyou: '#6B7280',
};

export default function FunnelDetailView({
  funnel, pages, tenantId,
}: { funnel: Funnel; pages: Page[]; tenantId: string }) {
  const router          = useRouter();
  const [showAdd,       setShowAdd]       = useState(false);
  const [configStep,    setConfigStep]    = useState<FunnelStep | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  const previewBase = 'http://localhost:3004';

  const removeStep = async (stepId: string) => {
    if (!confirm('Remove this step from the funnel?')) return;
    await fetch(`${backend}/api/funnels/${funnel.id}/steps/${stepId}`, {
      method: 'DELETE', headers: { 'x-tenant-id': tenantId },
    });
    router.refresh();
  };

  const sortedSteps = [...funnel.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const pageMap = Object.fromEntries(pages.map(p => [p.id, p]));

  return (
    <div className="funnel-detail-page">
      <div className="funnel-detail-header">
        <Link href="/funnels" className="funnels-back-link">← Funnels</Link>
        <div className="funnel-detail-title-row">
          <h1 className="funnel-detail-name">{funnel.name}</h1>
          <span className="funnel-card-status" style={{ color: funnel.status === 'live' ? '#10B981' : 'var(--text-tertiary)', marginLeft: 12 }}>
            ● {funnel.status}
          </span>
        </div>
      </div>

      <div className="funnel-steps-flow">
        {sortedSteps.length === 0 && (
          <p className="funnel-steps-empty">No steps yet. Add your first step to build the funnel.</p>
        )}

        {sortedSteps.map((step, i) => {
          const page  = pageMap[step.pageId];
          const color = STEP_COLORS[step.stepType] ?? '#6B7280';
          return (
            <div key={step.id} className="funnel-flow-item">
              <div className="funnel-step-card">
                <div className="funnel-step-card-left">
                  <span className="funnel-step-number">Step {step.stepOrder + 1}</span>
                  <span className="funnel-step-icon">{STEP_ICONS[step.stepType] ?? '📄'}</span>
                  <div className="funnel-step-info">
                    <span className="funnel-step-name">{step.name}</span>
                    <span className="funnel-step-page">
                      {page ? `${page.name} · /${page.slug}` : (step.pageId ? step.pageId : 'No page assigned')}
                    </span>
                  </div>
                  <span
                    className="funnel-step-type-badge"
                    style={{ background: color + '18', color }}
                  >
                    {step.stepType}
                  </span>
                </div>
                <div className="funnel-step-actions">
                  {step.pageId && (
                    <Link href={`/canvas/${step.pageId}`} className="btn btn-secondary btn-sm">
                      Edit Page
                    </Link>
                  )}
                  {step.pageId && (
                    <a href={`${previewBase}/${step.pageId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      Preview
                    </a>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfigStep(step)}>
                    Configure
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeStep(step.id)}>
                    Remove
                  </button>
                </div>
              </div>
              {i < sortedSteps.length - 1 && (
                <div className="funnel-flow-connector">↓</div>
              )}
            </div>
          );
        })}

        <button className="funnel-add-step-btn" onClick={() => setShowAdd(true)}>
          + Add Step
        </button>
      </div>

      {showAdd && (
        <AddStepModal
          funnelId={funnel.id}
          stepOrder={sortedSteps.length}
          tenantId={tenantId}
          pages={pages}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {configStep && (
        <ConfigureStepModal
          funnelId={funnel.id}
          step={configStep}
          tenantId={tenantId}
          pages={pages}
          onClose={() => setConfigStep(null)}
          onSaved={() => { setConfigStep(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
```

**Step 3: Create `AddStepModal.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { Page } from './FunnelDetailView';

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'] as const;

export default function AddStepModal({
  funnelId, stepOrder, tenantId, pages, onClose, onAdded,
}: {
  funnelId: string; stepOrder: number; tenantId: string; pages: Page[];
  onClose: () => void; onAdded: () => void;
}) {
  const [pageId,   setPageId]   = useState('');
  const [stepType, setStepType] = useState<string>('landing');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleAdd = async () => {
    setLoading(true); setError('');
    const res = await fetch(`${backend}/api/funnels/${funnelId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        pageId,
        stepType,
        name: name.trim() || `Step ${stepOrder + 1}`,
        stepOrder,
        onSuccess: { action: 'next' },
      }),
    });
    setLoading(false);
    if (res.ok) { onAdded(); }
    else { setError('Failed to add step.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Step</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Step Name (optional)</label>
            <input
              autoFocus className="field-input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Step ${stepOrder + 1}`}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Page</label>
            <select className="field-select" value={pageId} onChange={e => setPageId(e.target.value)}>
              <option value="">— Select a page —</option>
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name} · /{p.slug}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Step Type</label>
            <select className="field-select" value={stepType} onChange={e => setStepType(e.target.value)}>
              {STEP_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding...' : 'Add Step'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create `ConfigureStepModal.tsx`**

```tsx
'use client';
import { useState } from 'react';
import type { FunnelStep, Page } from './FunnelDetailView';

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'] as const;

export default function ConfigureStepModal({
  funnelId, step, tenantId, pages, onClose, onSaved,
}: {
  funnelId: string; step: FunnelStep; tenantId: string; pages: Page[];
  onClose: () => void; onSaved: () => void;
}) {
  const [pageId,    setPageId]    = useState(step.pageId);
  const [stepType,  setStepType]  = useState(step.stepType);
  const [name,      setName]      = useState(step.name);
  const [onSuccess, setOnSuccess] = useState(() => {
    try { return JSON.parse(step.onSuccess).action ?? 'next'; } catch { return 'next'; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleSave = async () => {
    setLoading(true); setError('');
    const res = await fetch(`${backend}/api/funnels/${funnelId}/steps/${step.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        pageId, stepType, name,
        onSuccess: { action: onSuccess },
      }),
    });
    setLoading(false);
    if (res.ok) { onSaved(); }
    else { setError('Failed to save step.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Step</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Step Name</label>
            <input className="field-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Page</label>
            <select className="field-select" value={pageId} onChange={e => setPageId(e.target.value)}>
              <option value="">— Select a page —</option>
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name} · /{p.slug}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Step Type</label>
            <select className="field-select" value={stepType} onChange={e => setStepType(e.target.value)}>
              {STEP_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">On Success</label>
            <select className="field-select" value={onSuccess} onChange={e => setOnSuccess(e.target.value)}>
              <option value="next">Next step</option>
              <option value="skip">Skip to end</option>
              <option value="external">External URL</option>
            </select>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 5: Verify no tests needed for server components (there are none)**

**Step 6: Run backend test suite to confirm no regressions**

```bash
npm run test:backend
```

Expected: all 169 tests pass (166 existing + 3 new step CRUD tests from Task 1)

**Step 7: Commit**

```bash
git add apps/canvas-dashboard/src/app/funnels/[funnelId]/
git commit -m "feat: add /funnels/[id] detail page with step flow and modals"
```

---

## Task 5: Drop Zone Visual Improvements

**Goal:** Add "Drop Here" hint in empty layout containers, improve the before/after line indicator with navy color + dot cap.

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/DropZoneIndicator.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasNode.tsx`
- Modify: `apps/canvas-dashboard/src/app/globals.css`

**Step 1: Update `DropZoneIndicator.tsx`** (full replacement)

```tsx
export type DropPosition = 'before' | 'after' | 'inside' | null;

export function DropZoneLine({ position }: { position: 'before' | 'after' }) {
  return <div className={`drop-zone-line drop-zone-${position}`} />;
}

export function DropHereHint() {
  return <div className="drop-here-hint">Drop Here</div>;
}
```

**Step 2: Update `globals.css` drop zone section**

Find the existing drop zone section (`.drop-zone-line { ... }`) and replace it:

```css
/* Drop zone indicators */
.drop-zone-line {
  position: absolute; left: 4px; right: 4px; height: 3px;
  background: var(--brand-navy); border-radius: 2px;
  z-index: 20; pointer-events: none;
  box-shadow: 0 0 0 1px rgba(45,47,143,0.12), 0 0 8px rgba(45,47,143,0.25);
}
.drop-zone-line::before {
  content: '';
  position: absolute; left: -3px; top: 50%; transform: translateY(-50%);
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--brand-navy);
}
.drop-zone-before { top: -2px; }
.drop-zone-after  { bottom: -2px; }

.drop-here-hint {
  min-height: 56px; margin: 8px;
  border: 2px dashed var(--border);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-tertiary); font-size: 12px; font-weight: 500;
  pointer-events: none; transition: all 0.15s ease;
  user-select: none;
}
.canvas-node-layout.is-drop-inside .drop-here-hint {
  border-color: var(--brand-navy);
  background: rgba(45,47,143,0.04);
  color: var(--brand-navy);
}
```

**Note:** The old CSS classes were `.before` and `.after`. The new ones are `.drop-zone-before` and `.drop-zone-after`. Update the class names in `CanvasNode.tsx` in the next step.

**Step 3: Update `CanvasNode.tsx`**

In the layout branch, make 3 changes:

1. Import `DropHereHint` from `DropZoneIndicator`:
```tsx
import { DropZoneLine, DropHereHint } from './DropZoneIndicator';
```

2. Add `is-drop-inside` class to the layout wrapper:
```tsx
className={`canvas-node-layout${isDropInside ? ' is-drop-inside' : ''}`}
```

3. Add "Drop Here" inside the layout, before the children map:
```tsx
{(!node.children || node.children.length === 0) && !isDragging && (
  <DropHereHint />
)}
```

4. Update `DropZoneLine` `position` prop to use new class names:
- Change `<DropZoneLine position="before" />` → keep as-is (the component uses `drop-zone-${position}` so `before` → `drop-zone-before` ✓)

The full updated layout branch of `CanvasNode.tsx`:

```tsx
if (nodeType === 'layout') {
  return (
    <div
      ref={setRef}
      style={{ ...parseStyles(node.styles), ...wrapperStyle }}
      className={`canvas-node-layout${isDropInside ? ' is-drop-inside' : ''}`}
      data-node-id={node.id}
      onClick={handleClick}
    >
      {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
      {DragHandle}
      {isSelected && !isDragging && (
        <FloatingToolbar nodeId={node.id} nodeName={getNodeLabel(node)} />
      )}
      {(!node.children || node.children.length === 0) && !isDragging && (
        <DropHereHint />
      )}
      {node.children?.map((child: any) => (
        <CanvasNode key={child.id} node={child} depth={depth + 1} dropInfo={dropInfo} />
      ))}
      {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
    </div>
  );
}
```

**Step 4: Verify no TypeScript errors**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (no errors)

**Step 5: Commit**

```bash
git add "apps/canvas-dashboard/src/app/canvas/[pageId]/components/DropZoneIndicator.tsx" \
        "apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasNode.tsx" \
        "apps/canvas-dashboard/src/app/globals.css"
git commit -m "feat: improve drop zone visuals — Drop Here hint and navy indicator line"
```

---

## Task 6: Panel Drag Support

**Goal:** Make elements in the left panel draggable so they can be dropped directly onto the canvas at a specific position.

**Files:**
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/ElementsPanel.tsx`
- Modify: `apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx`

**Step 1: Update `ElementsPanel.tsx`**

Add `useDraggable` import from `@dnd-kit/core` (already imported in this file, check and add if not present):
```tsx
import { useDraggable } from '@dnd-kit/core';
```

Extract a `DraggableElementCard` component (add at the bottom of the file, outside `ElementsPanel`):

```tsx
type ElementDef = (typeof ELEMENT_DEFS.layout)[0] | (typeof ELEMENT_DEFS.content)[0];

function DraggableElementCard({
  def, onAdd,
}: { def: ElementDef; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id:   `new-${def.key}`,
    data: {
      type:          'new-element',
      nodeType:      def.nodeType,
      defaultProps:  def.defaultProps,
      defaultStyles: def.defaultStyles,
    },
  });

  return (
    <button
      ref={setNodeRef}
      className="element-card"
      style={{ opacity: isDragging ? 0.5 : 1, touchAction: 'none' }}
      onClick={onAdd}
      {...listeners}
      {...attributes}
    >
      <span className="element-card-icon">{def.icon}</span>
      <span>{def.label}</span>
    </button>
  );
}
```

In `ElementsPanel`, replace the plain `<button className="element-card" ...>` with `<DraggableElementCard>`:

```tsx
{ELEMENT_DEFS.layout.map(def => (
  <DraggableElementCard key={def.key} def={def} onAdd={() => addElement(def)} />
))}
```

```tsx
{ELEMENT_DEFS.content.map(def => (
  <DraggableElementCard key={def.key} def={def} onAdd={() => addElement(def)} />
))}
```

**Step 2: Update `CanvasPage.tsx` — extend `handleDragEnd`**

Find `handleDragEnd` (around line 95). Add a new branch at the START of the function, before the existing node-move logic:

```tsx
const handleDragEnd = useCallback((event: DragEndEvent) => {
  setDraggingId(null);
  const currentDropInfo = dropInfo;
  setDropInfo(null);
  const { active, over } = event;

  // ── Panel element dropped onto canvas ──────────────────────
  if (active.data.current?.type === 'new-element') {
    if (!over) return;
    const { nodeType, defaultProps, defaultStyles } = active.data.current as {
      nodeType: 'layout' | 'element' | 'component';
      defaultProps: Record<string, unknown>;
      defaultStyles: Record<string, unknown>;
    };
    const overNode = nodes.get(over.id as string);
    if (!overNode) return;

    let newParentId: string | null = null;
    let newOrder: string;

    if (currentDropInfo?.position === 'inside' && overNode.nodeType === 'layout') {
      // Drop inside a layout container
      newParentId = over.id as string;
      const children = Array.from(nodes.values())
        .filter(n => n.parentId === newParentId)
        .sort((a, b) => a.order.localeCompare(b.order));
      newOrder = resolveDropOrder(children.at(-1)?.order, undefined);
    } else {
      // Drop before/after a sibling
      const position = currentDropInfo?.position ?? 'after';
      newParentId    = overNode.parentId ?? null;
      const siblings = Array.from(nodes.values())
        .filter(n => n.parentId === newParentId)
        .sort((a, b) => a.order.localeCompare(b.order));
      const overIdx  = siblings.findIndex(n => n.id === over.id);
      newOrder = position === 'before'
        ? resolveDropOrder(siblings[overIdx - 1]?.order, overNode.order)
        : resolveDropOrder(overNode.order, siblings[overIdx + 1]?.order);
    }

    insertNode({
      pageId, tenantId,
      nodeType,
      parentId: newParentId,
      order:    newOrder,
      props:    JSON.stringify(defaultProps ?? {}),
      styles:   JSON.stringify(defaultStyles ?? {}),
      settings: '{}',
    });
    return; // ← don't fall through to move-node logic
  }

  // ── Existing node moved ─────────────────────────────────────
  if (!over || active.id === over.id) return;
  // ... rest of existing handleDragEnd logic unchanged ...
}, [nodes, dropInfo, setDraggingId, moveNode, insertNode, pageId, tenantId]);
```

**IMPORTANT:** The `insertNode` must be added to the dependency array of `useCallback`. Check that `insertNode` is destructured from `useCanvas()` at the top of the `CanvasUI` component — it already is (check the existing destructuring line like `const { nodes, moveNode, ... } = useCanvas()`). Add `insertNode` to that destructuring if it's not there.

**Step 3: Verify TypeScript**

```bash
cd apps/canvas-dashboard && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors

**Step 4: Manual test**

Start the dev server and test:
1. Open `/canvas/[any-pageId]`
2. Drag "Heading" from the Elements panel over an empty layout → see "Drop Here" hint highlight in navy
3. Release — a new Heading node should appear in the layout
4. Drag "Section" from the panel between two existing nodes → see blue line indicator → release → Section inserted at that position
5. Verify existing node drag-and-drop still works

**Step 5: Commit**

```bash
git add "apps/canvas-dashboard/src/app/canvas/[pageId]/components/panels/ElementsPanel.tsx" \
        "apps/canvas-dashboard/src/app/canvas/[pageId]/components/CanvasPage.tsx"
git commit -m "feat: enable drag-from-panel to canvas for elements"
```

---

## Final verification

```bash
# Run all backend tests
npm run test:backend
# Expected: 169 tests pass

# Run all renderer tests
npm run test:renderer
# Expected: 23 tests pass

# TypeScript check
cd apps/canvas-dashboard && npx tsc --noEmit
# Expected: no errors
```
