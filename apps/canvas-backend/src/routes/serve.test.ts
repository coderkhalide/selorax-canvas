// apps/canvas-backend/src/routes/serve.test.ts
//
// serve.ts behavior summary (read from source):
//
//   URL:  GET /api/serve/:tenantId/:pageType/:slug
//   Redis key: `serve:${tenantId}:${pageType}:${slug}`
//   Guard: redis.status === 'ready' controls whether Redis is attempted at all.
//   On Redis HIT:  parse JSON, set X-Cache: HIT, return payload (no MySQL).
//   On Redis MISS: fall through to MySQL.
//   On Redis ERROR: caught silently, falls through to MySQL (resilient).
//   MySQL: page.findFirst({ where: { tenantId, pageType, slug, publishedVersionId: { not: null } } })
//          Pages with publishedVersionId: null are excluded by the query itself → 404.
//   On MySQL miss: 404.
//   On MySQL hit: pageVersion.findUnique({ where: { id: page.publishedVersionId } })
//   On version miss: 404.
//   On version hit: return { tree, versionId, pageId, tenantId } + warm Redis cache.
//   Cache warming: redis.set(cacheKey, JSON.stringify(payload), 'EX', 3600)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted() ensures mocks are available inside vi.mock() factory functions,
// which are hoisted above all import statements by Vitest.
const { prismaMock, redisMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
    },
    pageVersion: {
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
    },
    funnelStep: {
      findFirst: vi.fn(),
    },
  };

  // status: 'ready' makes the route attempt Redis (guard: redis.status === 'ready')
  const redisMock = {
    status: 'ready' as string,
    get: vi.fn(),
    set: vi.fn(),
  };

  return { prismaMock, redisMock };
});

vi.mock('../db',           () => ({ prisma: prismaMock }));
vi.mock('../redis/client', () => ({ redis: redisMock }));

import { createTestApp } from '../test-helpers/create-app';

const app = createTestApp();

