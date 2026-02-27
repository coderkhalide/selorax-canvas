# Phase 12 — AI Tools Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 10 new AI tools to the canvas agent covering screenshots/visual context, page management, funnel management, and A/B experiment creation — plus fix the broken insert_node ordering bug.

**Architecture:** All tools follow the existing `createTool({ id, description, inputSchema, outputSchema, execute })` Mastra pattern with `tenant_id` as the first param. New tools are registered in `index.ts`, wired into `canvas-agent.ts`, and exposed via `mcp/server.ts`. The screenshot tool chains through the thumbnail pipeline: frontend captures DOM → POST `/api/pages/:id/thumbnail` → R2 → MySQL `thumbnailUrl` → `get_canvas_screenshot` tool fetches + base64-encodes for Claude vision.

**Tech Stack:** Node.js 20, Mastra v1.8.0, Prisma (MySQL), ioredis, SpacetimeDB HTTP client, Cloudflare R2 (S3-compatible), Vitest for tests. All backend files in `apps/canvas-backend/src/`.

---

## Critical Context (read before touching any file)

- **Tenant isolation is non-negotiable:** every tool must include `tenant_id` in its inputSchema and filter all DB queries by it.
- **Test pattern:** mock `../../spacetime/client`, `../../db`, `../../redis/client` at the top of every test file with `vi.mock`. See `canvas-write-tools.test.ts` for the exact pattern.
- **Tool test execution:** `execute` function receives the input object directly (not wrapped in `{ context }`). E.g. `tool.execute({ tenant_id: 't1', page_id: 'p1' })`.
- **Prisma mock pattern:** `vi.mock('../../db', () => ({ prisma: { page: { findMany: vi.fn() } } }))` — stub only the methods the tool under test calls.
- **callReducer mock:** `vi.mock('../../spacetime/client', () => ({ callReducer: vi.fn().mockResolvedValue(undefined), opt: vi.fn(v => v ?? null) }))`
- **Run tests:** `npm test` from `apps/canvas-backend/`
- **Run TypeScript:** `npx tsc --noEmit` from `apps/canvas-backend/`
- **After Prisma schema changes:** `cd apps/canvas-backend && npx prisma migrate dev --name <name>` then `npx prisma generate`

---

## Task 1: Fix insert_node ordering (`resolveOrder` → async `resolveInsertOrder`)

**Problem:** `resolveOrder('after:nodeId')` returns `m${Date.now()}` — a timestamp, not a fractional index. Multiple rapid AI inserts with `"after:<nodeId>"` position all get similar timestamps and collide.

**Fix:** Make order resolution async. For `"after:<nodeId>"`, query STDB for siblings and compute a proper fractional order using `generateOrder` from `utils/order.ts`.

**Files:**
- Modify: `src/mastra/tools/insert-node.ts`
- Modify: `src/mastra/tools/resolve-order.test.ts`
- Modify: `src/mastra/tools/canvas-write-tools.test.ts`

### Step 1: Update resolve-order.test.ts with new contract

Replace the entire file:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock STDB client — resolveInsertOrder calls getPageNodes for "after:" position
const getPageNodesMock = vi.fn();
vi.mock('../../spacetime/client', () => ({
  getPageNodes: getPageNodesMock,
  callReducer: vi.fn(),
  opt: vi.fn(v => v ?? null),
}));

import { resolveInsertOrder } from './insert-node';

