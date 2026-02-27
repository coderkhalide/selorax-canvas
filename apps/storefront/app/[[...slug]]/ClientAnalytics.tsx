'use client';
import { useEffect, useCallback } from 'react';
import { PageRenderer } from '@selorax/renderer';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('_sid');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('_sid', id);
  }
  return id;
}

function fireEvent(payload: Record<string, unknown>): void {
  const data = JSON.stringify({
    ...payload,
    visitorId: getVisitorId(),
    occurredAt: new Date().toISOString(),
  });
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(
      `${BACKEND}/api/events`,
      new Blob([data], { type: 'application/json' }),
    );
  } else {
    fetch(`${BACKEND}/api/events`, {
      method: 'POST',
      body: data,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  }
}

// Shape returned by the serve API (onSuccess/onSkip are plain objects)
interface FunnelCtx {
  funnelId: string;
  funnelStepOrder: number;
  nextStepUrl: string | null;
  isLastStep: boolean;
  onSuccess: { type: string; url?: string } | null;
  onSkip: { type: string; url?: string } | null;
}

interface ExperimentCtx {
  experimentId: string;
  variantId: string;
  isControl: boolean;
}

interface ClientAnalyticsProps {
  tree: unknown;
  data: Record<string, unknown>;
  pageId: string;
  tenantId: string;
  funnelContext: FunnelCtx | null;
  experimentContext: ExperimentCtx | null;
}

export default function ClientAnalytics({
  tree,
  data,
  pageId,
  tenantId,
  funnelContext,
  experimentContext,
}: ClientAnalyticsProps) {
  // Fire page_view on mount
  useEffect(() => {
    fireEvent({
      eventType:       'page_view',
      tenantId,
      pageId,
      funnelId:        funnelContext?.funnelId        ?? null,
      funnelStepOrder: funnelContext?.funnelStepOrder  ?? null,
      experimentId:    experimentContext?.experimentId ?? null,
      variantId:       experimentContext?.variantId    ?? null,
      value:           0,
    });
  }, [pageId, tenantId, funnelContext, experimentContext]);

  // Event callback forwarded from renderer (funnel_step_complete, conversion)
  const onEvent = useCallback(
    (event: { eventType: string; value?: number; funnelId?: string; funnelStepOrder?: number }) => {
      fireEvent({
        ...event,
        tenantId,
        pageId,
        funnelId:        funnelContext?.funnelId        ?? null,
        funnelStepOrder: funnelContext?.funnelStepOrder  ?? null,
        experimentId:    experimentContext?.experimentId ?? null,
        variantId:       experimentContext?.variantId    ?? null,
      });
    },
    [tenantId, pageId, funnelContext, experimentContext],
  );

  // Navigate to next funnel step
  const onFunnelNext = useCallback(() => {
    if (funnelContext?.nextStepUrl) {
      window.location.href = funnelContext.nextStepUrl;
    } else if (funnelContext?.onSuccess?.url) {
      window.location.href = funnelContext.onSuccess.url;
    }
  }, [funnelContext]);

  // PageRenderer.FunnelContext expects onSuccess/onSkip as functions (or null).
  // We adapt the API-level plain-object shape here.
  const rendererFunnelContext = funnelContext
    ? {
        funnelId:        funnelContext.funnelId,
        funnelStepOrder: funnelContext.funnelStepOrder,
        nextStepUrl:     funnelContext.nextStepUrl,
        isLastStep:      funnelContext.isLastStep,
        onSuccess:       null as null,
        onSkip:          null as null,
      }
    : null;

  return (
    <PageRenderer
      tree={tree}
      data={data}
      funnelContext={rendererFunnelContext}
      onEvent={onEvent}
      onFunnelNext={onFunnelNext}
    />
  );
}
