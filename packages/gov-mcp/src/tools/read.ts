/**
 * Read-only MCP tools — list, get, search, transverse queries.
 */

import { dna } from "@ytrynot/dna";
import { err, ok } from "./results.js";
import { toolMeta } from "./meta.js";
import { describeToolSignature } from "./describe-signature.js";
import { resolveScopeFilter } from "../helpers.js";
import { tables } from "../definitions/schema.js";
import { TESTED_STATUS, DECISION_STATUS, IDEA_STATUS } from "../definitions/enums.js";
import * as S from "../schemas/tool-inputs.js";
import type { IToolCtx, IToolResult } from "../types/types.ts";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

// ─── List tools ──────────────────────────────────────────────────────────────

export function listDecisions(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listDecisionsInput>,
): IToolResult {
  const res = S.listDecisionsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) { whereFields.push("status"); params.status = input.status; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "decision");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.decisions.req.select("id", "seq", "title", "status", "date", "decider");
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("date", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(
    `${rows.length} decision(s)`,
    { decisions: rows, count: rows.length },
  );
}

export function getDecision(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getDecisionInput>,
): IToolResult {
  const res = S.getDecisionInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getDecisionById.get({ id: input.id });
  if (!row) return err(`Decision ${input.id} not found`);
  const history = ctx.queries.getStatusHistory.all({ entity_type: "decision", entity_id: input.id });
  const supersedes = ctx.queries.getDecisionSupersedes.all({ superseding_id: input.id });
  const scopes = ctx.queries.getEntityScopes.all({ entity_type: "decision", entity_id: input.id });
  return ok(`Decision ${input.id}`, { decision: row, history, supersedes, scopes });
}

export function listActions(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listActionsInput>,
): IToolResult {
  const res = S.listActionsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) { whereFields.push("status"); params.status = input.status; }
  if (input.owner) { whereFields.push("owner"); params.owner = input.owner; }
  if (input.priority) { whereFields.push("priority"); params.priority = input.priority; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "action");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.actions.req.select("id", "seq", "title", "status", "owner", "priority");
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("seq", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} action(s)`, { actions: rows, count: rows.length });
}

export function getAction(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getActionInput>,
): IToolResult {
  const res = S.getActionInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getActionById.get({ id: input.id });
  if (!row) return err(`Action ${input.id} not found`);
  const deps = ctx.queries.getActionDependencies.all({ action_id: input.id });
  const pbLinks = ctx.queries.getProblemActionsByAction.all({ action_id: input.id });
  const wsLinks = ctx.queries.getActionWorkstreams.all({ action_id: input.id });
  const history = ctx.queries.getStatusHistory.all({ entity_type: "action", entity_id: input.id });
  const scopes = ctx.queries.getEntityScopes.all({ entity_type: "action", entity_id: input.id });
  return ok(`Action ${input.id}`, {
    action: row,
    dependencies: deps,
    problemLinks: pbLinks,
    workstreamLinks: wsLinks,
    history,
    scopes,
  });
}

export function listIdeas(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listIdeasInput>,
): IToolResult {
  const res = S.listIdeasInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) { whereFields.push("status"); params.status = input.status; }
  if (input.package) { whereFields.push("package"); params.package = input.package; }
  if (input.priority) { whereFields.push("priority"); params.priority = input.priority; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "idea");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.ideas.req.select("id", "seq", "title", "status", "package", "priority");
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("seq", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} idea(s)`, { ideas: rows, count: rows.length });
}

export function getIdea(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getIdeaInput>,
): IToolResult {
  const res = S.getIdeaInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getIdeaById.get({ id: input.id });
  if (!row) return err(`Idea ${input.id} not found`);
  const promotedTo = row.promoted_to
    ? ctx.queries.getDecisionById.get({ id: row.promoted_to as string })
    : null;
  const scopes = ctx.queries.getEntityScopes.all({ entity_type: "idea", entity_id: input.id });
  return ok(`Idea ${input.id}`, { idea: row, promotedTo, scopes });
}

