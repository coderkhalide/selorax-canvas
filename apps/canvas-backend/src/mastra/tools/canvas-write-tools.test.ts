import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../spacetime/client', () => ({
  getPageNodes: vi.fn().mockResolvedValue([]),
  callReducer: vi.fn().mockResolvedValue(undefined),
  // opt() wraps optional values — insert-node.ts calls opt(context.parent_id) etc.
  opt: vi.fn((v: unknown) => v ?? null),
}));
vi.mock('../../db', () => ({ prisma: {} }));
vi.mock('../../redis/client', () => ({ redis: null }));

import { callReducer, getPageNodes } from '../../spacetime/client';
import { insertNodeTool } from './insert-node';
import { updateNodeStylesTool } from './update-node-styles';
import { updateNodePropsTool } from './update-node-props';
import { deleteNodeTool } from './delete-node';

const mockCallReducer = callReducer as ReturnType<typeof vi.fn>;
const mockGetPageNodes = getPageNodes as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCallReducer.mockResolvedValue(undefined);
});

describe('insertNodeTool', () => {
  it('calls insert_node reducer with serialized styles and props (position=last)', async () => {
    const result = await insertNodeTool.execute({
      tenant_id: 't1',
      page_id: 'p1',
      parent_id: 'root',
      position: 'last',
      node_type: 'element',
      styles: { color: '#fff' },
      props: { tag: 'text', content: 'Hi' },
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('insert_node');
    expect(args.page_id).toBe('p1');
    expect(args.tenant_id).toBe('t1');
    expect(args.node_type).toBe('element');
    expect(args.styles).toBe('{"color":"#fff"}');
    expect(args.props).toBe('{"tag":"text","content":"Hi"}');
    // order starts with 'z' for position=last
    expect(args.order).toMatch(/^z[a-z0-9]+$/);
    // result has a UUID node_id
    expect(result.node_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('passes order="a0" when position is "first"', async () => {
    await insertNodeTool.execute({
      tenant_id: 't1',
      page_id: 'p1',
      parent_id: 'root',
      position: 'first',
      node_type: 'element',
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('insert_node');
    expect(args.order).toBe('a0');
  });

  it('always includes tenant_id in the reducer call (tenant isolation)', async () => {
    await insertNodeTool.execute({
      tenant_id: 't1',
      page_id: 'p1',
      parent_id: 'root',
      position: 'last',
      node_type: 'layout',
    });

    expect(mockCallReducer).toHaveBeenCalledWith(
      'insert_node',
      expect.objectContaining({ tenant_id: 't1' }),
    );
  });

  it('resolves "after:<nodeId>" by querying STDB and returns fractional order between siblings', async () => {
    mockGetPageNodes.mockResolvedValueOnce([
      { id: 'a', parent_id: null, order: 'a0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
      { id: 'b', parent_id: null, order: 'b0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
    ]);

    await insertNodeTool.execute({
      tenant_id: 't1', page_id: 'p1', parent_id: 'root',
      position: 'after:a', node_type: 'element',
    });

    const [, args] = mockCallReducer.mock.calls[0];
    expect(args.order > 'a0').toBe(true);
    expect(args.order < 'b0').toBe(true);
  });
});

describe('updateNodeStylesTool', () => {
  it('calls update_node_styles reducer with serialized styles', async () => {
    const result = await updateNodeStylesTool.execute({
      tenant_id: 't1',
      node_id: 'n1',
      styles: { padding: '20px' },
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('update_node_styles');
    expect(args.node_id).toBe('n1');
    expect(args.styles).toBe('{"padding":"20px"}');
    expect(result.message).toContain('n1');
  });
});

describe('updateNodePropsTool', () => {
  it('calls update_node_props reducer with serialized props', async () => {
    const result = await updateNodePropsTool.execute({
      tenant_id: 't1',
      node_id: 'n1',
      props: { content: 'New text' },
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('update_node_props');
    expect(args.node_id).toBe('n1');
    expect(args.props).toBe('{"content":"New text"}');
    expect(result.message).toContain('n1');
  });
});

describe('deleteNodeTool', () => {
  it('calls delete_node_cascade reducer with node_id', async () => {
    const result = await deleteNodeTool.execute({
      tenant_id: 't1',
      node_id: 'n1',
    });

    expect(mockCallReducer).toHaveBeenCalledOnce();
    const [reducerName, args] = mockCallReducer.mock.calls[0];
    expect(reducerName).toBe('delete_node_cascade');
    expect(args.node_id).toBe('n1');
    // Note: STDB delete_node_cascade reducer does not accept tenant_id —
    // isolation is enforced via subscription-level filtering.
    expect(result.message).toContain('n1');
  });
});
