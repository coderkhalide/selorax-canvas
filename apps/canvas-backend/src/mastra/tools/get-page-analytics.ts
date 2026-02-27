import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export const getPageAnalyticsTool = createTool({
  id: 'get_page_analytics',
  description: 'Get analytics data for a page — visitors, conversion rate, revenue, and recent events. Always call this before making design suggestions.',
  inputSchema: z.object({
    tenant_id: z.string().describe('Tenant ID — required for isolation'),
    page_id:   z.string().describe('Page ID to get analytics for'),
    days:      z.number().optional().default(30).describe('Lookback window in days (default 30)'),
  }),
  outputSchema: z.object({
    stats: z.object({
      visitors:        z.number(),
      conversions:     z.number(),
      conversionRate:  z.number(),
      conversionValue: z.number(),
    }),
    recentEvents: z.array(z.any()),
  }),
  execute: async (context) => {
    const since = daysAgo(context.days ?? 30);

    const [visitorsResult, conversionsResult, recentEvents] = await Promise.all([
      prisma.$queryRaw<[{ visitors: number }]>`
        SELECT COUNT(DISTINCT visitor_id) as visitors
        FROM conversion_events
        WHERE tenant_id  = ${context.tenant_id}
          AND page_id    = ${context.page_id}
          AND event_type = 'page_view'
          AND occurred_at >= ${since}
      `,
      prisma.$queryRaw<[{ conversions: number; total_value: number }]>`
        SELECT COUNT(*) as conversions, COALESCE(SUM(value), 0) as total_value
        FROM conversion_events
        WHERE tenant_id  = ${context.tenant_id}
          AND page_id    = ${context.page_id}
          AND event_type = 'conversion'
          AND occurred_at >= ${since}
      `,
      prisma.conversionEvent.findMany({
        where:   { tenantId: context.tenant_id, pageId: context.page_id },
        orderBy: { occurredAt: 'desc' },
        take:    100,
      }),
    ]);

    const visitors    = Number(visitorsResult[0]?.visitors    ?? 0);
    const conversions = Number(conversionsResult[0]?.conversions ?? 0);
    const totalValue  = Number(conversionsResult[0]?.total_value  ?? 0);

    return {
      stats: {
        visitors,
        conversions,
        conversionRate:  visitors > 0 ? Math.round((conversions / visitors) * 1000) / 10 : 0,
        conversionValue: totalValue,
      },
      recentEvents,
    };
  },
});