const SIBLINGS = [
  { id: 'a', parent_id: 'root', order: 'a0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  { id: 'b', parent_id: 'root', order: 'b0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  { id: 'c', parent_id: 'root', order: 'c0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  getPageNodesMock.mockResolvedValue(SIBLINGS);
});

describe('resolveInsertOrder', () => {
  it('"first" returns "a0" without querying STDB', async () => {
    const result = await resolveInsertOrder('first', 'p1', 't1', 'root');
    expect(result).toBe('a0');
    expect(getPageNodesMock).not.toHaveBeenCalled();
  });

  it('"last" returns a z-prefixed string without querying STDB', async () => {
    const result = await resolveInsertOrder('last', 'p1', 't1', 'root');
    expect(result).toMatch(/^z/);
    expect(getPageNodesMock).not.toHaveBeenCalled();
  });

  it('"after:a" returns order AFTER a0 and BEFORE b0', async () => {
    const result = await resolveInsertOrder('after:a', 'p1', 't1', 'root');
    expect(result > 'a0').toBe(true);
    expect(result < 'b0').toBe(true);
    expect(getPageNodesMock).toHaveBeenCalledWith('p1', 't1');
  });

  it('"after:c" (last sibling) returns order after c0', async () => {
    const result = await resolveInsertOrder('after:c', 'p1', 't1', 'root');
    expect(result > 'c0').toBe(true);
    expect(getPageNodesMock).toHaveBeenCalledWith('p1', 't1');
  });

  it('"after:nonexistent" falls back to "last" order (z-prefixed)', async () => {
    const result = await resolveInsertOrder('after:nonexistent', 'p1', 't1', 'root');
    expect(result).toMatch(/^z/);
  });
});
```

### Step 2: Run test — confirm it fails

```bash
cd apps/canvas-backend && npm test -- resolve-order
```
Expected: FAIL — `resolveInsertOrder` not exported yet.

### Step 3: Update insert-node.ts

Replace the file `src/mastra/tools/insert-node.ts`:

```typescript
import { createTool }    from '@mastra/core/tools';
import { z }             from 'zod';
import { callReducer, getPageNodes, opt } from '../../spacetime/client';
import { generateOrder, orderFirst, orderLast } from '../../utils/order';

// Exported for testing
export async function resolveInsertOrder(
  position: string,
  pageId: string,
  tenantId: string,
  parentId: string,
): Promise<string> {
  if (position === 'first') return orderFirst();
  if (position === 'last')  return orderLast();

  // "after:<nodeId>" — find node and next sibling, compute fractional order between them
  const afterId = position.startsWith('after:') ? position.slice(6) : null;
  if (!afterId) return orderLast(); // unknown position → append

  const nodes = await getPageNodes(pageId, tenantId);
  const siblings = nodes
    .filter(n => (n.parent_id ?? null) === (parentId === 'root' ? null : parentId))
    .sort((a, b) => a.order.localeCompare(b.order));

  const idx = siblings.findIndex(n => n.id === afterId);
  if (idx === -1) return orderLast(); // node not found → append

  const after  = siblings[idx].order;
  const before = siblings[idx + 1]?.order; // undefined if last sibling
  return generateOrder(after, before);
}

export const insertNodeTool = createTool({
  id: 'insert_node',
  description: 'Create a new canvas node that appears live on all clients instantly. Returns the new node_id.',
  inputSchema: z.object({
    tenant_id:         z.string(),
    page_id:           z.string(),
    parent_id:         z.string().describe('Parent node id, or "root" for top-level'),
    position:          z.string().describe('"first" | "last" | "after:<nodeId>"'),
    node_type:         z.enum(['layout', 'element', 'component', 'slot']),
    styles:            z.record(z.any()).optional(),
    props:             z.record(z.any()).optional(),
    settings:          z.record(z.any()).optional(),
    component_id:      z.string().optional(),
    component_url:     z.string().optional(),
    component_version: z.string().optional(),
  }),
  outputSchema: z.object({ node_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const nodeId = crypto.randomUUID();
    const order  = await resolveInsertOrder(
      context.position,
      context.page_id,
      context.tenant_id,
      context.parent_id,
    );

    await callReducer('insert_node', {
      id:                nodeId,
      page_id:           context.page_id,
      tenant_id:         context.tenant_id,
      parent_id:         opt(context.parent_id === 'root' ? null : context.parent_id),
      order,
      node_type:         context.node_type,
      styles:            JSON.stringify(context.styles  ?? {}),
      props:             JSON.stringify(context.props   ?? {}),
      settings:          JSON.stringify(context.settings ?? {}),
      component_id:      opt(context.component_id),
      component_url:     opt(context.component_url),
      component_version: opt(context.component_version),
    });

    return { node_id: nodeId, message: `Node ${nodeId} inserted at position "${context.position}".` };
  },
});
```

### Step 4: Update canvas-write-tools.test.ts — add "after:" test

In `canvas-write-tools.test.ts`, add this test inside the `describe('insertNodeTool')` block:

```typescript
it('resolves "after:<nodeId>" by querying STDB and returns fractional order between siblings', async () => {
  const { getPageNodes } = await import('../../spacetime/client');
  const getPageNodesMock = getPageNodes as ReturnType<typeof vi.fn>;
  getPageNodesMock.mockResolvedValueOnce([
    { id: 'a', parent_id: 'root', order: 'a0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
    { id: 'b', parent_id: 'root', order: 'b0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  ]);

  await insertNodeTool.execute({
    tenant_id: 't1', page_id: 'p1', parent_id: 'root',
    position: 'after:a', node_type: 'element',
  });

  const [, args] = mockCallReducer.mock.calls[0];
  expect(args.order > 'a0').toBe(true);
  expect(args.order < 'b0').toBe(true);
});
```

Also update the mock at top of `canvas-write-tools.test.ts` to include `getPageNodes`:
```typescript
vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn().mockResolvedValue([]),
  callReducer: vi.fn().mockResolvedValue(undefined),
  opt: vi.fn((v: unknown) => v ?? null),
}));
```

### Step 5: Run tests and confirm passing

```bash
cd apps/canvas-backend && npm test
```
Expected: all tests pass.

### Step 6: TypeScript check

```bash
cd apps/canvas-backend && npx tsc --noEmit
```

---

## Task 2: Thumbnail backend route + Page schema `thumbnailUrl`

The frontend already calls `POST /api/pages/:id/thumbnail` — this backend route doesn't exist yet. We need to: create it, upload to R2, and store the URL in the Page record.

**Files:**
- Modify: `prisma/schema.prisma` — add `thumbnailUrl` to Page model
- Create: `src/routes/thumbnail.ts`
- Modify: `src/index.ts` — register thumbnail route
- Create: `src/routes/thumbnail.test.ts`

### Step 1: Add `thumbnailUrl` to Page schema

In `prisma/schema.prisma`, add to the `Page` model (after `publishedAt`):

```prisma
thumbnailUrl       String?   @map("thumbnail_url")
thumbnailUpdatedAt DateTime? @map("thumbnail_updated_at")
```

### Step 2: Run Prisma migration

```bash
cd apps/canvas-backend && npx prisma migrate dev --name add_thumbnail_url && npx prisma generate
```
Expected: Migration applied, client regenerated.

### Step 3: Write failing test

Create `src/routes/thumbnail.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock S3 client
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn().mockResolvedValue({}) })),
  PutObjectCommand: vi.fn().mockImplementation((args) => args),
}));

// Mock Prisma
const updateMock = vi.fn().mockResolvedValue({ id: 'page1', thumbnailUrl: 'https://r2.test/thumbnails/t1/page1.png' });
vi.mock('../db', () => ({ prisma: { page: { findFirst: vi.fn(), update: updateMock } } }));

import request from 'supertest';
import express from 'express';
import router from './thumbnail';

const app = express();
app.use(express.raw({ type: 'multipart/form-data', limit: '10mb' }));
// Mount with tenant middleware stub
app.use((req: any, _res: any, next: any) => { req.tenant = { id: 't1', name: 'Test' }; next(); });
app.use('/', router);

// Import prisma mock after app setup
import { prisma } from '../db';
const prismaMock = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.page.findFirst.mockResolvedValue({ id: 'page1', tenantId: 't1' });
  updateMock.mockResolvedValue({ id: 'page1', thumbnailUrl: 'https://r2.test/thumbnails/t1/page1.png' });
});

describe('POST /api/pages/:id/thumbnail', () => {
  it('returns 404 when page not found', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/page1/thumbnail')
      .attach('thumbnail', Buffer.from('fake-png'), { filename: 'thumbnail.png', contentType: 'image/png' });

    expect(res.status).toBe(404);
  });

  it('updates thumbnailUrl on the page record on success', async () => {
    const res = await request(app)
      .post('/page1/thumbnail')
      .attach('thumbnail', Buffer.from('fake-png'), { filename: 'thumbnail.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'page1' },
        data: expect.objectContaining({ thumbnailUrl: expect.stringContaining('page1') }),
      }),
    );
    expect(res.body.thumbnailUrl).toBeDefined();
  });
});
```

### Step 4: Run — confirm fails

```bash
cd apps/canvas-backend && npm test -- thumbnail
```
Expected: FAIL — router not found.

### Step 5: Create `src/routes/thumbnail.ts`

```typescript
import { Router }    from 'express';
import { prisma }    from '../db';
import { getTenant } from '../middleware/tenant';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import Busboy from 'busboy';

const router = Router();

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

