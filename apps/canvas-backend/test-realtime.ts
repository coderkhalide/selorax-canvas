/**
 * Real-time collaboration test for SeloraX Canvas.
 *
 * Simulates two concurrent users on the same canvas:
 *   Client A — subscribes to canvas_node via WebSocket (mimics the browser dashboard)
 *   Client B — calls insert_node reducer via HTTP (mimics the AI agent / second user)
 *
 * Passes when Client A receives the row pushed by Client B without polling.
 */

import { DbConnection, tables } from './src/module_bindings/index.js';
import { callReducer, opt }     from './src/spacetime/client.js';
import * as dotenv              from 'dotenv';
import { resolve, dirname }     from 'path';
import { fileURLToPath }        from 'url';

// ─── Load env ────────────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dir, '../../.env') });

const STDB_WS  = process.env.SPACETIMEDB_URL!;       // wss://maincloud.spacetimedb.com
const STDB_DB  = process.env.SPACETIMEDB_DB_NAME!;   // selorax-canvas
const PAGE_ID  = 'cmm4ks5620008uyxxds9z24h0';        // r2-demo page
const TENANT   = 'store_001';
const TEST_ID  = `rt-test-${crypto.randomUUID()}`;   // unique so we know exactly which insert to watch

const TIMEOUT_MS = 12_000;

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║  SeloraX Real-Time Collaboration Test         ║');
console.log('╚═══════════════════════════════════════════════╝\n');
console.log(`STDB:     ${STDB_WS}`);
console.log(`Database: ${STDB_DB}`);
console.log(`Page:     ${PAGE_ID}`);
console.log(`Test ID:  ${TEST_ID}\n`);

