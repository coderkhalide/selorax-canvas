import { describe, it, expect } from 'vitest';
import { computeGroupParent } from '@/utils/selection';

describe('computeGroupParent', () => {
  const nodes = [
    { id: 'root', parentId: null, order: 'a0' },
    { id: 'n1',   parentId: 'root', order: 'a1' },
    { id: 'n2',   parentId: 'root', order: 'a2' },
    { id: 'n3',   parentId: 'n1',   order: 'a0' }, // child of n1
  ];

  it('returns shared parent when all nodes share a parent', () => {
    expect(computeGroupParent(['n1', 'n2'], nodes)).toBe('root');
  });

  it('returns root id when nodes have different parents', () => {
    expect(computeGroupParent(['n1', 'n3'], nodes)).toBe('root');
  });
});
