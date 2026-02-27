'use client';
import { useState } from 'react';
import { useCanvas } from '@/context/CanvasContext';
import LayoutPanel   from './LayoutPanel';
import StyleEditor   from './StyleEditor';
import SettingsPanel from './SettingsPanel';

type RightTab = 'properties' | 'settings';

export default function RightPanel({ pageId, tenantId, isPublished }: {
  pageId?: string; tenantId: string; isPublished?: boolean;
}) {
  const [tab, setTab] = useState<RightTab>('properties');
  const { selectedNode } = useCanvas();

  return (
    <div className="panel-right">
      <AnalyticsStripSafe pageId={pageId} tenantId={tenantId} isPublished={isPublished ?? false} />
      <div className="right-panel-tabs">
        {(['properties', 'settings'] as RightTab[]).map(t => (
          <button key={t} className={`right-panel-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {!selectedNode ? (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Select a node to edit properties
        </div>
      ) : tab === 'properties' ? (
        <PropertiesTab node={selectedNode} tenantId={tenantId} />
      ) : (
        <SettingsPanel node={selectedNode} tenantId={tenantId} />
      )}
    </div>
  );
}

function AnalyticsStripSafe({ pageId, tenantId, isPublished }: { pageId?: string; tenantId: string; isPublished: boolean }) {
  if (!pageId) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AnalyticsStrip = require('./AnalyticsStrip').default;
    return <AnalyticsStrip pageId={pageId} tenantId={tenantId} isPublished={isPublished} />;
  } catch {
    return null;
  }
}

function AccordionSection({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setOpen(!open)}>
        {title}
        <span className={`accordion-chevron${open ? ' open' : ''}`}>&#9658;</span>
      </div>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}

function PropertiesTab({ node, tenantId: _tenantId }: { node: any; tenantId: string }) {
  const nodeStyles: Record<string, string> = (() => {
    try { return JSON.parse(node?.styles ?? '{}'); } catch { return {}; }
  })();
  const nodeProps: Record<string, unknown> = (() => {
    try { return JSON.parse(node?.props ?? '{}'); } catch { return {}; }
  })();
  const isText = node.nodeType === 'element' && ['heading','text','button'].includes(nodeProps.tag as string);
  const isLayout = node.nodeType === 'layout';

  return (
    <div>
      {isLayout && (
        <AccordionSection title="Layout">
          <LayoutPanel nodeId={node.id} styles={nodeStyles} />
        </AccordionSection>
      )}
      <AccordionSection title="Size">
        <SizeSection nodeId={node.id} styles={nodeStyles} />
      </AccordionSection>
      <AccordionSection title="Style">
        <StyleEditor node={node} />
      </AccordionSection>
      {isText && (
        <AccordionSection title="Typography">
          <TypographySection nodeId={node.id} styles={nodeStyles} />
        </AccordionSection>
      )}
    </div>
  );
}

function SizeSection({ nodeId, styles }: { nodeId: string; styles: Record<string, string> }) {
  const { updateStyles } = useCanvas();
  const [w, setW] = useState(styles.width  ?? '');
  const [h, setH] = useState(styles.height ?? '');
  return (
    <div>
      <div className="style-row">
        <span className="style-label">Width</span>
        <input className="style-input" value={w} placeholder="auto"
          onChange={e => setW(e.target.value)}
          onBlur={() => updateStyles(nodeId, { width: w })} />
      </div>
      <div className="style-row">
        <span className="style-label">Height</span>
        <input className="style-input" value={h} placeholder="auto"
          onChange={e => setH(e.target.value)}
          onBlur={() => updateStyles(nodeId, { height: h })} />
      </div>
    </div>
  );
}

function TypographySection({ nodeId, styles }: { nodeId: string; styles: Record<string, string> }) {
  const fields = [
    { label: 'Font Size', key: 'fontSize', placeholder: '16px' },
    { label: 'Font Weight', key: 'fontWeight', placeholder: '400' },
    { label: 'Line Height', key: 'lineHeight', placeholder: '1.5' },
    { label: 'Color', key: 'color', placeholder: '#111827' },
  ];
  return (
    <div>
      {fields.map(f => (
        <TypographyField key={f.key} label={f.label} fieldKey={f.key} placeholder={f.placeholder}
          initialValue={styles[f.key] ?? ''} nodeId={nodeId} />
      ))}
    </div>
  );
}

function TypographyField({ label, fieldKey, placeholder, initialValue, nodeId }: {
  label: string; fieldKey: string; placeholder: string; initialValue: string; nodeId: string;
}) {
  const { updateStyles } = useCanvas();
  const [val, setVal] = useState(initialValue);
  return (
    <div className="style-row">
      <span className="style-label">{label}</span>
      <input className="style-input" value={val} placeholder={placeholder}
        onChange={e => setVal(e.target.value)}
        onBlur={() => updateStyles(nodeId, { [fieldKey]: val })} />
    </div>
  );
}
