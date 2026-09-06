# Backup and Restore — @ytrynot/gov-mcp

## Backup

### Option 1: File Copy (Simplest)

SQLite is a single file. With WAL mode, you can safely copy the `.db` file while the database is in use:

```bash
cp packages/gov-mcp/data/ytn-gov-mcp.db backup/ytn-gov-mcp-$(date +%Y%m%d).db
```

For a consistent backup that includes WAL data, use the `.backup` SQLite CLI command:

```bash
sqlite3 packages/gov-mcp/data/ytn-gov-mcp.db ".backup backup/ytn-gov-mcp-$(date +%Y%m%d).db"
```

### Option 2: SQL Dump (via MCP tool)

Use the `export_dump` MCP tool to generate a SQL text dump (DDL + INSERTs):

```
mcp__ytn-gov-mcp__export_dump({})
```

Returns:
```json
{
  "sql": "-- Governance MCP database dump\nCREATE TABLE...\nINSERT INTO...",
  "tables": 13
}
```

Save the `sql` field to a file for a portable, text-based backup.

## Restore

### From File Copy

```bash
cp backup/ytn-gov-mcp-20260904.db packages/gov-mcp/data/ytn-gov-mcp.db
```

### From SQL Dump

```bash
sqlite3 packages/gov-mcp/data/ytn-gov-mcp.db < backup/dump.sql
```

Or via the driver:

```typescript
import { GovDb } from "@ytrynot/gov-mcp";

const db = GovDb.open({ dbPath: "path/to/new.db" });
db.exec(sqlDumpString);  // The full SQL dump from export_dump
db.close();
```

## Best Practices

- **Back up before migration** — always have a pre-migration backup.
- **Back up before bulk updates** — before running audit-driven corrections.
- **Test restores** — periodically verify that backups can be restored.
- **WAL checkpoint** — run `PRAGMA wal_checkpoint(TRUNCATE)` before file copy for a clean backup.
