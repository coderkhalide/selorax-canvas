import { headers } from "next/headers";
import { DashboardPage } from "../components/dashboard/DashboardPage";

export default async function Home() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") ?? "store_001";
  return <DashboardPage tenantId={tenantId} />;
}
