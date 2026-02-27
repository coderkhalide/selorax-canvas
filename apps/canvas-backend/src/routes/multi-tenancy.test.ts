/**
 * Multi-Tenancy Test Suite
 *
 * The core security invariant: every piece of data is scoped to a tenantId.
 * A tenant must never be able to read, modify, or delete another tenant's data.
 *
 * Attack surfaces tested:
 *   1.  Tenant middleware — MVP mode vs production header
 *   2.  List queries (findMany) — always scoped to tenantId
 *   3.  Read isolation (GET /:id) — cross-tenant access returns 404
 *   4.  Write isolation (PATCH) — cross-tenant access returns 404, mutation never called
 *   5.  Delete isolation (DELETE) — cross-tenant access returns 404, delete never called
 *   6.  Create isolation (POST) — tenantId always from req.tenant, never from request body
 *   7.  Publish isolation — uses req.tenant.id, body cannot override tenantId
 *   8.  Version history & rollback isolation
 *   9.  Redis key namespace isolation — cache keys always prefixed with tenantId
 *  10.  AI tool reducer isolation — tenant_id forwarded to every STDB call
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Tenant } from '@selorax/types';

// ---------------------------------------------------------------------------
// Hoisted mocks (must be created before vi.mock() factories run)
// ---------------------------------------------------------------------------
const { prismaMock, redisMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    pageVersion: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
    },
    component: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    componentVersion: { create: vi.fn() },
    funnel: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    experiment: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
    },
  };
  const redisMock = { status: 'ready', set: vi.fn(), del: vi.fn() };
  return { prismaMock, redisMock };
});

vi.mock('../db',              () => ({ prisma: prismaMock }));
vi.mock('../redis/client',    () => ({ redis: redisMock }));
vi.mock('../spacetime/client', () => ({
  getPageNodes:  vi.fn(),
  callReducer:   vi.fn().mockResolvedValue(undefined),
  opt: (v: any) => v == null ? null : { some: v },
}));
vi.mock('../publish', () => ({
  publishPage: vi.fn().mockResolvedValue({ id: 'ver-1', pageId: 'page-1' }),
}));
vi.mock('../utils/r2', () => ({
  r2Configured: vi.fn(() => false),
  uploadToR2:   vi.fn(),
}));

import pagesRouter      from './pages';
import funnelsRouter    from './funnels';
import experimentsRouter from './experiments';
import componentsRouter  from './components';
import { tenantMiddleware } from '../middleware/tenant';
import { publishPage }      from '../publish';
import { callReducer }      from '../spacetime/client';

import { insertNodeTool }          from '../mastra/tools/insert-node';
import { updateNodeStylesTool }    from '../mastra/tools/update-node-styles';
import { updateNodePropsTool }     from '../mastra/tools/update-node-props';
import { updateNodeSettingsTool }  from '../mastra/tools/update-node-settings';
import { moveNodeTool }            from '../mastra/tools/move-node';
import { deleteNodeTool }          from '../mastra/tools/delete-node';
import { injectComponentTool }     from '../mastra/tools/inject-component';

const mockPublishPage  = publishPage  as ReturnType<typeof vi.fn>;
const mockCallReducer  = callReducer  as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helper: build an isolated Express app for a specific tenant
// ---------------------------------------------------------------------------
function createTenantApp(tenantId: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).tenant = {
      id: tenantId, name: `${tenantId} Store`, domain: `${tenantId}.selorax.com`, plan: 'pro',
    } satisfies Tenant;
    next();
  });
  app.use('/api/pages',       pagesRouter);
  app.use('/api/funnels',     funnelsRouter);
  app.use('/api/experiments', experimentsRouter);
  app.use('/api/components',  componentsRouter);
  return app;
}

const appA = createTenantApp('tenant-a');
const appB = createTenantApp('tenant-b');

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.status = 'ready';
  redisMock.set.mockResolvedValue('OK');
  redisMock.del.mockResolvedValue(1);
  mockCallReducer.mockResolvedValue(undefined);
  mockPublishPage.mockResolvedValue({ id: 'ver-1', pageId: 'page-1' });
});

// ===========================================================================
// 1. Tenant Middleware
// ===========================================================================

describe('Tenant middleware', () => {
  it('MVP_MODE=true: attaches tenant from env vars, ignores headers', () => {
    const saved = { ...process.env };
    process.env.MVP_MODE     = 'true';
    process.env.TENANT_ID    = 'store_001';
    process.env.TENANT_NAME  = 'My Store';
    process.env.TENANT_DOMAIN = 'localhost:3003';
    process.env.TENANT_PLAN  = 'pro';

    const req: any = { headers: { 'x-tenant-id': 'hacker-tenant' } };
    const next = vi.fn();
    tenantMiddleware(req, {} as any, next);

    expect(req.tenant.id).toBe('store_001');
    expect(req.tenant.id).not.toBe('hacker-tenant');
    expect(next).toHaveBeenCalled();

    Object.assign(process.env, saved);
  });

  it('production mode: reads tenant from x-tenant-id header', () => {
    const savedMvp = process.env.MVP_MODE;
    process.env.MVP_MODE = 'false';

    const req: any = { headers: { 'x-tenant-id': 'tenant-xyz', 'x-tenant-name': 'XYZ Store' } };
    const next = vi.fn();
    tenantMiddleware(req, {} as any, next);

    expect(req.tenant.id).toBe('tenant-xyz');
    expect(req.tenant.name).toBe('XYZ Store');
    expect(next).toHaveBeenCalled();

    process.env.MVP_MODE = savedMvp;
  });

  it('production mode: missing x-tenant-id header returns 400', () => {
    const savedMvp = process.env.MVP_MODE;
    process.env.MVP_MODE = 'false';

    const req: any = { headers: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    tenantMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();

    process.env.MVP_MODE = savedMvp;
  });
});

// ===========================================================================
// 2. List queries — findMany always scoped to tenantId
// ===========================================================================

describe('List queries — findMany tenant scoping', () => {
  it('GET /api/pages: passes tenantId="tenant-a" to Prisma, not "tenant-b"', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);
    await request(appA).get('/api/pages');

    const call = prismaMock.page.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe('tenant-a');
    expect(call.where.tenantId).not.toBe('tenant-b');
  });

  it('GET /api/funnels: passes tenantId to Prisma', async () => {
    prismaMock.funnel.findMany.mockResolvedValue([]);
    await request(appA).get('/api/funnels');

    const call = prismaMock.funnel.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe('tenant-a');
  });

  it('GET /api/experiments: passes tenantId to Prisma', async () => {
    prismaMock.experiment.findMany.mockResolvedValue([]);
    await request(appA).get('/api/experiments');

    const call = prismaMock.experiment.findMany.mock.calls[0][0];
    expect(call.where.tenantId).toBe('tenant-a');
  });

  it('GET /api/components: OR clause includes tenantId + global public, never bare tenantId', async () => {
    prismaMock.component.findMany.mockResolvedValue([]);
    await request(appA).get('/api/components');

    const call = prismaMock.component.findMany.mock.calls[0][0];
    // Components use OR: [{ tenantId }, { tenantId: null, isPublic: true }]
    expect(call.where.OR).toContainEqual(expect.objectContaining({ tenantId: 'tenant-a' }));
    expect(call.where.OR).toContainEqual(expect.objectContaining({ tenantId: null, isPublic: true }));
    // Must NOT expose all components globally (no bare {} condition)
    expect(call.where.OR).not.toContainEqual({});
  });

  it('two tenants get independent list queries — never share a where clause', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);
    await request(appA).get('/api/pages');
    await request(appB).get('/api/pages');

    const [callA, callB] = prismaMock.page.findMany.mock.calls;
    expect(callA[0].where.tenantId).toBe('tenant-a');
    expect(callB[0].where.tenantId).toBe('tenant-b');
    expect(callA[0].where.tenantId).not.toBe(callB[0].where.tenantId);
  });
});

// ===========================================================================
// 3. Read isolation — GET /:id cross-tenant returns 404
// ===========================================================================

describe('Read isolation — GET single record', () => {
  it("GET /api/pages/:id: tenant-a cannot read tenant-b's page", async () => {
    prismaMock.page.findFirst.mockResolvedValue(null); // ownership check fails
    const res = await request(appA).get('/api/pages/tenant-b-page');
    expect(res.status).toBe(404);
    // Ownership check must use tenantId from req.tenant
    expect(prismaMock.page.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) })
    );
  });

  it("GET /api/pages/:id/versions: tenant-a cannot read tenant-b's version history", async () => {
    prismaMock.page.findFirst.mockResolvedValue(null); // page ownership check fails
    const res = await request(appA).get('/api/pages/tenant-b-page/versions');
    expect(res.status).toBe(404);
    expect(prismaMock.pageVersion.findMany).not.toHaveBeenCalled();
  });

  it("GET /api/funnels/:id: tenant-a cannot read tenant-b's funnel", async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);
    const res = await request(appA).get('/api/funnels/tenant-b-funnel');
    expect(res.status).toBe(404);
    expect(prismaMock.funnel.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) })
    );
  });

  it("GET /api/experiments/:id: tenant-a cannot read tenant-b's experiment", async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);
    const res = await request(appA).get('/api/experiments/tenant-b-exp');
    expect(res.status).toBe(404);
    expect(prismaMock.experiment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a' }) })
    );
  });

  it("GET /api/components/:id: tenant-a cannot read tenant-b's private component", async () => {
    prismaMock.component.findFirst.mockResolvedValue(null);
    const res = await request(appA).get('/api/components/tenant-b-comp');
    expect(res.status).toBe(404);
  });
});

// ===========================================================================
// 4. Write isolation — PATCH cross-tenant returns 404, mutation never called
// ===========================================================================

describe('Write isolation — PATCH /:id', () => {
  it("PATCH /api/pages/:id: tenant-a cannot modify tenant-b's page, page.update NOT called", async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);
    const res = await request(appA).patch('/api/pages/tenant-b-page').send({ title: 'Hacked' });
    expect(res.status).toBe(404);
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });

  it("PATCH /api/funnels/:id: tenant-a cannot modify tenant-b's funnel, funnel.update NOT called", async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);
    const res = await request(appA).patch('/api/funnels/tenant-b-funnel').send({ name: 'Hacked' });
    expect(res.status).toBe(404);
    expect(prismaMock.funnel.update).not.toHaveBeenCalled();
  });

  it("PATCH /api/components/:id: tenant-a cannot modify tenant-b's component, component.update NOT called", async () => {
    prismaMock.component.findFirst.mockResolvedValue(null);
    const res = await request(appA).patch('/api/components/tenant-b-comp').send({ name: 'Hacked' });
    expect(res.status).toBe(404);
    expect(prismaMock.component.update).not.toHaveBeenCalled();
  });

  it("PATCH /api/experiments/:id/start: tenant-a cannot start tenant-b's experiment", async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);
    const res = await request(appA).patch('/api/experiments/tenant-b-exp/start');
    expect(res.status).toBe(404);
    expect(prismaMock.experiment.update).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it("PATCH /api/experiments/:id/stop: tenant-a cannot stop tenant-b's experiment", async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);
    const res = await request(appA).patch('/api/experiments/tenant-b-exp/stop');
    expect(res.status).toBe(404);
    expect(prismaMock.experiment.update).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 5. Delete isolation — DELETE cross-tenant returns 404, delete never called
// ===========================================================================

describe('Delete isolation — DELETE /:id', () => {
  it("DELETE /api/pages/:id: tenant-a cannot delete tenant-b's page, page.delete NOT called", async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);
    const res = await request(appA).delete('/api/pages/tenant-b-page');
    expect(res.status).toBe(404);
    expect(prismaMock.page.delete).not.toHaveBeenCalled();
  });

  it("DELETE /api/funnels/:id: tenant-a cannot delete tenant-b's funnel, funnel.delete NOT called", async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);
    const res = await request(appA).delete('/api/funnels/tenant-b-funnel');
    expect(res.status).toBe(404);
    expect(prismaMock.funnel.delete).not.toHaveBeenCalled();
  });

  it("DELETE /api/components/:id: tenant-a cannot delete tenant-b's component, component.delete NOT called", async () => {
    prismaMock.component.findFirst.mockResolvedValue(null);
    const res = await request(appA).delete('/api/components/tenant-b-comp');
    expect(res.status).toBe(404);
    expect(prismaMock.component.delete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 6. Create isolation — tenantId always from req.tenant, never from request body
// ===========================================================================

describe('Create isolation — POST always uses req.tenant.id', () => {
  it('POST /api/pages: tenantId comes from req.tenant, body tenantId is ignored', async () => {
    prismaMock.page.create.mockResolvedValue({ id: 'p1', tenantId: 'tenant-a' });

    await request(appA).post('/api/pages').send({
      slug:     'home',
      tenantId: 'tenant-b', // attacker tries to inject a different tenantId
    });

    expect(prismaMock.page.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'tenant-a' }) })
    );
    // Body-supplied tenantId must not appear
    const data = prismaMock.page.create.mock.calls[0][0].data;
    expect(data.tenantId).toBe('tenant-a');
    expect(data.tenantId).not.toBe('tenant-b');
  });

  it('POST /api/funnels: tenantId from req.tenant, body value ignored', async () => {
    prismaMock.funnel.create.mockResolvedValue({ id: 'f1', tenantId: 'tenant-a' });

    await request(appA).post('/api/funnels').send({
      name:     'My Funnel',
      tenantId: 'tenant-b',
    });

    const data = prismaMock.funnel.create.mock.calls[0][0].data;
    expect(data.tenantId).toBe('tenant-a');
    expect(data.tenantId).not.toBe('tenant-b');
  });

  it('POST /api/components: tenantId from req.tenant, body value ignored', async () => {
    prismaMock.component.create.mockResolvedValue({ id: 'c1', tenantId: 'tenant-a' });

    await request(appA).post('/api/components').send({
      name:     'My Component',
      tenantId: 'tenant-b',
    });

    const data = prismaMock.component.create.mock.calls[0][0].data;
    expect(data.tenantId).toBe('tenant-a');
    expect(data.tenantId).not.toBe('tenant-b');
  });

  it('POST /api/experiments: tenantId from req.tenant, body value ignored', async () => {
    prismaMock.experiment.create.mockResolvedValue({ id: 'e1', tenantId: 'tenant-a', variants: [] });

    await request(appA).post('/api/experiments').send({
      pageId:   'page-1',
      name:     'Test Exp',
      tenantId: 'tenant-b',
    });

    const data = prismaMock.experiment.create.mock.calls[0][0].data;
    expect(data.tenantId).toBe('tenant-a');
    expect(data.tenantId).not.toBe('tenant-b');
  });
});

// ===========================================================================
// 7. Publish isolation
// ===========================================================================

describe('Publish isolation', () => {
  it('POST /api/pages/:id/publish passes req.tenant.id to publishPage (not a body-supplied id)', async () => {
    await request(appA).post('/api/pages/page-1/publish').send({
      tenantId: 'tenant-b', // attacker tries to publish as another tenant
    });

    expect(mockPublishPage).toHaveBeenCalledWith('page-1', 'tenant-a');
    // Must never be called with tenant-b
    expect(mockPublishPage).not.toHaveBeenCalledWith(expect.anything(), 'tenant-b');
  });

  it("tenant-b cannot trigger publish of tenant-a's page (publishPage receives 'tenant-b', ownership check inside pipeline rejects)", async () => {
    mockPublishPage.mockRejectedValue(new Error('Page not found or access denied'));

    const res = await request(appB).post('/api/pages/tenant-a-page/publish');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain('Page not found or access denied');
    // publishPage was called with 'tenant-b' so its internal ownership check catches it
    expect(mockPublishPage).toHaveBeenCalledWith('tenant-a-page', 'tenant-b');
  });
});

// ===========================================================================
// 8. Version history & rollback isolation
// ===========================================================================

describe('Version history & rollback isolation', () => {
  it('GET /api/pages/:id/versions: version findMany scoped to both pageId and tenantId', async () => {
    prismaMock.page.findFirst.mockResolvedValue({ id: 'page-1', tenantId: 'tenant-a' });
    prismaMock.pageVersion.findMany.mockResolvedValue([]);

    await request(appA).get('/api/pages/page-1/versions');

    expect(prismaMock.pageVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pageId: 'page-1', tenantId: 'tenant-a' }),
      })
    );
  });

  it('POST /api/pages/:id/rollback: page ownership check uses tenantId', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null); // page not owned by tenant-a
    const res = await request(appA).post('/api/pages/tenant-b-page/rollback/ver-1');
    expect(res.status).toBe(404);
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });

  it('POST /api/pages/:id/rollback: version ownership check uses tenantId — cannot rollback to another tenant\'s version', async () => {
    prismaMock.page.findFirst.mockResolvedValue({ id: 'page-1', tenantId: 'tenant-a' });
    prismaMock.pageVersion.findFirst.mockResolvedValue(null); // version not owned by tenant-a
    const res = await request(appA).post('/api/pages/page-1/rollback/ver-from-tenant-b');
    expect(res.status).toBe(404);
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });

  it('POST /api/pages/:id/rollback: version findFirst scoped to both pageId and tenantId', async () => {
    prismaMock.page.findFirst.mockResolvedValue({ id: 'page-1', tenantId: 'tenant-a' });
    prismaMock.pageVersion.findFirst.mockResolvedValue({ id: 'ver-5', pageId: 'page-1', tenantId: 'tenant-a' });
    prismaMock.page.update.mockResolvedValue({});

    await request(appA).post('/api/pages/page-1/rollback/ver-5');

    expect(prismaMock.pageVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'ver-5', pageId: 'page-1', tenantId: 'tenant-a' }),
      })
    );
  });
});

// ===========================================================================
// 9. Redis key namespace isolation
// ===========================================================================

describe('Redis key namespace isolation', () => {
  it('experiment start: Redis key includes tenantId — tenant-a and tenant-b use different keys', async () => {
    const expA = { id: 'exp-a', pageId: 'page-1', tenantId: 'tenant-a', variants: [] };
    const expB = { id: 'exp-b', pageId: 'page-1', tenantId: 'tenant-b', variants: [] };

    prismaMock.experiment.findFirst.mockResolvedValueOnce(expA);
    prismaMock.experiment.update.mockResolvedValueOnce({ ...expA, status: 'running' });
    await request(appA).patch('/api/experiments/exp-a/start');

    prismaMock.experiment.findFirst.mockResolvedValueOnce(expB);
    prismaMock.experiment.update.mockResolvedValueOnce({ ...expB, status: 'running' });
    await request(appB).patch('/api/experiments/exp-b/start');

    const [keyA, keyB] = redisMock.set.mock.calls.map((c: any[]) => c[0]);
    expect(keyA).toBe('exp:page:tenant-a:page-1');
    expect(keyB).toBe('exp:page:tenant-b:page-1');
    expect(keyA).not.toBe(keyB);
  });

  it('experiment stop: Redis del key includes tenantId', async () => {
    const exp = { id: 'exp-a', pageId: 'page-1', tenantId: 'tenant-a' };
    prismaMock.experiment.findFirst.mockResolvedValue(exp);
    prismaMock.experiment.update.mockResolvedValue({ ...exp, status: 'paused' });

    await request(appA).patch('/api/experiments/exp-a/stop');

    expect(redisMock.del).toHaveBeenCalledWith('exp:page:tenant-a:page-1');
  });

  it('experiment Redis key collision: stopping tenant-a experiment does not delete tenant-b cache', async () => {
    // Setup: tenant-b has an active experiment on the same pageId
    const expA = { id: 'exp-a', pageId: 'page-1', tenantId: 'tenant-a' };
    prismaMock.experiment.findFirst.mockResolvedValue(expA);
    prismaMock.experiment.update.mockResolvedValue({ ...expA, status: 'paused' });

    await request(appA).patch('/api/experiments/exp-a/stop');

    // Only tenant-a's key deleted — tenant-b:page-1 key not touched
    expect(redisMock.del).toHaveBeenCalledWith('exp:page:tenant-a:page-1');
    expect(redisMock.del).not.toHaveBeenCalledWith('exp:page:tenant-b:page-1');
  });
});

// ===========================================================================
// 10. AI tool reducer isolation — tenant_id forwarded to every STDB call
// ===========================================================================

describe('AI tool reducer isolation — tenant_id in every STDB call', () => {
  it('insert_node tool passes tenant_id to insert_node reducer', async () => {
    await insertNodeTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      parent_id: 'root',
      position:  'last',
      node_type: 'element',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'insert_node',
      expect.objectContaining({ tenant_id: 'tenant-a' }),
    );
  });

  it('update_node_styles tool passes tenant_id to update_node_styles reducer', async () => {
    await updateNodeStylesTool.execute({
      tenant_id: 'tenant-b',
      node_id:   'n1',
      styles:    { color: 'red' },
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'update_node_styles',
      expect.objectContaining({ tenant_id: 'tenant-b' }),
    );
  });

  it('update_node_props tool passes tenant_id to update_node_props reducer', async () => {
    await updateNodePropsTool.execute({
      tenant_id: 'tenant-a',
      node_id:   'n1',
      props:     { content: 'Hello' },
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'update_node_props',
      expect.objectContaining({ tenant_id: 'tenant-a' }),
    );
  });

  it('delete_node tool passes tenant_id to delete_node_cascade reducer (Critical Rule)', async () => {
    await deleteNodeTool.execute({
      tenant_id: 'tenant-b',
      node_id:   'n1',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'delete_node_cascade',
      expect.objectContaining({ tenant_id: 'tenant-b' }),
    );
    // Critically — must not be called WITHOUT tenant_id
    const args = mockCallReducer.mock.calls[0][1];
    expect(Object.keys(args)).toContain('tenant_id');
  });

  it('inject_component tool passes tenant_id to insert_node reducer', async () => {
    await injectComponentTool.execute({
      tenant_id:         'tenant-a',
      page_id:           'page-1',
      parent_id:         'root',
      position:          'last',
      component_id:      'comp-1',
      component_url:     'https://cdn.r2.dev/comp-1/1.0.0.js',
      component_version: '1.0.0',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'insert_node',
      expect.objectContaining({ tenant_id: 'tenant-a' }),
    );
  });

  it('update_node_settings tool passes tenant_id to update_node_settings reducer', async () => {
    await updateNodeSettingsTool.execute({
      tenant_id: 'tenant-a',
      node_id:   'n1',
      settings:  { visible: true },
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'update_node_settings',
      expect.objectContaining({ tenant_id: 'tenant-a' }),
    );
  });

  it('move_node tool passes tenant_id to move_node reducer', async () => {
    await moveNodeTool.execute({
      tenant_id:     'tenant-b',
      node_id:       'n1',
      new_parent_id: 'layout-2',
      new_order:     'b0',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'move_node',
      expect.objectContaining({ tenant_id: 'tenant-b' }),
    );
  });

  it('two tools called in sequence — tenant_id never leaks between calls', async () => {
    await insertNodeTool.execute({
      tenant_id: 'tenant-a', page_id: 'p1', parent_id: 'root', position: 'last', node_type: 'element',
    });
    await insertNodeTool.execute({
      tenant_id: 'tenant-b', page_id: 'p2', parent_id: 'root', position: 'last', node_type: 'element',
    });

    const [call1, call2] = mockCallReducer.mock.calls;
    expect(call1[1].tenant_id).toBe('tenant-a');
    expect(call2[1].tenant_id).toBe('tenant-b');
    expect(call1[1].tenant_id).not.toBe(call2[1].tenant_id);
  });
});