export function listProblems(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listProblemsInput>,
): IToolResult {
  const res = S.listProblemsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) { whereFields.push("status"); params.status = input.status; }
  if (input.severity) { whereFields.push("severity"); params.severity = input.severity; }
  if (input.type) { whereFields.push("type"); params.type = input.type; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "problem");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.problems.req.select("id", "seq", "title", "status", "severity", "type");
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("seq", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} problem(s)`, { problems: rows, count: rows.length });
}

export function getProblem(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getProblemInput>,
): IToolResult {
  const res = S.getProblemInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getProblemById.get({ id: input.id });
  if (!row) return err(`Problem ${input.id} not found`);
  const actions = ctx.queries.getProblemActions.all({ problem_id: input.id });
  const history = ctx.queries.getStatusHistory.all({ entity_type: "problem", entity_id: input.id });
  const scopes = ctx.queries.getEntityScopes.all({ entity_type: "problem", entity_id: input.id });
  return ok(`Problem ${input.id}`, { problem: row, actions, history, scopes });
}

export function listSpecs(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listSpecsInput>,
): IToolResult {
  const res = S.listSpecsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) { whereFields.push("status"); params.status = input.status; }
  if (input.package) { whereFields.push("package"); params.package = input.package; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "spec");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.specs.req.select("id", "filename", "package", "version", "status");
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("updated_at", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} spec(s)`, { specs: rows, count: rows.length });
}

export function getSpec(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getSpecInput>,
): IToolResult {
  const res = S.getSpecInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getSpecById.get({ id: input.id });
  if (!row) return err(`Spec ${input.id} not found`);
  const scopes = ctx.queries.getEntityScopes.all({ entity_type: "spec", entity_id: input.id });
  return ok(`Spec ${input.id}`, { spec: row, scopes });
}

