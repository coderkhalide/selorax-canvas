'use client';
import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useCanvas } from '@/context/CanvasContext';

const NODE_ICONS: Record<string, string> = {
  layout: '▢', element: '◻', component: '⬡',
};

export default function LayersTree() {
  const { flatNodes } = useCanvas();
  if (!flatNodes.length) {
    return <p style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)' }}>Canvas is empty</p>;
  }
  const roots      = flatNodes.filter(n => !n.parentId).sort((a: any, b: any) => a.order.localeCompare(b.order));
  const childrenOf = (id: string) => flatNodes
    .filter((n: any) => n.parentId === id).sort((a: any, b: any) => a.order.localeCompare(b.order));

  function renderNode(node: any, depth: number): React.ReactNode {
    return (
      <LayersItem key={node.id} node={node} depth={depth}
        childrenOf={childrenOf} />
    );
  }
  return <div style={{ padding: '4px 0' }}>{roots.map(n => renderNode(n, 0))}</div>;
}

function LayersItem({ node, depth, childrenOf }: {
  node: any; depth: number;
  childrenOf: (id: string) => any[];
}) {
  const { selectedIds, selectNode, deleteNode, updateProps } = useCanvas();
  const [collapsed, setCollapsed] = useState(false);
  const [renaming, setRenaming]   = useState(false);
  const [nameVal, setNameVal]     = useState('');

  const isSelected  = selectedIds.has(node.id);
  const isLayout    = node.nodeType === 'layout';
  const children    = childrenOf(node.id);
  const hasChildren = isLayout && children.length > 0;

  const props = (() => { try { return JSON.parse(node.props ?? '{}'); } catch { return {}; } })();
  const label = props.label ?? props.content?.slice(0, 20) ?? props.tag ?? node.nodeType;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: node.id });
  const setRef = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el); };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameVal(label);
    setRenaming(true);
  };

  const commitRename = () => {
    if (nameVal.trim()) updateProps(node.id, { label: nameVal.trim() });
    setRenaming(false);
  };

  return (
    <div>
      <div ref={setRef} style={{ paddingLeft: depth * 12 }}
        className={[
          'layers-item',
          isSelected ? 'selected' : '',
          isDragging ? 'dragging' : '',
          (isOver && isLayout) ? 'drop-over' : '',
        ].filter(Boolean).join(' ')}
        onClick={(e) => { if (!renaming) selectNode(node.id, e.shiftKey); }}
        onDoubleClick={startRename}
      >
        <span className="drag-handle" {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}>⠿</span>
        {hasChildren && (
          <span style={{ fontSize: 10, cursor: 'pointer', userSelect: 'none', marginRight: 2 }}
            onClick={e => { e.stopPropagation(); setCollapsed(!collapsed); }}>
            {collapsed ? '▶' : '▼'}
          </span>
        )}
        <span style={{ marginRight: 4 }}>{NODE_ICONS[node.nodeType] ?? '•'}</span>
        {renaming ? (
          <input
            autoFocus
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, fontSize: 12, border: '1px solid var(--brand-navy)',
              borderRadius: 3, padding: '1px 4px', background: 'var(--bg-app)', outline: 'none' }}
          />
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )}
        {node.lockedBy && <span style={{ fontSize: 10, color: '#F59E0B', marginLeft: 2 }}>🔒</span>}
        <button
          className="floating-btn danger"
          style={{ width: 20, height: 20, fontSize: 11, opacity: 0, marginLeft: 2 }}
          onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
          title="Delete"
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >✕</button>
      </div>
      {hasChildren && !collapsed && children.map((child: any) => (
        <LayersItem key={child.id} node={child} depth={depth + 1} childrenOf={childrenOf} />
      ))}
    </div>
  );
}
