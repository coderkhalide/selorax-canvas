'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useCanvas } from '@/context/CanvasContext';
import { DropZoneLine } from './DropZoneIndicator';

interface CanvasNodeProps {
  node: any;
  depth: number;
  dropInfo?: { overId: string; position: 'before' | 'after' | 'inside' } | null;
}

// Tags that support inline editing
const EDITABLE_TAGS = ['heading', 'text', 'button'];

export default function CanvasNode({ node, depth, dropInfo }: CanvasNodeProps) {
  if (!node) return null;
  const { selectedIds, editingId, selectNode, setEditingId, updateProps } = useCanvas();
  const isSelected = selectedIds.has(node.id);
  const isEditing  = editingId === node.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy || isEditing,
    data: { type: node.nodeType },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id, data: { type: node.nodeType },
  });
  const setRef = (el: HTMLDivElement | null) => { setDragRef(el); setDropRef(el); };

  const isDropTarget  = dropInfo?.overId === node.id;
  const isDropInside  = isDropTarget && dropInfo?.position === 'inside';

  const wrapperStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    outline: isSelected
      ? '2px solid var(--selection)'
      : (isDropInside || isOver) && node.nodeType === 'layout'
        ? '2px dashed var(--brand-navy)'
        : undefined,
    outlineOffset: '2px',
    position: 'relative',
    cursor: isEditing ? 'text' : 'pointer',
    background: isDropInside ? 'var(--brand-navy-light)' : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEditing) selectNode(node.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const props = node.props ? (typeof node.props === 'string' ? JSON.parse(node.props) : node.props) : {};
    if (EDITABLE_TAGS.includes(props.tag)) {
      setEditingId(node.id);
    }
  };

  const DragHandle = (
    <span className="canvas-drag-handle" {...attributes} {...listeners}
      onClick={e => e.stopPropagation()} title="Drag">⠿</span>
  );

  const nodeType = node.nodeType ?? node.type;

  if (nodeType === 'layout') {
    return (
      <div ref={setRef} style={{ ...parseStyles(node.styles), ...wrapperStyle }}
        className="canvas-node-layout" data-node-id={node.id}
        onClick={handleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        {node.children?.map((child: any) => (
          <CanvasNode key={child.id} node={child} depth={depth + 1} dropInfo={dropInfo} />
        ))}
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  if (nodeType === 'element') {
    return (
      <div ref={setRef} style={wrapperStyle} data-node-id={node.id} onClick={handleClick}
        onDoubleClick={handleDoubleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        <RenderElement node={node} isEditing={isEditing}
          onBlur={(content) => { updateProps(node.id, { content }); setEditingId(null); }} />
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  if (nodeType === 'component') {
    return (
      <div ref={setRef} style={{ ...wrapperStyle, minHeight: 40, background: '#f3f4f6',
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
        data-node-id={node.id} onClick={handleClick}>
        {isDropTarget && dropInfo?.position === 'before' && <DropZoneLine position="before" />}
        {DragHandle}
        <span style={{ fontSize: 11, color: '#6B7280' }}>📦 {node.componentId ?? 'Component'}</span>
        {isDropTarget && dropInfo?.position === 'after' && <DropZoneLine position="after" />}
      </div>
    );
  }

  return null;
}

function parseStyles(s: any): React.CSSProperties {
  if (!s) return {};
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return {}; }
}

function RenderElement({ node, isEditing, onBlur }: {
  node: any; isEditing: boolean; onBlur: (content: string) => void;
}) {
  const props = node.props ? (typeof node.props === 'string' ? JSON.parse(node.props) : node.props) : {};
  const styles = parseStyles(node.styles);

  if (props.tag === 'heading') {
    const Tag = `h${props.level ?? 2}` as 'h1' | 'h2' | 'h3';
    return (
      <Tag
        style={styles}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}
      >
        {props.content ?? 'Heading'}
      </Tag>
    );
  }
  if (props.tag === 'text') {
    return (
      <p style={styles} contentEditable={isEditing} suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}>
        {props.content ?? 'Text'}
      </p>
    );
  }
  if (props.tag === 'button') {
    return (
      <button style={styles} contentEditable={isEditing} suppressContentEditableWarning
        onBlur={e => isEditing && onBlur(e.currentTarget.textContent ?? '')}
        data-node-id={node.id}>
        {props.content ?? 'Button'}
      </button>
    );
  }
  if (props.tag === 'image') {
    return props.src
      ? <img src={props.src} alt={props.alt ?? ''} style={styles} data-node-id={node.id} />
      : <div style={{ ...styles, background: '#E5E7EB', minHeight: 100, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9CA3AF', fontSize: 12 }} data-node-id={node.id}>🖼 Image</div>;
  }
  if (props.tag === 'divider') {
    return <hr style={styles} data-node-id={node.id} />;
  }
  return <div style={styles} data-node-id={node.id}>{props.content ?? ''}</div>;
}
