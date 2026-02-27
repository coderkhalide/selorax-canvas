# SpacetimeDB Module

TypeScript module compiled to WASM and deployed to SpacetimeDB Maincloud.
Database name: `selorax-canvas` | Server: `maincloud`

## Tables (4)
| Table | Primary Key | Purpose |
|-------|-------------|---------|
| canvas_node | id (string) | One row per canvas node — flat, tree rebuilt client-side |
| active_cursor | user_id (string) | Live collaboration presence — deleted on disconnect |
| ai_operation | id (string) | AI agent progress — streamed in real-time |
| component_build | id (string) | AI component generation — preview_code appended chunk by chunk |

**Key rule**: Every table has `tenant_id` — it's the isolation key. Always filter on it.

## Reducers (15)
Node CRUD: `insert_node`, `update_node_styles`, `update_node_props`, `update_node_settings`, `move_node`, `delete_node_cascade`
Locking: `lock_node` (only locker can unlock), `unlock_node`
Presence: `upsert_cursor`, `move_cursor`, `remove_cursor`
AI ops: `create_ai_operation`, `update_ai_operation`
Component builds: `create_component_build`, `stream_component_code`

## API (spacetimedb/server v2)
```typescript
import { schema, table, t } from 'spacetimedb/server';

// Tables: named variables
const my_table = table(
  { name: 'my_table', public: true, indexes: [...] },
  { id: t.string().primaryKey(), field: t.string(), nullable_field: t.string().optional() }
);

// Schema: object syntax (not positional args)
const spacetimedb = schema({ my_table });
export default spacetimedb;

// Reducers: named exports (NOT string IDs)
export const my_reducer = spacetimedb.reducer(
  { arg1: t.string(), arg2: t.u64() },
  (ctx, args) => {
    ctx.db.my_table.insert({ id: args.arg1, field: args.arg2.toString() });
  }
);
```

## Critical Rules
- `.optional()` for nullable fields — `.nullable()` does NOT exist in v2
- Index names must be **globally unique** across ALL tables (prefix with table name: `idx_node_page`, `idx_cursor_page`, etc.)
- After any change to `module.ts`: run `make stdb-generate` AND `make stdb-publish`
- Bindings are AUTO-GENERATED — never edit files in `src/module_bindings/` directories

## Commands
```bash
make stdb-publish    # Deploy to Maincloud (auto-confirms)
make stdb-generate   # Regenerate TypeScript bindings for all 3 apps
```

## Bindings Output Locations
- `apps/canvas-backend/src/module_bindings/`
- `apps/canvas-dashboard/src/module_bindings/`
- `apps/preview-server/src/module_bindings/`

All listed in `.gitignore` — regenerate from scratch on each clone with `make stdb-generate`.
