import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // On root path, handle legacy store_id/access_token redirect first
  if (url.pathname === "/") {
    const storeId = url.searchParams.get("store_id");
    const accessToken = url.searchParams.get("access_token");
    const domain = url.searchParams.get("domain");
    const slug = url.searchParams.get("slug");

    if (storeId || accessToken || domain || slug) {
      const response = NextResponse.redirect(new URL("/editor", request.url));
      if (storeId) response.cookies.set("store_id", storeId);
      if (accessToken) response.cookies.set("access_token", accessToken);
      if (domain) response.cookies.set("domain", domain);
      if (slug) response.cookies.set("slug", slug);
      return response;
    }
  }

  // Inject tenant header for canvas editor routes and dashboard (MVP mode)
  if (url.pathname.startsWith("/editor") || url.pathname === "/") {
    const tenantId = process.env.TENANT_ID ?? "store_001";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-id", tenantId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/editor/:path*"],
};
