/**
 * FTS5 full-text search index DDL.
 *
 * The `search_index` virtual table is a SQLite FTS5 index synced by triggers
 * (see definitions/triggers.ts). It stores entity_type, entity_id, title,
 * and body for cross-entity search.
 *
 * Separated from the main schema because FTS5 virtual tables cannot be
 * expressed by the QB defTable API — this is a documented QB escape hatch.
 */
export const FTS5_DDL = `CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  entity_type,
  entity_id,
  title,
  body,
  tokenize = 'porter unicode61'
);`;
