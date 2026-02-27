import { createTool }   from '@mastra/core/tools';
import { z }            from 'zod';
import { getPageNodes } from '../../spacetime/client';

export const findNodesTool = createTool({
  id: 'find_nodes',
  description: 'Find nodes matching criteria (by type, prop content, etc.).',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    node_type: z.string().optional().describe('Filter by node type: layout|element|component|slot'),
    prop_key:  z.string().optional().describe('Filter by prop key'),
    prop_value: z.string().optional().describe('Filter by prop value (partial match)'),
  }),
  outputSchema: z.object({ nodes: z.array(z.any()), count: z.number() }),
  execute: async (context) => {
    const flatNodes = await getPageNodes(context.page_id, context.tenant_id);
    let filtered = flatNodes;

    if (context.node_type) {
      filtered = filtered.filter(n => n.node_type === context.node_type);
    }
    if (context.prop_key) {
      filtered = filtered.filter(n => {
        try {
          const props = JSON.parse(n.props ?? '{}');
          if (!(context.prop_key! in props)) return false;
          if (context.prop_value) {
            return String(props[context.prop_key!]).includes(context.prop_value);
          }
          return true;
        } catch { return false; }
      });
    }

    return {
      nodes: filtered.map(n => ({
        id: n.id, type: n.node_type, parentId: n.parent_id,
        props: JSON.parse(n.props ?? '{}'),
        styles: JSON.parse(n.styles ?? '{}'),
      })),
      count: filtered.length,
    };
  },
});
