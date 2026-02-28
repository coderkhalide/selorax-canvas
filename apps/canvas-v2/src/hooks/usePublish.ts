"use client";
import { useState, useCallback } from "react";

export type PublishStatus = "idle" | "publishing" | "success" | "error";

export function usePublish(pageId: string | undefined, tenantId: string | undefined) {
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const publish = useCallback(async (): Promise<boolean> => {
    if (!pageId || !tenantId) {
      setError("Missing pageId or tenantId");
      return false;
    }
    setStatus("publishing");
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Publish failed: ${res.status}`);
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      setError(msg);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
      return false;
    }
  }, [backendUrl, pageId, tenantId]);

  return { publish, status, error };
}
