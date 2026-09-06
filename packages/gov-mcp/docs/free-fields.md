# Free Fields

Free-form metadata fields that can be attached to any governance entity (decision, action, idea, problem, spec). Designed as an escape hatch for structured-but-flexible metadata that doesn't warrant a dedicated table column.

## Design Rationale

### Why a generic table instead of dedicated columns?

Adding a new metadata field (e.g. `required_role`, `instructions`, `sandbox_ref`) to an entity traditionally requires a schema migration: `ALTER TABLE actions ADD COLUMN ...`. This is costly, pollutes the table with sparse columns, and must be repeated for each entity type.

The `free_fields` table solves this by storing metadata as rows with a `key`, `format`, and `value`. New fields are added by inserting a row — no migration needed.

### Why soft delete instead of hard delete?

The package follows an append-only philosophy (`log_entries` and `status_history` are immutable). Free fields follow the same principle: deprecating a field preserves the trace that it existed, which is useful for auditability and for duplicating fields from past entities to new ones.

## Schema

```sql
CREATE TABLE free_fields (
  id          INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('decision','action','idea','problem','spec')),
  entity_id   TEXT NOT NULL,
  key         TEXT NOT NULL,
  format      TEXT NOT NULL CHECK(format IN ('md','json','link','url','text')),
  value       TEXT NOT NULL,
  fts_indexed INTEGER CHECK(fts_indexed IN (0, 1)),
  status      TEXT CHECK(status IN ('active','deprecated')),
  created_at  TEXT,
  updated_at  TEXT
);
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-incremented ID |
| `entity_type` | TEXT | Parent entity type: `decision`, `action`, `idea`, `problem`, `spec` |
| `entity_id` | TEXT | Parent entity ID (e.g. `DEC-0001`, `ACT-0001`) |
| `key` | TEXT | Field key (e.g. `required_role`, `instructions`, `sandbox_ref`) |
| `format` | TEXT | Value format: `md`, `json`, `link`, `url`, `text` |
| `value` | TEXT | Field value (string — JSON values are stringified) |
| `fts_indexed` | INTEGER | 1 = indexed in FTS5, 0 = not indexed. Default: 0 |
| `status` | TEXT | `active` or `deprecated`. Default: `active` |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### Indexes

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_free_fields_entity` | `entity_type`, `entity_id` | Fast lookup by entity |
| `idx_free_fields_key` | `key` | Fast lookup by key across all entities |

### Foreign Keys

`free_fields` does **not** have a foreign key on `entity_id` because the parent table is polymorphic (determined by `entity_type`). Referential integrity is the application's responsibility.

## Formats

| Format | Use case | Example value |
|--------|----------|---------------|
| `md` | Markdown instructions, notes | `## Steps\n1. Do thing\n2. Verify` |
| `json` | Structured data (roles, competencies, config) | `{"role":"devin-dna","skills":["codegen"]}` |
| `link` | Relative file path in the repo | `sandbox/test-tlm.mjs` |
| `url` | External URL | `https://github.com/ytrynot/ytn/pull/1` |
| `text` | Plain text | `Some note` |

The `format` column is informational — it tells consumers how to interpret `value`. The database does not validate the content against the format.

## MCP Tools

### `add_free_field`

Add a free-form metadata field to an entity.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nanoid` | string | yes | Writer token |
| `entityType` | enum | yes | `decision` \| `action` \| `idea` \| `problem` \| `spec` |
| `entityId` | string | yes | Entity ID (e.g. `DEC-0001`) |
| `key` | string | yes | Field key (1-100 chars) |
| `format` | enum | yes | `md` \| `json` \| `link` \| `url` \| `text` |
| `value` | string | yes | Field value (min 1 char) |
| `ftsIndexed` | boolean | no | Index in FTS5 search (default: false) |

**Returns:** `{ id: number, created: true }`

### `deprecate_free_field`

Soft-delete a free-form field. Marks `status = 'deprecated'` and updates `updated_at`. The field remains in the database.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nanoid` | string | yes | Writer token |
| `id` | integer | yes | Free field ID |

**Returns:** `{ id: number, deprecated: true }`

### `get_free_fields`

