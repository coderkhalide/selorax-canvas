import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
const { prismaMock, redisMock } = vi.hoisted(() => {
  const prismaMock = {
    page: {
      findFirst: vi.fn(),
      update:    vi.fn(),
    },
    pageVersion: {
      findFirst: vi.fn(),
      create:    vi.fn(),
    },
  };
  const redisMock = { status: 'ready', set: vi.fn() };
  return { prismaMock, redisMock };
});

vi.mock('../db',              () => ({ prisma: prismaMock }));
vi.mock('../redis/client',    () => ({ redis: redisMock }));
vi.mock('../spacetime/client', () => ({ getPageNodes: vi.fn() }));

import { getPageNodes } from '../spacetime/client';
import { publishPage }  from './index';

const mockGetPageNodes = getPageNodes as ReturnType<typeof vi.fn>;

// Minimal flat nodes that buildTree can turn into a tree
const flatNodes = [
  {
    id:        'node-1',
    pageId:    'page-1',
    tenantId:  'tenant-a',
    parentId:  null,
    nodeType:  'layout',
    order:     'a0',
    styles:    '{}',
    props:     '{}',
    settings:  '{}',
    lockedBy:  null,
    lockedAt:  null,
    updatedBy: 'system',
    updatedAt: new Date().toISOString(),
  },
];

const basePage = {
  id:                 'page-1',
  tenantId:           'tenant-a',
  slug:               'home',
  pageType:           'home',
  publishedVersionId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  redisMock.status = 'ready';
  redisMock.set.mockResolvedValue('OK');
  mockGetPageNodes.mockResolvedValue(flatNodes);
  prismaMock.page.findFirst.mockResolvedValue(basePage);
  prismaMock.pageVersion.findFirst.mockResolvedValue(null); // no dedup by default
  prismaMock.pageVersion.create.mockResolvedValue({ id: 'ver-1', pageId: 'page-1' });
  prismaMock.page.update.mockResolvedValue({ ...basePage, publishedVersionId: 'ver-1' });
});

// ---------------------------------------------------------------------------
// Ownership check
// ---------------------------------------------------------------------------

describe('publishPage — ownership check', () => {
  it('throws when page not found (ownership check)', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    await expect(publishPage('page-1', 'tenant-a')).rejects.toThrow(
      'Page not found or access denied',
    );

    expect(prismaMock.pageVersion.create).not.toHaveBeenCalled();
    expect(prismaMock.page.update).not.toHaveBeenCalled();
  });

  it('passes tenantId to prisma.page.findFirst (tenant isolation)', async () => {
    await publishPage('page-1', 'tenant-a');

    expect(prismaMock.page.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'page-1', tenantId: 'tenant-a' } }),
    );
  });
});

// ---------------------------------------------------------------------------
// STDB node check
// ---------------------------------------------------------------------------

describe('publishPage — STDB nodes', () => {
  it('throws when no nodes returned from SpacetimeDB', async () => {
    mockGetPageNodes.mockResolvedValue([]);

    await expect(publishPage('page-1', 'tenant-a')).rejects.toThrow(
      'No nodes — open canvas editor first',
    );
  });

  it('calls getPageNodes with pageId and tenantId', async () => {
    await publishPage('page-1', 'tenant-a');

    expect(mockGetPageNodes).toHaveBeenCalledWith('page-1', 'tenant-a');
  });
});

// ---------------------------------------------------------------------------
// Version creation (happy path)
// ---------------------------------------------------------------------------

describe('publishPage — version creation', () => {
  it('creates an immutable PageVersion and updates the page pointer', async () => {
    const result = await publishPage('page-1', 'tenant-a');

    // Immutable version created
    expect(prismaMock.pageVersion.create).toHaveBeenCalledOnce();
    expect(prismaMock.pageVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pageId:   'page-1',
          tenantId: 'tenant-a',
          treeHash: expect.any(String), // SHA-256 hex
        }),
      }),
    );

    // Page pointer updated (rollback mechanism)
    expect(prismaMock.page.update).toHaveBeenCalledOnce();
    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'page-1' },
        data:  expect.objectContaining({ publishedVersionId: 'ver-1' }),
      }),
    );

    // Return value
    expect(result.id).toBe('ver-1');
    expect(result.pageId).toBe('page-1');
  });

  it('strips canvas metadata (lockedBy, lockedAt, updatedBy, updatedAt) from stored tree', async () => {
    await publishPage('page-1', 'tenant-a');

    const createCall = prismaMock.pageVersion.create.mock.calls[0][0];
    const storedTree = JSON.parse(createCall.data.tree);

    expect(storedTree.lockedBy).toBeUndefined();
    expect(storedTree.lockedAt).toBeUndefined();
    expect(storedTree.updatedBy).toBeUndefined();
    expect(storedTree.updatedAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Dedup — same content hash
// ---------------------------------------------------------------------------

describe('publishPage — SHA-256 dedup', () => {
  it('skips creating a new version when tree hash matches existing published version', async () => {
    prismaMock.pageVersion.findFirst.mockResolvedValue({ id: 'ver-existing', pageId: 'page-1' });

    const result = await publishPage('page-1', 'tenant-a');

    // No new version created
    expect(prismaMock.pageVersion.create).not.toHaveBeenCalled();

    // Pointer still updated to the existing version
    expect(prismaMock.page.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ publishedVersionId: 'ver-existing' }) }),
    );

    expect(result.id).toBe('ver-existing');
  });

  it('passes treeHash to pageVersion.findFirst for dedup check', async () => {
    await publishPage('page-1', 'tenant-a');

    expect(prismaMock.pageVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pageId: 'page-1', treeHash: expect.any(String) }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Redis cache warming
// ---------------------------------------------------------------------------

describe('publishPage — Redis cache', () => {
  it('warms Redis cache with correct key and 1-hour TTL when Redis is ready', async () => {
    await publishPage('page-1', 'tenant-a');

    const expectedKey = `serve:tenant-a:home:home`;
    expect(redisMock.set).toHaveBeenCalledOnce();
    expect(redisMock.set).toHaveBeenCalledWith(
      expectedKey,
      expect.any(String), // JSON-stringified tree+metadata
      'EX',
      3600,
    );

    // Verify the cached payload contains tree and versionId
    const payload = JSON.parse(redisMock.set.mock.calls[0][1]);
    expect(payload.versionId).toBe('ver-1');
    expect(payload.tree).toBeDefined();
  });

  it('skips Redis cache warming when redis is not ready', async () => {
    redisMock.status = 'disconnected';

    await publishPage('page-1', 'tenant-a');

    expect(redisMock.set).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cloudflare purge
// ---------------------------------------------------------------------------

describe('publishPage — Cloudflare purge', () => {
  it('skips Cloudflare purge when env vars are absent', async () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Ensure env vars are not set
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    await publishPage('page-1', 'tenant-a');

    expect(mockFetch).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('calls Cloudflare purge API with correct tags when env vars are present', async () => {
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    process.env.CLOUDFLARE_ZONE_ID    = 'zone-abc';
    process.env.CLOUDFLARE_API_TOKEN  = 'token-xyz';

    await publishPage('page-1', 'tenant-a');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/zones/zone-abc/purge_cache',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-xyz',
        }),
        body: expect.stringContaining('tenant-tenant-a'),
      }),
    );

    // Verify both cache tags present
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.tags).toContain('tenant-tenant-a');
    expect(body.tags).toContain('page-page-1');

    // Cleanup
    delete process.env.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    global.fetch = originalFetch;
  });
});
