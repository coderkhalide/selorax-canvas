import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const getComponentTool = createTool({
  id: 'get_component',
  description: 'Get a component by ID including its source code and latest version.',
  inputSchema: z.object({
    tenant_id:    z.string(),
    component_id: z.string(),
  }),
  outputSchema: z.object({ component: z.any().nullable() }),
  execute: async ({ context }) => {
    const component = await prisma.component.findFirst({
      where: {
        id: context.component_id,
        OR: [{ tenantId: context.tenant_id }, { tenantId: null, isPublic: true }],
      },
      include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { component };
  },
});
