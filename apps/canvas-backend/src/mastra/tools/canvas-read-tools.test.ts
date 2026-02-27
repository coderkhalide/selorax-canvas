import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they are available inside vi.mock() factories.
const { getPageNodesMock } = vi.hoisted(() => {
  const getPageNodesMock = vi.fn();
  return { getPageNodesMock };
});

vi.mock('../../spacetime/client', () => ({
  getPageNodes: getPageNodesMock,
  callReducer: vi.fn(),
}));
vi.mock('../../db', () => ({ prisma: {} }));
vi.mock('../../redis/client', () => ({ redis: null }));

import { getPageTreeTool } from './get-page-tree';
import { getNodeTool } from './get-node';
import { findNodesTool } from './find-nodes';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const FLAT_NODES = [
  {
    id: 'root', page_id: 'p1', tenant_id: 't1', node_type: 'layout',
    parent_id: null, order: 'a0', styles: '{}', props: '{}', settings: '{}',
    children_ids: '[]', component_url: null, component_id: null, component_version: null,
  },
  {
    id: 'heading', page_id: 'p1', tenant_id: 't1', node_type: 'element',
    parent_id: 'root', order: 'a0', styles: '{}',
    props: '{"tag":"heading","level":1,"content":"Hello"}',
    settings: '{}', children_ids: '[]',
    component_url: null, component_id: null, component_version: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getPageNodesMock.mockResolvedValue(FLAT_NODES);
});

// ---------------------------------------------------------------------------
// get_page_tree
// ---------------------------------------------------------------------------

describe('get_page_tree', () => {
  it('calls getPageNodes with correct page_id and tenant_id', async () => {
    await getPageTreeTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(getPageNodesMock).toHaveBeenCalledOnce();
    expect(getPageNodesMock).toHaveBeenCalledWith('p1', 't1');
  });

  it('returns built tree with node_count = 2 and root.children.length = 1', async () => {
    const result = await getPageTreeTool.execute({ tenant_id: 't1', page_id: 'p1' });

    expect(result.node_count).toBe(2);
    expect(result.tree).toBeDefined();
    expect(result.tree.id).toBe('root');
    expect(result.tree.children).toHaveLength(1);
    expect(result.tree.children[0].id).toBe('heading');
  });
});

// ---------------------------------------------------------------------------
// get_node
// ---------------------------------------------------------------------------

describe('get_node', () => {
  it('returns the specific node with id="heading" when requested', async () => {
    const result = await getNodeTool.execute({ tenant_id: 't1', page_id: 'p1', node_id: 'heading' });

    expect(result.node).not.toBeNull();
    expect(result.node!.id).toBe('heading');
    expect(result.node!.type).toBe('element');
    expect(result.node!.parentId).toBe('root');
    expect(result.node!.props).toEqual({ tag: 'heading', level: 1, content: 'Hello' });
  });

  it('handles node not found gracefully by returning node: null', async () => {
    const result = await getNodeTool.execute({ tenant_id: 't1', page_id: 'p1', node_id: 'nonexistent' });

    expect(result.node).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// find_nodes
// ---------------------------------------------------------------------------

describe('find_nodes', () => {
  it('filters nodes by node_type="element" and returns count = 1', async () => {
    const result = await findNodesTool.execute({ tenant_id: 't1', page_id: 'p1', node_type: 'element' });

    expect(result.count).toBe(1);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('heading');
    expect(result.nodes[0].type).toBe('element');
  });
});
