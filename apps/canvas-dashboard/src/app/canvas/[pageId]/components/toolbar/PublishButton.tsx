'use client';
import { useState } from 'react';

interface PublishButtonProps {
  pageId: string;
  tenantId: string;
}

export default function PublishButton({ pageId, tenantId }: PublishButtonProps) {
  const [publishing, setPublishing] = useState(false);
  const [published,  setPublished]  = useState(false);

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    setPublished(false);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/pages/${pageId}/publish`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      if (res.ok) {
        setPublished(true);
        setTimeout(() => setPublished(false), 3000);
      } else {
        const { error } = await res.json();
        alert(`Publish failed: ${error}`);
      }
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <button
      className="btn btn-primary"
      onClick={handlePublish}
      disabled={publishing}
      style={{ minWidth: 80 }}
    >
      {publishing ? '...' : published ? '✓ Published' : 'Publish'}
    </button>
  );
}
