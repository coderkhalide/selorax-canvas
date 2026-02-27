import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const getAnalyticsTool = createTool({
  id: 'get_analytics',
  description: 'Get conversion analytics and A/B test results for a page.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    days:      z.number().optional().default(7).describe('Look-back window in days'),
  }),
  outputSchema: z.object({ experiments: z.array(z.any()), summary: z.any() }),
  execute: async ({ context }) => {
    const since = new Date(Date.now() - (context.days ?? 7) * 86400_000);

    const experiments = await prisma.experiment.findMany({
      where: { tenantId: context.tenant_id, pageId: context.page_id },
      include: {
        variants: {
          include: {
            snapshots: {
              where: { snapshotAt: { gte: since } },
              orderBy: { snapshotAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const totalEvents = await prisma.conversionEvent.count({
      where: {
        tenantId: context.tenant_id,
        occurredAt: { gte: since },
      },
    });

    return {
      experiments,
      summary: { totalEvents, periodDays: context.days ?? 7 },
    };
  },
});
