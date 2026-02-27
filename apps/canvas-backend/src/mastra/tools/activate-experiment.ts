import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const activateExperimentTool = createTool({
  id: 'activate_experiment',
  description: 'Activate a draft experiment to start running traffic splits.',
  inputSchema: z.object({
    tenant_id:     z.string(),
    experiment_id: z.string(),
  }),
  outputSchema: z.discriminatedUnion('success', [
    z.object({
      success:    z.literal(true),
      experiment: z.object({
        id:        z.string(),
        name:      z.string(),
        status:    z.literal('active'),
        startedAt: z.string(),
      }),
    }),
    z.object({
      success: z.literal(false),
      error:   z.string(),
    }),
  ]),
  execute: async (context) => {
    const { tenant_id: tenantId, experiment_id } = context;

    try {
      const experiment = await prisma.experiment.findFirst({
        where: { id: experiment_id, tenantId },
      });

      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      if (experiment.status !== 'draft') {
        return { success: false as const, error: `Cannot activate experiment with status '${experiment.status}'` };
      }

      // Tenant ownership verified above via findFirst
      await prisma.experiment.updateMany({
        where: { id: experiment_id, tenantId },
        data:  { status: 'active', startedAt: new Date() },
      });

      // Fetch updated record
      const updated = await prisma.experiment.findFirst({
        where:  { id: experiment_id, tenantId },
        select: { id: true, name: true, status: true, startedAt: true },
      });

      if (!updated) {
        return { success: false, error: 'Experiment not found after update' };
      }

      return {
        success: true,
        experiment: {
          id:        updated.id,
          name:      updated.name,
          status:    'active' as const,
          startedAt: (updated.startedAt ?? new Date()).toISOString(),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
