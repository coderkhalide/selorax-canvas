import { createTool } from '@mastra/core/tools';
import { z }          from 'zod';
import { prisma }     from '../../db';

export const searchComponentsTool = createTool({
  id: 'search_components',
  description: 'Search the component registry. ALWAYS call this before build_component to avoid duplicates.',
  inputSchema: z.object({
    tenant_id: z.string(),
    query:     z.string().describe('Search term — name, category, or description'),
  }),
  outputSchema: z.object({ components: z.array(z.any()), count: z.number() }),
  execute: async (context) => {
    const components = await prisma.component.findMany({
      where: {
        OR: [
          { tenantId: context.tenant_id },
          { tenantId: null, isPublic: true },
        ],
        name: { contains: context.query },
      },
      include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return { components, count: components.length };
  },
});