// POST /api/pages/:id/thumbnail
// Body: multipart/form-data with 'thumbnail' file (PNG/JPEG)
router.post('/:id/thumbnail', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
    });
    if (!page) return res.status(404).json({ error: 'Page not found' });

    // Parse multipart body
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const bb = Busboy({ headers: req.headers });
      bb.on('file', (_name, stream) => {
        stream.on('data', (d: Buffer) => chunks.push(d));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
      bb.on('error', reject);
      req.pipe(bb);
    });

    const key = `thumbnails/${tenant.id}/${req.params.id}.png`;
    await s3.send(new PutObjectCommand({
      Bucket:      process.env.S3_BUCKET!,
      Key:         key,
      Body:        buffer,
      ContentType: 'image/png',
    }));

    const thumbnailUrl = `${process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;

    const updated = await prisma.page.update({
      where: { id: req.params.id },
      data:  { thumbnailUrl, thumbnailUpdatedAt: new Date() },
    });

    res.json({ thumbnailUrl: updated.thumbnailUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pages/:id/thumbnail-url — returns current thumbnail URL for AI tool
router.get('/:id/thumbnail-url', async (req, res) => {
  try {
    const tenant = getTenant(req);
    const page = await prisma.page.findFirst({
      where: { id: req.params.id, tenantId: tenant.id },
      select: { id: true, thumbnailUrl: true, thumbnailUpdatedAt: true },
    });
    if (!page) return res.status(404).json({ error: 'Not found' });
    res.json({ thumbnailUrl: page.thumbnailUrl, updatedAt: page.thumbnailUpdatedAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

**Note:** `busboy` may need installing:
```bash
cd apps/canvas-backend && npm install busboy @types/busboy
```

### Step 6: Register route in `src/index.ts`

Add alongside existing routes (after funnels route):
```typescript
import thumbnailRouter from './routes/thumbnail';
// ...
app.use('/api/pages', thumbnailRouter);  // adds /:id/thumbnail and /:id/thumbnail-url to pages
```

**Important:** Register BEFORE the existing pages router, or ensure it doesn't conflict. Actually, add as a separate registration:
```typescript
app.use('/api/thumbnail', thumbnailRouter);
```
Wait — the frontend calls `/api/pages/:id/thumbnail`. So register the thumbnail router mounted on `/api/pages`:

Check `src/index.ts` — find where `pagesRouter` is mounted and add thumbnail routes to the same path, or register `thumbnailRouter` separately before `pagesRouter`. The safest approach: register `thumbnailRouter` at `/api/pages` before the pages router (Express matches first).

### Step 7: Run tests

```bash
cd apps/canvas-backend && npm test
```

### Step 8: TypeScript check

```bash
cd apps/canvas-backend && npx tsc --noEmit
```

---

## Task 3: `get_canvas_screenshot` AI Tool

The AI agent currently works blind. This tool fetches the latest thumbnail from MySQL, downloads the image, and returns it base64-encoded so Claude can see the page visually.

**Files:**
- Create: `src/mastra/tools/get-canvas-screenshot.ts`
- Create: `src/mastra/tools/screenshot-tool.test.ts`
- Modify: `src/mastra/tools/index.ts` — export
- Modify: `src/mastra/agents/canvas-agent.ts` — add tool + update instructions
- Modify: `src/mastra/mcp/server.ts` — expose via MCP

### Step 1: Write failing test

Create `src/mastra/tools/screenshot-tool.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Mock Prisma
const findFirstMock = vi.fn();
vi.mock('../../db', () => ({ prisma: { page: { findFirst: findFirstMock } } }));
vi.mock('../../spacetime/client', () => ({ getPageNodes: vi.fn(), callReducer: vi.fn() }));
vi.mock('../../redis/client', () => ({ redis: null }));

import { getCanvasScreenshotTool } from './get-canvas-screenshot';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('get_canvas_screenshot', () => {
  it('returns message "no thumbnail" when thumbnailUrl is null', async () => {
    findFirstMock.mockResolvedValue({ id: 'p1', thumbnailUrl: null, thumbnailUpdatedAt: null });

    const result = await getCanvasScreenshotTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(result.hasScreenshot).toBe(false);
    expect(result.message).toContain('no screenshot');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns base64 image data when thumbnailUrl exists', async () => {
    findFirstMock.mockResolvedValue({
      id: 'p1',
      thumbnailUrl: 'https://r2.example.com/thumbnails/t1/p1.png',
      thumbnailUpdatedAt: new Date('2026-02-27'),
    });

    const fakeBuffer = Buffer.from('fake-image-data');
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBuffer.buffer),
    });

    const result = await getCanvasScreenshotTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(result.hasScreenshot).toBe(true);
    expect(result.imageBase64).toBe(fakeBuffer.toString('base64'));
    expect(result.mediaType).toBe('image/png');
    expect(result.message).toContain('screenshot available');
  });

  it('returns no-screenshot message when fetch fails', async () => {
    findFirstMock.mockResolvedValue({
      id: 'p1', thumbnailUrl: 'https://r2.example.com/thumbnails/t1/p1.png', thumbnailUpdatedAt: new Date(),
    });
    fetchMock.mockResolvedValue({ ok: false, status: 403 });

    const result = await getCanvasScreenshotTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(result.hasScreenshot).toBe(false);
    expect(result.message).toContain('fetch failed');
  });

  it('enforces tenant isolation — uses tenant_id in WHERE clause', async () => {
    findFirstMock.mockResolvedValue(null);

    await getCanvasScreenshotTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
    );
  });
});
```

### Step 2: Run — confirm fails

```bash
cd apps/canvas-backend && npm test -- screenshot
```

### Step 3: Create `src/mastra/tools/get-canvas-screenshot.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const getCanvasScreenshotTool = createTool({
  id: 'get_canvas_screenshot',
  description: `Get a visual screenshot of the current canvas page as a base64-encoded PNG image.
Call this BEFORE making visual design changes — it shows you what the page currently looks like.
Returns imageBase64 + mediaType when a screenshot is available (taken on last publish or auto-save).
Returns hasScreenshot:false when no screenshot exists yet (prompt the user to click Export or wait for auto-thumbnail on next publish).`,
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
  }),
  outputSchema: z.object({
    hasScreenshot: z.boolean(),
    imageBase64:   z.string().optional(),
    mediaType:     z.string().optional(),
    capturedAt:    z.string().optional(),
    message:       z.string(),
  }),
  execute: async (context) => {
    const page = await prisma.page.findFirst({
      where: { id: context.page_id, tenantId: context.tenant_id },
      select: { id: true, thumbnailUrl: true, thumbnailUpdatedAt: true },
    });

    if (!page?.thumbnailUrl) {
      return {
        hasScreenshot: false,
        message: 'No screenshot available yet. Publish the page or use the Export button to generate one.',
      };
    }

    const res = await fetch(page.thumbnailUrl).catch(() => null);
    if (!res?.ok) {
      return {
        hasScreenshot: false,
        message: `Screenshot fetch failed (status ${res?.status ?? 'network error'}). The thumbnail may have expired.`,
      };
    }

    const buffer    = Buffer.from(await res.arrayBuffer());
    const imageBase64 = buffer.toString('base64');
    const mediaType   = page.thumbnailUrl.endsWith('.jpg') ? 'image/jpeg' : 'image/png';

    return {
      hasScreenshot: true,
      imageBase64,
      mediaType,
      capturedAt: page.thumbnailUpdatedAt?.toISOString(),
      message: `Visual screenshot available (captured ${page.thumbnailUpdatedAt?.toISOString() ?? 'unknown'}). Use imageBase64 + mediaType for vision analysis.`,
    };
  },
});
```

### Step 4: Run tests — confirm passing

```bash
cd apps/canvas-backend && npm test -- screenshot
```

### Step 5: Export from `src/mastra/tools/index.ts`

Add at the bottom:
```typescript
export { getCanvasScreenshotTool } from './get-canvas-screenshot';
```

### Step 6: Wire into agent and MCP (defer to Task 7)

Leave agent/MCP wiring for Task 7 — do it all at once after all tools are built.

### Step 7: TypeScript check

```bash
cd apps/canvas-backend && npx tsc --noEmit
```

---

## Task 4: Page Management Tools (`create_page`, `duplicate_page`, `rename_page`)

**Files:**
- Create: `src/mastra/tools/create-page.ts`
- Create: `src/mastra/tools/duplicate-page.ts`
- Create: `src/mastra/tools/rename-page.ts`
- Create: `src/mastra/tools/page-management-tools.test.ts`
- Modify: `src/mastra/tools/index.ts` — export all three

### Step 1: Write failing tests

Create `src/mastra/tools/page-management-tools.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock STDB client
const callReducerMock = vi.fn().mockResolvedValue(undefined);
const getPageNodesMock = vi.fn().mockResolvedValue([]);
vi.mock('../../spacetime/client', () => ({
  callReducer: callReducerMock,
  getPageNodes: getPageNodesMock,
  opt: vi.fn(v => v ?? null),
}));
vi.mock('../../redis/client', () => ({ redis: null }));

