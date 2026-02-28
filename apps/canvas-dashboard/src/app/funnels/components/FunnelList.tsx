'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CreateFunnelModal from './CreateFunnelModal';
import FunnelCard from './FunnelCard';

export interface FunnelSummary {
  id: string; name: string; status: string;
  steps: { id: string; pageId: string }[];
  createdAt: string;
}

export default function FunnelList({
  initialFunnels, tenantId,
}: { initialFunnels: FunnelSummary[]; tenantId: string }) {
  const router     = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

  const deleteFunnel = async (id: string) => {
    if (!confirm('Delete this funnel? This cannot be undone.')) return;
    setDeleting(id);
    await fetch(`${backend}/api/funnels/${id}`, {
      method:  'DELETE',
      headers: { 'x-tenant-id': tenantId },
    });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div className="funnels-page">
      <div className="funnels-page-header">
        <div>
          <Link href="/" className="funnels-back-link">← Dashboard</Link>
          <h1 className="funnels-page-title">Funnels</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New Funnel
        </button>
      </div>

      {initialFunnels.length === 0 ? (
        <div className="funnels-empty-state">
          <p>No funnels yet.</p>
          <p>Create your first funnel to get started.</p>
        </div>
      ) : (
        <div className="funnels-grid">
          {initialFunnels.map(f => (
            <FunnelCard
              key={f.id}
              funnel={f}
              onDelete={deleteFunnel}
              deleting={deleting === f.id}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateFunnelModal
          tenantId={tenantId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            router.push(`/funnels/${id}`);
          }}
        />
      )}
    </div>
  );
}
