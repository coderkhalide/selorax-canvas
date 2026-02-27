'use client';
import { useState } from 'react';

interface StyleEditorProps {
  node: any;
  conn: any;
  tenantId: string;
}

const QUICK_STYLES = [
  { label: 'Padding', key: 'padding', type: 'text' },
  { label: 'Margin', key: 'margin', type: 'text' },
  { label: 'Background', key: 'background', type: 'text' },
  { label: 'Color', key: 'color', type: 'text' },
  { label: 'Font Size', key: 'fontSize', type: 'text' },
  { label: 'Font Weight', key: 'fontWeight', type: 'text' },
  { label: 'Border Radius', key: 'borderRadius', type: 'text' },
  { label: 'Display', key: 'display', type: 'text' },
  { label: 'Width', key: 'width', type: 'text' },
  { label: 'Height', key: 'height', type: 'text' },
];

export default function StyleEditor({ node, conn, tenantId }: StyleEditorProps) {
  const [saving, setSaving] = useState(false);

  const currentStyles = (() => {
    try { return JSON.parse(node.styles ?? '{}'); } catch { return {}; }
  })();

  async function handleStyleChange(key: string, value: string) {
    if (!conn) return;
    setSaving(true);
    try {
      conn.reducers.update_node_styles({
        node_id: node.id,
        styles: JSON.stringify({ [key]: value }),
      });
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: '#6B7280', marginBottom: 8, marginTop: 12, fontWeight: 600 }}>
        Styles {saving && <span style={{ color: '#7C3AED' }}>✓</span>}
      </h3>
      {QUICK_STYLES.map(({ label, key }) => (
        <div key={key} className="style-row">
          <span className="style-label">{label}</span>
          <input
            className="style-input"
            defaultValue={currentStyles[key] ?? ''}
            onBlur={e => handleStyleChange(key, e.target.value)}
            placeholder="—"
          />
        </div>
      ))}
    </div>
  );
}
