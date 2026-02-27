import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (process.env.MVP_MODE === 'true') {
    res.headers.set('x-tenant-id',   process.env.TENANT_ID!);
    res.headers.set('x-tenant-name', process.env.TENANT_NAME!);
    res.headers.set('x-tenant-plan', process.env.TENANT_PLAN ?? 'pro');
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
