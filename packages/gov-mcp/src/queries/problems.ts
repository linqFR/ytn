/**
 * Problem queries — CRUD, seq, count, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileProblemQueries(db: GovDb): Pick<IQueries,
  | "getProblemById" | "getProblemBySeq" | "listProblems" | "nextProblemSeq"
  | "countProblemsByScope" | "insertProblem" | "updateProblemStatus"
  | "reportProblemsByDate" | "reportAllProblems"
> {
  const t = tables;
  const p = t.problems.names;
  const es = t.entity_scopes.names;
  return {
    getProblemById: db.prepare(t.problems.getById),
    getProblemBySeq: db.prepare(t.problems.req.select().where([p.col.seq]).toSQL()),
    listProblems: db.prepare(t.problems.req.select().orderBy(p.col.seq, "DESC").limit(100).toSQL()),
    nextProblemSeq: db.prepare(
      t.problems.req.selectRaw(`COALESCE(MAX(${p.col.seq}), 0) + 1 AS next_seq`).toSQL(),
    ),
    countProblemsByScope: db.prepare(
      t.problems.req.count().whereRaw(`${p.col.id} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = 'problem' AND ${es.col.scope_id} = @scope)`).toSQL(),
    ),
    insertProblem: db.prepare(t.problems.insert),
    updateProblemStatus: db.prepare(
      t.problems.req.update(p.col.status, p.col.fix, p.col.root_cause, p.col.wontfix_reason, p.col.fixed_at, p.col.tested, p.col.updated_at).whereRaw(`${p.col.id} = @id`).toSQL(),
    ),
    reportProblemsByDate: db.prepare(
      t.problems.req.select(p.col.id, p.col.title, p.col.status, p.col.severity)
        .whereRaw(`${p.col.date} LIKE @date`).orderBy(p.col.seq, "ASC").toSQL(),
    ),
    reportAllProblems: db.prepare(
      t.problems.req.select(p.col.id, p.col.title, p.col.status, p.col.severity, p.col.type, p.col.linked_spec, p.col.linked_act, p.col.description, p.col.root_cause, p.col.fix, p.col.wontfix_reason, p.col.fast_track, p.col.tested, p.col.fixed_at)
        .orderBy(p.col.seq, "ASC").toSQL(),
    ),
  };
}
