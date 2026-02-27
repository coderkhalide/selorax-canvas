import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they can be referenced in vi.mock() factories.
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
  };
  return { prismaMock };
});

// vi.mock() declarations are hoisted to the top of the file by Vitest.
// The factory functions run after module loading, using the hoisted prismaMock reference.
vi.mock('../db', () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: null }));
vi.mock('../spacetime/client', () => ({
  getPageNodes:  vi.fn(),
  callReducer:   vi.fn(),
}));
// pages.ts imports publishPage from '../publish' (not '../publish/index')
vi.mock('../publish', () => ({
  publishPage: vi.fn(),
}));

import request from 'supertest';
import { createTestApp } from '../test-helpers/create-app';
import { publishPage } from '../publish';

const app = createTestApp();

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// GET /api/pages
// ---------------------------------------------------------------------------
describe('GET /api/pages', () => {
  it('returns list of pages for tenant', async () => {
    prismaMock.page.findMany.mockResolvedValue([
      {
        id: 'page-1',
        tenantId: 'test-tenant',
        slug: 'home',
        pageType: 'home',
        title: 'Home',
        publishedVersionId: null,
        createdAt: new Date(),
        publishedAt: null,
      },
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

// ---------------------------------------------------------------------------
// POST /api/pages
// ---------------------------------------------------------------------------
describe('POST /api/pages', () => {
  it('creates a page and returns 201', async () => {
    const created = {
      id: 'page-new',
      tenantId: 'test-tenant',
      slug: 'new-page',
      pageType: 'home',
      title: 'New Page',
      publishedVersionId: null,
      createdAt: new Date(),
      publishedAt: null,
    };
    prismaMock.page.create.mockResolvedValue(created);

    const res = await request(app)
      .post('/api/pages')
      .send({ slug: 'new-page', pageType: 'home', title: 'New Page' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('page-new');
    expect(prismaMock.page.create).toHaveBeenCalledOnce();
  });

  it('returns 400 when slug is missing', async () => {
    const res = await request(app)
      .post('/api/pages')
      .send({ pageType: 'home' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/pages/:id/publish
//
// The route calls publishPage(id, tenantId) directly without a prior findFirst.
// publishPage throws if the page is not found or access is denied.
// A successful publish returns the result of publishPage as JSON with status 200.
// When publishPage throws (e.g. page not found), the route returns 500.
// ---------------------------------------------------------------------------
describe('POST /api/pages/:id/publish', () => {
  it('calls publishPage and returns the version', async () => {
    (publishPage as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'ver-1',
      pageId: 'page-1',
    });

    const res = await request(app).post('/api/pages/page-1/publish');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('ver-1');
    expect(publishPage).toHaveBeenCalledWith('page-1', 'test-tenant');
  });

  it('returns 500 when publishPage throws (page not found / access denied)', async () => {
    (publishPage as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Page not found or access denied')
    );

    const res = await request(app).post('/api/pages/nonexistent/publish');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Page not found or access denied');
  });
});

// ---------------------------------------------------------------------------
// POST /api/pages — duplicate slug (409)
// ---------------------------------------------------------------------------
describe('POST /api/pages — duplicate', () => {
  it('returns 409 when slug already exists', async () => {
    const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
    prismaMock.page.create.mockRejectedValue(err);
    const res = await request(app)
      .post('/api/pages')
      .send({ slug: 'existing-slug', pageType: 'home', title: 'Dupe' });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// POST /api/pages/:id/rollback/:versionId
//
// Critical Rule: versions are immutable — rollback = pointer update only.
// The handler calls page.findFirst (ownership), pageVersion.findFirst (version
// existence), then page.update({ publishedVersionId }). It never creates a new
// version row.
// ---------------------------------------------------------------------------
describe('POST /api/pages/:id/rollback/:versionId', () => {
  it('updates the page publishedVersionId (pointer update, not copy)', async () => {
    prismaMock.page.findFirst.mockResolvedValue({ id: 'page-1', tenantId: 'test-tenant' });
    prismaMock.pageVersion.findFirst.mockResolvedValue({
      id: 'ver-old',
      pageId: 'page-1',
      tenantId: 'test-tenant',
    });
    prismaMock.page.update.mockResolvedValue({ id: 'page-1', publishedVersionId: 'ver-old' });

    const res = await request(app).post('/api/pages/page-1/rollback/ver-old');

    expect(res.status).toBe(200);
    // Verify pointer update was made with the correct versionId
    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishedVersionId: 'ver-old' }),
      })
    );
    // Versions are immutable — rollback must never create a new version row
    expect(prismaMock.pageVersion.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/pages/:id — tenant isolation
//
// The handler calls page.findFirst({ where: { id, tenantId } }) before
// deleting. If the page does not belong to the tenant, it returns 404 and
// must NOT call page.delete.
// ---------------------------------------------------------------------------
describe('DELETE /api/pages/:id', () => {
  it('returns 404 when page does not belong to tenant (tenant isolation)', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null); // ownership check fails
    const res = await request(app).delete('/api/pages/other-tenant-page');
    expect(res.status).toBe(404);
    // Crucially: delete must NOT be called when ownership fails
    expect(prismaMock.page.delete).not.toHaveBeenCalled();
  });
});
