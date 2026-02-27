// apps/canvas-backend/src/routes/funnels.test.ts
//
// funnels.ts behavior summary (read from source):
//
//   GET /api/funnels
//     prisma.funnel.findMany({ where: { tenantId }, include: { steps: ... }, orderBy: { createdAt: 'desc' } })
//     Returns array.
//
//   GET /api/funnels/:id
//     prisma.funnel.findFirst({ where: { id, tenantId }, include: { steps: ... } })
//     404 if null.
//
//   POST /api/funnels
//     prisma.funnel.create({ data: { tenantId, name, goal, steps?: { create: [...] } } })
//     Returns 201 + created funnel.
//
//   PATCH /api/funnels/:id
//     Ownership check: findFirst({ where: { id, tenantId } }) → 404 if null
//     Then: prisma.funnel.update({ where: { id }, data: { name, goal, status } })
//     Returns updated funnel.
//
//   DELETE /api/funnels/:id
//     Ownership check: findFirst({ where: { id, tenantId } }) → 404 if null
//     Then: prisma.funnel.delete({ where: { id } })
//     Returns { ok: true }.
//     If ownership check fails → 404, delete NOT called.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted() creates values at hoist time so they can be referenced in vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    funnel: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../db',           () => ({ prisma: prismaMock }));
// Funnels do not use Redis — mock as null so accidental access throws rather than hangs
vi.mock('../redis/client', () => ({ redis: null }));

import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/funnels
// ---------------------------------------------------------------------------
describe('GET /api/funnels', () => {

  // -------------------------------------------------------------------------
  // Test 1 — returns list filtered by tenantId
  //
  // The route calls findMany with where: { tenantId: tenant.id }.
  // tenant.id is always 'test-tenant' (injected by createTestApp middleware).
  // -------------------------------------------------------------------------
  it('returns funnel list with tenantId filter', async () => {
    prismaMock.funnel.findMany.mockResolvedValue([
      {
        id:       'funnel-1',
        tenantId: 'test-tenant',
        name:     'Lead Capture',
        goal:     'signup',
        status:   'active',
        steps:    [],
      },
    ]);

    const res = await request(app).get('/api/funnels');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Lead Capture');

    // Must filter by tenantId so cross-tenant data is never returned
    expect(prismaMock.funnel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'test-tenant' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/funnels/:id
// ---------------------------------------------------------------------------
describe('GET /api/funnels/:id', () => {

  // -------------------------------------------------------------------------
  // Test 2 — 404 when funnel not found (or belongs to different tenant)
  //
  // findFirst uses both id AND tenantId in WHERE, so a funnel owned by another
  // tenant returns null the same as a nonexistent funnel — both yield 404.
  // -------------------------------------------------------------------------
  it('returns 404 when funnel not found', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/funnels/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/funnels
// ---------------------------------------------------------------------------
describe('POST /api/funnels', () => {

  // -------------------------------------------------------------------------
  // Test 3 — creates funnel and returns 201
  //
  // The route accepts { name, goal, steps? } and calls prisma.funnel.create()
  // with tenantId injected from req.tenant.id.  Steps are optional; when
  // provided they are mapped to FunnelStep create shapes.
  // -------------------------------------------------------------------------
  it('creates funnel and returns 201', async () => {
    const created = {
      id:       'funnel-new',
      tenantId: 'test-tenant',
      name:     'Onboarding Flow',
      goal:     'purchase',
      status:   'draft',
      steps:    [],
    };
    prismaMock.funnel.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/funnels')
      .send({ name: 'Onboarding Flow', goal: 'purchase' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('funnel-new');
    expect(res.body.name).toBe('Onboarding Flow');

    // tenantId must be injected from middleware — never trusted from body
    expect(prismaMock.funnel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: 'test-tenant', name: 'Onboarding Flow' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/funnels/:id
// ---------------------------------------------------------------------------
describe('PATCH /api/funnels/:id', () => {

  // -------------------------------------------------------------------------
  // Test 4 — returns 404 when funnel belongs to a different tenant
  //
  // The ownership check uses findFirst({ where: { id, tenantId } }).
  // If the funnel exists but for a different tenant, findFirst returns null
  // (because tenantId does not match).  The route must return 404 and must
  // NOT call funnel.update().
  // -------------------------------------------------------------------------
  it('returns 404 when funnel belongs to different tenant', async () => {
    // Ownership check fails — funnel not found for this tenant
    prismaMock.funnel.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/funnels/other-tenant-funnel')
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();

    // update must never be called when ownership check fails
    expect(prismaMock.funnel.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/funnels/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/funnels/:id', () => {

  // -------------------------------------------------------------------------
  // Test 5 — 404 when not found, funnel.delete NOT called
  //
  // The route first performs an ownership check (findFirst with tenantId).
  // If that returns null the route short-circuits with 404 and must NEVER
  // call funnel.delete() — this prevents cross-tenant deletions.
  // -------------------------------------------------------------------------
  it('returns 404 when not found and does not call delete', async () => {
    // Ownership check returns null (funnel doesn't exist or wrong tenant)
    prismaMock.funnel.findFirst.mockResolvedValue(null);

    const res = await request(app).delete('/api/funnels/ghost-funnel');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();

    // delete must NOT be called — guard must have short-circuited
    expect(prismaMock.funnel.delete).not.toHaveBeenCalled();
  });
});
