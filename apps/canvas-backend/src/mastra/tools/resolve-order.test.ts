import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPageNodesMock } = vi.hoisted(() => ({
  getPageNodesMock: vi.fn(),
}));

vi.mock('../../spacetime/client', () => ({
  getPageNodes: getPageNodesMock,
  callReducer: vi.fn(),
  opt: vi.fn(v => v ?? null),
}));

import { resolveInsertOrder } from './insert-node';

const SIBLINGS = [
  { id: 'a', parent_id: null, order: 'a0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  { id: 'b', parent_id: null, order: 'b0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
  { id: 'c', parent_id: null, order: 'c0', page_id: 'p1', tenant_id: 't1', node_type: 'element', styles: '{}', props: '{}', settings: '{}', children_ids: '[]', component_url: null, component_id: null, component_version: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  getPageNodesMock.mockResolvedValue(SIBLINGS);
});

describe('resolveInsertOrder', () => {
  it('"first" returns "a0" without querying STDB', async () => {
    const result = await resolveInsertOrder('first', 'p1', 't1', 'root');
    expect(result).toBe('a0');
    expect(getPageNodesMock).not.toHaveBeenCalled();
  });

  it('"last" returns a z-prefixed string without querying STDB', async () => {
    const result = await resolveInsertOrder('last', 'p1', 't1', 'root');
    expect(result).toMatch(/^z/);
    expect(getPageNodesMock).not.toHaveBeenCalled();
  });

  it('"after:a" returns order AFTER a0 and BEFORE b0', async () => {
    const result = await resolveInsertOrder('after:a', 'p1', 't1', 'root');
    expect(result > 'a0').toBe(true);
    expect(result < 'b0').toBe(true);
    expect(getPageNodesMock).toHaveBeenCalledWith('p1', 't1');
  });

  it('"after:c" (last sibling) returns order after c0', async () => {
    const result = await resolveInsertOrder('after:c', 'p1', 't1', 'root');
    expect(result > 'c0').toBe(true);
    expect(getPageNodesMock).toHaveBeenCalledWith('p1', 't1');
  });

  it('"after:nonexistent" falls back to "last" order (z-prefixed)', async () => {
    const result = await resolveInsertOrder('after:nonexistent', 'p1', 't1', 'root');
    expect(result).toMatch(/^z/);
  });
});
