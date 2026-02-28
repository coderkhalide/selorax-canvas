import { headers } from "next/headers";
import { notFound } from "next/navigation";
import FunnelBuilder from "@/components/FunnelBuilder";
import { StdbSyncProvider } from "@/providers/StdbSyncProvider";

interface PageParams {
  params: Promise<{ pageId: string }>;
}

export default async function EditorPage({ params }: PageParams) {
  const { pageId } = await params;

  // Validate pageId to prevent SQL injection in STDB subscription
  // cuid format: c + 24 alphanumeric chars; UUID: 36 chars with hyphens
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(pageId)) {
    notFound();
  }

  const headerStore = await headers();
  const tenantId = headerStore.get("x-tenant-id") ?? "store_001";

  return (
    <StdbSyncProvider pageId={pageId} tenantId={tenantId}>
      <FunnelBuilder pageId={pageId} tenantId={tenantId} />
    </StdbSyncProvider>
  );
}
