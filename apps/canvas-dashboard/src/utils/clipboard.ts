import { resolveDropOrder } from './drop-order';

const CLIPBOARD_KEY = 'canvas-clipboard';

interface SerializedNode {
  oldId:            string;
  parentId:         string | null;
  nodeType:         string;
  order:            string;
  styles:           string | null;
  props:            string | null;
  settings:         string | null;
  componentUrl:     any;
  componentVersion: any;
  componentId:      string | null;
}

/** Returns the root-level selected IDs — those whose ancestors are not also in the selection. */
function rootSelected(selectedIds: string[], allNodes: any[]): string[] {
  const selectedSet = new Set(selectedIds);
  return selectedIds.filter(id => {
    let node = allNodes.find(n => n.id === id);
    while (node?.parentId) {
      if (selectedSet.has(node.parentId)) return false;
      node = allNodes.find(n => n.id === node.parentId);
    }
    return true;
  });
}

/** Serialize selected nodes (and their descendants) to sessionStorage. */
export function copyNodes(selectedIds: string[], allNodes: any[]): void {
  const roots = rootSelected(selectedIds, allNodes);
  const collect = (ids: string[]): any[] => {
    const result: any[] = [];
    ids.forEach(id => {
      const node = allNodes.find(n => n.id === id);
      if (!node) return;
      result.push(node);
      const children = allNodes.filter(n => n.parentId === id);
      result.push(...collect(children.map(c => c.id)));
    });
    return result;
  };
  const nodes = collect(roots);
  const data: SerializedNode[] = nodes.map(n => ({
    oldId:            n.id,
    parentId:         n.parentId ?? null,
    nodeType:         n.nodeType,
    order:            n.order,
    styles:           n.styles,
    props:            n.props,
    settings:         n.settings,
    componentUrl:     n.componentUrl,
    componentVersion: n.componentVersion,
    componentId:      n.componentId ?? null,
  }));
  sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
}

/** Read serialized nodes from sessionStorage. */
export function pasteNodes(): SerializedNode[] {
  const raw = sessionStorage.getItem(CLIPBOARD_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

/** Deep-copy selected nodes with new IDs, remapping parent references. */
export function duplicateNodes(
  selectedIds: string[],
  allNodes: any[],
  baseOrder: string,
): Array<{
  id: string; parentId: string | null; nodeType: string; order: string;
  styles: any; props: any; settings: any;
  componentUrl: any; componentVersion: any; componentId: string | null;
}> {
  const idMap = new Map<string, string>(); // oldId → newId
  const result: ReturnType<typeof duplicateNodes> = [];

  const process = (node: any, newParentId: string | null, orderVal: string) => {
    const newId = crypto.randomUUID();
    idMap.set(node.id, newId);
    result.push({
      id:               newId,
      parentId:         newParentId,
      nodeType:         node.nodeType,
      order:            orderVal,
      styles:           node.styles,
      props:            node.props,
      settings:         node.settings,
      componentUrl:     node.componentUrl,
      componentVersion: node.componentVersion,
      componentId:      node.componentId ?? null,
    });
    const children = allNodes
      .filter(n => n.parentId === node.id)
      .sort((a, b) => (a.order ?? '').localeCompare(b.order ?? ''));
    children.forEach((child, i) => process(child, newId, `a${i}`));
  };

  const roots = rootSelected(selectedIds, allNodes);
  let prevRootOrder: string | undefined = baseOrder || undefined;
  roots.forEach((id) => {
    const node = allNodes.find(n => n.id === id);
    if (!node) return;
    const order = resolveDropOrder(prevRootOrder, undefined);
    prevRootOrder = order;
    process(node, node.parentId ?? null, order);
  });

  return result;
}
