import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const updateFunnelStepsTool = createTool({
  id: 'update_funnel_steps',
  description: 'Replace the steps of an existing funnel. Steps with an id are updated, steps without an id are created, and steps previously in the DB but absent from the new list are deleted.',
  inputSchema: z.object({
    tenant_id: z.string(),
    funnel_id: z.string(),
    steps:     z.array(z.object({
      id:     z.string().optional(),
      name:   z.string(),
      pageId: z.string(),
      order:  z.number(),
    })),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    funnel:  z.object({
      id:    z.string(),
      name:  z.string(),
      steps: z.array(z.object({
        id:     z.string(),
        name:   z.string().optional(),
        pageId: z.string(),
        order:  z.number(),
      })),
    }).optional(),
    error: z.string().optional(),
  }),
  execute: async (context) => {
    const { tenant_id: tenantId, funnel_id: funnelId, steps } = context;

    const existing = await prisma.funnel.findFirst({
      where:   { id: funnelId, tenantId },
      include: { steps: true },
    });

    if (!existing) {
      return { success: false, error: 'Funnel not found' };
    }

    // Build sets
    const incomingIds  = new Set(steps.filter(s => s.id).map(s => s.id as string));
    const existingIds  = existing.steps.map(s => s.id);

    const toDelete = existingIds.filter(id => !incomingIds.has(id));
    const toUpdate = steps.filter(s => s.id);
    const toCreate = steps.filter(s => !s.id);

    try {
      await prisma.$transaction([
        ...toDelete.map(id =>
          prisma.funnelStep.deleteMany({ where: { id, funnelId } }),
        ),
        ...toUpdate.map(s =>
          prisma.funnelStep.updateMany({
            where: { id: s.id as string, funnelId },
            data:  { name: s.name, pageId: s.pageId, stepOrder: s.order },
          }),
        ),
        ...toCreate.map(s =>
          prisma.funnelStep.create({
            data: {
              funnelId,
              name:      s.name,
              pageId:    s.pageId,
              stepOrder: s.order,
              onSuccess: JSON.stringify({}),
            },
          }),
        ),
      ]);

      const updated = await prisma.funnel.findFirst({
        where:   { id: funnelId, tenantId },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      if (!updated) {
        return { success: false, error: 'Funnel not found after update' };
      }

      return {
        success: true,
        funnel:  {
          id:    updated.id,
          name:  updated.name,
          steps: updated.steps.map(s => ({
            id:     s.id,
            name:   s.name ?? undefined,
            pageId: s.pageId,
            order:  s.stepOrder,
          })),
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
});
