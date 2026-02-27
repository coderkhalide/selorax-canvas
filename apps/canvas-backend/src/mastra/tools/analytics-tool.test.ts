import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw:       vi.fn(),
    conversionEvent: { findMany: vi.fn() },
  },
}));

vi.mock('../../db', () => ({ prisma: prismaMock }));

import { getPageAnalyticsTool } from './get-page-analytics';

beforeEach(() => vi.clearAllMocks());

describe('get_page_analytics', () => {
  it('returns stats and recent events for a page', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 500 }])
      .mockResolvedValueOnce([{ conversions: 50, total_value: 4850 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([
      { id: 'e1', eventType: 'page_view', occurredAt: new Date() },
    ]);

    const result = await getPageAnalyticsTool.execute({
      tenant_id: 'tenant-a',
      page_id:   'page-1',
      days:      30,
    } as any);

    expect(result.stats.visitors).toBe(500);
    expect(result.stats.conversions).toBe(50);
    expect(result.stats.conversionRate).toBeCloseTo(10.0, 0);
    expect(result.recentEvents).toHaveLength(1);
  });

  it('returns conversionRate 0 when no visitors', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ visitors: 0 }])
      .mockResolvedValueOnce([{ conversions: 0, total_value: 0 }]);
    prismaMock.conversionEvent.findMany.mockResolvedValue([]);

    const result = await getPageAnalyticsTool.execute({ tenant_id: 'tenant-a', page_id: 'page-1', days: 30 } as any);
    expect(result.stats.conversionRate).toBe(0);
  });
});
