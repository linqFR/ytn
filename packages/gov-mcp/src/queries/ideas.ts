/**
 * Idea queries — CRUD, seq, count, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileIdeaQueries(db: GovDb): Pick<IQueries,
  | "getIdeaById" | "getIdeaBySeq" | "listIdeas" | "nextIdeaSeq"
  | "countIdeasByScope" | "insertIdea" | "updateIdeaStatus"
  | "reportIdeasByDate" | "reportAllIdeas"
> {
  const t = tables;
  const i = t.ideas.names;
  const es = t.entity_scopes.names;
  return {
    getIdeaById: db.prepare(t.ideas.getById),
    getIdeaBySeq: db.prepare(t.ideas.req.select().where([i.col.seq]).toSQL()),
    listIdeas: db.prepare(t.ideas.req.select().orderBy(i.col.seq, "DESC").limit(100).toSQL()),
    nextIdeaSeq: db.prepare(
      t.ideas.req.selectRaw(`COALESCE(MAX(${i.col.seq}), 0) + 1 AS next_seq`).toSQL(),
    ),
    countIdeasByScope: db.prepare(
      t.ideas.req.count().whereRaw(`${i.col.id} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = 'idea' AND ${es.col.scope_id} = @scope)`).toSQL(),
    ),
    insertIdea: db.prepare(t.ideas.insert),
    updateIdeaStatus: db.prepare(
      t.ideas.req.update(i.col.status, i.col.promoted_to, i.col.abandon_reason, i.col.updated_at).whereRaw(`${i.col.id} = @id`).toSQL(),
    ),
    reportIdeasByDate: db.prepare(
      t.ideas.req.select(i.col.id, i.col.title, i.col.status)
        .whereRaw(`${i.col.date} LIKE @date`).orderBy(i.col.seq, "ASC").toSQL(),
    ),
    reportAllIdeas: db.prepare(
      t.ideas.req.select(i.col.id, i.col.title, i.col.status, i.col.package, i.col.priority, i.col.promoted_to, i.col.short_desc, i.col.long_desc, i.col.abandon_reason, i.col.tested)
        .orderBy(i.col.seq, "ASC").toSQL(),
    ),
  };
}
