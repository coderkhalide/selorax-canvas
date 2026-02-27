'use client';

interface LayersTreeProps {
  flatNodes: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

const NODE_ICONS: Record<string, string> = {
  layout: '⬜', element: '◻️', component: '🧩', slot: '⬡',
};

export default function LayersTree({ flatNodes, selectedId, onSelect }: LayersTreeProps) {
  if (!flatNodes.length) {
    return <p style={{ fontSize: 11, color: '#4B5563' }}>No nodes</p>;
  }

  // Build simple hierarchical display
  const roots = flatNodes.filter(n => !n.parent_id);
  const childrenOf = (id: string) => flatNodes.filter(n => n.parent_id === id)
    .sort((a, b) => a.order.localeCompare(b.order));

  function renderNode(node: any, depth: number): React.ReactNode {
    const props = node.props ? JSON.parse(node.props) : {};
    const label = props.content?.slice(0, 20) ?? props.tag ?? node.node_type;
    const icon  = NODE_ICONS[node.node_type] ?? '•';
    const children = childrenOf(node.id);

    return (
      <div key={node.id} style={{ marginLeft: depth * 12 }}>
        <div
          className={`layers-item ${node.id === selectedId ? 'selected' : ''}`}
          onClick={() => onSelect(node.id === selectedId ? null : node.id)}
        >
          <span>{icon}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          {node.locked_by && <span style={{ fontSize: 10, color: '#F59E0B' }}>🔒</span>}
        </div>
        {children.map(child => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {roots.map(node => renderNode(node, 0))}
    </div>
  );
}
