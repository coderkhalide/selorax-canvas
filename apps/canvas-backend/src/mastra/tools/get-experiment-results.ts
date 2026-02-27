import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

const snapshotSchema = z.object({
  conversions:    z.number(),
  visitors:       z.number(),
  conversionRate: z.number().nullable(),
});

export const getExperimentResultsTool = createTool({
  id: 'get_experiment_results',
  description: 'Get results for an experiment including per-variant conversion snapshots.',
  inputSchema: z.object({
    tenant_id:     z.string(),
    experiment_id: z.string(),
  }),
  outputSchema: z.discriminatedUnion('hasResults', [
    z.object({
      hasResults: z.literal(true),
      experiment: z.object({
        id:          z.string(),
        name:        z.string(),
        status:      z.string(),
        goalMetric:  z.string(),
        variants:    z.array(z.object({
          id:             z.string(),
          name:           z.string(),
          trafficPercent: z.number(),
          latestSnapshot: snapshotSchema.nullable(),
        })),
      }),
    }),
    z.object({
      hasResults: z.literal(false),
      message:    z.string(),
    }),
  ]),
  execute: async (context) => {
    const { tenant_id: tenantId, experiment_id } = context;

    try {
      const experiment = await prisma.experiment.findFirst({
        where:   { id: experiment_id, tenantId },
        include: {
          variants: {
            include: {
              snapshots: { orderBy: { snapshotAt: 'desc' }, take: 1 },
            },
          },
        },
      });

      if (!experiment) {
        return { hasResults: false, message: 'Experiment not found' };
      }

      return {
        hasResults: true,
        experiment: {
          id:         experiment.id,
          name:       experiment.name,
          status:     experiment.status,
          goalMetric: experiment.primaryMetric,
          variants:   experiment.variants.map(v => {
            const snap = v.snapshots[0] ?? null;
            return {
              id:             v.id,
              name:           v.name,
              trafficPercent: v.trafficWeight * 100,
              latestSnapshot: snap
                ? {
                    conversions:    snap.purchases,
                    visitors:       snap.visitors,
                    conversionRate: snap.conversionRate ?? null,
                  }
                : null,
            };
          }),
        },
      };
    } catch (err: any) {
      return { hasResults: false, message: err.message };
    }
  },
});
