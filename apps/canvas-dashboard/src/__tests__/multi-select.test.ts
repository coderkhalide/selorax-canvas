import { describe, it, expect } from 'vitest';
import { applySelect } from '@/utils/selection';

describe('applySelect', () => {
  it('single click replaces selection', () => {
    const prev = new Set(['a', 'b']);
    expect(applySelect(prev, 'c', false)).toEqual(new Set(['c']));
  });

  it('shift-click adds to selection', () => {
    const prev = new Set(['a']);
    expect(applySelect(prev, 'b', true)).toEqual(new Set(['a', 'b']));
  });

  it('shift-click on already-selected item removes it', () => {
    const prev = new Set(['a', 'b']);
    expect(applySelect(prev, 'a', true)).toEqual(new Set(['b']));
  });

  it('click with empty prev creates single selection', () => {
    expect(applySelect(new Set(), 'x', false)).toEqual(new Set(['x']));
  });

  it('shift-click on empty prev adds single item', () => {
    expect(applySelect(new Set(), 'x', true)).toEqual(new Set(['x']));
  });
});
