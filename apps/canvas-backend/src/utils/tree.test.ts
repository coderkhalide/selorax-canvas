import { describe, it, expect } from 'vitest';
import { buildTree } from './tree';
import type { FlatNode } from './tree';

function makeNode(overrides: Partial<FlatNode> & { id: string }): FlatNode {
  return {
    page_id: 'page-1',
    tenant_id: 'test-tenant',
    node_type: 'layout',
    parent_id: null,
    order: 'a0',
    styles: '{}',
    props: '{}',
    settings: '{}',
    children_ids: '[]',
    component_url: null,
    component_id: null,
    component_version: null,
    ...overrides,
  };
}

describe('buildTree()', () => {
  // Test 1: empty input returns null
  it('returns null for an empty array', () => {
    expect(buildTree([])).toBeNull();
  });

  // Test 2: single root node with no children
  it('returns a single root node with no children', () => {
    const nodes = [makeNode({ id: 'root' })];
    const result = buildTree(nodes);
    expect(result).toMatchObject({
      id: 'root',
      type: 'layout',
      children: [],
    });
  });

  // Test 3: child nested under parent via parent_id
  it('nests a child under its parent', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'child-1', parent_id: 'root', order: 'b0' }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.children).toHaveLength(1);
    expect(result.children[0].id).toBe('child-1');
  });

  // Test 4: multiple children sorted lexicographically by order
  it('sorts multiple children by order (lexicographic)', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'child-c', parent_id: 'root', order: 'c0' }),
      makeNode({ id: 'child-a', parent_id: 'root', order: 'a0' }),
      makeNode({ id: 'child-b', parent_id: 'root', order: 'b0' }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.children.map((c: any) => c.id)).toEqual([
      'child-a',
      'child-b',
      'child-c',
    ]);
  });

  // Test 5: deep nesting with JSON props parsed correctly
  it('handles deep nesting and parses JSON props', () => {
    const nodes = [
      makeNode({ id: 'root', props: '{"tag":"div"}' }),
      makeNode({ id: 'section', parent_id: 'root', order: 'a0', node_type: 'layout', props: '{"tag":"section"}' }),
      makeNode({ id: 'heading', parent_id: 'section', order: 'a0', node_type: 'element', props: '{"tag":"h1","content":"Hello"}' }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.props).toEqual({ tag: 'div' });

    const section = result.children[0];
    expect(section.id).toBe('section');
    expect(section.props).toEqual({ tag: 'section' });

    const heading = section.children[0];
    expect(heading.id).toBe('heading');
    expect(heading.props).toEqual({ tag: 'h1', content: 'Hello' });
  });

  // Test 6: malformed JSON in styles/props/settings falls back to {}
  it('falls back to {} for malformed JSON in styles, props, and settings', () => {
    const nodes = [
      makeNode({
        id: 'root',
        styles: 'NOT_VALID_JSON',
        props: '{broken',
        settings: 'undefined',
      }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.styles).toEqual({});
    expect(result.props).toEqual({});
    expect(result.settings).toEqual({});
  });

  // Test 7: component_url → url, component_id → componentId, component_version → componentVersion
  it('maps component fields to output keys correctly', () => {
    const nodes = [
      makeNode({
        id: 'root',
        node_type: 'component',
        component_url: 'https://cdn.example.com/button.js',
        component_id: 'comp-abc',
        component_version: '1.2.3',
      }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.url).toBe('https://cdn.example.com/button.js');
    expect(result.componentId).toBe('comp-abc');
    expect(result.componentVersion).toBe('1.2.3');
  });

  // Test 8: _order field is NOT present on output nodes
  it('does not expose _order on output nodes', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'child', parent_id: 'root', order: 'b0' }),
    ];
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect('_order' in result).toBe(false);
    expect('_order' in result.children[0]).toBe(false);
  });

  // Test 9: orphaned node (parent_id points to nonexistent parent) doesn't throw
  it('does not throw when a node references a nonexistent parent', () => {
    const nodes = [
      makeNode({ id: 'root' }),
      makeNode({ id: 'orphan', parent_id: 'ghost-parent', order: 'a0' }),
    ];
    expect(() => buildTree(nodes)).not.toThrow();
    // The orphan is silently dropped; root has no children
    const result = buildTree(nodes);
    expect(result).not.toBeNull();
    expect(result.children).toHaveLength(0);
  });
});
