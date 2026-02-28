import FunnelBuilder from "@/components/FunnelBuilder";
import { getProducts } from "../actions/product";
import { cookies } from "next/headers";

export default async function Home() {
  const cookieStore = await cookies();
  const storeId = cookieStore.get("store_id")?.value;
  const accessToken = cookieStore.get("access_token")?.value;

  let products = null;
  if (storeId && accessToken) {
    const result = await getProducts(storeId, accessToken);
    if (result.success) {
      products = result.data;
    }
  }

  return (
    <FunnelBuilder
      initialProducts={products}
      storeId={storeId}
      accessToken={accessToken}
      domain={cookieStore.get("domain")?.value}
      slug={cookieStore.get("slug")?.value}
    />
  );
}
