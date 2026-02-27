import { describe, it, expect } from 'vitest';
import { canvasReducer } from './CanvasContext';

const makeNode = (id: string, parentId: string | null = null) => ({
  id, pageId: 'p1', tenantId: 't1', parentId,
  nodeType: 'element' as const, order: 'a0',
  styles: '{}', props: '{}', settings: '{}',
});

const empty = { nodes: new Map(), selectedIds: new Set<string>(), editingId: null, draggingId: null };

describe('canvasReducer', () => {
  it('STDB_SYNC replaces nodes from STDB', () => {
    const node = makeNode('n1');
    const state = canvasReducer(empty, { type: 'STDB_SYNC', nodes: [node] });
    expect(state.nodes.get('n1')).toEqual(node);
    expect(state.nodes.size).toBe(1);
  });

  it('INSERT adds a node', () => {
    const node = makeNode('n1');
    const state = canvasReducer(empty, { type: 'INSERT', node });
    expect(state.nodes.has('n1')).toBe(true);
  });

  it('UPDATE_STYLES merges patch into existing styles', () => {
    const node = { ...makeNode('n1'), styles: '{"color":"red"}' };
    const s1 = canvasReducer(empty, { type: 'INSERT', node });
    const s2 = canvasReducer(s1, { type: 'UPDATE_STYLES', nodeId: 'n1', patch: { background: 'blue' } });
    const styles = JSON.parse(s2.nodes.get('n1')!.styles);
    expect(styles).toEqual({ color: 'red', background: 'blue' });
  });

  it('DELETE cascades to children', () => {
    const parent = makeNode('parent');
    const child  = { ...makeNode('child', 'parent'), order: 'a1' };
    let s = canvasReducer(empty, { type: 'INSERT', node: parent });
    s = canvasReducer(s, { type: 'INSERT', node: child });
    s = canvasReducer(s, { type: 'DELETE', nodeId: 'parent' });
    expect(s.nodes.has('parent')).toBe(false);
    expect(s.nodes.has('child')).toBe(false);
  });

  it('MOVE updates parentId and order', () => {
    const node = makeNode('n1');
    let s = canvasReducer(empty, { type: 'INSERT', node });
    s = canvasReducer(s, { type: 'MOVE', nodeId: 'n1', newParentId: 'p2', newOrder: 'b0' });
    expect(s.nodes.get('n1')!.parentId).toBe('p2');
    expect(s.nodes.get('n1')!.order).toBe('b0');
  });
});
