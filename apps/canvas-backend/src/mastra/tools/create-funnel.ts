import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const createFunnelTool = createTool({
  id: 'create_funnel',
  description: 'Create a new funnel with ordered steps for the tenant.',
  inputSchema: z.object({
    tenant_id:   z.string(),
    name:        z.string(),
    description: z.string().optional(),
    steps:       z.array(z.object({
      name:   z.string(),
      pageId: z.string(),
      order:  z.number(),
    })).default([]),
  }),
  outputSchema: z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      funnel:  z.object({
        id:          z.string(),
        name:        z.string(),
        description: z.string().optional(),
        steps:       z.array(z.object({
          id:     z.string(),
          name:   z.string().optional(),
          pageId: z.string(),
          order:  z.number(),
        })),
      }),
    }),
    z.object({
      success: z.literal(false),
      error:   z.string(),
    }),
  ]),
  execute: async (context) => {
    const { tenant_id: tenantId, name, description, steps } = context;

    try {
      const funnel = await prisma.funnel.create({
        data: {
          tenantId,
          name,
          goal:  description,
          steps: {
            create: steps.map(s => ({
              name:      s.name,
              pageId:    s.pageId,
              stepOrder: s.order,
              onSuccess: JSON.stringify({}),
            })),
          },
        },
        include: { steps: { orderBy: { stepOrder: 'asc' } } },
      });

      return {
        success: true,
        funnel:  {
          id:          funnel.id,
          name:        funnel.name,
          description: funnel.goal ?? undefined,
          steps:       funnel.steps.map(s => ({
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
