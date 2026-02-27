# SeloraX Canvas — Testing Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a layered test suite covering unit tests for pure functions, integration tests for Express routes, and tool tests for Mastra AI tools — catching regressions before they reach production.

**Architecture:** Vitest for all test running (fast, ESM-native, works in a TypeScript monorepo without extra config). Pure functions are tested in isolation. Express routes are tested with supertest + mocked Prisma/Redis/STDB using vi.mock(). Mastra tools are tested by mocking callReducer and getPageNodes directly.

**Tech Stack:** vitest, @vitest/coverage-v8, supertest, @testing-library/react (renderer package), msw (optional for fetch mocking), vi.mock() for Prisma/STDB/Redis

---

## Context You Must Know First

### What Already Works (Do Not Break)
- `test-realtime.ts` — real-time collaboration test. Not part of this suite, leave it alone.
- All 4 services run via `npm run dev:local`. Tests run without starting any service.
- SpacetimeDB = Maincloud, NEVER local. Tests must **mock** STDB, never hit Maincloud.

### Field Naming (Critical — Caused Bugs Before)
- SpacetimeDB generated row fields are **camelCase**: `node.pageId`, `node.nodeType`, `node.parentId`
- Reducer HTTP calls use **snake_case** keys: `{ page_id, node_type, parent_id }`
- SQL column names are **snake_case**: `page_id`, `tenant_id`
- The `buildTree()` in dashboard now expects **camelCase** input (STDB rows). The backend `buildTree()` expects **snake_case** input (`FlatNode` from HTTP SQL API). These are **two different versions** — do not conflate.

### File to Mock Every Time
- `../../spacetime/client` → mock `callReducer` and `getPageNodes` in all tool tests
- `../../db` → mock `prisma` in all route integration tests
- `../../redis/client` → mock `redis` in route tests (return null to simulate disabled)

### Tenant Isolation Rule
Every test that touches tenant-scoped data must use `tenantId: 'test-tenant'` and verify that other tenants cannot access the data.

---

## Phase 1 — Vitest Setup + Core Utilities

### Task 1: Install Vitest and Configure Monorepo

**Files:**
- Create: `vitest.config.ts` (root)
- Create: `apps/canvas-backend/vitest.config.ts`
- Create: `packages/renderer/vitest.config.ts`
- Modify: root `package.json` — add test scripts
- Modify: `apps/canvas-backend/package.json` — add vitest devDep

**Step 1: Install vitest in canvas-backend**

```bash
cd apps/canvas-backend
npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest
```

Expected: `package.json` updated with devDependencies.

**Step 2: Create `apps/canvas-backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/utils/**', 'src/routes/**', 'src/mastra/tools/**'],
    },
  },
});
```

**Step 3: Install vitest in renderer package**

```bash
cd packages/renderer
npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

**Step 4: Create `packages/renderer/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

**Step 5: Create `packages/renderer/src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom';
```

**Step 6: Add test scripts to root `package.json`**

Add to the `scripts` section:
```json
{
  "test": "turbo run test",
  "test:backend": "npm run test --workspace=apps/canvas-backend",
  "test:renderer": "npm run test --workspace=packages/renderer",
  "test:coverage": "turbo run test:coverage"
}
```

**Step 7: Add test script to `apps/canvas-backend/package.json`**

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Step 8: Add test script to `packages/renderer/package.json`**

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Step 9: Add `test` pipeline to `turbo.json`**

```json
{
  "pipeline": {
    "test": {
      "dependsOn": [],
      "outputs": ["coverage/**"]
    }
  }
}
```

**Step 10: Verify setup**

```bash
cd apps/canvas-backend && npx vitest run --reporter=verbose 2>&1
```
Expected: "No test files found" (not an error, just empty)

**Step 11: Commit**

```bash
git add apps/canvas-backend/vitest.config.ts apps/canvas-backend/package.json \
        packages/renderer/vitest.config.ts packages/renderer/package.json \
        packages/renderer/src/test-setup.ts turbo.json package.json
git commit -m "test: add vitest config for canvas-backend and renderer"
```

---

### Task 2: Unit Tests — `buildTree()` (backend)

**Files:**
- Create: `apps/canvas-backend/src/utils/tree.test.ts`

The `buildTree()` in backend takes `FlatNode[]` with **snake_case** fields from the HTTP SQL API. The `FlatNode` type has: `id`, `page_id`, `tenant_id`, `node_type`, `parent_id` (null | string), `order`, `styles` (JSON string), `props` (JSON string), `settings` (JSON string), `children_ids` (JSON string), `component_url` (null | string), `component_id`, `component_version`.

**Step 1: Write the failing tests**