Retrieve free-form metadata fields for an entity.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityType` | enum | yes | `decision` \| `action` \| `idea` \| `problem` \| `spec` |
| `entityId` | string | yes | Entity ID |
| `includeDeprecated` | boolean | no | Include deprecated fields (default: false) |

**Returns:** `{ freeFields: IFreeFieldRow[], count: number }`

## FTS5 Integration

Three FTS5 sync triggers handle `free_fields` indexing:

| Trigger | Event | Condition | Action |
|---------|-------|-----------|--------|
| `trg_free_fields_fts_insert` | AFTER INSERT | `fts_indexed = 1 AND status = 'active'` | Insert into `search_index` |
| `trg_free_fields_fts_update` | AFTER UPDATE | (always) | Delete old + insert new (conditional) |
| `trg_free_fields_fts_delete` | AFTER DELETE | (always) | Delete from `search_index` |

### FTS row mapping

| `search_index` column | Source |
|----------------------|--------|
| `entity_type` | `'free_field'` (literal) |
| `entity_id` | `CAST(NEW.id AS TEXT)` |
| `title` | `NEW.key` |
| `body` | `NEW.value` |
| `scope` | Resolved from parent entity via `CASE NEW.entity_type ...` subquery |

### Scope resolution

The FTS trigger resolves the parent entity's scope via a `CASE` expression:

```sql
CASE NEW.entity_type
  WHEN 'decision' THEN (SELECT scope FROM decisions WHERE id = NEW.entity_id)
  WHEN 'action'   THEN (SELECT scope FROM actions   WHERE id = NEW.entity_id)
  WHEN 'idea'     THEN (SELECT scope FROM ideas     WHERE id = NEW.entity_id)
  WHEN 'problem'  THEN (SELECT scope FROM problems  WHERE id = NEW.entity_id)
  WHEN 'spec'     THEN (SELECT scope FROM specs     WHERE id = NEW.entity_id)
  ELSE ''
END
```

This allows `search_mailbox` with scope filtering to match free fields by their parent entity's scope.

### Deprecation and FTS

When a field is deprecated (`status` changes from `active` to `deprecated`):

1. The `trg_free_fields_fts_update` trigger fires.
2. The old row is deleted from `search_index`.
3. The new row is **not** re-inserted (because `NEW.fts_indexed = 1 AND NEW.status = 'active'` is false).
4. The field disappears from full-text search.

To find deprecated fields for duplication, use `get_free_fields({ includeDeprecated: true })`.

## Usage Examples

### Add instructions to an action

```
add_free_field({
  nanoid: "<token>",
  entityType: "action",
  entityId: "ACT-0001",
  key: "instructions",
  format: "md",
  value: "## Steps\n1. Read the spec\n2. Implement\n3. Test",
  ftsIndexed: true
})
```

### Add a required role to a decision

```
add_free_field({
  nanoid: "<token>",
  entityType: "decision",
  entityId: "DEC-0001",
  key: "required_role",
  format: "json",
  value: "{\"role\":\"devin-dna\",\"skills\":[\"codegen\",\"maranget\"]}",
  ftsIndexed: false
})
```

### Retrieve all fields (including deprecated)

```
get_free_fields({
  entityType: "action",
  entityId: "ACT-0001",
  includeDeprecated: true
})
```

### Deprecate a field

```
deprecate_free_field({
  nanoid: "<token>",
  id: 42
})
```

### Search for free fields via FTS

```
search_mailbox({
  query: "unique marker text"
})
```

Results with `entity_type: "free_field"` are matches from `free_fields` where `fts_indexed = 1` and `status = 'active'`.

## Query Implementation

### Prepared statements

| Query | SQL | Notes |
|-------|-----|-------|
| `insertFreeField` | QB-generated INSERT | Uses `tables.free_fields.insert` |
| `getFreeFields` | Raw SQL | `WHERE status = 'active'` filter — escape hatch |
| `getFreeFieldsAll` | Raw SQL | No status filter — for `includeDeprecated: true` |
| `deprecateFreeField` | Raw SQL | `UPDATE ... SET status = 'deprecated'` |

The `getFreeFields` and `getFreeFieldsAll` queries use raw SQL because the `status = 'active'` literal filter is simpler in raw SQL than via the QB `.where()` API (which would require a parameterized equality check).

## Testing

Tests are in `tests/free-fields.test.ts` (11 tests):

1. Add and retrieve a field
2. Add multiple fields to the same entity
3. Deprecate a field (soft delete)
4. Get fields returns empty for entity with no fields
5. Reject invalid format
6. Reject invalid nanoid
7. `fts_indexed` defaults to false
8. New field has `status = 'active'` by default
9. FTS trigger indexes when `fts_indexed = 1` and `status = 'active'`
10. FTS trigger does not index when `fts_indexed = 0`
11. FTS trigger removes index when field is deprecated
