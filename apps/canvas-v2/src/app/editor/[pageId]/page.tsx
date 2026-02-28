import { headers } from "next/headers";
import FunnelBuilder from "@/components/FunnelBuilder";
import { StdbSyncProvider } from "@/providers/StdbSyncProvider";

interface PageParams {
  params: Promise<{ pageId: string }>;
}

export default async function EditorPage({ params }: PageParams) {
  const { pageId } = await params;
  const headerStore = await headers();
  const tenantId = headerStore.get("x-tenant-id") ?? "store_001";

  return (
    <StdbSyncProvider pageId={pageId} tenantId={tenantId}>
      <FunnelBuilder pageId={pageId} tenantId={tenantId} />
    </StdbSyncProvider>
  );
}
