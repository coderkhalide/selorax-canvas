// spacetime/src/module.ts
// Deploy:   spacetime publish --server maincloud selorax-canvas
// Bindings: make stdb-generate (runs spacetime generate for all 3 apps)

import { schema, table, t } from 'spacetimedb/server';

// ── Tables ───────────────────────────────────────────────────────────

// One row per canvas node. Flat — tree rebuilt client-side with buildTree().
// SpacetimeDB broadcasts row-level diffs — surgical real-time updates.
const canvas_node = table(
  {
    name: 'canvas_node',
    public: true,
    indexes: [
      { name: 'idx_node_page',        algorithm: 'btree', columns: ['page_id'] },
      { name: 'idx_node_parent',      algorithm: 'btree', columns: ['parent_id'] },
      { name: 'idx_node_page_tenant', algorithm: 'btree', columns: ['page_id', 'tenant_id'] },
    ],
  },
  {
    id:                t.string().primaryKey(),
    page_id:           t.string(),
    tenant_id:         t.string(),        // isolation key — always present
    node_type:         t.string(),        // 'layout' | 'element' | 'component' | 'slot'
    parent_id:         t.string().optional(),
    order:             t.string(),        // fractional index e.g. "a0", "a1", "a0V"
    styles:            t.string(),        // JSON — ResponsiveStyles
    props:             t.string(),        // JSON — ElementProps
    settings:          t.string(),        // JSON — ComponentSettings
    children_ids:      t.string(),        // JSON — string[]
    component_url:     t.string().optional(),
    component_id:      t.string().optional(),
    component_version: t.string().optional(),
    locked_by:         t.string().optional(),
    locked_at:         t.u64().optional(),
    updated_by:        t.string(),
    updated_at:        t.u64(),
  }
);

// One row per connected user. Shows live collaboration presence.
// Deleted on disconnect. AI gets its own cursor (user_type: 'ai').
const active_cursor = table(
  {
    name: 'active_cursor',
    public: true,
    indexes: [
      { name: 'idx_cursor_page',   algorithm: 'btree', columns: ['page_id'] },
      { name: 'idx_cursor_tenant', algorithm: 'btree', columns: ['tenant_id'] },
    ],
  },
  {
    user_id:          t.string().primaryKey(),
    page_id:          t.string(),
    tenant_id:        t.string(),
    x:                t.f32(),
    y:                t.f32(),
    selected_node_id: t.string().optional(),
    hovered_node_id:  t.string().optional(),
    user_name:        t.string(),
    user_color:       t.string(),
    user_type:        t.string(),         // 'human' | 'ai'
    user_avatar:      t.string().optional(),
    last_seen:        t.u64(),
  }
);

// One row per AI agent invocation. Progress streamed in real-time.
// All canvas clients see AI status live via subscription.
const ai_operation = table(
  {
    name: 'ai_operation',
    public: true,
    indexes: [
      { name: 'idx_aiop_page',   algorithm: 'btree', columns: ['page_id'] },
      { name: 'idx_aiop_tenant', algorithm: 'btree', columns: ['tenant_id'] },
    ],
  },
  {
    id:              t.string().primaryKey(),
    page_id:         t.string(),
    tenant_id:       t.string(),
    status:          t.string(),    // 'thinking'|'planning'|'building'|'applying'|'done'|'error'
    prompt:          t.string(),
    current_action:  t.string(),    // live status text shown on canvas
    progress:        t.u8(),        // 0–100
    plan:            t.string().optional(),
    nodes_created:   t.string(),    // JSON string[]
    nodes_modified:  t.string(),    // JSON string[]
    nodes_deleted:   t.string(),    // JSON string[]
    error_message:   t.string().optional(),
    started_at:      t.u64(),
    completed_at:    t.u64().optional(),
  }
);