```typescript
// apps/canvas-backend/src/utils/tree.test.ts
import { describe, it, expect } from 'vitest';
import { buildTree, flattenTree } from './tree';
import type { FlatNode } from './tree';

function makeNode(overrides: Partial<FlatNode> & { id: string }): FlatNode {
  return {
    page_id: 'page-1',
    tenant_id: 'test-tenant',
    node_type: 'layout',
    parent_id: null,
    order: 'a0',
    styles: '{}',
    props: '{}',
    settings: '{}',
    children_ids: '[]',
    component_url: null,
    component_id: null,
    component_version: null,
    ...overrides,
  };
}

describe('buildTree', () => {
  it('returns null for empty input', () => {
    expect(buildTree([])).toBeNull();
  });

  it('returns single root node with no children', () => {
    const nodes = [makeNode({ id: 'root' })];
    const tree = buildTree(nodes);
    expect(tree).toMatchObject({ id: 'root', type: 'layout', children: [] });
  });

  it('nests child under parent', () => {
    const nodes = [
      makeNode({ id: 'root', order: 'a0' }),
      makeNode({ id: 'child', parent_id: 'root', order: 'a0' }),
    ];
    const tree = buildTree(nodes);
    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].id).toBe('child');
  });

  it('sorts children by order (lexicographic)', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'c2', parent_id: 'root', order: 'b0' }),
      makeNode({ id: 'c1', parent_id: 'root', order: 'a0' }),
      makeNode({ id: 'c3', parent_id: 'root', order: 'c0' }),
    ];
    const tree = buildTree(nodes);
    expect(tree.children.map((c: any) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('builds deeply nested tree', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'section', parent_id: 'root', order: 'a0' }),
      makeNode({ id: 'heading', parent_id: 'section', order: 'a0', node_type: 'element', props: '{"tag":"heading","level":1,"content":"Hello"}' }),
    ];
    const tree = buildTree(nodes);
    expect(tree.children[0].children[0].id).toBe('heading');
    expect(tree.children[0].children[0].props.content).toBe('Hello');
  });

  it('parses styles/props/settings JSON from string fields', () => {
    const nodes = [
      makeNode({
        id: 'root',
        styles: '{"fontSize":"16px","color":"#111"}',
        props: '{"tag":"div"}',
        settings: '{"someFlag":true}',
      }),
    ];
    const tree = buildTree(nodes);
    expect(tree.styles).toEqual({ fontSize: '16px', color: '#111' });
    expect(tree.props).toEqual({ tag: 'div' });
    expect(tree.settings).toEqual({ someFlag: true });
  });

  it('handles malformed JSON gracefully (safeJson fallback)', () => {
    const nodes = [makeNode({ id: 'root', styles: 'NOT_JSON', props: '' })];
    const tree = buildTree(nodes);
    expect(tree.styles).toEqual({});
    expect(tree.props).toEqual({});
  });

  it('exposes component_url as url on component nodes', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({
        id: 'comp',
        parent_id: 'root',
        order: 'a0',
        node_type: 'component',
        component_url: 'https://cdn.example.com/comp.js',
        component_id: 'comp-123',
        component_version: '1.0.0',
      }),
    ];
    const tree = buildTree(nodes);
    const compNode = tree.children[0];
    expect(compNode.url).toBe('https://cdn.example.com/comp.js');
    expect(compNode.componentId).toBe('comp-123');
    expect(compNode.componentVersion).toBe('1.0.0');
  });

  it('does not expose _order on output nodes', () => {
    const nodes = [makeNode({ id: 'root', order: 'a0' })];
    const tree = buildTree(nodes);
    expect('_order' in tree).toBe(false);
  });

  it('handles orphaned nodes (parent_id points to missing parent) gracefully', () => {
    // orphan should not crash — it won't appear in the tree but won't throw
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'orphan', parent_id: 'nonexistent', order: 'a0' }),
    ];
    expect(() => buildTree(nodes)).not.toThrow();
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd apps/canvas-backend && npx vitest run src/utils/tree.test.ts --reporter=verbose
```
Expected: 9 tests fail (function exists but may have type issues, or tests catch real bugs)

**Step 3: Fix any bugs found in `buildTree` — run until green**

Check `src/utils/tree.ts` against each failing assertion. Common gotchas:
- `buildTree([])` may return `undefined` not `null` — fix to return null
- `component_url` not mapped to `url` — fix the mapping

**Step 4: Run tests until all pass**

```bash
cd apps/canvas-backend && npx vitest run src/utils/tree.test.ts --reporter=verbose
```
Expected: 9 tests pass

**Step 5: Commit**

```bash
git add apps/canvas-backend/src/utils/tree.test.ts
git commit -m "test: add buildTree unit tests"
```

---

### Task 3: Unit Tests — `resolveOrder()` in insert-node tool

**Files:**
- Create: `apps/canvas-backend/src/mastra/tools/resolve-order.test.ts`

The `resolveOrder(position)` function is inline in `insert-node.ts`. Extract it first, then test it.

**Step 1: Extract `resolveOrder` to be importable**

In `apps/canvas-backend/src/mastra/tools/insert-node.ts`, the function is already defined at the bottom. Export it:

```typescript
// Change:
function resolveOrder(position: string): string {
// To:
export function resolveOrder(position: string): string {
```

**Step 2: Write tests**

```typescript
// apps/canvas-backend/src/mastra/tools/resolve-order.test.ts
import { describe, it, expect } from 'vitest';
import { resolveOrder } from './insert-node';

describe('resolveOrder', () => {
  it('returns "a0" for "first"', () => {
    expect(resolveOrder('first')).toBe('a0');
  });

  it('returns a z-prefixed string for "last"', () => {
    const result = resolveOrder('last');
    expect(result).toMatch(/^z/);
  });

  it('returns an m-prefixed string for "after:<nodeId>"', () => {
    const result = resolveOrder('after:some-node-id');
    expect(result).toMatch(/^m/);
  });

  it('unknown position falls through to m-prefix (append behavior)', () => {
    const result = resolveOrder('unknown');
    expect(result).toMatch(/^m/);
  });
});
```

**Step 3: Run to confirm pass**

```bash
cd apps/canvas-backend && npx vitest run src/mastra/tools/resolve-order.test.ts --reporter=verbose
```
Expected: 4 tests pass

**Step 4: Commit**

```bash
git add apps/canvas-backend/src/mastra/tools/insert-node.ts \
        apps/canvas-backend/src/mastra/tools/resolve-order.test.ts
git commit -m "test: extract and test resolveOrder helper"
```

---

## Phase 2 — Renderer Package Tests

### Task 4: Unit Tests — `resolveStyles()` and `resolveTokens()`

**Files:**
- Create: `packages/renderer/src/helpers.test.ts`

First, check if `resolveStyles` and `resolveTokens` are exported from `packages/renderer/src/PageRenderer.tsx`. If not, extract them to `packages/renderer/src/helpers.ts` and import from there in `PageRenderer.tsx`.

