/**
 * Lifecycle queries — inter-table relations, cross-entity lookups, and audit checks.
 *
 * These queries span multiple tables (ideas↔decisions, problems↔actions,
 * actions self-reference) and represent the governance domain's business rules
 * rather than single-table CRUD.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";
import {
  IDEA_STATUS, ACTION_STATUS, PROBLEM_STATUS, SOURCE_TYPE, TESTED_STATUS,
  DECISION_STATUS,
} from "../definitions/enums.js";

export function compileLifecycleQueries(db: GovDb): Pick<IQueries,
  | "getDecisionsForIdea" | "getIdeasByPromotedTo" | "getActionsBySource"
  | "getProblemActions" | "getProblemActionsByAction" | "insertProblemAction" | "insertProblemActionOrIgnore"
  | "reportActionsBySource" | "reportIdeasByPromotedTo" | "reportProblemsByDecisionActions"
  | "auditIdeaImplDecNotAccepted" | "auditActDonePbOpen" | "auditActPendingStale"
  | "auditPbPartialNoToTest" | "auditActDoneNoEvidence" | "auditPbFixedNoFix"
> {
  const t = tables;
  const a = t.actions.names;
  const d = t.decisions.names;
  const p = t.problems.names;
  const i = t.ideas.names;
  const pa = t.problem_actions.names;
  return {
    getDecisionsForIdea: db.prepare(t.decisions.req.select().where([d.col.id]).toSQL()),
    getIdeasByPromotedTo: db.prepare(t.ideas.req.select().where([i.col.promoted_to]).toSQL()),
    getActionsBySource: db.prepare(
      t.actions.req.select().where([a.col.source]).orderBy(a.col.seq, "ASC").toSQL(),
    ),
    getProblemActions: db.prepare(t.problem_actions.req.select().where([pa.col.problem_id]).toSQL()),
    getProblemActionsByAction: db.prepare(
      t.problem_actions.req.select([pa.col.problem_id, pa.col.role]).where([pa.col.action_id]).toSQL(),
    ),
    insertProblemAction: db.prepare(t.problem_actions.insert),
    insertProblemActionOrIgnore: db.prepare(
      t.problem_actions.req.insert(t.problem_actions.cols).or("IGNORE").toSQL(),
    ),
    reportActionsBySource: db.prepare(
      t.actions.req.select(a.col.id, a.col.title, a.col.status, a.col.priority, a.col.owner)
        .where([a.col.source]).orderBy(a.col.seq, "ASC").toSQL(),
    ),
    reportIdeasByPromotedTo: db.prepare(
      t.ideas.req.select(i.col.id, i.col.title, i.col.status)
        .where([i.col.promoted_to]).orderBy(i.col.seq, "ASC").toSQL(),
    ),
    // Problems linked to a decision via its actions — subquery in WHERE
    // qb escape hatch: subquery in WHERE via whereRaw
    reportProblemsByDecisionActions: db.prepare(
      t.problems.req.select(p.col.id, p.col.title, p.col.status, p.col.severity)
        .whereRaw(
          `${p.col.id} IN (SELECT ${pa.col.problem_id} FROM ${pa.table} WHERE ${pa.col.action_id} IN (SELECT ${a.col.id} FROM ${a.table} WHERE ${a.col.source} = @source)) ` +
          `OR ${p.col.linked_act} IN (SELECT ${a.col.id} FROM ${a.table} WHERE ${a.col.source} = @source)`,
        ).orderBy(p.col.seq, "ASC").toSQL(),
    ),

    // ── Audit queries (qb-generated) ──
    auditIdeaImplDecNotAccepted: db.prepare(
      tables.ideas.req
        .as("i")
        .selectRaw(`i.${i.col.id} AS idea_id, i.${i.col.title} AS idea_title, i.${i.col.promoted_to}, d.${d.col.status} AS dec_status`)
        .joinInner(`${d.table} d`, `i.${i.col.promoted_to} = d.${d.col.id}`)
        .whereLiteral(`i.${i.col.status}`, `'${IDEA_STATUS.implemented}'`)
        .whereRaw(`d.${d.col.status} != '${DECISION_STATUS.Accepted}'`)
        .toSQL(),
    ),
    auditActDonePbOpen: db.prepare(
      tables.actions.req
        .as("a")
        .selectRaw(`a.${a.col.id} AS action_id, a.${a.col.title} AS action_title, p.${p.col.id} AS problem_id, p.${p.col.status} AS problem_status`)
        .joinInner(`${pa.table} pa`, `pa.${pa.col.action_id} = a.${a.col.id}`)
        .joinInner(`${p.table} p`, `pa.${pa.col.problem_id} = p.${p.col.id}`)
        .whereLiteral(`a.${a.col.status}`, `'${ACTION_STATUS.done}'`)
        .whereIn(`p.${p.col.status}`, [PROBLEM_STATUS.open, PROBLEM_STATUS.critical])
        .toSQL(),
    ),
    // EXISTS subquery — qb escape hatch (whereRaw for correlated EXISTS)
    auditActPendingStale: db.prepare(
      tables.actions.req
        .as("a1")
        .select(a.col.id, a.col.title, a.col.source)
        .whereLiteral(`a1.${a.col.status}`, `'${ACTION_STATUS.pending}'`)
        .whereLiteral(`a1.${a.col.source_type}`, `'${SOURCE_TYPE.decision}'`)
        .whereRaw(`EXISTS (SELECT 1 FROM ${a.table} a2 WHERE a2.${a.col.source} = a1.${a.col.source} AND a2.${a.col.source_type} = '${SOURCE_TYPE.decision}' AND a2.${a.col.status} = '${ACTION_STATUS.done}')`)
        .toSQL(),
    ),
    auditPbPartialNoToTest: db.prepare(
      tables.problems.req
        .select(p.col.id, p.col.title)
        .whereLiteral(p.col.status, `'${PROBLEM_STATUS.partial}'`)
        .whereRaw(`${p.col.tested} != '${TESTED_STATUS.partially}'`)
        .toSQL(),
    ),
    auditActDoneNoEvidence: db.prepare(
      tables.actions.req
        .select(a.col.id, a.col.title)
        .whereLiteral(a.col.status, `'${ACTION_STATUS.done}'`)
        .whereRaw(`(${a.col.evidence} IS NULL OR ${a.col.evidence} = '')`)
        .toSQL(),
    ),
    auditPbFixedNoFix: db.prepare(
      tables.problems.req
        .select(p.col.id, p.col.title)
        .whereLiteral(p.col.status, `'${PROBLEM_STATUS.fixed}'`)
        .whereRaw(`(${p.col.fix} IS NULL OR ${p.col.fix} = '')`)
        .toSQL(),
    ),
  };
}
