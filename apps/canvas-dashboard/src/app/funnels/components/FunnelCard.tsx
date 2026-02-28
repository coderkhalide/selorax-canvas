'use client';
import Link from 'next/link';
import type { FunnelSummary } from './FunnelList';

const STATUS_COLORS: Record<string, string> = {
  draft:    'var(--text-tertiary)',
  live:     '#10B981',
  archived: '#9CA3AF',
};

export default function FunnelCard({
  funnel, onDelete, deleting,
}: { funnel: FunnelSummary; onDelete: (id: string) => void; deleting: boolean }) {
  const stepCount   = funnel.steps?.length ?? 0;
  const firstPageId = funnel.steps?.[0]?.pageId;
  const previewBase = 'http://localhost:3004';

  return (
    <div className={`funnel-card${deleting ? ' funnel-card-deleting' : ''}`}>
      <div className="funnel-card-top">
        <span className="funnel-card-status" style={{ color: STATUS_COLORS[funnel.status] ?? STATUS_COLORS.draft }}>
          ● {funnel.status}
        </span>
      </div>
      <h3 className="funnel-card-name">{funnel.name}</h3>
      <p className="funnel-card-meta">
        {stepCount === 0 ? 'No steps yet' : `${stepCount} step${stepCount > 1 ? 's' : ''}`}
      </p>
      <div className="funnel-card-actions">
        <Link href={`/funnels/${funnel.id}`} className="btn btn-secondary btn-sm">
          Edit
        </Link>
        {firstPageId && (
          <a
            href={`${previewBase}/${firstPageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Preview
          </a>
        )}
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(funnel.id)}
          disabled={deleting}
        >
          {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
