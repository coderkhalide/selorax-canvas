// Node.js SpacetimeDB client — used by publish pipeline + AI tools
//
// READS  (getPageNodes): SpacetimeDB HTTP SQL API — simple POST with plain-text SQL.
// WRITES (callReducer):  SpacetimeDB HTTP REST API — POST /v1/database/{db}/call/{reducer}.
//
// SQL response format: array of result sets. Each result set has:
//   schema.elements[]: { name: { some: "col_name" }, algebraic_type: ... }
//   rows[][]:           column values in schema order
//   Option<T> encoded as [0, value] for Some and [1, []] for None.

import type { FlatNode } from '../utils/tree';

const STDB_URL    = process.env.SPACETIMEDB_URL!;      // wss://maincloud.spacetimedb.com
const STDB_NAME   = process.env.SPACETIMEDB_DB_NAME!;  // selorax-canvas

// HTTP endpoint (convert wss:// → https://)
const STDB_HTTP = STDB_URL.replace(/^wss?:\/\//, 'https://');

// Decode SpacetimeDB Option<T> from SQL response format: [0, value] = Some, [1, []] = None
function decodeOpt(val: any): string | null {
  if (!Array.isArray(val)) return null;
  const [variant, value] = val;
  return variant === 0 ? value : null;
}

// ── READ: HTTP SQL API ────────────────────────────────────────────────────────────────────
//
// POST /v1/database/{db}/sql — plain text SQL body, JSON response.
// Returns array of result sets. pageId and tenantId are cuid/UUID — safe to interpolate.

export async function getPageNodes(pageId: string, tenantId: string): Promise<FlatNode[]> {
  const sql = `SELECT * FROM canvas_node WHERE page_id = '${pageId}' AND tenant_id = '${tenantId}'`;
  const url = `${STDB_HTTP}/v1/database/${STDB_NAME}/sql`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: sql,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`STDB SQL query failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json() as Array<{ schema: { elements: any[] }; rows: any[][] }>;
  if (!data.length) return [];

  const { schema, rows } = data[0];

  // Build column name → index map
  const colIndex: Record<string, number> = {};
  schema.elements.forEach((el: any, i: number) => {
    const name: string = el.name?.some ?? el.name;
    if (name) colIndex[name] = i;
  });

  return rows.map((row): FlatNode => ({
    id:                row[colIndex['id']],
    page_id:           row[colIndex['page_id']],
    tenant_id:         row[colIndex['tenant_id']],
    node_type:         row[colIndex['node_type']],
    parent_id:         decodeOpt(row[colIndex['parent_id']]),
    order:             row[colIndex['order']],
    styles:            row[colIndex['styles']],
    props:             row[colIndex['props']],
    settings:          row[colIndex['settings']],
    children_ids:      row[colIndex['children_ids']],
    component_url:     decodeOpt(row[colIndex['component_url']]),
    component_id:      decodeOpt(row[colIndex['component_id']]),
    component_version: decodeOpt(row[colIndex['component_version']]),
  }));
}

// ── SpacetimeDB JSON option encoding ─────────────────────────────────────────────────────
// SpacetimeDB encodes Option<T> as a sum type: { "some": value } or null (for None).
// Use opt() when building reducer args with optional fields.
export function opt<T>(val: T | null | undefined): { some: T } | null {
  return val == null ? null : { some: val };
}

// ── WRITE: HTTP REST API (no WebSocket, simpler for server-side) ─────────────────────────
//
// SpacetimeDB REST: POST /v1/database/{db}/call/{reducer_name}
// Body: JSON array of reducer args in FIELD ORDER matching the reducer schema.
// Anonymous calls work on public databases.

export async function callReducer(
  name: string,              // snake_case: 'insert_node'
  args: Record<string, any>, // snake_case keys — mapped to positional args by field
): Promise<void> {
  const url = `${STDB_HTTP}/v1/database/${STDB_NAME}/call/${name}`;
  const body = JSON.stringify(args);

  // Retry once on 502 (SpacetimeDB Maincloud momentary restarts)
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.ok) return;

    // Retry on 502 after brief wait
    if (res.status === 502 && attempt === 0) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    const responseBody = await res.text().catch(() => '');
    throw new Error(`STDB reducer "${name}" failed (${res.status}): ${responseBody.slice(0, 200)}`);
  }
}
