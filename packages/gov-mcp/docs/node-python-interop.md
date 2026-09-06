# Node-Only Scope and Python Future — @ytrynot/gov-mcp

## Current Scope: Node.js Only

The v0/v1 implementation of `@ytrynot/gov-mcp` is Node.js only:

- **Driver**: `better-sqlite3` (synchronous, Node-native)
- **Validation**: `@ytrynot/dna` (TypeScript/Node)
- **Query Builder**: `@ytrynot/qb` (TypeScript/Node)
- **MCP SDK**: `@modelcontextprotocol/sdk` (Node.js)
- **Tests**: Vitest (Node.js)

## Future Python Perspective

The architecture is designed to allow a future Python implementation that shares the same SQLite database:

### Shared Artifacts

The `schema/` directory contains language-agnostic SQL:

- `schema/schema.sql` — Full DDL (tables, indexes, FTS5)
- `schema/triggers.sql` — All triggers (cascade + FTS5 sync)

Only `workspace` is seeded at init. Other scopes are declared by the agent via the `create_scope` MCP tool.

A Python implementation can:
1. Open the same `.db` file (WAL mode allows concurrent access).
2. Apply the same schema and triggers from the SQL artifacts.
3. Implement the same MCP tools in Python.
4. Share test fixtures (JSON) for cross-language validation.

### Shared Test Fixtures

Test fixtures are planned as JSON files under `tests/integration/` and `tests/protocol/`:

- `cascade-act-done-pb.json`
- `cascade-act-done-idea.json`
- `cascade-dec-cancelled-idea.json`
- `cascade-spec-superseded-pb.json`
- `fk-constraints.json`
- `check-constraints.json`
- `wildcards-scope.json`
- `get-updates-cursor.json`
- `audit-consistency.json`

Each fixture contains:
- `setup`: SQL to prepare the database state
- `input`: Tool input parameters
- `expected`: Expected output structure

These fixtures can be consumed by both Node (Vitest) and Python (pytest) test runners.

### Concurrency

WAL mode + `busy_timeout = 5000` allows:
- Multiple readers from both Node and Python simultaneously.
- A single writer at a time (Node or Python).
- Automatic retry on lock contention for up to 5 seconds.

### Not Shared

- DNA schemas (`src/schemas/`) — Python would use its own validation (e.g., Pydantic).
- qb table definitions (`src/schema.ts`) — Python would use its own schema definitions.
- MCP tool handlers (`src/tools/`) — Python would implement its own handlers.
- Migration script — Python would implement its own Markdown parser.

## Roadmap

1. **v0 (current)**: Node.js only, SQLite, MCP server, 39 tools.
2. **v1**: Shared JSON test fixtures, cross-language validation.
3. **v2 (future)**: Python implementation sharing the same `.db` file.
