import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted() creates values at hoist time so they can be referenced in vi.mock() factories.
// Without this, prismaMock would be undefined inside the factory because vi.mock() is hoisted
// above all import statements, but variable declarations are not.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    component: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    componentVersion: {
      create: vi.fn(),
    },
  };
  return { prismaMock };
});

vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../utils/r2', () => ({
  r2Configured: vi.fn(() => true),
  uploadToR2:   vi.fn(),
}));

import { createTestApp } from '../test-helpers/create-app';
import { uploadToR2, r2Configured } from '../utils/r2';

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(r2Configured).mockReturnValue(true);
});

// ---------------------------------------------------------------------------
// GET /api/components
// ---------------------------------------------------------------------------
describe('GET /api/components', () => {
  it('returns components for tenant + global public', async () => {
    prismaMock.component.findMany.mockResolvedValue([
      {
        id:             'comp-1',
        tenantId:       'test-tenant',
        name:           'Hero Banner',
        currentVersion: '1.0.0',
        currentUrl:     'https://cdn.r2.dev/hero.js',
        versions:       [],
      },
    ]);

    const res = await request(app).get('/api/components');

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Hero Banner');
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });

  it('filters by search query', async () => {
    prismaMock.component.findMany.mockResolvedValue([]);

    await request(app).get('/api/components?search=hero');

    // The route sets where.name = { contains: search } at the top-level where object
    expect(prismaMock.component.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: expect.objectContaining({ contains: 'hero' }),
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/components/:id/versions — R2 upload path
// ---------------------------------------------------------------------------
describe('POST /api/components/:id/versions', () => {
  it('uploads to R2 and creates ComponentVersion', async () => {
    prismaMock.component.findFirst.mockResolvedValue({
      id:             'comp-1',
      tenantId:       'test-tenant',
      name:           'Hero',
      currentVersion: '1.0.0',
    });

    vi.mocked(uploadToR2).mockResolvedValue('https://cdn.r2.dev/comp-1/1.0.1.js');

    prismaMock.componentVersion.create.mockResolvedValue({
      id:          'cv-1',
      componentId: 'comp-1',
      version:     '1.0.1',
    });

    prismaMock.component.update.mockResolvedValue({
      id:             'comp-1',
      currentVersion: '1.0.1',
    });

    const res = await request(app)
      .post('/api/components/comp-1/versions')
      .send({ sourceCode: 'export default () => null;' });

    expect(res.status).toBe(201);
    expect(uploadToR2).toHaveBeenCalled();
    // Response shape: { ok, versionId, version, compiledUrl }
    expect(res.body.ok).toBe(true);
    expect(res.body.versionId).toBe('cv-1');
    expect(res.body.compiledUrl).toBe('https://cdn.r2.dev/comp-1/1.0.1.js');
  });

  it('returns 400 when sourceCode is missing', async () => {
    prismaMock.component.findFirst.mockResolvedValue({
      id:       'comp-1',
      tenantId: 'test-tenant',
    });

    const res = await request(app)
      .post('/api/components/comp-1/versions')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 500 when R2 is not configured', async () => {
    prismaMock.component.findFirst.mockResolvedValue({
      id:       'comp-1',
      tenantId: 'test-tenant',
    });

    vi.mocked(r2Configured).mockReturnValue(false);

    const res = await request(app)
      .post('/api/components/comp-1/versions')
      .send({ sourceCode: 'export default () => null;' });

    // Route returns 500 with error: 'R2 not configured (missing S3_* env vars)'
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});
