import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const listFunnelsTool = createTool({
  id: 'list_funnels',
  description: 'List all funnels for the tenant including their ordered steps.',
  inputSchema: z.object({
    tenant_id: z.string(),
  }),
  outputSchema: z.object({
    funnels: z.array(z.object({
      id:          z.string(),
      name:        z.string(),
      description: z.string().optional(),
      steps:       z.array(z.object({
        id:     z.string(),
        name:   z.string().optional(),
        pageId: z.string(),
        order:  z.number(),
      })),
    })),
  }),
  execute: async (context) => {
    const tenantId = context.tenant_id;

    const funnels = await prisma.funnel.findMany({
      where:   { tenantId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      funnels: funnels.map(f => ({
        id:          f.id,
        name:        f.name,
        description: f.goal ?? undefined,
        steps:       f.steps.map(s => ({
          id:     s.id,
          name:   s.name ?? undefined,
          pageId: s.pageId,
          order:  s.stepOrder,
        })),
      })),
    };
  },
});
