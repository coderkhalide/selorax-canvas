'use client';

interface CanvasNodeProps {
  node: any;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

export default function CanvasNode({ node, selectedId, onSelect, depth }: CanvasNodeProps) {
  if (!node) return null;

  const isSelected = node.id === selectedId;
  const styles = {
    ...node.styles,
    outline: isSelected ? '2px solid #7C3AED' : undefined,
    outlineOffset: isSelected ? '2px' : undefined,
    position: 'relative' as const,
    cursor: 'pointer',
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  switch (node.type) {
    case 'layout':
      return (
        <div style={styles} data-node-id={node.id} onClick={handleClick}>
          {node.children?.map((child: any) => (
            <CanvasNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      );
    case 'element':
      return <RenderElement node={node} styles={styles} onClick={handleClick} />;
    case 'component':
      return (
        <div style={{ ...styles, minHeight: 40, background: '#f3f4f6', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
          data-node-id={node.id} onClick={handleClick}>
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
  const props = node.props ?? {};
  const baseProps = { style: styles, 'data-node-id': node.id, onClick };

  switch (props.tag) {
    case 'text':    return <p {...baseProps}>{props.content ?? 'Text'}</p>;
    case 'heading': {
      const Tag = (props.level ?? 'h2') as 'h1' | 'h2' | 'h3';
      return <Tag {...baseProps}>{props.content ?? 'Heading'}</Tag>;
    }
    case 'image':
      return props.src
        ? <img src={props.src} alt={props.alt ?? ''} style={styles} data-node-id={node.id} onClick={onClick} />
        : <div {...baseProps} style={{ ...styles, background: '#e5e7eb', minHeight: 100, borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
            🖼 Image
          </div>;
    case 'button':
      return <button {...baseProps}>{props.label ?? 'Button'}</button>;
    case 'divider':
      return <hr style={styles} data-node-id={node.id} onClick={onClick} />;
    default:
      return <div {...baseProps}>{props.content ?? ''}</div>;
  }
}
