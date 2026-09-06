/**
 * Shared queries — FTS5 full-text search and transverse UNION.
 *
 * These queries span all entity tables and cannot be attributed to a single
 * table file. FTS5 indexes 6 tables; `mailboxLast24h` UNIONs 5 tables.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { QueryBuilder } from "@ytrynot/qb";
import { tables } from "../definitions/schema.js";

export function compileSharedQueries(db: GovDb): Pick<IQueries,
  | "fts5Search" | "fts5SearchByType" | "mailboxLast24h"
> {
  const d = tables.decisions.names;
  const a = tables.actions.names;
  const i = tables.ideas.names;
  const p = tables.problems.names;
  const le = tables.log_entries.names;
  return {
    // ── FTS5 search (raw SQL — qb escape hatch, FTS5 MATCH + snippet) ──
    fts5Search: db.prepare(
      `SELECT entity_type, entity_id, title, snippet(search_index, 3, '<mark>', '</mark>', '...', 32) AS snippet
       FROM search_index
       WHERE search_index MATCH @query
       ORDER BY rank
       LIMIT 50`,
    ),
    fts5SearchByType: db.prepare(
      `SELECT entity_type, entity_id, title, snippet(search_index, 3, '<mark>', '</mark>', '...', 32) AS snippet
       FROM search_index
       WHERE search_index MATCH @query AND entity_type = @entityType
       ORDER BY rank
       LIMIT 50`,
    ),

    // ── Transverse (UNION ALL via qb — each branch uses selectRaw + whereRaw) ──
    // Column names derived from defTable via .names.col.xxx — no hardcoded identifiers.
    mailboxLast24h: db.prepare(
      QueryBuilder.unionAll(
        tables.decisions.req
          .selectRaw(`'decision' AS type, ${d.col.id}, ${d.col.title}, '' AS body, ${d.col.updated_at} AS timestamp`)
          .whereRaw(`${d.col.updated_at} >= datetime('now', ? || ' hours')`),
        tables.actions.req
          .selectRaw(`'action' AS type, ${a.col.id}, ${a.col.title}, COALESCE(${a.col.body}, '') AS body, ${a.col.updated_at} AS timestamp`)
          .whereRaw(`${a.col.updated_at} >= datetime('now', ? || ' hours')`),
        tables.ideas.req
          .selectRaw(`'idea' AS type, ${i.col.id}, ${i.col.title}, COALESCE(${i.col.short_desc}, '') AS body, ${i.col.updated_at} AS timestamp`)
          .whereRaw(`${i.col.updated_at} >= datetime('now', ? || ' hours')`),
        tables.problems.req
          .selectRaw(`'problem' AS type, ${p.col.id}, ${p.col.title}, COALESCE(${p.col.description}, '') AS body, ${p.col.updated_at} AS timestamp`)
          .whereRaw(`${p.col.updated_at} >= datetime('now', ? || ' hours')`),
        tables.log_entries.req
          .selectRaw(`'log_entry' AS type, CAST(${le.col.id} AS TEXT) AS id, COALESCE(${le.col.subject}, '') AS title, COALESCE(${le.col.body}, '') AS body, ${le.col.timestamp}`)
          .whereRaw(`${le.col.timestamp} >= datetime('now', ? || ' hours')`),
      ).orderByRaw("timestamp DESC").toSQL(),
    ),
  };
}