// One row per AI-generated component. preview_code streamed live chunk by chunk.
const component_build = table(
  {
    name: 'component_build',
    public: true,
    indexes: [
      { name: 'idx_build_op',     algorithm: 'btree', columns: ['operation_id'] },
      { name: 'idx_build_tenant', algorithm: 'btree', columns: ['tenant_id'] },
    ],
  },
  {
    id:            t.string().primaryKey(),
    tenant_id:     t.string(),
    operation_id:  t.string(),
    status:        t.string(),      // 'generating'|'compiling'|'uploading'|'ready'|'error'
    description:   t.string(),
    progress:      t.u8(),
    preview_code:  t.string().optional(),   // appended chunk by chunk
    compiled_url:  t.string().optional(),
    component_id:  t.string().optional(),
    created_at:    t.u64(),
    completed_at:  t.u64().optional(),
  }
);

// ── Schema ───────────────────────────────────────────────────────────
const spacetimedb = schema({ canvas_node, active_cursor, ai_operation, component_build });
export default spacetimedb;

// ── Reducers ─────────────────────────────────────────────────────────
// Reducers are the ONLY way to write data. They run as atomic transactions.
// Clients call via generated bindings: conn.reducers.insert_node(...)
// The export name IS the reducer name — no string needed.

export const insert_node = spacetimedb.reducer({
  id: t.string(), page_id: t.string(), tenant_id: t.string(),
  node_type: t.string(), parent_id: t.string().optional(), order: t.string(),
  styles: t.string(), props: t.string(), settings: t.string(), children_ids: t.string(),
  component_url: t.string().optional(), component_id: t.string().optional(),
  component_version: t.string().optional(),
}, (ctx, args) => {
  ctx.db.canvas_node.insert({
    ...args,
    locked_by: null, locked_at: null,
    updated_by: ctx.sender.toHexString(),
    updated_at: BigInt(Date.now()),
  });
});

