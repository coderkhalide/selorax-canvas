'use client';
import { useState } from 'react';
import type { FunnelStep, Page } from './FunnelDetailView';

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'] as const;

export default function ConfigureStepModal({
  funnelId, step, tenantId, pages, onClose, onSaved,
}: {
  funnelId: string; step: FunnelStep; tenantId: string; pages: Page[];
  onClose: () => void; onSaved: () => void;
}) {
  const [pageId,    setPageId]    = useState(step.pageId);
  const [stepType,  setStepType]  = useState(step.stepType);
  const [name,      setName]      = useState(step.name);
  const [onSuccess, setOnSuccess] = useState(() => {
    try { return JSON.parse(step.onSuccess).action ?? 'next'; } catch { return 'next'; }
  });
  const [externalUrl, setExternalUrl] = useState(() => {
    try { return JSON.parse(step.onSuccess).url ?? ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleSave = async () => {
    setLoading(true); setError('');
    const res = await fetch(`${backend}/api/funnels/${funnelId}/steps/${step.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        pageId, stepType, name,
        onSuccess: onSuccess === 'external'
          ? { action: 'external', url: externalUrl }
          : { action: onSuccess },
      }),
    });
    setLoading(false);
    if (res.ok) { onSaved(); }
    else { setError('Failed to save step.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure Step</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Step Name</label>
            <input className="field-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Page</label>
            <select className="field-select" value={pageId} onChange={e => setPageId(e.target.value)}>
              <option value="">— Select a page —</option>
              {pages.map(p => (
                <option key={p.id} value={p.id}>{p.name} · /{p.slug}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">Step Type</label>
            <select className="field-select" value={stepType} onChange={e => setStepType(e.target.value)}>
              {STEP_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">On Success</label>
            <select className="field-select" value={onSuccess} onChange={e => setOnSuccess(e.target.value)}>
              <option value="next">Next step</option>
              <option value="skip">Skip to end</option>
              <option value="external">External URL</option>
            </select>
          </div>
          {onSuccess === 'external' && (
            <div className="field-group">
              <label className="field-label">External URL</label>
              <input
                className="field-input"
                value={externalUrl}
                onChange={e => setExternalUrl(e.target.value)}
                placeholder="https://example.com/thank-you"
              />
            </div>
          )}
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