export function listScopes(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listScopesInput>,
): IToolResult {
  const res = S.listScopesInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.parent) { whereFields.push("parent"); params.parent = input.parent; }
  let builder = tables.scopes.req.select();
  if (whereFields.length > 0) builder = builder.where(whereFields);
  const sql = builder.orderBy("sort_order", "ASC").toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} scope(s)`, { scopes: rows, count: rows.length });
}

export function getScope(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getScopeInput>,
): IToolResult {
  const res = S.getScopeInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getScopeById.get({ id: input.id });
  if (!row) return err(`Scope ${input.id} not found`);
  const counts = {
    decisions: ctx.queries.countDecisionsByScope.get({ scope: input.id }),
    actions: ctx.queries.countActionsByScope.get({ scope: input.id }),
    ideas: ctx.queries.countIdeasByScope.get({ scope: input.id }),
    problems: ctx.queries.countProblemsByScope.get({ scope: input.id }),
  };
  return ok(`Scope ${input.id}`, { scope: row, counts });
}

// ─── Log entry tools ─────────────────────────────────────────────────────────

export function listLogEntries(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listLogEntriesInput>,
): IToolResult {
  const res = S.listLogEntriesInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.date) { whereFields.push("date"); params.date = input.date; }
  if (input.type) { whereFields.push("type"); params.type = input.type; }
  if (input.refId) { whereFields.push("ref_id"); params.ref_id = input.refId; }
  let scopeClause: string | null = null;
  if (input.scope) {
    const resolved = resolveScopeFilter(ctx, input.scope, input.withChildren, "log_entry", "CAST(id AS TEXT)");
    scopeClause = resolved.clause;
    Object.assign(params, resolved.params);
  }
  let builder = tables.log_entries.req.select();
  if (whereFields.length > 0) builder = builder.where(whereFields);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("id", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  return ok(`${rows.length} log entr(ies)`, { entries: rows, count: rows.length });
}

export function getLastLogEntry(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getLastLogEntryInput>,
): IToolResult {
  const res = S.getLastLogEntryInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const row = ctx.queries.getLastLogEntryByRef.get({ ref_id: input.refId });
  if (!row) return err(`No log entry found for ref_id=${input.refId}`);
  return ok(`Last log entry for ${input.refId}`, { entry: row });
}

export function getThread(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getThreadInput>,
): IToolResult {
  const res = S.getThreadInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const rows = ctx.queries.getThreadEntries.all({ thread_id: input.threadId });
  if (rows.length === 0) return err(`Thread ${input.threadId} not found or empty`);
  return ok(`Thread ${input.threadId} (${rows.length} entries)`, {
    thread_id: input.threadId,
    entries: rows,
  });
}

// ─── Search ──────────────────────────────────────────────────────────────────

export function searchMailbox(
  ctx: IToolCtx,
  input: dna.infer<typeof S.searchMailboxInput>,
): IToolResult {
  const res = S.searchMailboxInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const entityType = input.entityType ?? "all";
  let results = entityType === "all"
    ? ctx.queries.fts5Search.all({ query: input.query })
    : ctx.queries.fts5SearchByType.all({ query: input.query, entityType });

  // Post-FTS5 scope filtering via entity_scopes
  if (input.scope) {
    let scopeSet: Set<string>;
    if (input.withChildren) {
      const childIds = ctx.queries.scopeTree
        .all({ scope: input.scope })
        .map((r) => (r as { id: string }).id);
      scopeSet = new Set(childIds.length > 0 ? childIds : [input.scope]);
    } else {
      scopeSet = new Set([input.scope]);
    }
    results = results.filter((r) => {
      const et = r.entity_type;
      // Map FTS entity_type to entity_scopes entity_type
      const esType = et === "log_entry" ? "log_entry" : et;
      const idExpr = et === "log_entry" ? r.entity_id : r.entity_id;
      const scopes = ctx.queries.getEntityScopes.all({ entity_type: esType, entity_id: idExpr });
      return scopes.some((s) => scopeSet.has(s.scope_id));
    });
  }

  return ok(`${results.length} search result(s)`, { results, count: results.length });
}

// ─── Transverse queries ──────────────────────────────────────────────────────

export function mailboxLast24h(
  ctx: IToolCtx,
  input: dna.infer<typeof S.mailboxLast24hInput>,
): IToolResult {
  const res = S.mailboxLast24hInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const hours = -(input.hours ?? 24);
  let rows = ctx.queries.mailboxLast24h.all(
    String(hours),
    String(hours),
    String(hours),
    String(hours),
    String(hours),
  );

  // Post-query scope filtering via entity_scopes (UNION query cannot join entity_scopes)
  if (input.scope) {
    let scopeSet: Set<string>;
    if (input.withChildren) {
      const childIds = ctx.queries.scopeTree
        .all({ scope: input.scope })
        .map((r) => (r as { id: string }).id);
      scopeSet = new Set(childIds.length > 0 ? childIds : [input.scope]);
    } else {
      scopeSet = new Set([input.scope]);
    }
    // Map UNION 'type' column to entity_scopes entity_type
    const typeMap: Record<string, string> = {
      decision: "decision",
      action: "action",
      idea: "idea",
      problem: "problem",
      log_entry: "log_entry",
    };
    rows = rows.filter((r) => {
      const et = typeMap[r.type as string] ?? r.type as string;
      const scopes = ctx.queries.getEntityScopes.all({ entity_type: et, entity_id: String(r.id) });
      return scopes.some((s) => scopeSet.has(s.scope_id));
    });
  }

  return ok(`${rows.length} item(s) in the last ${input.hours ?? 24}h`, {
    timeline: rows,
    count: rows.length,
  });
}

export function getDecisionHistory(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getDecisionHistoryInput>,
): IToolResult {
  const res = S.getDecisionHistoryInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const dec = ctx.queries.getDecisionById.get({ id: input.id });
  if (!dec) return err(`Decision ${input.id} not found`);
  const acts = ctx.queries.getActionsBySource.all({ source: input.id });
  const ideas = ctx.queries.getIdeasByPromotedTo.all({ promoted_to: input.id });
  const history = ctx.queries.getStatusHistory.all({ entity_type: "decision", entity_id: input.id });
  return ok(`Decision history for ${input.id}`, {
    decision: dec,
    actions: acts,
    ideas,
    history,
  });
}

export function getActionLineage(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getActionLineageInput>,
): IToolResult {
  const res = S.getActionLineageInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const act = ctx.queries.getActionById.get({ id: input.id });
  if (!act) return err(`Action ${input.id} not found`);
  const sourceDec = act.source
    ? ctx.queries.getDecisionById.get({ id: act.source as string })
    : null;
  const deps = ctx.queries.getActionDependencies.all({ action_id: input.id });
  const pbLinks = ctx.queries.getProblemActionsByAction.all({ action_id: input.id });
  const history = ctx.queries.getStatusHistory.all({ entity_type: "action", entity_id: input.id });
  return ok(`Action lineage for ${input.id}`, {
    action: act,
    sourceDecision: sourceDec,
    dependencies: deps,
    problemLinks: pbLinks,
    history,
  });
}

export function getOpenActions(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getOpenActionsInput>,
): IToolResult {
  const res = S.getOpenActionsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const rows = input.priority
    ? ctx.queries.getOpenActionsByPriority.all({ priority: input.priority })
    : ctx.queries.getOpenActions.all();
  return ok(`${rows.length} open action(s)`, { actions: rows, count: rows.length });
}

export function getHandoff(ctx: IToolCtx): IToolResult {
  const openActions = ctx.queries.getOpenActionsForHandoff.all();

  const pendingDecisions = ctx.db.prepare(
    tables.decisions.req.select("id", "title", "status")
      .whereRaw(`status = '${DECISION_STATUS.Proposed}'`).orderBy("date", "DESC").toSQL(),
  ).all();

  // Problems by severity — whereIn for status NOT IN + whereRaw for severity
  const criticalPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereRaw("severity = 'CRITICAL' AND status NOT IN ('fixed', 'wontfix')").toSQL(),
  ).all();
  const highPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereRaw("severity = 'HIGH' AND status NOT IN ('fixed', 'wontfix')").toSQL(),
  ).all();
  const mediumPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereRaw("severity = 'MEDIUM' AND status NOT IN ('fixed', 'wontfix')").toSQL(),
  ).all();

  const rawIdeas = ctx.db.prepare(
    tables.ideas.req.select("id", "title")
      .whereRaw(`status = '${IDEA_STATUS.raw}'`).orderBy("seq", "DESC").toSQL(),
  ).all();

  // tested: UNION ALL across 3 tables — qb escape hatch (no UNION support)
  // Filter: entities with tested status indicating test activity (partially or success)
  const testedActiveClause = `tested NOT IN ('${TESTED_STATUS.no_need}', '${TESTED_STATUS.not_ready}')`;
  const toTest = ctx.db.prepare(
    `SELECT 'action' AS entity_type, id AS entity_id, title AS reason FROM actions WHERE ${testedActiveClause}
     UNION ALL
     SELECT 'problem' AS entity_type, id AS entity_id, title AS reason FROM problems WHERE ${testedActiveClause}
     UNION ALL
     SELECT 'idea' AS entity_type, id AS entity_id, title AS reason FROM ideas WHERE ${testedActiveClause}`,
  ).all();

  const archItems = ctx.db.prepare(
    tables.log_entries.req.select("id", "type", "subject")
      .whereRaw("type = 'architectural'").orderBy("id", "DESC").limit(20).toSQL(),
  ).all();
  return ok("Handoff snapshot", {
    date: new Date().toISOString().slice(0, 10),
    open_actions: openActions,
    pending_decisions: pendingDecisions,
    active_problems: {
      critical: criticalPbs,
      high: highPbs,
      medium: mediumPbs,
    },
    raw_ideas: rawIdeas,
    to_test: toTest,
    architectural_items: archItems,
  });
}

export function auditConsistency(
  ctx: IToolCtx,
  input: dna.infer<typeof S.auditConsistencyInput>,
): IToolResult {
  const res = S.auditConsistencyInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  // Resolve scope filter set (for post-query filtering)
  let scopeSet: Set<string> | null = null;
  if (input.scope) {
    if (input.withChildren) {
      const childIds = ctx.queries.scopeTree
        .all({ scope: input.scope })
        .map((r) => (r as { id: string }).id);
      scopeSet = new Set(childIds.length > 0 ? childIds : [input.scope]);
    } else {
      scopeSet = new Set([input.scope]);
    }
  }

  /** Filter items by scope set (post-query, via entity_scopes lookup). */
  const filterByScope = <T extends Record<string, unknown>>(
    items: T[],
    entityType: string,
    idField: string,
  ): T[] => {
    if (!scopeSet) return items;
    return items.filter((item) => {
      const entityId = String(item[idField] ?? "");
      if (!entityId) return true;
      const scopes = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
      return scopes.some((s) => scopeSet!.has(s.scope_id));
    });
  };

  const findings: { check: string; severity: string; items: unknown[] }[] = [];

  const ideaImplDecNotAccepted = filterByScope(
    ctx.queries.auditIdeaImplDecNotAccepted.all() as Record<string, unknown>[],
    "idea", "idea_id",
  ) as typeof ctx.queries.auditIdeaImplDecNotAccepted.all extends () => infer R ? R : never;
  if (ideaImplDecNotAccepted.length > 0) {
    findings.push({
      check: "IDEA implemented ↔ DEC non-Accepted",
      severity: "warning",
      items: ideaImplDecNotAccepted,
    });
  }

  const actDonePbOpen = filterByScope(
    ctx.queries.auditActDonePbOpen.all() as Record<string, unknown>[],
    "action", "action_id",
  ) as typeof ctx.queries.auditActDonePbOpen.all extends () => infer R ? R : never;
  if (actDonePbOpen.length > 0) {
    findings.push({
      check: "ACT done ↔ PB still open",
      severity: "warning",
      items: actDonePbOpen,
    });
  }

  const actPendingStale = filterByScope(
    ctx.queries.auditActPendingStale.all() as Record<string, unknown>[],
    "action", "id",
  ) as typeof ctx.queries.auditActPendingStale.all extends () => infer R ? R : never;
  if (actPendingStale.length > 0) {
    findings.push({
      check: "ACT pending stale",
      severity: "info",
      items: actPendingStale,
    });
  }

  const pbPartialNoToTest = filterByScope(
    ctx.queries.auditPbPartialNoToTest.all() as Record<string, unknown>[],
    "problem", "id",
  ) as typeof ctx.queries.auditPbPartialNoToTest.all extends () => infer R ? R : never;
  if (pbPartialNoToTest.length > 0) {
    findings.push({
      check: `PB partial with tested != '${TESTED_STATUS.partially}'`,
      severity: "warning",
      items: pbPartialNoToTest,
    });
  }

  const actDoneNoEvidence = filterByScope(
    ctx.queries.auditActDoneNoEvidence.all() as Record<string, unknown>[],
    "action", "id",
  ) as typeof ctx.queries.auditActDoneNoEvidence.all extends () => infer R ? R : never;
  if (actDoneNoEvidence.length > 0) {
    findings.push({
      check: "ACT done without evidence",
      severity: "error",
      items: actDoneNoEvidence,
    });
  }

  const pbFixedNoFix = filterByScope(
    ctx.queries.auditPbFixedNoFix.all() as Record<string, unknown>[],
    "problem", "id",
  ) as typeof ctx.queries.auditPbFixedNoFix.all extends () => infer R ? R : never;
  if (pbFixedNoFix.length > 0) {
    findings.push({
      check: "PB fixed without fix",
      severity: "error",
      items: pbFixedNoFix,
    });
  }

  const summary = {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  return ok(
    `Audit: ${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.info} info`,
    { findings, summary },
  );
}

export function whoami(
  ctx: IToolCtx,
  input: dna.infer<typeof S.whoamiInput>,
): IToolResult {
  const res = S.whoamiInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const writer = ctx.queries.getWriterByNanoid.get({ nanoid: input.nanoid });
  if (!writer) return err(`Writer not found for nanoid ${input.nanoid}`);
  return ok(`Writer ${writer.id}`, { writer });
}

/** List all writers — never returns nanoid. Optional filters by role and scope. */
export function listWriters(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listWritersInput>,
): IToolResult {
  const res = S.listWritersInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const cols = ["id", "role", "responsibility", "default_scope", "display_name", "objective", "expertise", "prohibitions", "created_at"];
  let sql = tables.writers.req.select(cols);
  if (input.role) sql = sql.where({ col: "role", param: "role" });
  if (input.scope) sql = sql.where({ col: "default_scope", param: "scope" });
  const writers = ctx.db.prepare(sql.orderBy("created_at", "ASC").toSQL()).all({
    ...(input.role && { role: input.role }),
    ...(input.scope && { scope: input.scope }),
  });
  return ok(`${writers.length} writer(s)`, { writers });
}

/** Help / instructions — returns available tools and usage from toolMeta. */
export function help(
  ctx: IToolCtx,
  input: dna.infer<typeof S.helpInput>,
): IToolResult {
  const res = S.helpInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const categories: Array<{ key: string; label: string }> = [
    { key: "writers", label: "Writers & Identity" },
    { key: "read", label: "Read & Browse" },
    { key: "search", label: "Search & Transverse" },
    { key: "write", label: "Write & Mutations" },
    { key: "reports", label: "Reports & Export" },
    { key: "system", label: "System" },
  ];
  const lines: string[] = ["# Governance MCP — Tools Reference", ""];
  lines.push("## Getting Started", "");
  lines.push("Before you can write anything, you MUST register yourself as a writer:");
  lines.push("1. Call `register_me` (or `register_writer`) with your chosen `id`, your `role` (\"admin\" or \"agent\"), and optional profile fields.");
  lines.push("2. The response contains your `nanoid` — a secret token. **Save both your `id` and your `nanoid`** in a secure location.");
  lines.push("3. Use the `nanoid` as the `nanoid` parameter for all write operations (create_decision, create_action, append_log_entry, correct, etc.).");
  lines.push("4. Use `whoami` with your `nanoid` to retrieve your profile at any time.");
  lines.push("5. `list_writers` shows other writers' profiles but never returns their nanoids.");
  lines.push("");
  lines.push("## How-To: Common Workflows", "");
  lines.push("**Start a discussion:** `append_log_entry({ type: \"question\", scope, subject, body })` → reply with `append_log_entry({ type: \"answer\", replyTo: <id>, body })` → read with `get_thread({ threadId: <id> })`.");
  lines.push("");
  lines.push("**Propose & accept a decision:** `create_decision({ title, decider, scope })` → `update_decision_status({ id, newStatus: \"Accepted\" })`.");
  lines.push("");
  lines.push("**Create & track an action:** `create_action({ title, source: \"DEC-NNNN\", source_type: \"decision\", scope })` → `update_action_status({ id, newStatus: \"in_progress\" })` → `update_action_status({ id, newStatus: \"done\", evidence: \"...\" })`.");
  lines.push("");
  lines.push("**Report & fix a problem:** `create_problem({ title, severity, type, scope })` → `update_problem_status({ id, newStatus: \"fixed\", fix: \"...\" })`. Link to actions with `link_problem_action`.");
  lines.push("");
  lines.push("**Promote an idea:** `create_idea({ title, scope })` → `create_decision({ title, decider, scope })` → `update_idea_status({ id, newStatus: \"promoted\", promotedTo: \"DEC-NNNN\" })`.");
  lines.push("");
  lines.push("**Add metadata to any entity:** `add_free_field({ entityType, entityId, key, format, value })` → retrieve with `get_free_fields({ entityType, entityId })`. Soft-delete with `deprecate_free_field({ id })`.");
  lines.push("");
  lines.push("**Correct a field:** `correct({ entityType, entityId, field, newValue, reason })`. Cannot correct log_entries — use `append_log_entry({ type: \"correction\", replyTo: <id> })` instead.");
  lines.push("");
  lines.push("**Handoff between sessions:** `get_handoff()` for a snapshot → `append_log_entry({ type: \"handoff\", body: \"...\" })` for context.");
  lines.push("");
  lines.push("**Search:** `search_mailbox({ query })` — full-text across all entities. Filter with `entityType`.");
  lines.push("");
  lines.push("**Pull unread updates:** `get_updates({ nanoid })` — returns log entries since your last read. Cursor is advanced automatically.");
  lines.push("");
  lines.push("## Recommended Reading", "");
  lines.push("Call `get_doc({ filename: \"<doc>\" })` to read any of these. Pick by intent:");
  lines.push("");
  lines.push("| If you want to… | Read |");
  lines.push("|------------------|------|");
  lines.push("| Start writing immediately (register, create, update, handoff) | `how-to.md` |");
  lines.push("| See the full tool reference with parameters and return shapes | `tools.md` |");
  lines.push("| Understand the architecture, SQLite-as-truth, table layout | `architecture.md` |");
  lines.push("| Understand status cascades (done → partial, superseded → reopened) | `cascades.md` |");
  lines.push("| Write or manage spec-annexes (lifecycle, versioning, drift) | `spec-guide.md` |");
  lines.push("| Add custom metadata to entities (free fields, FTS indexing) | `free-fields.md` |");
  lines.push("| Use the package as a TypeScript library (programmatic API) | `api.md` |");
  lines.push("| Back up or restore the SQLite database | `backup-restore.md` |");
  lines.push("| Migrate from Markdown files to SQLite (one-shot import) | `migration.md` |");
  lines.push("");
  lines.push("Or call `list_docs({})` to see all available documents with their titles.");
  lines.push("");
  for (const cat of categories) {
    const tools = Object.entries(toolMeta).filter(([, m]) => m.category === cat.key);
    if (tools.length === 0) continue;
    lines.push(`## ${cat.label}`, "");
    for (const [name, meta] of tools) {
      lines.push(`### ${name}`, "");
      lines.push(meta.description, "");

      // Auto-generated Parameters: block from DNA schema (.describe() metadata)
      const sig = describeToolSignature(name);
      if (sig) {
        lines.push(sig, "");
      }

      // Usage prose (intro + Returns: + notes — no Parameters: block)
      lines.push(meta.usage, "");
    }
  }
  lines.push("## Security: nanoid", "");
  lines.push("- The nanoid is a secret token. Never share it in logs, decisions, or public channels.");
  lines.push("- **Keep your writer `id` and your `nanoid` together** — you need both to identify yourself and authenticate writes.");
  lines.push("- `list_writers` shows writer profiles but never returns nanoids.");
  lines.push("- `whoami` requires the nanoid to retrieve your own profile.");
  lines.push("- If you lose your nanoid, an admin can read it directly from the database, or you can register a new writer.");
  return ok(lines.join("\n"));
}

