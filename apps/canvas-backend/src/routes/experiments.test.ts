// apps/canvas-backend/src/routes/experiments.test.ts
//
// experiments.ts behavior summary (read from source):
//
//   GET /api/experiments
//     prisma.experiment.findMany({ where: { tenantId }, include: { variants: true }, orderBy: { createdAt: 'desc' } })
//
//   GET /api/experiments/:id
//     prisma.experiment.findFirst({ where: { id, tenantId }, include: { variants, snapshots, analyses } })
//     404 if null.
//
//   POST /api/experiments
//     prisma.experiment.create({ data: { tenantId, pageId, name, hypothesis, primaryMetric, trafficMode, variants? } })
//     Returns 201.
//
//   PATCH /api/experiments/:id/start
//     Ownership check: findFirst({ where: { id, tenantId }, include: { variants: true } }) → 404 if null
//     prisma.experiment.update({ where: { id }, data: { status: 'running', startedAt: new Date() } })
//     Redis set: `exp:page:${tenantId}:${pageId}` with EX 86400*30 (30 days) — only if redis.status === 'ready'
//     Returns updated experiment.
//
//   PATCH /api/experiments/:id/stop
//     Ownership check: findFirst({ where: { id, tenantId } }) → 404 if null
//     prisma.experiment.update({ where: { id }, data: { status: 'paused', endedAt: new Date() } })
//     Redis del: `exp:page:${tenantId}:${pageId}` — only if redis.status === 'ready'
//     Returns updated experiment.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted() creates values at hoist time so they can be referenced in vi.mock() factories.
// Without this, the mocks would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock, redisMock } = vi.hoisted(() => {
  const prismaMock = {
    experiment: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
    },
  };

  // status: 'ready' makes the route attempt Redis (guard: redis.status === 'ready')
  const redisMock = {
    status: 'ready' as string,
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };

  return { prismaMock, redisMock };
});

vi.mock('../db',           () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: redisMock }));

import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
  // Reset status to 'ready' so Redis is attempted by default in each test
  redisMock.status = 'ready';
});

