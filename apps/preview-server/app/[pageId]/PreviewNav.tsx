'use client';
import { useCallback } from 'react';
import { PageRenderer, FunnelContext } from '@selorax/renderer';

interface PreviewNavProps {
  tree: unknown;
  data: Record<string, unknown>;
  funnelContext: FunnelContext | null;
  nextPreviewUrl: string | null;
}

// Thin client wrapper that provides funnel navigation in preview.
// No analytics events are fired — preview traffic must not pollute production data.
export default function PreviewNav({ tree, data, funnelContext, nextPreviewUrl }: PreviewNavProps) {
  const onFunnelNext = useCallback(() => {
    if (nextPreviewUrl) window.location.href = nextPreviewUrl;
  }, [nextPreviewUrl]);

  return (
    <PageRenderer
      tree={tree}
      data={data}
      funnelContext={funnelContext}
      onEvent={() => {}} // no-op — analytics intentionally disabled in preview
      onFunnelNext={onFunnelNext}
    />
  );
}