**Step 1: Export helpers from PageRenderer.tsx**

In `packages/renderer/src/PageRenderer.tsx`, ensure these are exported:
```typescript
export function resolveStyles(styles: any, device?: string): React.CSSProperties { ... }
export function resolveTokens(value: string, data: any): string { ... }
```

**Step 2: Write tests**

```typescript
// packages/renderer/src/helpers.test.ts
import { describe, it, expect } from 'vitest';
import { resolveStyles, resolveTokens } from './PageRenderer';

describe('resolveStyles', () => {
  it('returns base styles unchanged when no device', () => {
    const styles = { fontSize: '16px', color: '#111' };
    expect(resolveStyles(styles)).toEqual({ fontSize: '16px', color: '#111' });
  });

  it('strips _sm, _md, _lg, _hover keys from base output', () => {
    const styles = {
      padding: '60px',
      _sm: { padding: '20px' },
      _hover: { opacity: '0.8' },
    };
    const result = resolveStyles(styles);
    expect(result).toEqual({ padding: '60px' });
    expect('_sm' in result).toBe(false);
    expect('_hover' in result).toBe(false);
  });

  it('merges _sm overrides when device is "mobile"', () => {
    const styles = {
      padding: '60px',
      fontSize: '24px',
      _sm: { padding: '20px' },
    };
    const result = resolveStyles(styles, 'mobile');
    expect(result.padding).toBe('20px');    // overridden
    expect(result.fontSize).toBe('24px');   // base preserved
  });

  it('does not apply _sm overrides for desktop (no device)', () => {
    const styles = { padding: '60px', _sm: { padding: '20px' } };
    expect(resolveStyles(styles).padding).toBe('60px');
  });

  it('handles empty styles object', () => {
    expect(resolveStyles({})).toEqual({});
  });

  it('handles null/undefined gracefully', () => {
    expect(() => resolveStyles(null)).not.toThrow();
    expect(() => resolveStyles(undefined)).not.toThrow();
  });
});

describe('resolveTokens', () => {
  it('replaces {{store.name}} with value from data', () => {
    const result = resolveTokens('Welcome to {{store.name}}', { store: { name: 'SeloraX' } });
    expect(result).toBe('Welcome to SeloraX');
  });

  it('replaces nested paths', () => {
    const result = resolveTokens('{{a.b.c}}', { a: { b: { c: 'deep' } } });
    expect(result).toBe('deep');
  });

  it('leaves unknown tokens as empty string', () => {
    const result = resolveTokens('Hello {{unknown.key}}', {});
    expect(result).toBe('Hello ');
  });

  it('replaces multiple tokens in one string', () => {
    const result = resolveTokens('{{a}} and {{b}}', { a: 'foo', b: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('returns non-token strings unchanged', () => {
    expect(resolveTokens('No tokens here', {})).toBe('No tokens here');
  });

  it('handles non-string data value (number → string)', () => {
    const result = resolveTokens('{{count}}', { count: 42 });
    expect(result).toBe('42');
  });
});
```

**Step 3: Run tests**

```bash
cd packages/renderer && npx vitest run src/helpers.test.ts --reporter=verbose
```

**Step 4: Fix any failing tests in `PageRenderer.tsx`**

Common issues: token replacement may not handle nested paths, or `_hover` not being stripped.

**Step 5: Run until all pass, then commit**

```bash
git add packages/renderer/src/helpers.test.ts packages/renderer/src/PageRenderer.tsx
git commit -m "test: add resolveStyles and resolveTokens unit tests"
```

---

### Task 5: Component Tests — `PageRenderer` rendering

**Files:**
- Create: `packages/renderer/src/PageRenderer.test.tsx`

**Step 1: Write tests**

```typescript
// packages/renderer/src/PageRenderer.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageRenderer } from './PageRenderer';
import type { TreeNode } from '@selorax/types';

function makeTree(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: 'root',
    type: 'layout',
    styles: {},
    props: { tag: 'div' },
    settings: {},
    children: [],
    ...overrides,
  };
}

describe('PageRenderer', () => {
  it('renders a text element', () => {
    const tree = makeTree({
      children: [{
        id: 'txt',
        type: 'element',
        styles: {},
        props: { tag: 'text', content: 'Hello World' },
        settings: {},
        children: [],
      }],
    });
    render(<PageRenderer tree={tree} data={{}} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders a heading element with correct tag', () => {
    const tree = makeTree({
      children: [{
        id: 'h1',
        type: 'element',
        styles: { fontSize: '48px' },
        props: { tag: 'heading', level: 1, content: 'Page Title' },
        settings: {},
        children: [],
      }],
    });
    render(<PageRenderer tree={tree} data={{}} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Page Title');
  });

  it('renders an image element with src', () => {
    const tree = makeTree({
      children: [{
        id: 'img',
        type: 'element',
        styles: {},
        props: { tag: 'image', src: 'https://example.com/img.jpg', alt: 'Test' },
        settings: {},
        children: [],
      }],
    });
    render(<PageRenderer tree={tree} data={{}} />);
    const img = screen.getByRole('img', { name: 'Test' });
    expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('resolves tokens in text content', () => {
    const tree = makeTree({
      children: [{
        id: 'txt',
        type: 'element',
        styles: {},
        props: { tag: 'text', content: 'Welcome to {{store.name}}' },
        settings: {},
        children: [],
      }],
    });
    render(<PageRenderer tree={tree} data={{ store: { name: 'TestShop' } }} />);
    expect(screen.getByText('Welcome to TestShop')).toBeInTheDocument();
  });

  it('renders nested layout → element', () => {
    const tree = makeTree({
      children: [{
        id: 'section',
        type: 'layout',
        styles: { padding: '20px' },
        props: { tag: 'section' },
        settings: {},
        children: [{
          id: 'p',
          type: 'element',
          styles: {},
          props: { tag: 'text', content: 'Nested text' },
          settings: {},
          children: [],
        }],
      }],
    });
    render(<PageRenderer tree={tree} data={{}} />);
    expect(screen.getByText('Nested text')).toBeInTheDocument();
  });

  it('renders null tree gracefully (no crash)', () => {
    expect(() => render(<PageRenderer tree={null as any} data={{}} />)).not.toThrow();
  });
});
```

