import { useState, useEffect } from "react";

export interface PageSummary {
  id: string;
  title: string;
  slug: string;
  pageType: string;
}

export function usePageList(tenantId: string) {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const backend =
      process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
    setLoading(true);
    fetch(`${backend}/api/pages`, {
      headers: { "x-tenant-id": tenantId },
    })
      .then((r) => r.json())
      .then((data) => setPages(Array.isArray(data) ? data : []))
      .catch((err) => console.error("[usePageList]", err))
      .finally(() => setLoading(false));
  }, [tenantId]);

  return { pages, loading };
}
