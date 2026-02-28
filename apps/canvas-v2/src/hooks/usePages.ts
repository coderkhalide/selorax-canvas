"use client";
import { useState, useEffect, useCallback } from "react";

export interface Page {
  id: string;
  title: string | null;
  slug: string;
  type: string;
  updatedAt: string;
  publishedVersionId: string | null;
}

export function usePages(tenantId: string) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/api/pages`, {
        headers: { "x-tenant-id": tenantId },
      });
      if (!res.ok) throw new Error(`Failed to fetch pages: ${res.status}`);
      const data = await res.json();
      setPages(data.pages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, tenantId]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const createPage = useCallback(async (title: string, type: string): Promise<Page | null> => {
    try {
      const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const res = await fetch(`${backendUrl}/api/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-id": tenantId },
        body: JSON.stringify({ title, type, slug: `${slug}-${Date.now()}` }),
      });
      if (!res.ok) throw new Error(`Failed to create page: ${res.status}`);
      const data = await res.json();
      const newPage: Page = data.page;
      setPages((prev) => [newPage, ...prev]);
      return newPage;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    }
  }, [backendUrl, tenantId]);

  return { pages, loading, error, createPage, refetch: fetchPages };
}
