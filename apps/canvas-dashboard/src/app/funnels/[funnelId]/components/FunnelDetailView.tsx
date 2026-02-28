'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AddStepModal from './AddStepModal';
import ConfigureStepModal from './ConfigureStepModal';

export interface FunnelStep {
  id: string; pageId: string; stepOrder: number;
  stepType: string; name: string; onSuccess: string;
}
export interface Page { id: string; name: string; slug: string; pageType?: string; }
interface Funnel { id: string; name: string; status: string; steps: FunnelStep[]; }

const STEP_ICONS: Record<string, string> = {
  landing: '🏠', checkout: '💳', upsell: '⬆️', downsell: '⬇️', thankyou: '✅',
};
const STEP_COLORS: Record<string, string> = {
  landing: '#2D2F8F', checkout: '#F47920', upsell: '#10B981', downsell: '#F59E0B', thankyou: '#6B7280',
};

export default function FunnelDetailView({
  funnel, pages, tenantId,
}: { funnel: Funnel; pages: Page[]; tenantId: string }) {
  const router          = useRouter();
  const [showAdd,       setShowAdd]       = useState(false);
  const [configStep,    setConfigStep]    = useState<FunnelStep | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
  const previewBase = process.env.NEXT_PUBLIC_PREVIEW_URL ?? 'http://localhost:3004';

  const removeStep = async (stepId: string) => {
    if (!confirm('Remove this step from the funnel?')) return;
    const res = await fetch(`${backend}/api/funnels/${funnel.id}/steps/${stepId}`, {
      method: 'DELETE', headers: { 'x-tenant-id': tenantId },
    });
    if (res.ok) { router.refresh(); }
    else { alert('Failed to remove step. Please try again.'); }
  };

  const sortedSteps = [...funnel.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const pageMap = Object.fromEntries(pages.map(p => [p.id, p]));

  return (
    <div className="funnel-detail-page">
      <div className="funnel-detail-header">
        <Link href="/funnels" className="funnels-back-link">← Funnels</Link>
        <div className="funnel-detail-title-row">
          <h1 className="funnel-detail-name">{funnel.name}</h1>
          <span className="funnel-card-status" style={{ color: funnel.status === 'live' ? '#10B981' : 'var(--text-tertiary)', marginLeft: 12 }}>
            ● {funnel.status}
          </span>
        </div>
      </div>

      <div className="funnel-steps-flow">
        {sortedSteps.length === 0 && (
          <p className="funnel-steps-empty">No steps yet. Add your first step to build the funnel.</p>
        )}

        {sortedSteps.map((step, i) => {
          const page  = pageMap[step.pageId];
          const color = STEP_COLORS[step.stepType] ?? '#6B7280';
          return (
            <div key={step.id} className="funnel-flow-item">
              <div className="funnel-step-card">
                <div className="funnel-step-card-left">
                  <span className="funnel-step-number">Step {step.stepOrder + 1}</span>
                  <span className="funnel-step-icon">{STEP_ICONS[step.stepType] ?? '📄'}</span>
                  <div className="funnel-step-info">
                    <span className="funnel-step-name">{step.name}</span>
                    <span className="funnel-step-page">
                      {page ? `${page.name} · /${page.slug}` : (step.pageId ? step.pageId : 'No page assigned')}
                    </span>
                  </div>
                  <span
                    className="funnel-step-type-badge"
                    style={{ background: color + '18', color }}
                  >
                    {step.stepType}
                  </span>
                </div>
                <div className="funnel-step-actions">
                  {step.pageId && (
                    <Link href={`/canvas/${step.pageId}`} className="btn btn-secondary btn-sm">
                      Edit Page
                    </Link>
                  )}
                  {step.pageId && (
                    <a href={`${previewBase}/${step.pageId}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      Preview
                    </a>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setConfigStep(step)}>
                    Configure
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeStep(step.id)}>
                    Remove
                  </button>
                </div>
              </div>
              {i < sortedSteps.length - 1 && (
                <div className="funnel-flow-connector">↓</div>
              )}
            </div>
          );
        })}

        <button className="funnel-add-step-btn" onClick={() => setShowAdd(true)}>
          + Add Step
        </button>
      </div>

      {showAdd && (
        <AddStepModal
          funnelId={funnel.id}
          stepOrder={sortedSteps.length}
          tenantId={tenantId}
          pages={pages}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); router.refresh(); }}
        />
      )}

      {configStep && (
        <ConfigureStepModal
          funnelId={funnel.id}
          step={configStep}
          tenantId={tenantId}
          pages={pages}
          onClose={() => setConfigStep(null)}
          onSaved={() => { setConfigStep(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