**Step 2: Run tests**

```bash
cd packages/renderer && npx vitest run src/PageRenderer.test.tsx --reporter=verbose
```

**Step 3: Fix issues found, run until all pass, commit**

```bash
git add packages/renderer/src/PageRenderer.test.tsx
git commit -m "test: add PageRenderer component tests"
```

---

## Phase 3 — Backend Route Integration Tests

Strategy: use `supertest` to make HTTP requests against a real Express app instance, with Prisma and SpacetimeDB clients mocked via `vi.mock()`. Redis is mocked as `null` (disabled) by default to keep tests simple.

### Task 6: Integration Test Setup — Shared Test App Factory

**Files:**
- Create: `apps/canvas-backend/src/test-helpers/create-app.ts`
- Create: `apps/canvas-backend/src/test-helpers/mocks.ts`

**Step 1: Create `src/test-helpers/mocks.ts`**

```typescript
// apps/canvas-backend/src/test-helpers/mocks.ts
// Central vi.mock declarations for Prisma, Redis, and STDB.
// Import in any test file that needs these mocks.
import { vi } from 'vitest';

// Default mock Prisma client
export const prismaMock = {
  page: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  pageVersion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  component: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  componentVersion: {
    create: vi.fn(),
  },
  funnel: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  experiment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  conversionEvent: {
    createMany: vi.fn(),
    count: vi.fn(),
  },
};

export function resetMocks() {
  Object.values(prismaMock).forEach(model => {
    Object.values(model).forEach(fn => (fn as any).mockReset());
  });
}
```

**Step 2: Create `src/test-helpers/create-app.ts`**

```typescript
// apps/canvas-backend/src/test-helpers/create-app.ts
// Creates an isolated Express app instance for testing.
// Mocks are injected — no real DB connections needed.
import express from 'express';
import pagesRouter from '../routes/pages';
import componentsRouter from '../routes/components';
import serveRouter from '../routes/serve';
import eventsRouter from '../routes/events';

export function createTestApp() {
  const app = express();
  app.use(express.json());

  // MVP tenant middleware — always returns test-tenant
  app.use((req, _res, next) => {
    (req as any).tenant = { id: 'test-tenant', name: 'Test Store', plan: 'pro' };
    next();
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/pages', pagesRouter);
  app.use('/api/components', componentsRouter);
  app.use('/api/serve', serveRouter);
  app.use('/api/events', eventsRouter);

  return app;
}
```

---

### Task 7: Integration Tests — Pages Routes

**Files:**
- Create: `apps/canvas-backend/src/routes/pages.test.ts`

**Step 1: Write vi.mock declarations (must be at top of file, before imports)**

```typescript
// apps/canvas-backend/src/routes/pages.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.mock MUST be before imports in vitest (hoisted)
vi.mock('../db', () => ({
  prisma: prismaMock,
}));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn(),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../publish/index', () => ({
  publishPage: vi.fn(),
}));

import { prismaMock, resetMocks } from '../test-helpers/mocks';
import { createTestApp } from '../test-helpers/create-app';
import { publishPage } from '../publish/index';

const app = createTestApp();

describe('GET /api/pages', () => {
  beforeEach(() => resetMocks());

  it('returns list of pages for tenant', async () => {
    prismaMock.page.findMany.mockResolvedValue([
      { id: 'page-1', tenantId: 'test-tenant', slug: 'home', pageType: 'home',
        title: 'Home', publishedVersionId: null, createdAt: new Date(), publishedAt: null },
    ]);
    const res = await request(app).get('/api/pages');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].slug).toBe('home');
  });

  it('passes tenantId filter to Prisma', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);
    await request(app).get('/api/pages');
    expect(prismaMock.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'test-tenant' }),
      })
    );
  });
});

describe('POST /api/pages', () => {
  beforeEach(() => resetMocks());

  it('creates a page and returns 201', async () => {
    const created = { id: 'page-new', tenantId: 'test-tenant', slug: 'new-page',
      pageType: 'home', title: 'New Page', publishedVersionId: null,
      createdAt: new Date(), publishedAt: null };
    prismaMock.page.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/pages')
      .send({ slug: 'new-page', pageType: 'home', title: 'New Page' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('page-new');
    expect(prismaMock.page.create).toHaveBeenCalledOnce();
  });

  it('returns 400 when slug is missing', async () => {
    const res = await request(app).post('/api/pages').send({ pageType: 'home' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/pages/:id/publish', () => {
  beforeEach(() => resetMocks());

  it('calls publishPage and returns the version', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1', tenantId: 'test-tenant', slug: 'home', pageType: 'home',
    });
    const mockVersion = { id: 'ver-1', pageId: 'page-1', tenantId: 'test-tenant',
      publishedAt: new Date() };
    (publishPage as any).mockResolvedValue(mockVersion);

    const res = await request(app).post('/api/pages/page-1/publish');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ver-1');
    expect(publishPage).toHaveBeenCalledWith('page-1', 'test-tenant');
  });

  it('returns 404 when page does not belong to tenant', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);
    const res = await request(app).post('/api/pages/nonexistent/publish');
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run**

```bash
cd apps/canvas-backend && npx vitest run src/routes/pages.test.ts --reporter=verbose
```

**Step 3: Fix issues, run until all pass**

Note: If `vi.mock` hoisting causes import order issues, try moving `prismaMock` reference into a factory function.

**Step 4: Commit**

```bash
git add apps/canvas-backend/src/routes/pages.test.ts \
        apps/canvas-backend/src/test-helpers/
