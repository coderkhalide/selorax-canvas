'use client';
import { useState, useEffect } from 'react';
import FunnelStepConfig from './FunnelStepConfig';

interface FunnelStep {
  id?:        string;
  pageId:     string;
  stepOrder:  number;
  stepType:   string;
  name:       string;
  onSuccess:  string;
}

interface Funnel {
  id:     string;
  name:   string;
  goal:   string;
  status: string;
  steps:  FunnelStep[];
}

interface FunnelBuilderProps {
  tenantId:   string;
  backendUrl: string;
}

const STEP_ICONS: Record<string, string> = {
  landing: '🏠', checkout: '💳', upsell: '⬆️', downsell: '⬇️', thankyou: '✅',
};

export default function FunnelBuilder({ tenantId, backendUrl }: FunnelBuilderProps) {
  const [funnels,      setFunnels]     = useState<Funnel[]>([]);
  const [expanded,     setExpanded]    = useState<string | null>(null);
  const [creating,     setCreating]    = useState(false);
  const [newName,      setNewName]     = useState('');
  const [editingStep,  setEditingStep] = useState<{ funnelId: string; step: FunnelStep } | null>(null);
  const [error,        setError]       = useState<string | null>(null);

  const jsonHeaders = { 'Content-Type': 'application/json', 'x-tenant-id': tenantId };

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${backendUrl}/api/funnels`, {
      headers: { 'x-tenant-id': tenantId },
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(data => setFunnels(Array.isArray(data) ? data : []))
      .catch(err => { if (err.name !== 'AbortError') setFunnels([]); });
    return () => controller.abort();
  }, [tenantId, backendUrl]);

  const createFunnel = async () => {
    if (!newName.trim()) return;
    const res = await fetch(`${backendUrl}/api/funnels`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ name: newName.trim(), goal: 'conversion' }),
    });
    if (res.ok) {
      const f = await res.json();
      setFunnels(prev => [...prev, f]);
      setExpanded(f.id);
      setCreating(false);
      setNewName('');
    } else { setError('Failed to create funnel'); }
  };

  const addStep = async (funnelId: string) => {
    const funnel = funnels.find(f => f.id === funnelId);
    if (!funnel) return;
    const steps = [...funnel.steps, {
      pageId: '', stepType: 'landing',
      name: `Step ${funnel.steps.length + 1}`,
      stepOrder: funnel.steps.length,
      onSuccess: JSON.stringify({ action: 'next' }),
    }];
    const res = await fetch(`${backendUrl}/api/funnels/${funnelId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ steps }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFunnels(prev => prev.map(f => f.id === funnelId ? updated : f));
    } else { setError('Failed to add step'); }
  };

  const saveStep = async (funnelId: string, updatedStep: FunnelStep) => {
    const funnel = funnels.find(f => f.id === funnelId);
    if (!funnel) return;
    const steps = funnel.steps.map(s =>
      s.id === updatedStep.id ? updatedStep : s
    );
    const res = await fetch(`${backendUrl}/api/funnels/${funnelId}`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ steps }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFunnels(prev => prev.map(f => f.id === funnelId ? updated : f));
    } else { setError('Failed to save step'); }
    setEditingStep(null);
  };

  return (
    <div className="funnel-builder">
      {error && (
        <p className="funnel-error">{error}</p>
      )}
      {funnels.map(funnel => (
        <div key={funnel.id} className="funnel-item">
          {/* Funnel header — click to expand */}
          <div
            className="funnel-header"
            onClick={() => setExpanded(expanded === funnel.id ? null : funnel.id)}
          >
            <span className="funnel-chevron">
              {expanded === funnel.id ? '▼' : '▶'}
            </span>
            <span className="funnel-name">{funnel.name}</span>
            <span className={`funnel-status status-${funnel.status}`}>
              {funnel.status}
            </span>
          </div>

          {/* Expanded: visual step flow */}
          {expanded === funnel.id && (
            <div className="funnel-flow">
              {funnel.steps
                .slice()
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step, i) => (
                  <div key={step.id ?? i} className="funnel-step-wrapper">
                    <div
                      className="funnel-step-card"
                      onClick={() => setEditingStep({ funnelId: funnel.id, step })}
                    >
                      <span className="step-icon">
                        {STEP_ICONS[step.stepType] ?? '📄'}
                      </span>
                      <div className="step-info">
                        <span className="step-name">{step.name}</span>
                        <span className="step-type">{step.stepType}</span>
                      </div>
                    </div>
                    {i < funnel.steps.length - 1 && (
                      <div className="funnel-step-connector">
                        <div className="funnel-step-line" />
                        <span className="funnel-step-arrow">↓</span>
                      </div>
                    )}
                  </div>
                ))}

              <button
                className="funnel-add-step"
                onClick={() => addStep(funnel.id)}
              >
                + Add step
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Create new funnel */}
      {creating ? (
        <div className="funnel-create">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFunnel()}
            placeholder="Funnel name..."
            className="funnel-name-input"
          />
          <div className="funnel-create-actions">
            <button onClick={createFunnel} className="btn btn-primary">Create</button>
            <button onClick={() => { setCreating(false); setNewName(''); }} className="btn btn-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <button className="funnel-new-btn" onClick={() => setCreating(true)}>
          + New Funnel
        </button>
      )}

      {/* Step config flyout */}
      {editingStep && (
        <FunnelStepConfig
          funnelId={editingStep.funnelId}
          step={editingStep.step}
          tenantId={tenantId}
          backendUrl={backendUrl}
          onClose={() => setEditingStep(null)}
          onSave={step => saveStep(editingStep.funnelId, step)}
        />
      )}
    </div>
  );
}