export const update_node_styles = spacetimedb.reducer({
  node_id: t.string(), styles: t.string(),   // JSON patch — deep merged
}, (ctx, { node_id, styles }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.styles || '{}'), ...JSON.parse(styles) };
  ctx.db.canvas_node.id.update({
    ...node, styles: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

export const update_node_props = spacetimedb.reducer({
  node_id: t.string(), props: t.string(),
}, (ctx, { node_id, props }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.props || '{}'), ...JSON.parse(props) };
  ctx.db.canvas_node.id.update({
    ...node, props: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

export const update_node_settings = spacetimedb.reducer({
  node_id: t.string(), settings: t.string(),
}, (ctx, { node_id, settings }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const merged = { ...JSON.parse(node.settings || '{}'), ...JSON.parse(settings) };
  ctx.db.canvas_node.id.update({
    ...node, settings: JSON.stringify(merged),
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

export const move_node = spacetimedb.reducer({
  node_id: t.string(), new_parent_id: t.string(), new_order: t.string(),
}, (ctx, { node_id, new_parent_id, new_order }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  ctx.db.canvas_node.id.update({
    ...node, parent_id: new_parent_id, order: new_order,
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

export const delete_node_cascade = spacetimedb.reducer({
  node_id: t.string(),
}, (ctx, { node_id }) => {
  function cascade(id: string) {
    for (const child of ctx.db.canvas_node.iter()) {
      if (child.parent_id === id) cascade(child.id);
    }
    const node = ctx.db.canvas_node.id.find(id);
    if (node) ctx.db.canvas_node.id.delete(node);
  }
  cascade(node_id);
});

export const lock_node = spacetimedb.reducer({
  node_id: t.string(),
}, (ctx, { node_id }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  const caller = ctx.sender.toHexString();
  if (node.locked_by && node.locked_by !== caller) return;
  ctx.db.canvas_node.id.update({
    ...node, locked_by: caller, locked_at: BigInt(Date.now()),
    updated_by: caller, updated_at: BigInt(Date.now()),
  });
});

export const unlock_node = spacetimedb.reducer({
  node_id: t.string(),
}, (ctx, { node_id }) => {
  const node = ctx.db.canvas_node.id.find(node_id);
  if (!node) return;
  if (node.locked_by !== ctx.sender.toHexString()) return;
  ctx.db.canvas_node.id.update({
    ...node, locked_by: null, locked_at: null,
    updated_by: ctx.sender.toHexString(), updated_at: BigInt(Date.now()),
  });
});

export const upsert_cursor = spacetimedb.reducer({
  page_id: t.string(), tenant_id: t.string(),
  x: t.f32(), y: t.f32(),
  selected_node_id: t.string().optional(), hovered_node_id: t.string().optional(),
  user_name: t.string(), user_color: t.string(), user_type: t.string(),
  user_avatar: t.string().optional(),
}, (ctx, args) => {
  const user_id  = ctx.sender.toHexString();
  const existing = ctx.db.active_cursor.user_id.find(user_id);
  const now      = BigInt(Date.now());
  if (existing) {
    ctx.db.active_cursor.user_id.update({ ...existing, ...args, user_id, last_seen: now });
  } else {
    ctx.db.active_cursor.insert({ ...args, user_id, last_seen: now });
  }
});

export const move_cursor = spacetimedb.reducer({
  x: t.f32(), y: t.f32(),
  selected_node_id: t.string().optional(), hovered_node_id: t.string().optional(),
}, (ctx, args) => {
  const cursor = ctx.db.active_cursor.user_id.find(ctx.sender.toHexString());
  if (!cursor) return;
  ctx.db.active_cursor.user_id.update({ ...cursor, ...args, last_seen: BigInt(Date.now()) });
});

export const remove_cursor = spacetimedb.reducer({}, ctx => {
  const cursor = ctx.db.active_cursor.user_id.find(ctx.sender.toHexString());
  if (cursor) ctx.db.active_cursor.user_id.delete(cursor);
});

export const create_ai_operation = spacetimedb.reducer({
  id: t.string(), page_id: t.string(), tenant_id: t.string(), prompt: t.string(),
}, (ctx, args) => {
  ctx.db.ai_operation.insert({
    ...args, status: 'thinking', current_action: 'Understanding your request...',
    progress: 0, plan: null,
    nodes_created: '[]', nodes_modified: '[]', nodes_deleted: '[]',
    error_message: null, started_at: BigInt(Date.now()), completed_at: null,
  });
});

export const update_ai_operation = spacetimedb.reducer({
  op_id: t.string(), status: t.string(), current_action: t.string(), progress: t.u8(),
}, (ctx, { op_id, status, current_action, progress }) => {
  const op = ctx.db.ai_operation.id.find(op_id);
  if (!op) return;
  const isDone = status === 'done' || status === 'error';
  ctx.db.ai_operation.id.update({
    ...op, status, current_action, progress,
    completed_at: isDone ? BigInt(Date.now()) : op.completed_at,
  });
});

export const create_component_build = spacetimedb.reducer({
  id: t.string(), tenant_id: t.string(), operation_id: t.string(), description: t.string(),
}, (ctx, args) => {
  ctx.db.component_build.insert({
    ...args, status: 'generating', progress: 0,
    preview_code: null, compiled_url: null, component_id: null,
    created_at: BigInt(Date.now()), completed_at: null,
  });
});

export const stream_component_code = spacetimedb.reducer({
  build_id: t.string(), code_chunk: t.string(),
}, (ctx, { build_id, code_chunk }) => {
  const build = ctx.db.component_build.id.find(build_id);
  if (!build) return;
  ctx.db.component_build.id.update({
    ...build, preview_code: (build.preview_code ?? '') + code_chunk,
  });
});

export const update_component_build = spacetimedb.reducer({
  build_id: t.string(), status: t.string(), progress: t.u8(),
  compiled_url: t.string().optional(), component_id: t.string().optional(),
}, (ctx, { build_id, status, progress, compiled_url, component_id }) => {
  const build  = ctx.db.component_build.id.find(build_id);
  if (!build) return;
  const isDone = status === 'ready' || status === 'error';
  ctx.db.component_build.id.update({
    ...build, status, progress,
    compiled_url: compiled_url ?? build.compiled_url,
    component_id: component_id ?? build.component_id,
    completed_at: isDone ? BigInt(Date.now()) : build.completed_at,
  });
});
