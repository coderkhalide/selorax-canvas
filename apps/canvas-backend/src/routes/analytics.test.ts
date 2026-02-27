import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    conversionEvent: {
      findMany: vi.fn(),
    },
    funnelStep: { findMany: vi.fn() },
    funnel:     { findFirst: vi.fn() },
    $queryRaw:  vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: prismaMock }));

import express from 'express';
import request from 'supertest';
import analyticsRouter from './analytics';

const app = express();
app.use(express.json());
// Simulate tenant middleware
app.use((req: any, _res: any, next: any) => { req.tenant = { id: 'tenant-a' }; next(); });
app.use('/api/analytics', analyticsRouter);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/analytics/pages/:pageId', () => {
  it('returns KPIs for a page with visitors and conversions', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: BigInt(1240) }])
      .mockResolvedValueOnce([{ conversions: BigInt(186), total_value: 18042 }]);

    const res = await request(app).get('/api/analytics/pages/page-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.visitors).toBe(1240);
    expect(res.body.conversions).toBe(186);
    expect(res.body.conversionRate).toBeCloseTo(15.0, 0);
    expect(res.body.conversionValue).toBe(18042);
  });

  it('returns conversionRate: 0 when no visitors', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: BigInt(0) }])
      .mockResolvedValueOnce([{ conversions: BigInt(0), total_value: 0 }]);

    const res = await request(app).get('/api/analytics/pages/page-1?days=30');
    expect(res.body.conversionRate).toBe(0);
  });
});

describe('GET /api/analytics/funnels/:funnelId', () => {
  it('returns funnel steps with visitor counts and drop-off percentages', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue({
      id: 'funnel-1', name: 'Main Funnel',
      steps: [
        { stepOrder: 1, pageId: 'page-1', name: 'Opt-in' },
        { stepOrder: 2, pageId: 'page-2', name: 'Upsell' },
        { stepOrder: 3, pageId: 'page-3', name: 'Thank You' },
      ],
    });
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: BigInt(1240) }])
      .mockResolvedValueOnce([{ visitors: BigInt(744) }])
      .mockResolvedValueOnce([{ visitors: BigInt(186) }])
      .mockResolvedValueOnce([{ conversions: BigInt(186), total_value: 18042 }]);

    const res = await request(app).get('/api/analytics/funnels/funnel-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.steps[0].dropOff).toBe(0);
    expect(res.body.steps[1].dropOff).toBeCloseTo(40.0, 0);
    expect(res.body.totalConversions).toBe(186);
    expect(res.body.totalRevenue).toBe(18042);
  });

  it('returns 404 when funnel not found', async () => {
    prismaMock.funnel.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/api/analytics/funnels/bad-id');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/analytics/ai-context/:pageId', () => {
  it('returns stats + recentEvents for AI consumption', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: BigInt(500) }])
      .mockResolvedValueOnce([{ conversions: BigInt(50), total_value: 4850 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([{ id: 'evt-1', eventType: 'page_view' }]);

    const res = await request(app).get('/api/analytics/ai-context/page-1?days=30');
    expect(res.status).toBe(200);
    expect(res.body.stats.visitors).toBe(500);
    expect(res.body.recentEvents).toHaveLength(1);
    expect(prismaMock.conversionEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
