import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    pageVersion: {
      findMany:   vi.fn(),
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
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
    conversionEvent: {
      createMany: vi.fn(),
      count:      vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../spacetime/client', () => ({ getPageNodes: vi.fn(), callReducer: vi.fn() }));
vi.mock('../publish', () => ({ publishPage: vi.fn() }));
vi.mock('../utils/r2', () => ({
  r2Configured: vi.fn(() => false),
  uploadToR2:   vi.fn(),
}));

import request from 'supertest';
import express from 'express';
import type { Tenant } from '@selorax/types';
import pagesRouter      from '../routes/pages';
import componentsRouter from '../routes/components';

// ---------------------------------------------------------------------------
// createTenantApp — builds an isolated Express app for a specific tenant.
// Simulates production tenant middleware by injecting req.tenant directly.
// ---------------------------------------------------------------------------
function createTenantApp(tenantId: string, domain = 'test.selorax.com') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).tenant = {
      id:     tenantId,
      name:   'Store',
      domain,
      plan:   'pro',
    } satisfies Tenant;
    next();
  });
  app.use('/api/pages',      pagesRouter);
  app.use('/api/components', componentsRouter);
  return app;
}

const appA = createTenantApp('tenant-a');
const appB = createTenantApp('tenant-b');

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tenant-A page list passes correct tenantId
// ---------------------------------------------------------------------------
describe('GET /api/pages — tenant isolation', () => {
  it('tenant-a GET /api/pages passes tenantId="tenant-a" to Prisma', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);

    await request(appA).get('/api/pages');

    expect(prismaMock.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-a' }),
      })
    );
  });

  it('tenant-b GET /api/pages passes tenantId="tenant-b" to Prisma', async () => {
    prismaMock.page.findMany.mockResolvedValue([]);

    await request(appB).get('/api/pages');

    expect(prismaMock.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-b' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant DELETE — tenant-a cannot delete tenant-b's page
// ---------------------------------------------------------------------------
describe('DELETE /api/pages — cross-tenant isolation', () => {
  it("DELETE by tenant-a on tenant-b's page returns 404, page.delete NOT called", async () => {
    // The ownership check (findFirst with tenantId: 'tenant-a') returns null
    // because this page belongs to tenant-b
    prismaMock.page.findFirst.mockResolvedValue(null);

    const res = await request(appA).delete('/api/pages/tenant-b-page-id');

    expect(res.status).toBe(404);
    // page.delete must NEVER be called when ownership check fails
    expect(prismaMock.page.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cross-tenant PATCH /api/components — tenant-a cannot modify tenant-b's component
// ---------------------------------------------------------------------------
describe('PATCH /api/components — cross-tenant isolation', () => {
  it("PATCH by tenant-a on tenant-b's component returns 404, component.update NOT called", async () => {
    // The ownership check (findFirst with tenantId: 'tenant-a') returns null
    // because this component belongs to tenant-b
    prismaMock.component.findFirst.mockResolvedValue(null);

    const res = await request(appA)
      .patch('/api/components/tenant-b-comp-id')
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(404);
    // component.update must NEVER be called when ownership check fails
    expect(prismaMock.component.update).not.toHaveBeenCalled();
  });
});
