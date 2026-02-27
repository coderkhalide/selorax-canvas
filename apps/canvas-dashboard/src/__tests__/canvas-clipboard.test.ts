import { describe, it, expect, vi, beforeEach } from 'vitest';
import { copyNodes, pasteNodes, duplicateNodes } from '@/utils/clipboard';

const mockNodes = [
  { id: 'a', parentId: null, order: 'a0', nodeType: 'layout', styles: '{}', props: null, settings: null, componentUrl: undefined, componentVersion: undefined, componentId: null },
  { id: 'b', parentId: 'a',  order: 'a1', nodeType: 'element', styles: '{}', props: '{}', settings: null, componentUrl: undefined, componentVersion: undefined, componentId: null },
];

beforeEach(() => {
  vi.stubGlobal('sessionStorage', {
    _store: {} as Record<string, string>,
    getItem(k: string) { return (this as any)._store[k] ?? null; },
    setItem(k: string, v: string) { (this as any)._store[k] = v; },
  });
});

describe('copyNodes + pasteNodes', () => {
  it('round-trips node data through sessionStorage', () => {
    copyNodes(['a', 'b'], mockNodes as any);
    const pasted = pasteNodes();
    expect(pasted).toHaveLength(2);
    expect(pasted[0].oldId).toBe('a');
    expect(pasted[1].oldId).toBe('b');
  });

  it('pasteNodes returns empty array when clipboard is empty', () => {
    expect(pasteNodes()).toEqual([]);
  });
});

describe('duplicateNodes', () => {
  it('returns nodes with new IDs for all selected', () => {
    const result = duplicateNodes(['a', 'b'], mockNodes as any, 'a0z');
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe('a');
    expect(result[1].id).not.toBe('b');
  });

  it('remaps child parentId to new parent ID', () => {
    const result = duplicateNodes(['a'], mockNodes as any, 'a0z');
    // 'a' has child 'b' — both should be duplicated, b's parentId should be the new a's id
    expect(result).toHaveLength(2); // a + its child b
    const newA = result.find(n => n.parentId === null || !result.some(r => r.id === n.parentId));
    const newB = result.find(n => n.id !== newA?.id);
    expect(newB?.parentId).toBe(newA?.id);
  });

  it('selecting both parent and child does not double-process the child', () => {
    // 'a' is parent of 'b' — selecting both should produce same as selecting just 'a'
    const resultBoth   = duplicateNodes(['a', 'b'], mockNodes as any, 'a0z');
    const resultParent = duplicateNodes(['a'],       mockNodes as any, 'a0z');
    expect(resultBoth.length).toBe(resultParent.length);
  });
});
