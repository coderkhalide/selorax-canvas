'use client';
import { useState, useEffect } from 'react';
import { useCanvas } from '@/context/CanvasContext';

export default function SettingsPanel({ node, tenantId }: { node: any; tenantId: string }) {
  const { updateSettings } = useCanvas();
  const [schema, setSchema] = useState<Record<string, any> | null>(null);
  const nodeSettings = (() => {
    try { return JSON.parse(node.settings ?? '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    if (node.nodeType !== 'component' || !node.componentId) {
      setSchema(null);
      return;
    }
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
    fetch(`${backend}/api/components/${node.componentId}/schema`, {
      headers: { 'x-tenant-id': tenantId },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.schema) setSchema(data.schema); })
      .catch(() => {});
    if (node.componentUrl) {
      import(/* webpackIgnore: true */ node.componentUrl)
        .then((mod: any) => { if (mod?.settings) setSchema(mod.settings); })
        .catch(() => {});
    }
  }, [node.componentId, node.componentUrl, tenantId]);

  if (node.nodeType !== 'component') {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        Settings are available for custom components only.
      </div>
    );
  }
  if (!schema) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
        {node.componentId ? 'Loading settings...' : 'No settings defined.'}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px' }}>
      {Object.entries(schema).map(([key, def]: [string, any]) => (
        <SettingField key={key} fieldKey={key} def={def}
          value={nodeSettings[key] ?? def.default ?? ''}
          onChange={val => updateSettings(node.id, { [key]: val })} />
      ))}
    </div>
  );
}

function SettingField({ fieldKey, def, value, onChange }: {
  fieldKey: string; def: any; value: any; onChange: (v: any) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
        {def.label ?? fieldKey}
      </label>
      {def.type === 'boolean' ? (
        <input type="checkbox" checked={!!local}
          onChange={e => { setLocal(e.target.checked); onChange(e.target.checked); }} />
      ) : def.type === 'select' ? (
        <select className="style-input" value={local}
          onChange={e => { setLocal(e.target.value); onChange(e.target.value); }}>
          {def.options?.map((o: string) => <option key={o}>{o}</option>)}
        </select>
      ) : def.type === 'number_slider' ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min={def.min ?? 0} max={def.max ?? 100} value={local}
            onChange={e => { setLocal(Number(e.target.value)); onChange(Number(e.target.value)); }}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 12, width: 28 }}>{local}</span>
        </div>
      ) : (
        <input className="style-input" value={local}
          onChange={e => setLocal(e.target.value)}
          onBlur={() => onChange(local)}
          placeholder={def.placeholder ?? '—'} />
      )}
    </div>
  );
}
