import { createTool }   from '@mastra/core/tools';
import { z }            from 'zod';
import { getPageNodes } from '../../spacetime/client';

export const getNodeTool = createTool({
  id: 'get_node',
  description: 'Get a single node by ID with its current styles, props, and settings.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    node_id:   z.string(),
  }),
  outputSchema: z.object({ node: z.any().nullable() }),
  execute: async ({ context }) => {
    const flatNodes = await getPageNodes(context.page_id, context.tenant_id);
    const node = flatNodes.find(n => n.id === context.node_id) ?? null;
    if (!node) return { node: null };
    return {
      node: {
        id:       node.id,
        type:     node.node_type,
        parentId: node.parent_id,
        order:    node.order,
        styles:   JSON.parse(node.styles   ?? '{}'),
        props:    JSON.parse(node.props    ?? '{}'),
        settings: JSON.parse(node.settings ?? '{}'),
        componentId:      node.component_id,
        componentUrl:     node.component_url,
        componentVersion: node.component_version,
        lockedBy: node.locked_by,
      },
    };
  },
});

export const getNodeChildrenTool = createTool({
  id: 'get_node_children',
  description: 'Get all direct children of a node.',
  inputSchema: z.object({
    tenant_id: z.string(),
    page_id:   z.string(),
    node_id:   z.string(),
  }),
  outputSchema: z.object({ children: z.array(z.any()) }),
  execute: async ({ context }) => {
    const flatNodes = await getPageNodes(context.page_id, context.tenant_id);
    const children = flatNodes
      .filter(n => n.parent_id === context.node_id)
      .sort((a, b) => a.order.localeCompare(b.order));
    return { children };
  },
});