// Mock Prisma
const pageCreateMock  = vi.fn();
const pageFindFirstMock = vi.fn();
const pageUpdateMock  = vi.fn();
vi.mock('../../db', () => ({
  prisma: {
    page: {
      create:    pageCreateMock,
      findFirst: pageFindFirstMock,
      update:    pageUpdateMock,
    },
  },
}));

import { createPageTool }    from './create-page';
import { duplicatePageTool } from './duplicate-page';
import { renamePageTool }    from './rename-page';

beforeEach(() => {
  vi.clearAllMocks();
  callReducerMock.mockResolvedValue(undefined);
});

// ── create_page ──────────────────────────────────────────────────────────────

describe('create_page', () => {
  it('creates a page in MySQL with tenant_id + slug + pageType', async () => {
    pageCreateMock.mockResolvedValue({ id: 'new-page', tenantId: 't1', slug: 'about', pageType: 'custom', title: 'About' });

    const result = await createPageTool.execute({
      tenant_id: 't1', slug: 'about', page_type: 'custom', title: 'About',
    });

    expect(pageCreateMock).toHaveBeenCalledWith({
      data: { tenantId: 't1', slug: 'about', pageType: 'custom', title: 'About' },
    });
    expect(result.page_id).toBe('new-page');
    expect(result.message).toContain('about');
  });

  it('enforces tenant isolation — tenantId in create data', async () => {
    pageCreateMock.mockResolvedValue({ id: 'x', tenantId: 't2', slug: 'home', pageType: 'home', title: null });

    await createPageTool.execute({ tenant_id: 't2', slug: 'home', page_type: 'home' });

    expect(pageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't2' }) }),
    );
  });
});

// ── duplicate_page ────────────────────────────────────────────────────────────

describe('duplicate_page', () => {
  const SOURCE_NODES = [
    { id: 'n1', page_id: 'src', tenant_id: 't1', node_type: 'layout', parent_id: null, order: 'a0', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
    { id: 'n2', page_id: 'src', tenant_id: 't1', node_type: 'element', parent_id: 'n1', order: 'a0', styles: '{}', props: '{"content":"Hello"}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  ];

  beforeEach(() => {
    pageFindFirstMock.mockResolvedValue({ id: 'src', tenantId: 't1', slug: 'home', pageType: 'custom', title: 'Home' });
    pageCreateMock.mockResolvedValue({ id: 'new-id', tenantId: 't1', slug: 'home-copy', pageType: 'custom', title: 'Home (copy)' });
    getPageNodesMock.mockResolvedValue(SOURCE_NODES);
  });

  it('creates a new MySQL page record with "-copy" slug suffix', async () => {
    await duplicatePageTool.execute({ tenant_id: 't1', source_page_id: 'src' });

    expect(pageCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'home-copy', tenantId: 't1' }),
      }),
    );
  });

  it('inserts all source nodes into STDB for the new page via callReducer', async () => {
    await duplicatePageTool.execute({ tenant_id: 't1', source_page_id: 'src' });

    // One insert_node call per source node
    expect(callReducerMock).toHaveBeenCalledTimes(SOURCE_NODES.length);
    callReducerMock.mock.calls.forEach(([reducerName]: [string]) => {
      expect(reducerName).toBe('insert_node');
    });
  });

  it('returns 404 when source page not found', async () => {
    pageFindFirstMock.mockResolvedValue(null);

    await expect(
      duplicatePageTool.execute({ tenant_id: 't1', source_page_id: 'nonexistent' }),
    ).rejects.toThrow('not found');
  });
});

// ── rename_page ────────────────────────────────────────────────────────────────