async function run() {
  let clientAConn: DbConnection | null = null;
  let clientBConn: DbConnection | null = null;

  try {
    // ── Step 1: Client A subscribes ─────────────────────────────────────────
    console.log('── Step 1: Client A connecting and subscribing via WebSocket...');

    const receivedInsert = await new Promise<{ id: string; latencyMs: number }>((resolve, reject) => {
      let writeTimestamp = 0;
      let subscriptionReady = false;

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout after ${TIMEOUT_MS}ms — Client A never received the insert push`));
      }, TIMEOUT_MS);

      const connectionBuilder = DbConnection.builder()
        .withUri(STDB_WS)
        .withDatabaseName(STDB_DB)
        .onConnect((conn, identity, _token) => {
          clientAConn = conn;
          console.log(`   ✅ Client A connected  identity=${identity.toHexString().slice(0, 16)}...`);

          // ── Register insert callback BEFORE subscribing so we catch every push ──
          // This fires whenever SpacetimeDB pushes a new canvas_node row to this client.
          conn.db.canvas_node.onInsert((_ctx, row) => {
            if (row.id !== TEST_ID) return; // ignore pre-existing nodes
            const latencyMs = writeTimestamp > 0 ? Date.now() - writeTimestamp : -1;
            console.log(`\n   🔔 Client A received PUSH: node "${row.id}" type="${row.nodeType}"`);
            console.log(`   ⏱  Round-trip latency: ${latencyMs}ms (write → WebSocket push → JS callback)\n`);
            clearTimeout(timeout);
            resolve({ id: row.id, latencyMs });
          });

          // ── Subscribe to this page's nodes (camelCase field names from generated bindings) ──
          conn.subscriptionBuilder()
            .onApplied(async () => {
              subscriptionReady = true;
              console.log('   ✅ Client A subscription active (onApplied fired)');
              console.log(`      Watching canvas_node WHERE pageId='${PAGE_ID}' AND tenantId='${TENANT}'\n`);

              // ── Step 2: Client B writes a new node via HTTP reducer call ──────
              console.log('── Step 2: Client B writing new node via insert_node reducer (HTTP)...');
              writeTimestamp = Date.now();

              try {
                await callReducer('insert_node', {
                  id:                TEST_ID,
                  page_id:           PAGE_ID,
                  tenant_id:         TENANT,
                  node_type:         'element',
                  parent_id:         opt(null),
                  order:             `z${Date.now().toString(36)}`,
                  styles:            JSON.stringify({ fontSize: '14px', color: '#7C3AED' }),
                  props:             JSON.stringify({ tag: 'text', content: '[realtime-test] Client B wrote this' }),
                  settings:          JSON.stringify({}),
                  children_ids:      '[]',
                  component_url:     opt(null),
                  component_id:      opt(null),
                  component_version: opt(null),
                });
                console.log(`   ✅ Client B wrote node "${TEST_ID}" via HTTP`);
                console.log('   ⏳ Waiting for Client A to receive WebSocket push...\n');
              } catch (err) {
                clearTimeout(timeout);
                reject(err);
              }
            })
            .onError((_ctx, err) => {
              clearTimeout(timeout);
              reject(new Error(`Client A subscription error: ${err}`));
            })
            // Raw SQL subscription — DB columns are snake_case
            .subscribe([
              `SELECT * FROM canvas_node WHERE page_id = '${PAGE_ID}' AND tenant_id = '${TENANT}'`,
              `SELECT * FROM ai_operation WHERE page_id = '${PAGE_ID}' AND tenant_id = '${TENANT}'`,
            ]);
        })
        .onConnectError((_ctx, err) => {
          clearTimeout(timeout);
          reject(new Error(`Client A connect error: ${err}`));
        });

      connectionBuilder.build();
    });

    // ── Step 3: Verify result ─────────────────────────────────────────────────
    console.log('── Step 3: Verifying real-time delivery...');
    console.log(`   Node ID:  ${receivedInsert.id}`);
    console.log(`   Latency:  ${receivedInsert.latencyMs >= 0 ? receivedInsert.latencyMs + 'ms' : 'n/a (initial sync)'}`);

    // ── Step 4: Test style update propagation ────────────────────────────────
    console.log('\n── Step 4: Client B updates the node styles — testing update propagation...');

    let updateReceived = false;
    const updatePromise = new Promise<number>((res, rej) => {
      const t = setTimeout(() => rej(new Error('Update propagation timed out')), TIMEOUT_MS);
      const writeTs = Date.now();
      clientAConn!.db.canvas_node.onUpdate((_ctx, _old, newRow) => {
        if (newRow.id !== TEST_ID) return;
        clearTimeout(t);
        updateReceived = true;
        res(Date.now() - writeTs);
      });
    });

    await callReducer('update_node_styles', {
      node_id: TEST_ID,
      styles:  JSON.stringify({ fontSize: '16px', color: '#059669', fontWeight: 'bold' }),
    });
    console.log('   ✅ Client B called update_node_styles via HTTP');

    const updateLatency = await updatePromise;
    console.log(`   🔔 Client A received style UPDATE push in ${updateLatency}ms`);

    // ── Step 5: Cleanup — delete test node ───────────────────────────────────
    console.log('\n── Step 5: Cleanup — deleting test node...');
    await callReducer('delete_node_cascade', { node_id: TEST_ID });
    console.log('   ✅ Test node deleted');

    // ── Final report ──────────────────────────────────────────────────────────
    console.log('\n╔═══════════════════════════════════════════════╗');
    console.log('║  ✅  REAL-TIME COLLABORATION TEST PASSED      ║');
    console.log('╠═══════════════════════════════════════════════╣');
    console.log(`║  Insert push latency: ${String(receivedInsert.latencyMs + 'ms').padEnd(22)}║`);
    console.log(`║  Update push latency: ${String(updateLatency + 'ms').padEnd(22)}║`);
    console.log('║                                               ║');
    console.log('║  SpacetimeDB pushes writes to all            ║');
    console.log('║  subscribed clients instantly.                ║');
    console.log('║  Dashboard useTable() will reflect live.      ║');
    console.log('╚═══════════════════════════════════════════════╝\n');

    process.exit(0);

  } catch (err: any) {
    console.error('\n╔═══════════════════════════════════════════════╗');
    console.error('║  ❌  REAL-TIME TEST FAILED                    ║');
    console.error('╚═══════════════════════════════════════════════╝');
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    // Disconnect clients
    try { clientAConn?.disconnect(); } catch {}
    try { clientBConn?.disconnect(); } catch {}
  }
}

run();
