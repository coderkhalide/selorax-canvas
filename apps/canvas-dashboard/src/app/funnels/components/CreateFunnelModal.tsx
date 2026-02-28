'use client';
import { useState } from 'react';

export default function CreateFunnelModal({
  tenantId, onClose, onCreated,
}: { tenantId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name,    setName]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const handleCreate = async () => {
    if (!name.trim()) { setError('Funnel name is required'); return; }
    setLoading(true);
    setError('');
    const res = await fetch(`${backend}/api/funnels`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
      body:    JSON.stringify({ name: name.trim() }),
    });
    setLoading(false);
    if (res.ok) {
      const f = await res.json();
      onCreated(f.id);
    } else {
      setError('Failed to create funnel. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Funnel</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field-group">
            <label className="field-label">Funnel Name</label>
            <input
              autoFocus
              className="field-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="e.g. Summer Sale Funnel"
            />
            {error && <p className="field-error">{error}</p>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? 'Creating...' : 'Create Funnel'}
          </button>
        </div>
      </div>
    </div>
  );
}
