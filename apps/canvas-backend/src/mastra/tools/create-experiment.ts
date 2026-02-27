import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createExperimentTool = createTool({
  id: 'create_experiment',
  description: 'Create a new A/B experiment for a page with at least 2 variants. Each variant must reference a published PageVersion via pageVersionId.',
  inputSchema: z.object({
    tenant_id:   z.string(),
    page_id:     z.string(),
    name:        z.string(),
    variants:    z.array(z.object({
      name:           z.string(),
      trafficPercent: z.number(),
      pageVersionId:  z.string().describe('Published PageVersion ID this variant shows'),
    })),
    goal_metric: z.string().optional(),
  }),
  outputSchema: z.discriminatedUnion('success', [
    z.object({
      success:    z.literal(true),
      experiment: z.object({
        id:          z.string(),
        name:        z.string(),
        status:      z.string(),
        goalMetric:  z.string(),
        variants:    z.array(z.object({
          id:             z.string(),
          name:           z.string(),
          trafficPercent: z.number(),
        })),
      }),
    }),
    z.object({
      success: z.literal(false),
      error:   z.string(),
    }),
  ]),
  execute: async (context) => {
    const { tenant_id: tenantId, page_id, name, variants, goal_metric } = context;

    if (variants.length < 2) {
      return { success: false, error: 'Experiment needs at least 2 variants' };
    }

    const totalTraffic = variants.reduce((sum, v) => sum + v.trafficPercent, 0);
    if (totalTraffic > 100) {
      return { success: false, error: 'Traffic percentages must sum to 100 or less' };
    }

    if (totalTraffic === 0) {
      return { success: false as const, error: 'Total traffic allocation must be greater than 0' };
    }

    try {
      const page = await prisma.page.findFirst({ where: { id: page_id, tenantId } });
      if (!page) {
        return { success: false, error: 'Page not found' };
      }

      // Validate all pageVersionIds belong to this tenant
      const versionIds = variants.map((v: any) => v.pageVersionId);
      const validVersions = await prisma.pageVersion.findMany({
        where: { id: { in: versionIds }, pageId: page_id, tenantId },
        select: { id: true },
      });
      if (validVersions.length !== versionIds.length) {
        return { success: false as const, error: 'One or more pageVersionIds are invalid for this tenant' };
      }

      const experiment = await prisma.experiment.create({
        data: {
          tenantId,
          pageId:          page_id,
          name,
          status:          'draft',
          primaryMetric:   goal_metric ?? 'conversion_rate',
          variants: {
            create: variants.map(v => ({
              tenantId,
              pageId:        page_id,
              name:          v.name,
              trafficWeight: v.trafficPercent / 100,
              pageVersionId: v.pageVersionId,
            })),
          },
        },
        include: { variants: true },
      });

      return {
        success: true,
        experiment: {
          id:         experiment.id,
          name:       experiment.name,
          status:     experiment.status,
          goalMetric: experiment.primaryMetric,
          variants:   experiment.variants.map(v => ({
            id:             v.id,
            name:           v.name,
            trafficPercent: v.trafficWeight * 100,
          })),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