git commit -m "test: add pages route integration tests"
```

---

### Task 8: Integration Tests — Serve Route (Cache Logic)

The serve route is critical: Redis HIT → skip MySQL. Redis MISS → MySQL → warm cache.

**Files:**
- Create: `apps/canvas-backend/src/routes/serve.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/routes/serve.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const redisMock = {
  status: 'ready',
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: redisMock }));

import { prismaMock, resetMocks } from '../test-helpers/mocks';
import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

const TREE = { id: 'root', type: 'layout', children: [], styles: {}, props: {}, settings: {} };

describe('GET /api/serve/:tenantId/:pageType/:slug', () => {
  beforeEach(() => {
    resetMocks();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
  });

  it('returns tree from Redis cache on HIT', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ tree: TREE }));

    const res = await request(app).get('/api/serve/store_001/home/index');
    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    // MySQL must NOT be called on cache hit
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to MySQL on Redis MISS and warms cache', async () => {
    redisMock.get.mockResolvedValue(null); // cache miss
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1', tenantId: 'store_001', slug: 'index', publishedVersionId: 'ver-1',
    });
    prismaMock.pageVersion.findUnique.mockResolvedValue({
      id: 'ver-1', tree: JSON.stringify(TREE), publishedAt: new Date(),
    });

    const res = await request(app).get('/api/serve/store_001/home/index');
    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    // Cache must be warmed after MySQL read
    expect(redisMock.set).toHaveBeenCalled();
  });

  it('returns 404 when page not found in MySQL after cache miss', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.page.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/serve/store_001/home/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 404 when page has no published version', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1', tenantId: 'store_001', slug: 'draft',
      publishedVersionId: null, // not published yet
    });

    const res = await request(app).get('/api/serve/store_001/home/draft');
    expect(res.status).toBe(404);
  });

  it('still works when Redis is unavailable (null redis client)', async () => {
    // Temporarily make redis null by overriding the mock
    // This verifies the MySQL fallback path works without Redis
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1', tenantId: 'store_001', slug: 'index', publishedVersionId: 'ver-1',
    });
    prismaMock.pageVersion.findUnique.mockResolvedValue({
      id: 'ver-1', tree: JSON.stringify(TREE), publishedAt: new Date(),
    });
    redisMock.get.mockRejectedValue(new Error('Redis down')); // Redis error

    const res = await request(app).get('/api/serve/store_001/home/index');
    expect(res.status).toBe(200); // must not 500
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/routes/serve.test.ts --reporter=verbose
git add apps/canvas-backend/src/routes/serve.test.ts
git commit -m "test: add serve route integration tests (Redis cache logic)"
```

---

### Task 9: Integration Tests — Components Route (R2 Upload Path)

**Files:**
- Create: `apps/canvas-backend/src/routes/components.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/routes/components.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../utils/r2', () => ({
  r2Configured: vi.fn(() => true),
  uploadToR2: vi.fn(),
}));

import { prismaMock, resetMocks } from '../test-helpers/mocks';
import { createTestApp } from '../test-helpers/create-app';
import { uploadToR2, r2Configured } from '../utils/r2';

const app = createTestApp();

describe('GET /api/components', () => {
  beforeEach(() => resetMocks());

  it('returns components for tenant + global public', async () => {
    prismaMock.component.findMany.mockResolvedValue([
      { id: 'comp-1', tenantId: 'test-tenant', name: 'Hero Banner',
        currentVersion: '1.0.0', currentUrl: 'https://cdn.r2.dev/hero.js',
        versions: [{ id: 'v1', version: '1.0.0', createdAt: new Date() }] },
    ]);
    const res = await request(app).get('/api/components');
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Hero Banner');
    // Query must include OR: tenant OR global public
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it('filters by search query', async () => {
    prismaMock.component.findMany.mockResolvedValue([]);
    await request(app).get('/api/components?search=hero');
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ name: expect.objectContaining({ contains: 'hero' }) }),
      })
    );
  });
});

