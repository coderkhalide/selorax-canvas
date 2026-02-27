// Same buildTree() as canvas-backend/src/utils/tree.ts
// Kept in sync — if you update one, update the other

export function buildTree(flatNodes: any[]): any {
  const map = new Map<string, any>();
  for (const n of flatNodes) {
    // Row fields are camelCase from SpacetimeDB generated bindings
    map.set(n.id, {
      id: n.id, type: n.nodeType, _order: n.order,
      styles:   safeJson(n.styles,   {}),
      props:    safeJson(n.props,    {}),
      settings: safeJson(n.settings, {}),
      children: [],
      url:              n.componentUrl     ?? undefined,
      componentId:      n.componentId      ?? undefined,
      componentVersion: n.componentVersion ?? undefined,
    });
  }

  let root: any = null;
  for (const n of flatNodes) {
    const treeNode = map.get(n.id)!;
    if (!n.parentId) { root = treeNode; }
    else { map.get(n.parentId)?.children.push(treeNode); }
  }

  function sort(node: any) {
    if (!node) return;
    node.children.sort((a: any, b: any) => a._order.localeCompare(b._order));
    node.children.forEach(sort);
  }
  sort(root);

  function clean(node: any): any {
    if (!node) return null;
    const { _order, ...rest } = node;
    rest.children = rest.children.map(clean);
    return rest;
  }

  return clean(root);
}

function safeJson(s: string, fallback: any) {
  try { return JSON.parse(s); } catch { return fallback; }
}
