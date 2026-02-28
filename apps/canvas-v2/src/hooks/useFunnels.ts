"use client";
import { useState, useEffect, useCallback } from "react";

export interface FunnelStep {
  id: string;
  order: number;
  title: string | null;
  pageId: string;
  page?: { id: string; title: string | null; slug: string; type: string };
}

export interface Funnel {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  steps?: FunnelStep[];
}

export function useFunnels(tenantId: string) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchFunnels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/funnels`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch funnels: ${res.status}`);
      const data = await res.json();
      setFunnels(data.funnels ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => { fetchFunnels(); }, [fetchFunnels]);

  const createFunnel = useCallback(async (name: string): Promise<Funnel | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/funnels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`Failed to create funnel: ${res.status}`);
      const data = await res.json();
      const newFunnel: Funnel = data.funnel;
      setFunnels((prev) => [newFunnel, ...prev]);
      return newFunnel;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId]);

  const addStep = useCallback(async (funnelId: string, title: string, pageType: string): Promise<FunnelStep | null> => {
    try {
      const res = await fetch(`${backendUrl}/api/funnels/${funnelId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ title, pageType }),
      });
      if (!res.ok) throw new Error(`Failed to add step: ${res.status}`);
      const data = await res.json();
      await fetchFunnels();
      return data.step;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId, fetchFunnels]);

  return { funnels, loading, error, createFunnel, addStep, refetch: fetchFunnels };
}