export function getUpdates(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getUpdatesInput>,
): IToolResult {
  const res = S.getUpdatesInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const writer = ctx.queries.getWriterByNanoid.get({ nanoid: input.nanoid });
  if (!writer) return err(`Writer not found for nanoid ${input.nanoid}`);
  const cursor = (writer.last_read_log_id as number) ?? 0;
  const limit = input.limit ?? 50;
  const limitPlus1 = limit + 1;

  // qb escape hatch: id > @cursor uses whereRaw (qb .where() only supports =).
  // type/scope filters are also via whereRaw to keep a single conditional chain.
  // Scope filtering uses entity_scopes subquery (log_entries no longer has a scope column).
  let rawCond = "id > @cursor";
  if (input.type) rawCond += " AND type = @type";
  let scopeParams: Record<string, unknown> = {};
  if (input.scope) {
    if (input.withChildren) {
      const childIds = ctx.queries.scopeTree
        .all({ scope: input.scope })
        .map((r) => (r as { id: string }).id);
      if (childIds.length === 0) {
        rawCond += " AND CAST(id AS TEXT) IN (SELECT entity_id FROM entity_scopes WHERE entity_type = 'log_entry' AND scope_id = @scope)";
        scopeParams = { scope: input.scope };
      } else {
        const placeholders = childIds.map((_, i) => `@scope_${i}`).join(", ");
        rawCond += ` AND CAST(id AS TEXT) IN (SELECT entity_id FROM entity_scopes WHERE entity_type = 'log_entry' AND scope_id IN (${placeholders}))`;
        childIds.forEach((id, i) => { scopeParams[`scope_${i}`] = id; });
      }
    } else {
      rawCond += " AND CAST(id AS TEXT) IN (SELECT entity_id FROM entity_scopes WHERE entity_type = 'log_entry' AND scope_id = @scope)";
      scopeParams = { scope: input.scope };
    }
  }
  const sql = tables.log_entries.req.select()
    .whereRaw(rawCond).orderBy("id", "ASC").limit(limitPlus1).toSQL();
  const params: Record<string, unknown> = { cursor, ...scopeParams };
  if (input.type) params.type = input.type;

  // Read + cursor update must be transactional to avoid skipping entries
  // inserted between the SELECT and the cursor advancement.
  const { rows, hasMore, entries, newCursor } = ctx.db.transaction(() => {
    const rows = ctx.db.prepare(sql).all(params);
    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;
    const newCursor = entries.length > 0
      ? (entries[entries.length - 1].id as number)
      : cursor;
    ctx.queries.updateWriterCursor.run({ last_read_log_id: newCursor, nanoid: input.nanoid });
    return { rows, hasMore, entries, newCursor };
  });

  const maxRow = ctx.queries.getMaxLogEntryId.get({}) as { max_id: number | null } | undefined;
  const maxId = maxRow?.max_id ?? 0;
  const remaining = hasMore ? Math.max(0, maxId - newCursor) : 0;

  const summary = hasMore
    ? `${entries.length} entries returned (cursor: ${newCursor}/${maxId}). ${remaining} remaining — call get_updates again with the same nanoid to fetch the next batch.`
    : `${entries.length} entries returned (cursor: ${newCursor}/${maxId}). All caught up.`;

  return ok(summary, {
    entries,
    new_cursor: newCursor,
    max_entry_id: maxId,
    has_more: hasMore,
    remaining,
  });
}

