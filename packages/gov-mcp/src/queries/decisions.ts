/**
 * Decision queries — CRUD, seq, count, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileDecisionQueries(db: GovDb): Pick<IQueries,
  | "getDecisionById" | "getDecisionBySeq" | "listDecisions" | "nextDecisionSeq"
  | "countDecisionsByScope" | "insertDecision" | "updateDecisionStatus"
  | "reportDecisionsByDate" | "reportAllDecisions"
  | "insertDecisionSupersedes" | "getDecisionSupersedes"
> {
  const t = tables;
  const d = t.decisions.names;
  const ds = t.decision_supersedes.names;
  const es = t.entity_scopes.names;
  return {
    getDecisionById: db.prepare(t.decisions.getById),
    getDecisionBySeq: db.prepare(t.decisions.req.select().where([d.col.seq]).toSQL()),
    listDecisions: db.prepare(t.decisions.req.select().orderBy(d.col.date, "DESC").limit(100).toSQL()),
    nextDecisionSeq: db.prepare(
      t.decisions.req.selectRaw(`COALESCE(MAX(${d.col.seq}), 0) + 1 AS next_seq`).toSQL(),
    ),
    countDecisionsByScope: db.prepare(
      t.decisions.req.count().whereRaw(`${d.col.id} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = 'decision' AND ${es.col.scope_id} = @scope)`).toSQL(),
    ),
    insertDecision: db.prepare(t.decisions.insert),
    updateDecisionStatus: db.prepare(
      t.decisions.req.update(d.col.status, d.col.updated_at).whereRaw(`${d.col.id} = @id`).toSQL(),
    ),
    reportDecisionsByDate: db.prepare(
      t.decisions.req.select(d.col.id, d.col.title, d.col.status)
        .whereRaw(`${d.col.date} LIKE @date`).orderBy(d.col.seq, "ASC").toSQL(),
    ),
    reportAllDecisions: db.prepare(
      t.decisions.req.select(d.col.id, d.col.title, d.col.status, d.col.date, d.col.decider, d.col.superseded_by, d.col.spec_ref, d.col.source, d.col.context, d.col.decision, d.col.consequences)
        .orderBy(d.col.seq, "ASC").toSQL(),
    ),
    insertDecisionSupersedes: db.prepare(t.decision_supersedes.insert),
    getDecisionSupersedes: db.prepare(
      t.decision_supersedes.req.select().where([ds.col.superseding_id]).toSQL(),
    ),
  };
}
