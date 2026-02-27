import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    pageVersion: {
      findFirst:  vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../spacetime/client', () => ({ getPageNodes: vi.fn(), callReducer: vi.fn() }));
vi.mock('../publish', () => ({ publishPage: vi.fn() }));

import request from 'supertest';
import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Rollback = pointer update only (Critical Rule: versions are immutable)
// ---------------------------------------------------------------------------
describe('POST /api/pages/:id/rollback/:versionId — version immutability', () => {
  it('rollback is a pointer update: page.update called with publishedVersionId, pageVersion.create NOT called', async () => {
    // Ownership check — page belongs to test-tenant
    prismaMock.page.findFirst.mockResolvedValue({
      id:       'page-1',
      tenantId: 'test-tenant',
    });
    // Version existence check — version belongs to this page + tenant
    prismaMock.pageVersion.findFirst.mockResolvedValue({
      id:       'ver-old',
      pageId:   'page-1',
      tenantId: 'test-tenant',
    });
    prismaMock.page.update.mockResolvedValue({
      id:                 'page-1',
      publishedVersionId: 'ver-old',
    });

    const res = await request(app).post('/api/pages/page-1/rollback/ver-old');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.rolledBackTo).toBe('ver-old');

    // Rollback MUST call page.update with the correct publishedVersionId pointer
    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedVersionId: 'ver-old' }),
      })
    );

    // Versions are immutable — rollback must NEVER create a new version row
    expect(prismaMock.pageVersion.create).not.toHaveBeenCalled();
  });

  it('returns 404 when version does not belong to this page/tenant', async () => {
    // Ownership check — page belongs to test-tenant
    prismaMock.page.findFirst.mockResolvedValue({
      id:       'page-1',
      tenantId: 'test-tenant',
    });
    // Version lookup returns null — version doesn't exist for this page + tenant
    prismaMock.pageVersion.findFirst.mockResolvedValue(null);

    const res = await request(app).post('/api/pages/page-1/rollback/nonexistent-ver');

    expect(res.status).toBe(404);
    // page.update must NOT be called when version doesn't exist
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });
});