// ---------------------------------------------------------------------------
// GET /api/experiments
// ---------------------------------------------------------------------------
describe('GET /api/experiments', () => {

  // -------------------------------------------------------------------------
  // Test 1 — returns list filtered by tenantId
  //
  // The route calls findMany with where: { tenantId: tenant.id }.
  // tenant.id is always 'test-tenant' (injected by createTestApp middleware).
  // -------------------------------------------------------------------------
  it('returns experiment list with tenantId filter', async () => {
    prismaMock.experiment.findMany.mockResolvedValue([
      {
        id:             'exp-1',
        tenantId:       'test-tenant',
        pageId:         'page-1',
        name:           'Hero CTA Test',
        status:         'draft',
        primaryMetric:  'conversion_rate',
        trafficMode:    'sticky',
        variants:       [],
      },
    ]);

    const res = await request(app).get('/api/experiments');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Hero CTA Test');

    // Must filter by tenantId so cross-tenant data is never returned
    expect(prismaMock.experiment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'test-tenant' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/experiments/:id
// ---------------------------------------------------------------------------
describe('GET /api/experiments/:id', () => {

  // -------------------------------------------------------------------------
  // Test 2 — 404 when experiment not found
  //
  // findFirst uses both id AND tenantId in WHERE.  If the experiment does not
  // exist, or belongs to a different tenant, findFirst returns null → 404.
  // -------------------------------------------------------------------------
  it('returns 404 when experiment not found', async () => {
    prismaMock.experiment.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/experiments/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/experiments
// ---------------------------------------------------------------------------
describe('POST /api/experiments', () => {

  // -------------------------------------------------------------------------
  // Test 3 — creates experiment and returns 201
  //
  // The route accepts { pageId, name, hypothesis, primaryMetric, trafficMode, variants? }
  // and calls prisma.experiment.create() with tenantId injected from req.tenant.id.
  // -------------------------------------------------------------------------
  it('creates experiment and returns 201', async () => {
    const created = {
      id:            'exp-new',
      tenantId:      'test-tenant',
      pageId:        'page-1',
      name:          'Button Color Test',
      hypothesis:    'Red button converts better',
      primaryMetric: 'conversion_rate',
      trafficMode:   'sticky',
      status:        'draft',
      variants:      [],
    };
    prismaMock.experiment.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/experiments')
      .send({
        pageId:     'page-1',
        name:       'Button Color Test',
        hypothesis: 'Red button converts better',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('exp-new');
    expect(res.body.name).toBe('Button Color Test');

    // tenantId must be injected from middleware — never trusted from body
    expect(prismaMock.experiment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'test-tenant', pageId: 'page-1' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/experiments/:id/start
// ---------------------------------------------------------------------------
describe('PATCH /api/experiments/:id/start', () => {

  // -------------------------------------------------------------------------
  // Test 4 — sets status to 'running' and warms Redis cache
  //
  // The route:
  //   1. Ownership check via findFirst (includes variants)
  //   2. Updates status to 'running', sets startedAt
  //   3. Caches to Redis key `exp:page:{tenantId}:{pageId}` with EX 86400*30
  //      (only when redis.status === 'ready')
  // -------------------------------------------------------------------------
  it("sets status to 'running' and warms Redis cache", async () => {
    const experiment = {
      id:       'exp-1',
      tenantId: 'test-tenant',
      pageId:   'page-1',
      name:     'Hero CTA Test',
      status:   'draft',
      variants: [{ id: 'var-1', name: 'Control', isControl: true, trafficWeight: 0.5 }],
    };
    prismaMock.experiment.findFirst.mockResolvedValue(experiment);

    const updated = { ...experiment, status: 'running', startedAt: new Date() };
    prismaMock.experiment.update.mockResolvedValue(updated);
    redisMock.set.mockResolvedValue('OK');

    const res = await request(app).patch('/api/experiments/exp-1/start');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');

    // Prisma update must use status: 'running'
    expect(prismaMock.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-1' },
        data:  expect.objectContaining({ status: 'running' }),
      })
    );

    // Redis must be warmed with the correct key and 30-day TTL
    const expectedKey = 'exp:page:test-tenant:page-1';
    expect(redisMock.set).toHaveBeenCalledWith(
      expectedKey,
      expect.any(String),
      'EX',
      86400 * 30,
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/experiments/:id/stop
// ---------------------------------------------------------------------------
describe('PATCH /api/experiments/:id/stop', () => {

  // -------------------------------------------------------------------------
  // Test 5 — sets status to 'paused' and deletes Redis key
  //
  // The route:
  //   1. Ownership check via findFirst
  //   2. Updates status to 'paused', sets endedAt
  //   3. Deletes Redis key `exp:page:{tenantId}:{pageId}`
  //      (only when redis.status === 'ready')
  // -------------------------------------------------------------------------
  it("sets status to 'paused' and deletes Redis key", async () => {
    const experiment = {
      id:       'exp-1',
      tenantId: 'test-tenant',
      pageId:   'page-1',
      name:     'Hero CTA Test',
      status:   'running',
    };
    prismaMock.experiment.findFirst.mockResolvedValue(experiment);

    const updated = { ...experiment, status: 'paused', endedAt: new Date() };
    prismaMock.experiment.update.mockResolvedValue(updated);
    redisMock.del.mockResolvedValue(1);

    const res = await request(app).patch('/api/experiments/exp-1/stop');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paused');

    // Prisma update must use status: 'paused'
    expect(prismaMock.experiment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'exp-1' },
        data:  expect.objectContaining({ status: 'paused' }),
      })
    );

    // Redis key must be deleted to stop serving the experiment config
    const expectedKey = 'exp:page:test-tenant:page-1';
    expect(redisMock.del).toHaveBeenCalledWith(expectedKey);
  });
});
