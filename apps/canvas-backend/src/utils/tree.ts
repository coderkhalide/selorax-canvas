export interface FlatNode {
  id: string; page_id: string; tenant_id: string;
  node_type: string; parent_id: string | null; order: string;
  styles: string; props: string; settings: string; children_ids: string;
  component_url?: string | null; component_id?: string | null; component_version?: string | null;
}

export function buildTree(flatNodes: FlatNode[]): any {
  const map = new Map<string, any>();
  for (const n of flatNodes) {
    map.set(n.id, {
      id: n.id, type: n.node_type, _order: n.order,
      styles:   safeJson(n.styles,   {}),
      props:    safeJson(n.props,    {}),
      settings: safeJson(n.settings, {}),
      children: [],
      url:              n.component_url     ?? undefined,
      componentId:      n.component_id      ?? undefined,
      componentVersion: n.component_version ?? undefined,
    });
  }

  let root: any = null;
  for (const n of flatNodes) {
    const treeNode = map.get(n.id)!;
    if (!n.parent_id) { root = treeNode; }
    else { map.get(n.parent_id)?.children.push(treeNode); }
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

export function flattenTree(tree: any, pageId: string, tenantId: string): FlatNode[] {
  const result: FlatNode[] = [];
  function traverse(node: any, parentId: string | null, index: number) {
    result.push({
      id: node.id, page_id: pageId, tenant_id: tenantId,
      node_type: node.type, parent_id: parentId,
      order: `a${index}`,
      styles:      JSON.stringify(node.styles   ?? {}),
      props:       JSON.stringify(node.props    ?? {}),
      settings:    JSON.stringify(node.settings ?? {}),
      children_ids: JSON.stringify((node.children ?? []).map((c: any) => c.id)),
      component_url:     node.url             ?? null,
      component_id:      node.componentId     ?? null,
      component_version: node.componentVersion ?? null,
    });
    (node.children ?? []).forEach((c: any, i: number) => traverse(c, node.id, i));
  }
  if (tree) traverse(tree, null, 0);
  return result;
}

function safeJson(s: string, fallback: any) {
  try { return JSON.parse(s); } catch { return fallback; }
}
