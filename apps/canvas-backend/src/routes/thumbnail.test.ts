import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so variables are available inside the hoisted vi.mock factories
const { findFirstMock, updateMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn(),
  updateMock:    vi.fn(),
}));

// Mock S3 — don't actually upload
// S3Client must be a real constructor function (not arrow) because the source does `new S3Client(...)`
vi.mock('@aws-sdk/client-s3', () => {
  const sendMock = vi.fn().mockResolvedValue({});
  function S3Client(this: any) { this.send = sendMock; }
  function PutObjectCommand(args: unknown) { return args; }
  return { S3Client, PutObjectCommand };
});

// Mock Prisma
vi.mock('../db', () => ({
  prisma: { page: { findFirst: findFirstMock, update: updateMock } },
}));

// Mock getTenant middleware
vi.mock('../middleware/tenant', () => ({
  getTenant: vi.fn().mockReturnValue({ id: 't1', name: 'Test' }),
}));

import request  from 'supertest';
import express  from 'express';
import router   from './thumbnail';

const app = express();
app.use('/', router);

beforeEach(() => {
  vi.clearAllMocks();
  findFirstMock.mockResolvedValue({ id: 'page1', tenantId: 't1' });
  updateMock.mockResolvedValue({ id: 'page1', thumbnailUrl: 'https://r2.test/thumbnails/t1/page1.png' });
});

describe('thumbnail route', () => {
  it('returns 404 when page not found', async () => {
    findFirstMock.mockResolvedValue(null);
    const res = await request(app)
      .post('/page1/thumbnail')
      .attach('thumbnail', Buffer.from('fake-png'), { filename: 'thumbnail.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns thumbnailUrl on success', async () => {
    const res = await request(app)
      .post('/page1/thumbnail')
      .attach('thumbnail', Buffer.from('fake-png'), { filename: 'thumbnail.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.thumbnailUrl).toMatch(/^https?:\/\//);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: 't1' }) }),
    );
  });

  it('GET /:id/thumbnail-url returns null when no thumbnail', async () => {
    findFirstMock.mockResolvedValue({ id: 'page1', thumbnailUrl: null, thumbnailUpdatedAt: null });
    const res = await request(app).get('/page1/thumbnail-url');
    expect(res.status).toBe(200);
    expect(res.body.thumbnailUrl).toBeNull();
  });
});
