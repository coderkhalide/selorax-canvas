'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface LayersTreeProps {
  flatNodes:   any[];
  selectedIds: Set<string>;
  onSelect:    (id: string | null, shiftKey?: boolean) => void;
}

const NODE_ICONS: Record<string, string> = {
  layout: '⬜', element: '◻️', component: '🧩', slot: '⬡',
};

export default function LayersTree({ flatNodes, selectedIds, onSelect }: LayersTreeProps) {
  if (!flatNodes.length) {
    return <p style={{ fontSize: 11, color: '#4B5563' }}>No nodes</p>;
  }

  const roots      = flatNodes.filter(n => !n.parentId);
  const childrenOf = (id: string) => flatNodes
    .filter(n => n.parentId === id)
    .sort((a, b) => a.order.localeCompare(b.order));

  function renderNode(node: any, depth: number): React.ReactNode {
    const props    = node.props ? JSON.parse(node.props) : {};
    const label    = props.content?.slice(0, 20) ?? props.tag ?? node.nodeType;
    const icon     = NODE_ICONS[node.nodeType] ?? '•';
    const children = childrenOf(node.id);

    return (
      <div key={node.id}>
        <LayersItem
          node={node}
          depth={depth}
          label={label}
          icon={icon}
          isSelected={selectedIds.has(node.id)}
          onSelect={onSelect}
        />
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

function LayersItem({ node, depth, label, icon, isSelected, onSelect }: {
  node: any; depth: number; label: string; icon: string;
  isSelected: boolean; onSelect: (id: string | null, shiftKey?: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy,
    data: { type: node.nodeType },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: { type: node.nodeType },
  });

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      style={{ marginLeft: depth * 12 }}
      className={[
        'layers-item',
        isSelected ? 'selected' : '',
        isDragging ? 'dragging' : '',
        (isOver && node.nodeType === 'layout') ? 'drop-over' : '',
      ].filter(Boolean).join(' ')}
      onClick={(e) => onSelect(isSelected ? null : node.id, e.shiftKey)}
    >
      {/* Drag handle */}
      <span
        className="drag-handle"
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        title="Drag to reorder"
      >
        ⠿
      </span>
      <span>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {node.lockedBy && <span style={{ fontSize: 10, color: '#F59E0B' }}>🔒</span>}
    </div>
  );
}
