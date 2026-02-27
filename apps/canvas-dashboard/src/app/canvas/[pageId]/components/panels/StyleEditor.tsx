'use client';
import { useState } from 'react';
import { useCanvas } from '@/context/CanvasContext';

const STYLE_FIELDS = [
  { label: 'Background', key: 'background' },
  { label: 'Padding',    key: 'padding' },
  { label: 'Margin',     key: 'margin' },
  { label: 'Radius',     key: 'borderRadius' },
  { label: 'Border',     key: 'border' },
  { label: 'Shadow',     key: 'boxShadow' },
  { label: 'Opacity',    key: 'opacity' },
];

export default function StyleEditor({ node }: { node: any }) {
  const currentStyles = (() => {
    try { return JSON.parse(node.styles ?? '{}'); } catch { return {}; }
  })();
  return (
    <div>
      {STYLE_FIELDS.map(({ label, key }) => (
        <StyleField key={key} label={label} fieldKey={key}
          initialValue={currentStyles[key] ?? ''} nodeId={node.id} />
      ))}
    </div>
  );
}

function StyleField({ label, fieldKey, initialValue, nodeId }: {
  label: string; fieldKey: string; initialValue: string; nodeId: string;
}) {
  const { updateStyles } = useCanvas();
  const [val, setVal] = useState(initialValue);
  return (
    <div className="style-row">
      <span className="style-label">{label}</span>
      <input className="style-input" value={val} placeholder="—"
        onChange={e => setVal(e.target.value)}
        onBlur={() => updateStyles(nodeId, { [fieldKey]: val })} />
    </div>
  );
}
