"use client";
import { useState, useEffect, useCallback } from "react";

export interface RemoteComponent {
  id: string;
  name: string;
  category: string;
  thumbnailUrl: string | null;
  componentUrl: string;
}

export function useComponents(tenantId: string) {
  const [components, setComponents] = useState<RemoteComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchComponents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/components`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok)
        throw new Error(`Failed to fetch components: ${res.status}`);
      const data = await res.json();
      // Backend returns a bare array; handle both bare array and wrapped object
      const raw: any[] = Array.isArray(data) ? data : (data.components ?? []);
      setComponents(
        raw
          // Each component has a `versions` array (ordered by createdAt desc).
          // The first entry is the latest version. Filter out components without
          // any uploaded version (no compiledUrl yet).
          .filter((c: any) => c.versions?.[0]?.compiledUrl)
          .map((c: any) => ({
            id: c.id,
            name: c.name,
            category: c.category ?? "General",
            thumbnailUrl: c.thumbnailUrl ?? null,
            componentUrl: c.versions[0].compiledUrl as string,
          }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  return { components, loading, error, refetch: fetchComponents };
}