// ─── Free field tools ────────────────────────────────────────────────────────

export function getFreeFields(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getFreeFieldsInput>,
): IToolResult {
  const res = S.getFreeFieldsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const query = input.includeDeprecated
    ? ctx.queries.getFreeFieldsAll
    : ctx.queries.getFreeFields;
  const rows = query.all({
    entity_type: input.entityType,
    entity_id: input.entityId,
  });
  return ok(`${rows.length} free field(s) for ${input.entityType} ${input.entityId}`, {
    freeFields: rows,
    count: rows.length,
  });
}

// ─── Documentation tools ─────────────────────────────────────────────────────

/**
 * Resolve the docs directory relative to this module.
 *
 * In source (tsx): `import.meta.dirname` is `src/tools/`, so docs is `../../docs`.
 * In bundled output (tsup): `import.meta.dirname` is `dist/`, so docs is `../docs`.
 * The `files` array in package.json includes "docs" so the directory is published.
 */
function resolveDocsDir(): string {
  const dir = import.meta.dirname;
  // Try source layout first (src/tools → ../../docs), then bundled (dist → ../docs)
  const candidates = [
    path.resolve(dir, "..", "..", "docs"),
    path.resolve(dir, "..", "docs"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fall back to the source-relative path even if it doesn't exist yet
  return candidates[0];
}

/** Extract the first H1 title from Markdown content, or null if none. */
function extractMarkdownTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/** List all .md files in the package docs/ directory. */
export function listDocs(
  _ctx: IToolCtx,
  input: dna.infer<typeof S.listDocsInput>,
): IToolResult {
  const res = S.listDocsInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const docsDir = resolveDocsDir();
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(docsDir, { withFileTypes: true });
  } catch {
    return err(`Documentation directory not found: ${docsDir}`);
  }
  const docs = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => {
      const fullPath = path.join(docsDir, e.name);
      const stat = fs.statSync(fullPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      return {
        filename: e.name,
        size: stat.size,
        title: extractMarkdownTitle(content),
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
  return ok(`${docs.length} document(s)`, { docs, count: docs.length });
}

/** Get the content of a specific documentation file. */
export function getDoc(
  _ctx: IToolCtx,
  input: dna.infer<typeof S.getDocInput>,
): IToolResult {
  const res = S.getDocInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const docsDir = resolveDocsDir();
  const filePath = path.join(docsDir, input.filename);
  // Defense-in-depth: verify the resolved path is still inside docsDir
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(path.resolve(docsDir) + path.sep)) {
    return err(`Path traversal rejected: ${input.filename}`);
  }
  if (!fs.existsSync(filePath)) {
    return err(`Document not found: ${input.filename}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const stat = fs.statSync(filePath);
  return ok(`Document: ${input.filename}`, {
    filename: input.filename,
    content,
    size: stat.size,
  });
}
