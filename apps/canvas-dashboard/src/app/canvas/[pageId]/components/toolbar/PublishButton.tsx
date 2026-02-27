'use client';
import { useState, useEffect, useRef } from 'react';

interface PublishButtonProps {
  pageId: string;
  tenantId: string;
}

export default function PublishButton({ pageId, tenantId }: PublishButtonProps) {
  const [publishing, setPublishing] = useState(false);
  const [published,  setPublished]  = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handlePublish() {
    if (publishing) return;
    setPublishing(true);
    setPublished(false);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/pages/${pageId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        }
      );
      if (res.ok) {
        setPublished(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setPublished(false), 3000);

        // Auto-thumbnail — fire and forget, never blocks publish flow
        try {
          const frame = document.querySelector('.canvas-frame') as HTMLElement;
          if (frame) {
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(frame, { pixelRatio: 1 });
            const thumbRes = await fetch(dataUrl);
            const blob = await thumbRes.blob();
            const formData = new FormData();
            formData.append('thumbnail', blob, 'thumbnail.png');
            formData.append('tenantId', tenantId);
            await fetch(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/pages/${pageId}/thumbnail`,
              { method: 'POST', body: formData }
            );
          }
        } catch {
          // thumbnail failure is non-blocking
        }
      } else {
        const { error } = await res.json();
        alert(`Publish failed: ${error}`);
      }
    } catch (err) {
      alert(`Publish failed: ${err instanceof Error ? err.message : String(err)}`);
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
