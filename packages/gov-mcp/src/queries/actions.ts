/**
 * Action queries — CRUD, seq, count, open actions, junction tables, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";
import { QueryBuilder } from "@ytrynot/qb";
import { ACTION_STATUS } from "../definitions/enums.js";

export function compileActionQueries(db: GovDb): Pick<IQueries,
  | "getActionById" | "getActionBySeq" | "listActions" | "nextActionSeq"
  | "countActionsByScope" | "insertAction" | "updateActionStatus"
  | "getOpenActions" | "getOpenActionsByPriority" | "getOpenActionsForHandoff"
  | "getActionDependencies" | "insertActionDependency" | "insertActionDependencyOrIgnore"
  | "getActionWorkstreams" | "insertActionWorkstream" | "insertActionWorkstreamOrIgnore"
  | "checkActionDependencyExists" | "checkActionDependencyCycle"
  | "reportActionsByDate" | "reportAllActions"
> {
  const t = tables;
  const a = t.actions.names;
  const ad = t.action_dependencies.names;
  const aw = t.action_workstreams.names;
  const es = t.entity_scopes.names;
  return {
    getActionById: db.prepare(t.actions.getById),
    getActionBySeq: db.prepare(t.actions.req.select().where([a.col.seq]).toSQL()),
    listActions: db.prepare(t.actions.req.select().orderBy(a.col.seq, "DESC").limit(100).toSQL()),
    nextActionSeq: db.prepare(
      t.actions.req.selectRaw(`COALESCE(MAX(${a.col.seq}), 0) + 1 AS next_seq`).toSQL(),
    ),
    countActionsByScope: db.prepare(
      t.actions.req.count().whereRaw(`${a.col.id} IN (SELECT ${es.col.entity_id} FROM ${es.table} WHERE ${es.col.entity_type} = 'action' AND ${es.col.scope_id} = @scope)`).toSQL(),
    ),
    insertAction: db.prepare(t.actions.insert),
    updateActionStatus: db.prepare(
      t.actions.req.update(a.col.status, a.col.evidence, a.col.blockers, a.col.updated_at).whereRaw(`${a.col.id} = @id`).toSQL(),
    ),
    getOpenActions: db.prepare(
      t.actions.req.select().whereIn(a.col.status, [ACTION_STATUS.pending, ACTION_STATUS.in_progress, ACTION_STATUS.blocked])
        .orderByRaw(`CASE ${a.col.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, ${a.col.seq} ASC`)
        .toSQL(),
    ),
    getOpenActionsByPriority: db.prepare(
      t.actions.req.select().whereIn(a.col.status, [ACTION_STATUS.pending, ACTION_STATUS.in_progress, ACTION_STATUS.blocked]).where([a.col.priority])
        .orderByRaw(`CASE ${a.col.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, ${a.col.seq} ASC`)
        .toSQL(),
    ),
    getOpenActionsForHandoff: db.prepare(
      t.actions.req.select(a.col.id, a.col.title, a.col.priority, a.col.status)
        .whereIn(a.col.status, [ACTION_STATUS.pending, ACTION_STATUS.in_progress, ACTION_STATUS.blocked])
        .orderByRaw(`CASE ${a.col.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END`)
        .toSQL(),
    ),
    getActionDependencies: db.prepare(t.action_dependencies.req.select().where([ad.col.action_id]).toSQL()),
    insertActionDependency: db.prepare(t.action_dependencies.insert),
    insertActionDependencyOrIgnore: db.prepare(
      t.action_dependencies.req.insert(t.action_dependencies.cols).or("IGNORE").toSQL(),
    ),
    getActionWorkstreams: db.prepare(t.action_workstreams.req.select().where([aw.col.action_id]).toSQL()),
    insertActionWorkstream: db.prepare(t.action_workstreams.insert),
    insertActionWorkstreamOrIgnore: db.prepare(
      t.action_workstreams.req.insert(t.action_workstreams.cols).or("IGNORE").toSQL(),
    ),
    checkActionDependencyExists: db.prepare(
      t.action_dependencies.req.selectRaw("1")
        .where([ad.col.action_id, ad.col.depends_on])
        .limit(1).toSQL(),
    ),
    checkActionDependencyCycle: db.prepare(
      (() => {
        const seed = t.action_dependencies.req.select(ad.col.depends_on).where([ad.col.action_id]);
        const recur = t.action_dependencies.req.selectRaw(`${ad.table}.${ad.col.depends_on}`)
          .joinInner("deps", `${ad.table}.${ad.col.action_id} = deps.${ad.col.depends_on}`);
        return QueryBuilder.table("deps").selectRaw("1")
          .whereRaw(`deps.${ad.col.depends_on} = @target`)
          .limit(1).withRecursive("deps", seed.unionAll(recur)).toSQL();
      })(),
    ),
    reportActionsByDate: db.prepare(
      t.actions.req.select(a.col.id, a.col.title, a.col.status)
        .whereRaw(`${a.col.date} LIKE @date`).orderBy(a.col.seq, "ASC").toSQL(),
    ),
    reportAllActions: db.prepare(
      t.actions.req.select(a.col.id, a.col.title, a.col.status, a.col.owner, a.col.priority, a.col.source, a.col.source_type, a.col.spec_ref, a.col.body, a.col.evidence, a.col.blockers, a.col.defer_reason, a.col.cancel_reason, a.col.tested)
        .orderBy(a.col.seq, "ASC").toSQL(),
    ),
  };
}