describe('rename_page', () => {
  beforeEach(() => {
    pageFindFirstMock.mockResolvedValue({ id: 'p1', tenantId: 't1', slug: 'old-slug', title: 'Old Title' });
    pageUpdateMock.mockResolvedValue({ id: 'p1', tenantId: 't1', slug: 'new-slug', title: 'New Title' });
  });

  it('updates title and slug in MySQL', async () => {
    await renamePageTool.execute({ tenant_id: 't1', page_id: 'p1', title: 'New Title', slug: 'new-slug' });

    expect(pageUpdateMock).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data:  { title: 'New Title', slug: 'new-slug' },
    });
  });

  it('returns 404 error when page not found for this tenant', async () => {
    pageFindFirstMock.mockResolvedValue(null);

    await expect(
      renamePageTool.execute({ tenant_id: 't1', page_id: 'x', title: 'T', slug: 's' }),
    ).rejects.toThrow('not found');
  });
});
```

### Step 2: Run — confirm fails

```bash
cd apps/canvas-backend && npm test -- page-management
```

### Step 3: Create `src/mastra/tools/create-page.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createPageTool = createTool({
  id: 'create_page',
  description: 'Create a new blank page for the tenant in MySQL. Returns page_id for use with insert_node.',
  inputSchema: z.object({
    tenant_id: z.string(),
    slug:      z.string().describe('URL-safe slug, e.g. "about-us" or "products/shoes"'),
    page_type: z.enum(['home', 'product', 'custom']).default('custom'),
    title:     z.string().optional(),
  }),
  outputSchema: z.object({ page_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const page = await prisma.page.create({
      data: {
        tenantId: context.tenant_id,
        slug:     context.slug,
        pageType: context.page_type,
        title:    context.title,
      },
    });
    return {
      page_id: page.id,
      message: `Page "${context.slug}" created (id: ${page.id}). Now add nodes with insert_node using this page_id.`,
    };
  },
});
```

### Step 4: Create `src/mastra/tools/duplicate-page.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';
import { getPageNodes, callReducer, opt } from '../../spacetime/client';

export const duplicatePageTool = createTool({
  id: 'duplicate_page',
  description: 'Duplicate an existing page: creates a new MySQL record with slug "<original>-copy" and clones all STDB nodes to the new page. Returns new_page_id.',
  inputSchema: z.object({
    tenant_id:      z.string(),
    source_page_id: z.string(),
    new_slug:       z.string().optional().describe('Custom slug for the copy — defaults to "<original-slug>-copy"'),
    new_title:      z.string().optional().describe('Custom title — defaults to "<original-title> (copy)"'),
  }),
  outputSchema: z.object({ new_page_id: z.string(), node_count: z.number(), message: z.string() }),
  execute: async (context) => {
    const source = await prisma.page.findFirst({
      where: { id: context.source_page_id, tenantId: context.tenant_id },
    });
    if (!source) throw new Error(`Source page ${context.source_page_id} not found`);

    const newSlug  = context.new_slug  ?? `${source.slug}-copy`;
    const newTitle = context.new_title ?? (source.title ? `${source.title} (copy)` : undefined);

    const newPage = await prisma.page.create({
      data: { tenantId: context.tenant_id, slug: newSlug, pageType: source.pageType, title: newTitle },
    });

    // Clone all STDB nodes to the new page
    const nodes = await getPageNodes(context.source_page_id, context.tenant_id);
    for (const node of nodes) {
      await callReducer('insert_node', {
        id:                crypto.randomUUID(),
        page_id:           newPage.id,
        tenant_id:         context.tenant_id,
        parent_id:         opt(node.parent_id),
        order:             node.order,
        node_type:         node.node_type,
        styles:            node.styles,
        props:             node.props,
        settings:          node.settings,
        component_id:      opt(node.component_id),
        component_url:     opt(node.component_url),
        component_version: opt(node.component_version),
      });
    }

    return {
      new_page_id: newPage.id,
      node_count:  nodes.length,
      message:     `Page duplicated as "${newSlug}" (id: ${newPage.id}) with ${nodes.length} nodes. Use get_page_tree with new_page_id to verify.`,
    };
  },
});
```

### Step 5: Create `src/mastra/tools/rename-page.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const renamePageTool = createTool({
  id: 'rename_page',
  description: 'Rename a page: update its title and/or URL slug in MySQL. Only call with explicit user instruction.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    title:     z.string().optional(),
    slug:      z.string().optional().describe('New URL-safe slug — changing this affects published URLs'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    const existing = await prisma.page.findFirst({
      where: { id: context.page_id, tenantId: context.tenant_id },
    });
    if (!existing) throw new Error(`Page ${context.page_id} not found`);

    await prisma.page.update({
      where: { id: context.page_id },
      data:  { title: context.title, slug: context.slug },
    });

    return { message: `Page ${context.page_id} renamed. Title: "${context.title ?? existing.title}", Slug: "${context.slug ?? existing.slug}".` };
  },
});
```

### Step 6: Export from `index.ts`

Add to `src/mastra/tools/index.ts`:
```typescript
export { createPageTool }    from './create-page';
export { duplicatePageTool } from './duplicate-page';
export { renamePageTool }    from './rename-page';
```

### Step 7: Run all tests

```bash
cd apps/canvas-backend && npm test
```

---

## Task 5: Funnel Management Tools (`list_funnels`, `create_funnel`, `update_funnel_steps`)

**Files:**
- Create: `src/mastra/tools/list-funnels.ts`
- Create: `src/mastra/tools/create-funnel.ts`
- Create: `src/mastra/tools/update-funnel-steps.ts`
- Create: `src/mastra/tools/funnel-tools.test.ts`
- Modify: `src/mastra/tools/index.ts`

### Step 1: Write failing tests

Create `src/mastra/tools/funnel-tools.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../spacetime/client', () => ({ callReducer: vi.fn(), getPageNodes: vi.fn(), opt: vi.fn(v => v ?? null) }));
vi.mock('../../redis/client', () => ({ redis: null }));

const funnelFindManyMock  = vi.fn();
const funnelCreateMock    = vi.fn();
const funnelFindFirstMock = vi.fn();
const stepDeleteManyMock  = vi.fn();
const stepCreateManyMock  = vi.fn();

vi.mock('../../db', () => ({
  prisma: {
    funnel: {
      findMany:  funnelFindManyMock,
      create:    funnelCreateMock,
      findFirst: funnelFindFirstMock,
    },
    funnelStep: {
      deleteMany:  stepDeleteManyMock,
      createMany:  stepCreateManyMock,
    },
  },
}));

import { listFunnelsTool }       from './list-funnels';
import { createFunnelTool }      from './create-funnel';
import { updateFunnelStepsTool } from './update-funnel-steps';

beforeEach(() => vi.clearAllMocks());

// ── list_funnels ───────────────────────────────────────────────────────────────

describe('list_funnels', () => {
  it('returns funnels filtered by tenant_id', async () => {
    funnelFindManyMock.mockResolvedValue([
      { id: 'f1', tenantId: 't1', name: 'Onboarding', status: 'live', steps: [] },
    ]);

    const result = await listFunnelsTool.execute({ tenant_id: 't1' });

    expect(funnelFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 't1' } }),
    );
    expect(result.funnels).toHaveLength(1);
    expect(result.funnels[0].name).toBe('Onboarding');
  });
});

// ── create_funnel ─────────────────────────────────────────────────────────────

describe('create_funnel', () => {
  it('creates funnel with steps in MySQL', async () => {
    funnelCreateMock.mockResolvedValue({
      id: 'f2', tenantId: 't1', name: 'Purchase', goal: 'checkout',
      steps: [{ id: 's1', pageId: 'p1', stepOrder: 0, stepType: 'landing', name: 'Landing' }],
    });

    const result = await createFunnelTool.execute({
      tenant_id: 't1',
      name: 'Purchase',
      goal: 'checkout',
      steps: [{ page_id: 'p1', step_type: 'landing', name: 'Landing', on_success: { action: 'next' } }],
    });

    expect(funnelCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 't1', name: 'Purchase' }),
      }),
    );
    expect(result.funnel_id).toBe('f2');
  });

  it('enforces tenant isolation — tenantId in create data', async () => {
    funnelCreateMock.mockResolvedValue({ id: 'f3', tenantId: 't2', name: 'Test', steps: [] });

    await createFunnelTool.execute({ tenant_id: 't2', name: 'Test', steps: [] });

    expect(funnelCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't2' }) }),
    );
  });
});

// ── update_funnel_steps ────────────────────────────────────────────────────────

