'use client';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface CanvasNodeProps {
  node: any;
  selectedIds: Set<string>;
  onSelect: (id: string | null, shiftKey?: boolean) => void;
  depth: number;
}

export default function CanvasNode({ node, selectedIds, onSelect, depth }: CanvasNodeProps) {
  if (!node) return null;

  const isSelected = selectedIds.has(node.id);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    disabled: !!node.lockedBy,
    data: { type: node.nodeType },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: node.id,
    data: { type: node.nodeType },
  });

  const setRef: React.RefCallback<HTMLDivElement> = (el) => {
    setDragRef(el);
    setDropRef(el);
  };

  const wrapperStyle: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    outline: isSelected ? '2px solid #7C3AED' : (isOver && node.nodeType === 'layout') ? '2px dashed #7C3AED' : undefined,
    outlineOffset: '2px',
    position: 'relative',
    cursor: 'pointer',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id, e.shiftKey);
  };

  const DragHandle = (
    <span
      className="canvas-drag-handle"
      {...attributes}
      {...listeners}
      onClick={e => e.stopPropagation()}
      title="Drag to reorder"
    >
      ⠿
    </span>
  );

  const nodeType = node.nodeType ?? node.type;

  switch (nodeType) {
    case 'layout':
      return (
        <div
          ref={setRef}
          style={{ ...node.styles, ...wrapperStyle }}
          className="canvas-node-layout"
          data-node-id={node.id}
          onClick={handleClick}
        >
          {DragHandle}
          {node.children?.map((child: any) => (
            <CanvasNode
              key={child.id} node={child}
              selectedIds={selectedIds} onSelect={onSelect} depth={depth + 1}
            />
          ))}
        </div>
      );

    case 'element':
      return (
        <div ref={setRef} style={wrapperStyle} data-node-id={node.id} onClick={handleClick}>
          {DragHandle}
          <RenderElement node={node} styles={node.styles} onClick={undefined} />
        </div>
      );

    case 'component':
      return (
        <div
          ref={setRef}
          style={{ ...wrapperStyle, minHeight: 40, background: '#f3f4f6', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
          data-node-id={node.id}
          onClick={handleClick}
        >
          {DragHandle}
          <span style={{ fontSize: 11, color: '#6B7280' }}>
            📦 {node.componentId ?? 'Component'}
          </span>
        </div>
      );

    default:
      return null;
  }
}

function RenderElement({ node, styles, onClick }: any) {
  const props    = node.props ? (typeof node.props === 'string' ? JSON.parse(node.props) : node.props) : {};
  const baseProps = { style: styles, 'data-node-id': node.id, onClick };

  switch (props.tag) {
    case 'text':    return <p {...baseProps}>{props.content ?? 'Text'}</p>;
    case 'heading': {
      const Tag = `h${props.level ?? 2}` as 'h1' | 'h2' | 'h3';
      return <Tag {...baseProps}>{props.content ?? 'Heading'}</Tag>;
    }
    case 'image':
      return props.src
        ? <img src={props.src} alt={props.alt ?? ''} style={styles} data-node-id={node.id} onClick={onClick} />
        : <div {...baseProps} style={{ ...styles, background: '#e5e7eb', minHeight: 100, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
            🖼 Image
          </div>;
    case 'button':  return <button {...baseProps}>{props.label ?? 'Button'}</button>;
    case 'divider': return <hr style={styles} data-node-id={node.id} onClick={onClick} />;
    default:        return <div {...baseProps}>{props.content ?? ''}</div>;
  }
}