// Minimal valid component tree used in version.tree (stored as JSON string in MySQL)
const TREE = {
  id: 'root',
  type: 'layout',
  children: [],
  styles: {},
  props: {},
  settings: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset status to 'ready' so Redis is attempted by default in each test
  redisMock.status = 'ready';
  // Default: no funnel step (funnelContext: null)
  prismaMock.funnelStep.findFirst.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// GET /api/serve/:tenantId/:pageType/:slug
// ---------------------------------------------------------------------------
describe('GET /api/serve/:tenantId/:pageType/:slug', () => {

  // -------------------------------------------------------------------------
  // Test 1 — Redis cache HIT
  //
  // When Redis returns a cached payload, the route must:
  //   - Return 200 with the parsed payload (including tree)
  //   - NOT call MySQL at all
  //   - Set X-Cache: HIT header
  // -------------------------------------------------------------------------
  it('returns tree from Redis cache on HIT', async () => {
    // Cache payload matches what the route stores: { tree, versionId, pageId, tenantId, funnelContext, experimentContext }
    const cachedPayload = {
      tree: TREE,
      versionId: 'ver-1',
      pageId: 'page-1',
      tenantId: 'store_001',
      funnelContext: null,
      experimentContext: null,
    };
    redisMock.get.mockResolvedValue(JSON.stringify(cachedPayload));

    const res = await request(app).get('/api/serve/store_001/home/index');

    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    expect(res.body.tree.id).toBe('root');
    expect(res.body.funnelContext).toBeNull();
    expect(res.body.experimentContext).toBeNull();

    // MySQL must NOT be called on cache hit
    expect(prismaMock.page.findFirst).not.toHaveBeenCalled();

    // X-Cache header must be set to HIT
    expect(res.headers['x-cache']).toBe('HIT');
  });

  // -------------------------------------------------------------------------
  // Test 2 — Redis cache MISS → MySQL fallback + cache warm
  //
  // When Redis returns null (miss), the route must:
  //   - Query MySQL for the page (with publishedVersionId filter)
  //   - Query MySQL for the version
  //   - Return 200 with { tree, versionId, pageId, tenantId }
  //   - Call redis.set to warm the cache (with 'EX', 3600 TTL args)
  // -------------------------------------------------------------------------
  it('falls back to MySQL on Redis MISS and warms cache', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');

    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      tenantId: 'store_001',
      slug: 'index',
      pageType: 'home',
      publishedVersionId: 'ver-1',
    });

    prismaMock.pageVersion.findUnique.mockResolvedValue({
      id: 'ver-1',
      tree: JSON.stringify(TREE),
      publishedAt: new Date(),
    });

    const res = await request(app).get('/api/serve/store_001/home/index');

    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
    expect(res.body.tree.id).toBe('root');
    expect(res.body.versionId).toBe('ver-1');
    expect(res.body.pageId).toBe('page-1');
    expect(res.body.tenantId).toBe('store_001');

    // Cache must be warmed after MySQL read with the correct TTL signature
    expect(redisMock.set).toHaveBeenCalledWith(
      'serve:store_001:home:index',
      expect.any(String),
      'EX',
      3600,
    );

    // X-Cache header must be MISS on DB fallback
    expect(res.headers['x-cache']).toBe('MISS');
  });

  // -------------------------------------------------------------------------
  // Test 3 — MySQL miss → 404
  //
  // When Redis misses and the page is not found in MySQL (either nonexistent or
  // not published — the query filters publishedVersionId: { not: null }), the
  // route returns 404.
  // -------------------------------------------------------------------------
  it('returns 404 when page not found in MySQL after cache miss', async () => {
    redisMock.get.mockResolvedValue(null);
    prismaMock.page.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/serve/store_001/home/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 4 — Page with no published version → 404
  //
  // The MySQL query uses publishedVersionId: { not: null } as a WHERE clause,
  // so a draft page (publishedVersionId: null) will NOT be returned by
  // findFirst — it returns null → 404.
  // We simulate this by having findFirst return null (which is what MySQL does
  // when the filter excludes the row).
  // -------------------------------------------------------------------------
  it('returns 404 when page has no published version', async () => {
    redisMock.get.mockResolvedValue(null);
    // The query itself excludes unpublished pages, so findFirst returns null
    prismaMock.page.findFirst.mockResolvedValue(null);

    const res = await request(app).get('/api/serve/store_001/home/draft');

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Test 5 — Redis throws → falls through to MySQL (resilience)
  //
  // serve.ts wraps redis.get() in try/catch and silently falls through on error.
  // So even when Redis is down, the route must still serve from MySQL with 200.
  // This tests the resilience requirement: Redis errors must never cause 500.
  // -------------------------------------------------------------------------
  it('falls through to MySQL when Redis throws (resilience)', async () => {
    redisMock.get.mockRejectedValue(new Error('Redis down'));
    // redis.set may also throw — .catch(() => {}) in the route handles that
    redisMock.set.mockRejectedValue(new Error('Redis down'));

    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      tenantId: 'store_001',
      slug: 'index',
      pageType: 'home',
      publishedVersionId: 'ver-1',
    });

    prismaMock.pageVersion.findUnique.mockResolvedValue({
      id: 'ver-1',
      tree: JSON.stringify(TREE),
      publishedAt: new Date(),
    });

    const res = await request(app).get('/api/serve/store_001/home/index');

    // Redis error must never propagate — route must still return 200 from MySQL
    expect(res.status).toBe(200);
    expect(res.body.tree).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// funnelContext
// ---------------------------------------------------------------------------
describe('serve — funnelContext', () => {
  const basePage    = { id: 'page-1', tenantId: 'store_001', slug: 'home', pageType: 'home', publishedVersionId: 'ver-1' };
  const baseVersion = { id: 'ver-1', pageId: 'page-1', tree: JSON.stringify({ id: 'root', type: 'layout', children: [] }) };

  beforeEach(() => {
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    prismaMock.page.findFirst.mockResolvedValue(basePage);
    prismaMock.pageVersion.findUnique.mockResolvedValue(baseVersion);
  });

  it('returns funnelContext: null when page is not part of a funnel', async () => {
    const res = await request(app).get('/api/serve/store_001/home/home');
    expect(res.status).toBe(200);
    expect(res.body.funnelContext).toBeNull();
  });

  it('returns funnelContext with nextStepUrl when page is a funnel step with a next step', async () => {
    const nextPage = { id: 'page-2', slug: 'upsell', pageType: 'funnel_step' };
    prismaMock.funnelStep.findFirst
      .mockResolvedValueOnce({ id: 'step-1', funnelId: 'funnel-1', stepOrder: 1, onSuccess: '{}', onSkip: null })
      .mockResolvedValueOnce({ id: 'step-2', funnelId: 'funnel-1', stepOrder: 2, pageId: 'page-2', onSuccess: '{}', onSkip: null, page: nextPage });

    const res = await request(app).get('/api/serve/store_001/home/home');
    expect(res.status).toBe(200);
    expect(res.body.funnelContext).toMatchObject({
      funnelId: 'funnel-1',
      funnelStepOrder: 1,
      nextStepUrl: '/upsell',
      isLastStep: false,
    });
  });

  it('returns funnelContext with isLastStep: true and onSuccess when no next step exists', async () => {
    prismaMock.funnelStep.findFirst
      .mockResolvedValueOnce({ id: 'step-3', funnelId: 'funnel-1', stepOrder: 3, onSuccess: '{"type":"link","url":"/thank-you"}', onSkip: null })
      .mockResolvedValueOnce(null);

    const res = await request(app).get('/api/serve/store_001/home/home');
    expect(res.body.funnelContext.isLastStep).toBe(true);
    expect(res.body.funnelContext.nextStepUrl).toBeNull();
    expect(res.body.funnelContext.onSuccess).toEqual({ type: 'link', url: '/thank-you' });
  });
});