describe('update_funnel_steps', () => {
  beforeEach(() => {
    funnelFindFirstMock.mockResolvedValue({ id: 'f1', tenantId: 't1', name: 'Test' });
    stepDeleteManyMock.mockResolvedValue({ count: 2 });
    stepCreateManyMock.mockResolvedValue({ count: 3 });
  });

  it('replaces all steps: deleteMany then createMany', async () => {
    await updateFunnelStepsTool.execute({
      tenant_id: 't1',
      funnel_id: 'f1',
      steps: [
        { page_id: 'p1', step_type: 'landing', name: 'Landing', on_success: { action: 'next' } },
        { page_id: 'p2', step_type: 'upsell',  name: 'Upsell',  on_success: { action: 'next' } },
        { page_id: 'p3', step_type: 'confirm', name: 'Thank You', on_success: { action: 'end' } },
      ],
    });

    expect(stepDeleteManyMock).toHaveBeenCalledWith({ where: { funnelId: 'f1' } });
    expect(stepCreateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ funnelId: 'f1', stepOrder: 0 }),
          expect.objectContaining({ funnelId: 'f1', stepOrder: 1 }),
          expect.objectContaining({ funnelId: 'f1', stepOrder: 2 }),
        ]),
      }),
    );
  });

  it('returns 404 error when funnel not found for tenant', async () => {
    funnelFindFirstMock.mockResolvedValue(null);

    await expect(
      updateFunnelStepsTool.execute({ tenant_id: 't1', funnel_id: 'x', steps: [] }),
    ).rejects.toThrow('not found');
  });
});
```

### Step 2: Run — confirm fails

```bash
cd apps/canvas-backend && npm test -- funnel-tools
```

### Step 3: Create `src/mastra/tools/list-funnels.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const listFunnelsTool = createTool({
  id: 'list_funnels',
  description: 'List all sales funnels for the tenant with their steps and status.',
  inputSchema: z.object({ tenant_id: z.string() }),
  outputSchema: z.object({ funnels: z.array(z.any()) }),
  execute: async (context) => {
    const funnels = await prisma.funnel.findMany({
      where:   { tenantId: context.tenant_id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return { funnels };
  },
});
```

### Step 4: Create `src/mastra/tools/create-funnel.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

const stepSchema = z.object({
  page_id:    z.string(),
  step_type:  z.string().optional(),
  name:       z.string().optional(),
  on_success: z.record(z.any()).describe('Action when step completed, e.g. { action: "next" } or { action: "url", url: "https://..." }'),
  on_skip:    z.record(z.any()).optional(),
});

export const createFunnelTool = createTool({
  id: 'create_funnel',
  description: `Create a sales funnel with ordered steps. Each step links to a page and defines what happens on success/skip.
Example steps: landing page → upsell → order confirmation.
Only call with user instruction specifying the funnel goal and pages to include.`,
  inputSchema: z.object({
    tenant_id: z.string(),
    name:      z.string().describe('Funnel name, e.g. "Main Purchase Flow"'),
    goal:      z.string().optional().describe('Conversion goal, e.g. "checkout" or "email_signup"'),
    steps:     z.array(stepSchema),
  }),
  outputSchema: z.object({ funnel_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const funnel = await prisma.funnel.create({
      data: {
        tenantId: context.tenant_id,
        name:     context.name,
        goal:     context.goal,
        steps: context.steps.length > 0 ? {
          create: context.steps.map((s, i) => ({
            pageId:    s.page_id,
            stepOrder: i,
            stepType:  s.step_type,
            name:      s.name,
            onSuccess: JSON.stringify(s.on_success),
            onSkip:    s.on_skip ? JSON.stringify(s.on_skip) : null,
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    return {
      funnel_id: funnel.id,
      message:   `Funnel "${context.name}" created with ${funnel.steps.length} steps (id: ${funnel.id}).`,
    };
  },
});
```

### Step 5: Create `src/mastra/tools/update-funnel-steps.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

const stepSchema = z.object({
  page_id:    z.string(),
  step_type:  z.string().optional(),
  name:       z.string().optional(),
  on_success: z.record(z.any()),
  on_skip:    z.record(z.any()).optional(),
});

export const updateFunnelStepsTool = createTool({
  id: 'update_funnel_steps',
  description: 'Replace all steps of a funnel with a new ordered list. Use to reorder, add, or remove steps.',
  inputSchema: z.object({
    tenant_id: z.string(),
    funnel_id: z.string(),
    steps:     z.array(stepSchema).describe('Complete new step list in order — replaces all existing steps'),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    const funnel = await prisma.funnel.findFirst({
      where: { id: context.funnel_id, tenantId: context.tenant_id },
    });
    if (!funnel) throw new Error(`Funnel ${context.funnel_id} not found`);

    // Replace all steps atomically
    await prisma.funnelStep.deleteMany({ where: { funnelId: context.funnel_id } });
    if (context.steps.length > 0) {
      await prisma.funnelStep.createMany({
        data: context.steps.map((s, i) => ({
          funnelId:  context.funnel_id,
          pageId:    s.page_id,
          stepOrder: i,
          stepType:  s.step_type,
          name:      s.name,
          onSuccess: JSON.stringify(s.on_success),
          onSkip:    s.on_skip ? JSON.stringify(s.on_skip) : null,
        })),
      });
    }

    return { message: `Funnel ${context.funnel_id} updated with ${context.steps.length} steps.` };
  },
});
```

### Step 6: Export from `index.ts`

```typescript
export { listFunnelsTool }       from './list-funnels';
export { createFunnelTool }      from './create-funnel';
export { updateFunnelStepsTool } from './update-funnel-steps';
```

### Step 7: Run tests

```bash
cd apps/canvas-backend && npm test
```

---

## Task 6: Experiment Tools (`create_experiment`, `create_variant`, `activate_experiment`)

**Experiment model fields (from Prisma schema):**
- `Experiment`: `id`, `tenantId`, `pageId`, `name`, `hypothesis`, `status` (draft|running|ended), `primaryMetric`, `trafficMode` (sticky|random)
- `ExperimentVariant`: `id`, `experimentId`, `tenantId`, `pageId`, `name`, `description`, `pageVersionId`, `trafficWeight`, `isControl`

**Files:**
- Create: `src/mastra/tools/create-experiment.ts`
- Create: `src/mastra/tools/create-variant.ts`
- Create: `src/mastra/tools/activate-experiment.ts`
- Create: `src/mastra/tools/experiment-tools.test.ts`
- Modify: `src/mastra/tools/index.ts`

### Step 1: Write failing tests

Create `src/mastra/tools/experiment-tools.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../spacetime/client', () => ({ callReducer: vi.fn(), getPageNodes: vi.fn(), opt: vi.fn(v => v ?? null) }));
vi.mock('../../redis/client', () => ({ redis: null }));

const experimentCreateMock    = vi.fn();
const experimentFindFirstMock = vi.fn();
const experimentUpdateMock    = vi.fn();
const variantCreateMock       = vi.fn();
const pageFindFirstMock       = vi.fn();

vi.mock('../../db', () => ({
  prisma: {
    experiment:        { create: experimentCreateMock, findFirst: experimentFindFirstMock, update: experimentUpdateMock },
    experimentVariant: { create: variantCreateMock },
    page:              { findFirst: pageFindFirstMock },
  },
}));

import { createExperimentTool } from './create-experiment';
import { createVariantTool }    from './create-variant';
import { activateExperimentTool } from './activate-experiment';

beforeEach(() => vi.clearAllMocks());

// ── create_experiment ─────────────────────────────────────────────────────────

describe('create_experiment', () => {
  beforeEach(() => {
    pageFindFirstMock.mockResolvedValue({ id: 'p1', tenantId: 't1', publishedVersionId: 'v1' });
    experimentCreateMock.mockResolvedValue({ id: 'exp1', tenantId: 't1', pageId: 'p1', variants: [] });
  });

  it('creates experiment with control variant using published version', async () => {
    await createExperimentTool.execute({
      tenant_id: 't1', page_id: 'p1',
      name: 'Hero CTA Test', hypothesis: 'Purple button converts better',
    });

    expect(experimentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1', pageId: 'p1', name: 'Hero CTA Test',
          variants: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ isControl: true, pageVersionId: 'v1' }),
            ]),
          }),
        }),
      }),
    );
  });

  it('returns error when page not found for tenant', async () => {
    pageFindFirstMock.mockResolvedValue(null);

    await expect(
      createExperimentTool.execute({ tenant_id: 't1', page_id: 'missing', name: 'Test', hypothesis: 'x' }),
    ).rejects.toThrow('not found');
  });
});

// ── create_variant ────────────────────────────────────────────────────────────

describe('create_variant', () => {
  beforeEach(() => {
    experimentFindFirstMock.mockResolvedValue({ id: 'exp1', tenantId: 't1', pageId: 'p1', status: 'draft' });
    variantCreateMock.mockResolvedValue({ id: 'var1', name: 'Variant B', trafficWeight: 0.5 });
  });

  it('creates a variant linked to the experiment', async () => {
    const result = await createVariantTool.execute({
      tenant_id: 't1', experiment_id: 'exp1',
      name: 'Variant B', traffic_weight: 0.5,
    });

    expect(variantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          experimentId: 'exp1', tenantId: 't1',
          name: 'Variant B', trafficWeight: 0.5, isControl: false,
        }),
      }),
    );
    expect(result.variant_id).toBe('var1');
  });

  it('returns 404 when experiment not found for tenant', async () => {
    experimentFindFirstMock.mockResolvedValue(null);

    await expect(
      createVariantTool.execute({ tenant_id: 't1', experiment_id: 'x', name: 'B', traffic_weight: 0.5 }),
    ).rejects.toThrow('not found');
  });
});

