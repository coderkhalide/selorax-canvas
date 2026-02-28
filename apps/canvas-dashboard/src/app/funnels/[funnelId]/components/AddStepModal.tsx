'use client';
import { useState } from 'react';
import type { Page } from './FunnelDetailView';

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'] as const;

export default function AddStepModal({
  funnelId, stepOrder, tenantId, pages, onClose, onAdded,
}: {
  funnelId: string; stepOrder: number; tenantId: string; pages: Page[];
  onClose: () => void; onAdded: () => void;
}) {
  const [pageId,      setPageId]      = useState('');
  const [newPageName, setNewPageName] = useState<string | null>(null); // name of just-created page
  const [stepType,    setStepType]    = useState<string>('landing');
  const [name,        setName]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [creating,    setCreating]    = useState(false); // creating a new page
  const [error,       setError]       = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleCreatePage = async () => {
    const title = name.trim() || `Step ${stepOrder + 1} Page`;
    const slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  + '-' + Date.now().toString(36);
    setCreating(true); setError('');
    const res = await fetch(`${backend}/api/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({ slug, title, pageType: stepType }),
    });
    setCreating(false);
    if (res.ok) {
      const page = await res.json();
      setPageId(page.id);
      setNewPageName(page.title ?? page.slug);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(`Failed to create page. ${JSON.stringify(body)}`);
    }
  };

  const handleAdd = async () => {
    setLoading(true); setError('');
    const res = await fetch(`${backend}/api/funnels/${funnelId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body: JSON.stringify({
        pageId,
        stepType,
        name: name.trim() || `Step ${stepOrder + 1}`,
        stepOrder,
        onSuccess: { action: 'next' },
      }),
    });
    setLoading(false);
    if (res.ok) { onAdded(); }
    else { setError('Failed to add step.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Step</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Step Name (optional)</label>
            <input
              autoFocus className="field-input" value={name}
              onChange={e => setName(e.target.value)}
              placeholder={`Step ${stepOrder + 1}`}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Page</label>
            {newPageName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', padding: '8px 12px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  ✓ {newPageName}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => { setPageId(''); setNewPageName(null); }}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="field-select" style={{ flex: 1 }} value={pageId} onChange={e => setPageId(e.target.value)}>
                  <option value="">— Select a page —</option>
                  {pages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} · /{p.slug}</option>
                  ))}
                </select>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={handleCreatePage}
                  disabled={creating}
                >
                  {creating ? '...' : '+ New Page'}
                </button>
              </div>
            )}
          </div>
          <div className="field-group">
            <label className="field-label">Step Type</label>
            <select className="field-select" value={stepType} onChange={e => setStepType(e.target.value)}>
              {STEP_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>
            {loading ? 'Adding...' : 'Add Step'}
          </button>
        </div>
      </div>
    </div>
  );
}
