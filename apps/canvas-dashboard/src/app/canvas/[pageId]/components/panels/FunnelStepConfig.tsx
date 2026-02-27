'use client';
import { useState } from 'react';

interface FunnelStep {
  id?:        string;
  pageId:     string;
  stepOrder:  number;
  stepType:   string;
  name:       string;
  onSuccess:  string;
}

interface FunnelStepConfigProps {
  funnelId:   string;
  step:       FunnelStep | null;
  tenantId:   string;
  backendUrl: string;
  onClose:    () => void;
  onSave:     (step: FunnelStep) => void;
}

const STEP_TYPES = ['landing', 'checkout', 'upsell', 'downsell', 'thankyou'];

export default function FunnelStepConfig({
  step, onClose, onSave,
}: FunnelStepConfigProps) {
  const [name,      setName]      = useState(step?.name ?? '');
  const [pageId,    setPageId]    = useState(step?.pageId ?? '');
  const [stepType,  setStepType]  = useState(step?.stepType ?? 'landing');
  const [onSuccess, setOnSuccess] = useState(
    step?.onSuccess ? JSON.parse(step.onSuccess).action ?? 'next' : 'next'
  );

  if (!step) return null;

  const save = () => {
    onSave({
      ...step,
      name,
      pageId,
      stepType,
      onSuccess: JSON.stringify({ action: onSuccess }),
    });
  };

  return (
    <div className="funnel-step-config-overlay">
      <div className="funnel-step-config">
        <div className="step-config-header">
          <h4>Configure Step</h4>
          <button className="step-config-close" onClick={onClose}>✕</button>
        </div>

        <div className="step-config-field">
          <label>Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="step-config-input"
          />
        </div>

        <div className="step-config-field">
          <label>Page ID</label>
          <input
            value={pageId}
            onChange={e => setPageId(e.target.value)}
            placeholder="Enter page ID..."
            className="step-config-input"
          />
        </div>

        <div className="step-config-field">
          <label>Step Type</label>
          <select
            value={stepType}
            onChange={e => setStepType(e.target.value)}
            className="step-config-select"
          >
            {STEP_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="step-config-field">
          <label>On Success</label>
          <select
            value={onSuccess}
            onChange={e => setOnSuccess(e.target.value)}
            className="step-config-select"
          >
            <option value="next">Next step</option>
            <option value="skip">Skip to end</option>
            <option value="external">External URL</option>
          </select>
        </div>

        <div className="step-config-actions">
          <button className="btn btn-primary" onClick={save}>Save</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