// ── activate_experiment ────────────────────────────────────────────────────────

describe('activate_experiment', () => {
  beforeEach(() => {
    experimentFindFirstMock.mockResolvedValue({ id: 'exp1', tenantId: 't1', status: 'draft' });
    experimentUpdateMock.mockResolvedValue({ id: 'exp1', status: 'running', startedAt: new Date() });
  });

  it('sets experiment status to "running" and records startedAt', async () => {
    await activateExperimentTool.execute({ tenant_id: 't1', experiment_id: 'exp1' });

    expect(experimentUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp1' },
        data:  expect.objectContaining({ status: 'running' }),
      }),
    );
  });

  it('returns error when experiment not found for tenant', async () => {
    experimentFindFirstMock.mockResolvedValue(null);

    await expect(
      activateExperimentTool.execute({ tenant_id: 't1', experiment_id: 'x' }),
    ).rejects.toThrow('not found');
  });

  it('returns error when experiment is already running', async () => {
    experimentFindFirstMock.mockResolvedValue({ id: 'exp1', tenantId: 't1', status: 'running' });

    await expect(
      activateExperimentTool.execute({ tenant_id: 't1', experiment_id: 'exp1' }),
    ).rejects.toThrow('already running');
  });
});
```

### Step 2: Run — confirm fails

```bash
cd apps/canvas-backend && npm test -- experiment-tools
```

### Step 3: Create `src/mastra/tools/create-experiment.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createExperimentTool = createTool({
  id: 'create_experiment',
  description: `Create an A/B experiment for a page. Automatically creates a control variant using the page's current published version.
Then use create_variant to add test variants. Then use activate_experiment to start traffic splitting.
Only call with explicit user instruction specifying the test hypothesis.`,
  inputSchema: z.object({
    tenant_id:       z.string(),
    page_id:         z.string(),
    name:            z.string().describe('Experiment name, e.g. "Hero Section CTA Color Test"'),
    hypothesis:      z.string().describe('What you expect to happen, e.g. "Purple CTA will increase clicks by 15%"'),
    primary_metric:  z.string().optional().default('conversion_rate').describe('Metric to optimize: conversion_rate | click_rate | revenue'),
  }),
  outputSchema: z.object({ experiment_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const page = await prisma.page.findFirst({
      where: { id: context.page_id, tenantId: context.tenant_id },
    });
    if (!page) throw new Error(`Page ${context.page_id} not found`);

    const experiment = await prisma.experiment.create({
      data: {
        tenantId:      context.tenant_id,
        pageId:        context.page_id,
        name:          context.name,
        hypothesis:    context.hypothesis,
        primaryMetric: context.primary_metric ?? 'conversion_rate',
        trafficMode:   'sticky',
        status:        'draft',
        variants: {
          create: [{
            tenantId:      context.tenant_id,
            pageId:        context.page_id,
            name:          'Control',
            description:   'Original page (control)',
            pageVersionId: page.publishedVersionId,
            trafficWeight: 0.5,
            isControl:     true,
          }],
        },
      },
      include: { variants: true },
    });

    return {
      experiment_id: experiment.id,
      message: `Experiment "${context.name}" created (id: ${experiment.id}). Control variant uses current published version. Now use create_variant to add test variants, then activate_experiment to start.`,
    };
  },
});
```

### Step 4: Create `src/mastra/tools/create-variant.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createVariantTool = createTool({
  id: 'create_variant',
  description: 'Add an A/B test variant to an experiment. Supply a pageVersionId (from publish_page) to use as the variant tree, or leave empty to use the same tree as control.',
  inputSchema: z.object({
    tenant_id:       z.string(),
    experiment_id:   z.string(),
    name:            z.string().describe('Variant name, e.g. "Purple CTA" or "Variant B"'),
    description:     z.string().optional(),
    page_version_id: z.string().optional().describe('PageVersion id to serve for this variant — publish the modified page first'),
    traffic_weight:  z.number().min(0).max(1).describe('Traffic fraction, e.g. 0.5 for 50%. All variants including control should sum to ~1.0'),
  }),
  outputSchema: z.object({ variant_id: z.string(), message: z.string() }),
  execute: async (context) => {
    const experiment = await prisma.experiment.findFirst({
      where: { id: context.experiment_id, tenantId: context.tenant_id },
    });
    if (!experiment) throw new Error(`Experiment ${context.experiment_id} not found`);

    const variant = await prisma.experimentVariant.create({
      data: {
        experimentId:  context.experiment_id,
        tenantId:      context.tenant_id,
        pageId:        experiment.pageId,
        name:          context.name,
        description:   context.description,
        pageVersionId: context.page_version_id,
        trafficWeight: context.traffic_weight,
        isControl:     false,
      },
    });

    return {
      variant_id: variant.id,
      message:    `Variant "${context.name}" added to experiment ${context.experiment_id} (${context.traffic_weight * 100}% traffic).`,
    };
  },
});
```

### Step 5: Create `src/mastra/tools/activate-experiment.ts`

```typescript
import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const activateExperimentTool = createTool({
  id: 'activate_experiment',
  description: 'Start an A/B experiment — sets status to "running" so the serve API begins splitting traffic. Only call with EXPLICIT user confirmation. Experiment must be in "draft" status with at least one variant.',
  inputSchema: z.object({
    tenant_id:     z.string(),
    experiment_id: z.string(),
  }),
  outputSchema: z.object({ message: z.string() }),
  execute: async (context) => {
    const experiment = await prisma.experiment.findFirst({
      where: { id: context.experiment_id, tenantId: context.tenant_id },
    });
    if (!experiment) throw new Error(`Experiment ${context.experiment_id} not found`);
    if (experiment.status === 'running') throw new Error(`Experiment ${context.experiment_id} is already running`);

    await prisma.experiment.update({
      where: { id: context.experiment_id },
      data:  { status: 'running', startedAt: new Date() },
    });

    return { message: `Experiment "${experiment.name}" is now running. Traffic is being split between variants.` };
  },
});
```

**Note:** Check if `startedAt` exists in the Experiment schema. If not, omit it from the `update` data.

### Step 6: Export from `index.ts`

```typescript
export { createExperimentTool }  from './create-experiment';
export { createVariantTool }     from './create-variant';
export { activateExperimentTool } from './activate-experiment';
```

### Step 7: Run all tests

```bash
cd apps/canvas-backend && npm test
```

---

## Task 7: Wire All New Tools into Agent + MCP + Update Instructions

All 10 new tools need to be added to: (1) canvas-agent tool list, (2) MCP server tool list, (3) agent instructions.

**Files:**
- Modify: `src/mastra/agents/canvas-agent.ts`
- Modify: `src/mastra/mcp/server.ts`

### Step 1: Read both files

```bash
cat src/mastra/agents/canvas-agent.ts
cat src/mastra/mcp/server.ts
```

### Step 2: Update `canvas-agent.ts`

Import all new tools at the top (alongside existing imports):
```typescript
import {
  getCanvasScreenshotTool,
  createPageTool, duplicatePageTool, renamePageTool,
  listFunnelsTool, createFunnelTool, updateFunnelStepsTool,
  createExperimentTool, createVariantTool, activateExperimentTool,
} from '../tools';
```

Add all 10 to the `tools` object:
```typescript
tools: {
  // existing 16 tools...
  getCanvasScreenshot: getCanvasScreenshotTool,
  createPage:          createPageTool,
  duplicatePage:       duplicatePageTool,
  renamePage:          renamePageTool,
  listFunnels:         listFunnelsTool,
  createFunnel:        createFunnelTool,
  updateFunnelSteps:   updateFunnelStepsTool,
  createExperiment:    createExperimentTool,
  createVariant:       createVariantTool,
  activateExperiment:  activateExperimentTool,
},
```

Update the `instructions` string — append these sections to the existing instructions:

```
VISUAL WORKFLOW (NEW):
- Call get_canvas_screenshot BEFORE making visual design decisions.
  It returns a base64 PNG so you can SEE the current page layout.
  If hasScreenshot is false, the user hasn't published yet — proceed based on get_page_tree.

PAGE MANAGEMENT:
- create_page: Create a blank page, then add nodes with insert_node.
- duplicate_page: Clone an existing page as a starting point.
- rename_page: Update page title or slug — only with explicit user instruction.

FUNNEL MANAGEMENT:
- list_funnels: Always call first to see existing funnels before creating new ones.
- create_funnel: Create a funnel with ordered steps linking to existing pages.
  Each step needs a page_id — create pages first if they don't exist.
- update_funnel_steps: Replace all steps in a funnel (use to reorder or add steps).

A/B EXPERIMENTS (confirmation required):
- create_experiment: Create draft experiment with auto-generated control variant.
- create_variant: Add a test variant (publish modified page first to get pageVersionId).
- activate_experiment: Start traffic splitting — REQUIRES explicit user confirmation.
  NEVER activate without "yes, start the experiment" or equivalent.
```

### Step 3: Update `mcp/server.ts`

Import and add all 10 tools to the MCPServer tools object:

```typescript
import {
  getCanvasScreenshotTool,
  createPageTool, duplicatePageTool, renamePageTool,
  listFunnelsTool, createFunnelTool, updateFunnelStepsTool,
  createExperimentTool, createVariantTool, activateExperimentTool,
} from '../tools';

// In the MCPServer tools object, add:
getCanvasScreenshot: getCanvasScreenshotTool,
createPage:          createPageTool,
duplicatePage:       duplicatePageTool,
renamePage:          renamePageTool,
listFunnels:         listFunnelsTool,
createFunnel:        createFunnelTool,
updateFunnelSteps:   updateFunnelStepsTool,
createExperiment:    createExperimentTool,
createVariant:       createVariantTool,
activateExperiment:  activateExperimentTool,
```

### Step 4: Run all tests

```bash
cd apps/canvas-backend && npm test
```
Expected: all tests pass (previous tests + 4 new test files).

### Step 5: TypeScript check

```bash
cd apps/canvas-backend && npx tsc --noEmit
```

---

## Verification Checklist

After all 7 tasks:

```bash
# 1. All tests pass
cd apps/canvas-backend && npm test

# 2. TypeScript clean
cd apps/canvas-backend && npx tsc --noEmit

# 3. Verify tool count (should be 26: 16 original + 10 new)
grep -c "createTool" src/mastra/tools/*.ts

# 4. Verify all exports in index.ts (should be 26 lines)
grep "export {" src/mastra/tools/index.ts | wc -l

# 5. Verify agent has new tools in instructions
grep "get_canvas_screenshot\|create_funnel\|create_experiment" src/mastra/agents/canvas-agent.ts
```
