'use client';
import { useCanvas } from '@/context/CanvasContext';
import { resolveDropOrder } from '@/utils/drop-order';

const ELEMENT_DEFS = {
  layout: [
    { key: 'section', icon: '▬', label: 'Section',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'column', padding: '40px 20px', width: '100%', minHeight: '80px' },
      defaultProps: { label: 'Section' } },
    { key: 'row', icon: '⇔', label: 'Row',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'row', gap: '16px' },
      defaultProps: { label: 'Row' } },
    { key: 'columns', icon: '⊞', label: 'Columns',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
      defaultProps: { label: 'Columns' } },
    { key: 'wrapper', icon: '▢', label: 'Wrapper',
      nodeType: 'layout' as const,
      defaultStyles: { display: 'flex', flexDirection: 'column', gap: '8px' },
      defaultProps: { label: 'Wrapper' } },
  ],
  content: [
    { key: 'heading', icon: 'H', label: 'Heading',
      nodeType: 'element' as const,
      defaultStyles: { fontSize: '32px', fontWeight: '700', color: '#111827' },
      defaultProps: { tag: 'heading', level: 2, content: 'Heading' } },
    { key: 'paragraph', icon: 'P', label: 'Paragraph',
      nodeType: 'element' as const,
      defaultStyles: { fontSize: '16px', color: '#374151', lineHeight: '1.6' },
      defaultProps: { tag: 'text', content: 'Paragraph text goes here.' } },
    { key: 'button', icon: '⬭', label: 'Button',
      nodeType: 'element' as const,
      defaultStyles: { display: 'inline-block', padding: '12px 24px', borderRadius: '6px',
        background: '#F47920', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
      defaultProps: { tag: 'button', content: 'Click me' } },
    { key: 'image', icon: '🖼', label: 'Image',
      nodeType: 'element' as const,
      defaultStyles: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', background: '#E5E7EB' },
      defaultProps: { tag: 'image', src: '', alt: '' } },
    { key: 'divider', icon: '—', label: 'Divider',
      nodeType: 'element' as const,
      defaultStyles: { borderTop: '1px solid #E5E7EB', width: '100%', margin: '8px 0' },
      defaultProps: { tag: 'divider' } },
  ],
};

type ElementDef = typeof ELEMENT_DEFS.layout[0] | typeof ELEMENT_DEFS.content[0];

export default function ElementsPanel({ pageId, tenantId }: { pageId: string; tenantId: string }) {
  const { insertNode, selectedIds, nodes } = useCanvas();

  function addElement(def: ElementDef) {
    // Find the parent: selected node if it's a layout, otherwise root
    const lastSelId = [...selectedIds].at(-1) ?? null;
    const selNode   = lastSelId ? nodes.get(lastSelId) : null;
    const parentId  = (selNode?.nodeType === 'layout') ? selNode.id : null;

    // Compute order: after last child of parent (or last root node)
    const siblings = Array.from(nodes.values())
      .filter(n => n.parentId === parentId)
      .sort((a, b) => a.order.localeCompare(b.order));
    const newOrder = resolveDropOrder(siblings.at(-1)?.order, undefined);

    insertNode({
      pageId, tenantId,
      parentId,
      nodeType: def.nodeType,
      order: newOrder,
      styles: JSON.stringify(def.defaultStyles),
      props:  JSON.stringify(def.defaultProps),
      settings: '{}',
    });
  }

  return (
    <div>
      <div className="elements-category">
        <p className="elements-category-title">Layout</p>
        <div className="elements-grid">
          {ELEMENT_DEFS.layout.map(def => (
            <button key={def.key} className="element-card" onClick={() => addElement(def)}>
              <span className="element-card-icon">{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="elements-category">
        <p className="elements-category-title">Content</p>
        <div className="elements-grid">
          {ELEMENT_DEFS.content.map(def => (
            <button key={def.key} className="element-card" onClick={() => addElement(def)}>
              <span className="element-card-icon">{def.icon}</span>
              <span>{def.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
