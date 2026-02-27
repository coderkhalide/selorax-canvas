import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() creates values at hoist time so they are available inside vi.mock() factories.
const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    page: { findFirst: vi.fn() },
  };
  return { prismaMock };
});

vi.mock('../../db', () => ({ prisma: prismaMock }));
vi.mock('../../redis/client', () => ({ redis: null }));
vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn(),
  callReducer: vi.fn(),
}));

import { getCanvasScreenshot } from './get-canvas-screenshot';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// get_canvas_screenshot
// ---------------------------------------------------------------------------

describe('get_canvas_screenshot', () => {
  it('returns hasScreenshot: false when page has no thumbnailUrl (page found, thumbnailUrl is null)', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      thumbnailUrl: null,
      thumbnailUpdatedAt: null,
    });

    const result = await getCanvasScreenshot.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-1',
    });

    expect(result.hasScreenshot).toBe(false);
    expect((result as any).message).toContain('No screenshot available yet');

    expect(prismaMock.page.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'page-1', tenantId: 'tenant-a' },
      })
    );
  });

  it('returns hasScreenshot: false when page not found', async () => {
    prismaMock.page.findFirst.mockResolvedValue(null);

    const result = await getCanvasScreenshot.execute({
      tenant_id: 'tenant-a',
      page_id: 'nonexistent',
    });

    expect(result.hasScreenshot).toBe(false);
    expect((result as any).message).toContain('No screenshot available yet');
  });

  it('returns hasScreenshot: true with base64 data when thumbnail exists', async () => {
    const capturedAt = new Date('2025-01-15T10:00:00.000Z');
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      thumbnailUrl: 'https://cdn.example.com/thumbnails/tenant-a/page-1.png',
      thumbnailUpdatedAt: capturedAt,
    });

    // Mock a small PNG buffer (1x1 transparent PNG)
    const fakeBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const fakePngBuffer = Buffer.from(fakeBytes);
    // Create a fresh ArrayBuffer with the same bytes to avoid Node.js Buffer offset issues
    const fakeArrayBuffer = fakePngBuffer.buffer.slice(
      fakePngBuffer.byteOffset,
      fakePngBuffer.byteOffset + fakePngBuffer.byteLength,
    );
    const expectedBase64 = fakePngBuffer.toString('base64');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => fakeArrayBuffer,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getCanvasScreenshot.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-1',
    });

    expect(result.hasScreenshot).toBe(true);
    if (result.hasScreenshot) {
      expect(result.imageBase64).toBe(expectedBase64);
      expect(result.mediaType).toBe('image/png');
      expect(result.capturedAt).toBe('2025-01-15T10:00:00.000Z');
      expect(result.message).toBe('Screenshot retrieved successfully');
    }

    expect(mockFetch).toHaveBeenCalledWith('https://cdn.example.com/thumbnails/tenant-a/page-1.png');

    vi.unstubAllGlobals();
  });

  it('returns hasScreenshot: false when fetch resolves with a non-ok HTTP status (e.g. 403)', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      thumbnailUrl: 'https://cdn.example.com/thumbnails/tenant-a/page-1.png',
      thumbnailUpdatedAt: new Date(),
    });

    const cancelMock = vi.fn();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      body: { cancel: cancelMock },
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await getCanvasScreenshot.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-1',
    });

    expect(result.hasScreenshot).toBe(false);
    expect((result as any).message).toContain('HTTP 403');

    vi.unstubAllGlobals();
  });

  it('returns hasScreenshot: false with error message when fetch throws', async () => {
    prismaMock.page.findFirst.mockResolvedValue({
      id: 'page-1',
      thumbnailUrl: 'https://cdn.example.com/thumbnails/tenant-a/page-1.png',
      thumbnailUpdatedAt: new Date(),
    });

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await getCanvasScreenshot.execute({
      tenant_id: 'tenant-a',
      page_id: 'page-1',
    });

    expect(result.hasScreenshot).toBe(false);
    expect((result as any).message).toContain('Network connection refused');

    vi.unstubAllGlobals();
  });
});
