# Storefront — Production SSR

Port 3003. Next.js 14 App Router serving published pages with ISR.

## How It Works
1. Request hits `/` or `/products/shoes` or `/pages/about`
2. `resolvePageType(slug)` maps to `{ pageType, pageSlug }`
3. Fetch published page tree from backend: `GET /api/serve/:tenantId/:pageType/:slug`
4. Backend serves from Redis (HIT) or MySQL (MISS + cache-fill)
5. `<PageRenderer tree={tree} data={data} />` renders the node tree as HTML

## Page Type Routing
| URL | pageType | pageSlug |
|-----|----------|----------|
| / | home | index |
| /products/shoes | product | shoes |
| /pages/about | custom | about |
| /anything-else | custom | anything-else |

## ISR Revalidation
```typescript
fetch(`${BACKEND}/api/serve/...`, { next: { revalidate: 60 } })
```
Pages revalidate every 60 seconds. Cloudflare purges are triggered on publish.

## Graceful Degradation
If page not found or not published → returns a friendly "Page not published yet" message (no 404 crash).
If backend down → Next.js renders the cached version until it expires.

## Key Files
```
app/
  [[...slug]]/page.tsx   — Catch-all route, resolvePageType, fetch, render
```

## .env.local
```
BACKEND_URL=http://localhost:3001   (internal Docker: http://canvas-backend:3001)
TENANT_ID=store_001
TENANT_NAME=My Test Store
TENANT_DOMAIN=localhost:3003
```

## Dev
```bash
next dev -p 3003
```

## TODO: Experiment Variant Support
- Should read `x-visitor-id` cookie/header
- Check `exp:page:{tenantId}:{pageId}` Redis key for active experiments
- Assign visitor to variant, fetch variant tree
- Fire page_view via sendBeacon
(Phase 9 work — not yet implemented)
