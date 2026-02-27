/**
 * Pure function: compute next selectedIds set based on click + shift key.
 */
export function applySelect(
  prev: Set<string>,
  id: string,
  shiftKey: boolean,
): Set<string> {
  if (!shiftKey) return new Set([id]);
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

interface FlatNode { id: string; parentId: string | null | undefined; order: string; }

/**
 * Returns the common parent for grouping: shared parent of all selected nodes,
 * or the first node's parent as fallback when parents differ.
 */
export function computeGroupParent(
  selectedIds: string[],
  allNodes: FlatNode[],
): string | null {
  const parents = new Set(
    selectedIds.map(id => allNodes.find(n => n.id === id)?.parentId ?? null)
  );
  if (parents.size === 1) return [...parents][0];
  // Mixed parents — use first node's parent
  const first = allNodes.find(n => n.id === selectedIds[0]);
  return first?.parentId ?? null;
}
