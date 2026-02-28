"use client";
import { useState, useCallback, useEffect, useRef } from "react";

export type PublishStatus = "idle" | "publishing" | "success" | "error";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export function usePublish(pageId: string | undefined, tenantId: string | undefined) {
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const publish = useCallback(async (): Promise<boolean> => {
    if (!pageId || !tenantId) {
      setError("Missing pageId or tenantId");
      return false;
    }
    setStatus("publishing");
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/pages/${pageId}/publish`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Publish failed: ${res.status}`);
      }
      if (mountedRef.current) {
        setStatus("success");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) setStatus("idle");
        }, 3000);
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      if (mountedRef.current) {
        setError(msg);
        setStatus("error");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          if (mountedRef.current) setStatus("idle");
        }, 4000);
      }
      return false;
    }
  }, [pageId, tenantId]);

  return { publish, status, error };
}