describe('POST /api/components/:id/versions', () => {
  beforeEach(() => {
    resetMocks();
    vi.mocked(r2Configured).mockReturnValue(true);
  });

  it('uploads to R2 and creates ComponentVersion', async () => {
    const comp = { id: 'comp-1', tenantId: 'test-tenant', name: 'Hero',
      currentVersion: '1.0.0' };
    prismaMock.component.findFirst.mockResolvedValue(comp);
    vi.mocked(uploadToR2).mockResolvedValue('https://cdn.r2.dev/comp-1/1.0.1.js');
    prismaMock.componentVersion.create.mockResolvedValue({
      id: 'cv-1', componentId: 'comp-1', version: '1.0.1',
    });
    prismaMock.component.update.mockResolvedValue({ ...comp, currentVersion: '1.0.1' });

    const res = await request(app)
      .post('/api/components/comp-1/versions')
      .send({ sourceCode: 'export default () => null;' });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe('1.0.1');
    expect(res.body.compiledUrl).toBe('https://cdn.r2.dev/comp-1/1.0.1.js');
    expect(uploadToR2).toHaveBeenCalledWith(
      expect.stringContaining('comp-1'),
      'export default () => null;'
    );
  });

  it('returns 400 when sourceCode is missing', async () => {
    prismaMock.component.findFirst.mockResolvedValue({ id: 'comp-1', tenantId: 'test-tenant' });
    const res = await request(app).post('/api/components/comp-1/versions').send({});
    expect(res.status).toBe(400);
  });

  it('returns 500 when R2 is not configured', async () => {
    prismaMock.component.findFirst.mockResolvedValue({ id: 'comp-1', tenantId: 'test-tenant' });
    vi.mocked(r2Configured).mockReturnValue(false);
    const res = await request(app)
      .post('/api/components/comp-1/versions')
      .send({ sourceCode: 'code' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/R2 not configured/i);
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/routes/components.test.ts --reporter=verbose
git add apps/canvas-backend/src/routes/components.test.ts
git commit -m "test: add components route integration tests (R2 upload logic)"
```

---

## Phase 4 — Mastra Tool Unit Tests

All tool tests follow the same pattern:
1. Mock `callReducer`, `getPageNodes`, `prisma`
2. Call `tool.execute(input)` directly
3. Assert the correct STDB/Prisma call was made with the right args
4. Assert the correct output was returned

### Task 10: Tool Tests — Canvas Read Tools

**Files:**
- Create: `apps/canvas-backend/src/mastra/tools/canvas-read-tools.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/mastra/tools/canvas-read-tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn(),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../../db', () => ({ prisma: {} }));
vi.mock('../../redis/client', () => ({ redis: null }));

import { getPageNodes } from '../../spacetime/client';
import { getPageTreeTool } from './get-page-tree';
import { getNodeTool } from './get-node';
import { findNodesTool } from './find-nodes';

const FLAT_NODES = [
  { id: 'root', page_id: 'p1', tenant_id: 't1', node_type: 'layout',
    parent_id: null, order: 'a0', styles: '{}', props: '{}', settings: '{}',
    children_ids: '[]', component_url: null, component_id: null, component_version: null },
  { id: 'heading', page_id: 'p1', tenant_id: 't1', node_type: 'element',
    parent_id: 'root', order: 'a0', styles: '{}',
    props: '{"tag":"heading","level":1,"content":"Hello"}',
    settings: '{}', children_ids: '[]',
    component_url: null, component_id: null, component_version: null },
];

beforeEach(() => {
  vi.mocked(getPageNodes).mockResolvedValue(FLAT_NODES);
});

describe('get_page_tree tool', () => {
  it('calls getPageNodes with correct tenant/page IDs', async () => {
    await getPageTreeTool.execute({ tenant_id: 't1', page_id: 'p1' });
    expect(getPageNodes).toHaveBeenCalledWith('p1', 't1');
  });

  it('returns built tree and node count', async () => {
    const result = await getPageTreeTool.execute({ tenant_id: 't1', page_id: 'p1' });
    expect(result.node_count).toBe(2);
    expect(result.tree.id).toBe('root');
    expect(result.tree.children).toHaveLength(1);
  });
});

describe('get_node tool', () => {
  it('returns specific node by id', async () => {
    const result = await getNodeTool.execute({
      tenant_id: 't1', page_id: 'p1', node_id: 'heading',
    });
    expect(result.id).toBe('heading');
    expect(result.type).toBe('element');
  });

  it('returns null/error when node not found', async () => {
    const result = await getNodeTool.execute({
      tenant_id: 't1', page_id: 'p1', node_id: 'nonexistent',
    });
    expect(result.error ?? result.id).toBe(result.error);
  });
});

describe('find_nodes tool', () => {
  it('filters nodes by node_type', async () => {
    const result = await findNodesTool.execute({
      tenant_id: 't1', page_id: 'p1', node_type: 'element',
    });
    expect(result.count).toBe(1);
    expect(result.nodes[0].id).toBe('heading');
  });

  it('returns all nodes when no filter specified', async () => {
    const result = await findNodesTool.execute({ tenant_id: 't1', page_id: 'p1' });
    expect(result.count).toBe(2);
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/mastra/tools/canvas-read-tools.test.ts --reporter=verbose
git add apps/canvas-backend/src/mastra/tools/canvas-read-tools.test.ts
git commit -m "test: add canvas read tool unit tests"
```

---

### Task 11: Tool Tests — Canvas Write Tools

**Files:**
- Create: `apps/canvas-backend/src/mastra/tools/canvas-write-tools.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/mastra/tools/canvas-write-tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn().mockResolvedValue(undefined),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../../db', () => ({ prisma: {} }));
vi.mock('../../redis/client', () => ({ redis: null }));

import { callReducer } from '../../spacetime/client';
import { insertNodeTool } from './insert-node';
import { updateNodeStylesTool } from './update-node-styles';
import { updateNodePropsTool } from './update-node-props';
import { deleteNodeTool } from './delete-node';

beforeEach(() => {
  vi.mocked(callReducer).mockReset();
  vi.mocked(callReducer).mockResolvedValue(undefined);
});

describe('insert_node tool', () => {
  it('calls insert_node reducer with correct args', async () => {
    const result = await insertNodeTool.execute({
      tenant_id: 't1', page_id: 'p1', parent_id: 'root',
      position: 'last', node_type: 'element',
      styles: { color: '#fff' }, props: { tag: 'text', content: 'Hi' },
    });
    expect(callReducer).toHaveBeenCalledWith('insert_node', expect.objectContaining({
      page_id: 'p1',
      tenant_id: 't1',
      node_type: 'element',
      styles: JSON.stringify({ color: '#fff' }),
      props: JSON.stringify({ tag: 'text', content: 'Hi' }),
    }));
    expect(result.node_id).toBeDefined(); // UUID
    expect(result.message).toContain('inserted');
  });

  it('uses "a0" order for position="first"', async () => {
    await insertNodeTool.execute({
      tenant_id: 't1', page_id: 'p1', parent_id: 'root',
      position: 'first', node_type: 'layout',
    });
    expect(callReducer).toHaveBeenCalledWith('insert_node', expect.objectContaining({
      order: 'a0',
    }));
  });
});

describe('update_node_styles tool', () => {
  it('calls update_node_styles reducer', async () => {
    const result = await updateNodeStylesTool.execute({
      tenant_id: 't1', node_id: 'n1',
      styles: { padding: '20px', color: '#fff' },
    });
    expect(callReducer).toHaveBeenCalledWith('update_node_styles', {
      node_id: 'n1',
      styles: JSON.stringify({ padding: '20px', color: '#fff' }),
    });
    expect(result.message).toContain('n1');
  });
});

describe('update_node_props tool', () => {
  it('calls update_node_props reducer', async () => {
    await updateNodePropsTool.execute({
      tenant_id: 't1', node_id: 'n1',
      props: { content: 'New text' },
    });
    expect(callReducer).toHaveBeenCalledWith('update_node_props', {
      node_id: 'n1',
      props: JSON.stringify({ content: 'New text' }),
    });
  });
});

describe('delete_node tool', () => {
  it('calls delete_node_cascade reducer', async () => {
    const result = await deleteNodeTool.execute({ tenant_id: 't1', node_id: 'n1' });
    expect(callReducer).toHaveBeenCalledWith('delete_node_cascade', { node_id: 'n1' });
    expect(result.message).toContain('deleted');
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/mastra/tools/canvas-write-tools.test.ts --reporter=verbose
git add apps/canvas-backend/src/mastra/tools/canvas-write-tools.test.ts
git commit -m "test: add canvas write tool unit tests"
```

---

### Task 12: Tool Tests — Component & Page Tools

**Files:**
- Create: `apps/canvas-backend/src/mastra/tools/component-page-tools.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/mastra/tools/component-page-tools.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = {
  component: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  page: { findMany: vi.fn() },
};

vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn().mockResolvedValue(undefined),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../../db', () => ({ prisma: prismaMock }));
vi.mock('../../redis/client', () => ({ redis: null }));
vi.mock('../../publish/index', () => ({
  publishPage: vi.fn().mockResolvedValue({ id: 'ver-1', pageId: 'p1' }),
}));

import { searchComponentsTool } from './search-components';
import { listPagesTool } from './list-pages';
import { publishPageTool } from './publish-page';
import { injectComponentTool } from './inject-component';
import { callReducer } from '../../spacetime/client';

beforeEach(() => {
  Object.values(prismaMock).forEach(m =>
    Object.values(m).forEach((fn: any) => fn.mockReset())
  );
  vi.mocked(callReducer).mockReset().mockResolvedValue(undefined);
});

describe('search_components tool', () => {
  it('searches by query and returns components with count', async () => {
    prismaMock.component.findMany.mockResolvedValue([
      { id: 'c1', name: 'Hero Banner', tenantId: 't1',
        versions: [{ compiledUrl: 'https://cdn.r2.dev/hero.js' }] },
    ]);
    const result = await searchComponentsTool.execute({ tenant_id: 't1', query: 'hero' });
    expect(result.count).toBe(1);
    expect(result.components[0].name).toBe('Hero Banner');
    // Must include tenant-scoped OR global public in query
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });
});

describe('list_pages tool', () => {
  it('returns pages with required fields', async () => {
    prismaMock.page.findMany.mockResolvedValue([
      { id: 'p1', tenantId: 't1', slug: 'home', pageType: 'home',
        title: 'Home', publishedVersionId: 'v1', publishedAt: new Date(), createdAt: new Date() },
    ]);
    const result = await listPagesTool.execute({ tenant_id: 't1' });
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].slug).toBe('home');
  });
});

describe('publish_page tool', () => {
  it('calls publishPage pipeline and returns version info', async () => {
    const result = await publishPageTool.execute({ tenant_id: 't1', page_id: 'p1' });
    expect(result.version_id).toBe('ver-1');
    expect(result.message).toContain('published');
  });
});

describe('inject_component tool', () => {
  it('calls insert_node reducer with node_type=component', async () => {
    const result = await injectComponentTool.execute({
      tenant_id: 't1', page_id: 'p1', parent_id: 'root',
      position: 'last', component_id: 'c1',
      component_url: 'https://cdn.r2.dev/comp.js',
      component_version: '1.0.0',
      settings: { title: 'Hello' },
    });
    expect(callReducer).toHaveBeenCalledWith('insert_node', expect.objectContaining({
      node_type: 'component',
      component_url: expect.objectContaining({ some: 'https://cdn.r2.dev/comp.js' }),
      component_id: expect.objectContaining({ some: 'c1' }),
    }));
    expect(result.node_id).toBeDefined();
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/mastra/tools/component-page-tools.test.ts --reporter=verbose
git add apps/canvas-backend/src/mastra/tools/component-page-tools.test.ts
git commit -m "test: add component and page tool unit tests"
```

---

## Phase 5 — Tenant Isolation & Edge Case Tests

### Task 13: Tenant Isolation Tests

The single most important correctness property: tenant A cannot access tenant B's data.

**Files:**
- Create: `apps/canvas-backend/src/routes/tenant-isolation.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/routes/tenant-isolation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import pagesRouter from '../routes/pages';
import componentsRouter from '../routes/components';

const prismaMock = {
  page: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  pageVersion: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  component: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  componentVersion: { create: vi.fn() },
  funnel: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  experiment: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  conversionEvent: { createMany: vi.fn(), count: vi.fn() },
};

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../publish/index', () => ({ publishPage: vi.fn() }));

// Two separate app instances — one per tenant
function createTenantApp(tenantId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).tenant = { id: tenantId, name: 'Store', plan: 'pro' };
    next();
  });
  app.use('/api/pages', pagesRouter);
  app.use('/api/components', componentsRouter);
  return app;
}

const appA = createTenantApp('tenant-a');
const appB = createTenantApp('tenant-b');

beforeEach(() => {
  Object.values(prismaMock).forEach(m =>
    Object.values(m).forEach((fn: any) => fn.mockReset())
  );
});

describe('Tenant isolation', () => {
  it('GET /api/pages passes tenantId=tenant-a to Prisma for tenant A', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);
    await request(appA).get('/api/pages');
    const call = prismaMock.page.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe('tenant-a');
  });

  it('GET /api/pages passes tenantId=tenant-b to Prisma for tenant B', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);
    await request(appB).get('/api/pages');
    const call = prismaMock.page.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe('tenant-b');
  });

  it('DELETE /api/pages/:id returns 404 when page belongs to different tenant', async () => {
    // Tenant A tries to delete tenant B's page
    // findFirst scoped to tenant-a returns null → 404
    prismaMock.page.findFirst.mockResolvedValue(null);
    const res = await request(appA).delete('/api/pages/tenant-b-page');
    expect(res.status).toBe(404);
    expect(prismaMock.page.delete).not.toHaveBeenCalled(); // NEVER delete without ownership check
  });

  it('PATCH /api/components/:id returns 404 for another tenant component', async () => {
    prismaMock.component.findFirst.mockResolvedValue(null); // ownership check fails
    const res = await request(appA).patch('/api/components/other-tenant-comp').send({ name: 'Hacked' });
    expect(res.status).toBe(404);
    expect(prismaMock.component.update).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/routes/tenant-isolation.test.ts --reporter=verbose
git add apps/canvas-backend/src/routes/tenant-isolation.test.ts
git commit -m "test: add tenant isolation boundary tests"
```

---

### Task 14: Immutable Version Tests (Rollback Logic)

**Files:**
- Create: `apps/canvas-backend/src/routes/pages-rollback.test.ts`

**Step 1: Write tests**

```typescript
// apps/canvas-backend/src/routes/pages-rollback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../publish/index', () => ({ publishPage: vi.fn() }));
vi.mock('../spacetime/client', () => ({ getPageNodes: vi.fn(), callReducer: vi.fn(), opt: (v: any) => v }));

import { prismaMock, resetMocks } from '../test-helpers/mocks';
import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

describe('POST /api/pages/:id/rollback/:versionId', () => {
  beforeEach(() => resetMocks());

  it('updates page.publishedVersionId pointer (never mutates the version)', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1', tenantId: 'test-tenant', slug: 'home',
    });
    prismaMock.pageVersion.findFirst.mockResolvedValue({
      id: 'ver-old', pageId: 'page-1', tenantId: 'test-tenant',
    });
    prismaMock.page.update.mockResolvedValue({
      id: 'page-1', publishedVersionId: 'ver-old',
    });

    const res = await request(app).post('/api/pages/page-1/rollback/ver-old');
    expect(res.status).toBe(200);
    // Only page pointer is updated, NOT pageVersion
    expect(prismaMock.page.update).toHaveBeenCalledWith({
      where: { id: 'page-1' },
      data: expect.objectContaining({ publishedVersionId: 'ver-old' }),
    });
    // Version rows are NEVER mutated (this is the immutability guarantee)
    expect(prismaMock.pageVersion.create).not.toHaveBeenCalled();
  });

  it('returns 404 when version does not belong to page', async () => {
    prismaMock.page.findFirst.mockResolvedValue({ id: 'page-1', tenantId: 'test-tenant' });
    prismaMock.pageVersion.findFirst.mockResolvedValue(null); // version not found
    const res = await request(app).post('/api/pages/page-1/rollback/wrong-ver');
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run, fix, commit**

```bash
cd apps/canvas-backend && npx vitest run src/routes/pages-rollback.test.ts --reporter=verbose
git add apps/canvas-backend/src/routes/pages-rollback.test.ts
git commit -m "test: add immutable version rollback tests"
```

---

## Phase 6 — CI and Coverage

### Task 15: Coverage Report + CI Script

**Files:**
- Create: `.github/workflows/test.yml` (if GitHub Actions is set up)
- Modify: root `package.json`

**Step 1: Add coverage thresholds to `apps/canvas-backend/vitest.config.ts`**

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/utils/**', 'src/routes/**', 'src/mastra/tools/**'],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
  },
},
```

**Step 2: Run coverage and see current baseline**

```bash
cd apps/canvas-backend && npx vitest run --coverage --reporter=verbose
```
Expected: Coverage report printed to terminal. Note which files are below threshold.

**Step 3: Create GitHub Actions workflow (if using GitHub)**

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:backend
      - run: npm run test:renderer
```

**Step 4: Commit**

```bash
git add .github/workflows/test.yml apps/canvas-backend/vitest.config.ts
git commit -m "ci: add test workflow with coverage thresholds"
```

---

## Summary — Test Count by Phase

| Phase | Tests | Coverage |
|-------|-------|---------|
| 1 — Setup + buildTree | 9 | utils/tree.ts: 100% |
| 2 — resolveOrder | 4 | insert-node.ts: partial |
| 3 — resolveStyles + resolveTokens | 12 | PageRenderer helpers: 100% |
| 4 — PageRenderer component | 6 | PageRenderer: ~70% |
| 5 — Pages routes | 5 | routes/pages.ts: ~60% |
| 6 — Serve route (cache logic) | 5 | routes/serve.ts: ~70% |
| 7 — Components + R2 | 5 | routes/components.ts: ~60% |
| 8 — Canvas read tools | 5 | tools/get-*.ts: ~80% |
| 9 — Canvas write tools | 6 | tools/*-node.ts: ~80% |
| 10 — Component/page tools | 5 | tools/search/list/publish: ~75% |
| 11 — Tenant isolation | 4 | Cross-cutting: ensures correctness |
| 12 — Immutable versions | 2 | routes/pages.ts rollback path |
| **Total** | **~68** | **~70% overall** |

## What to Test Manually (Not Worth Automating Now)
- Full AI agent streaming (requires live Anthropic API + STDB Maincloud)
- Real-time multi-client push (covered by `test-realtime.ts`)
- R2 upload signing (requires real AWS credentials to verify)
- Next.js SSR rendering (covered by `curl` tests in dev)
