/**
 * Read-only MCP tools — list, get, search, transverse queries.
 */

import { dna } from "@ytrynot/dna";
import { err, ok } from "./results.js";
import { toolMeta } from "./meta.js";
import { buildHelp } from "./describe-signature.js";
import { resolveScopeFilter, currentTimestamp } from "../helpers.js";
import { tables } from "../definitions/schema.js";
import { TESTED_STATUS, DECISION_STATUS, IDEA_STATUS, CATEGORY } from "../definitions/enums.js";
import * as S from "../schemas/tool-inputs.js";
import { helpInput } from "../definitions/tools.js";
import type { IToolCtx, OToolResult } from "../types/types.ts";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── List tools ──────────────────────────────────────────────────────────────

export function listDecisions(
  ctx: IToolCtx,
  input: dna.infer<typeof S.listDecisionsInput>,
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
  const res = S.listLogEntriesInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const whereFields: string[] = [];
  const params: Record<string, unknown> = {};
  let dateClause: string | null = null;
  if (input.date) {
    // Filter by day, not exact timestamp — entries may have non-midnight ISO dates
    dateClause = "date(date) = date(@date)";
    params.date = input.date;
  }
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
  if (dateClause) builder = builder.whereRaw(dateClause);
  if (scopeClause) builder = builder.whereRaw(scopeClause);
  const sql = builder.orderBy("id", "DESC").limit(input.limit ?? 100).toSQL();
  const rows = ctx.db.prepare(sql).all(params);
  // If nanoid is provided, advance the writer's read cursor to now (unless peek).
  if (input.nanoid && input.peek !== true) {
    ctx.queries.updateWriterCursor.run({ last_read_at: currentTimestamp(), nanoid: input.nanoid });
  }
  return ok(`${rows.length} log entr(ies)`, { entries: rows, count: rows.length });
}

export function getLastLogEntry(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getLastLogEntryInput>,
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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

  // Post-query type filter (UNION returns all entity types)
  if (input.type) {
    rows = rows.filter((r) => r.type === input.type);
  }

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

  // Post-query limit (applied after type and scope filters)
  if (input.limit) {
    rows = rows.slice(0, input.limit);
  }

  return ok(`${rows.length} item(s) in the last ${input.hours ?? 24}h`, {
    timeline: rows,
    count: rows.length,
  });
}

export function getDecisionHistory(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getDecisionHistoryInput>,
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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

export function getHandoff(ctx: IToolCtx): OToolResult {
  const openActions = ctx.queries.getOpenActionsForHandoff.all();

  const pendingDecisions = ctx.db.prepare(
    tables.decisions.req.select("id", "title", "status")
      .whereLiteral("status", `'${DECISION_STATUS.Proposed}'`).orderBy("date", "DESC").toSQL(),
  ).all();

  // Problems by severity — whereLiteral for severity + whereNotIn for status
  const criticalPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereLiteral("severity", "'CRITICAL'").whereNotIn("status", ["fixed", "wontfix"]).toSQL(),
  ).all();
  const highPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereLiteral("severity", "'HIGH'").whereNotIn("status", ["fixed", "wontfix"]).toSQL(),
  ).all();
  const mediumPbs = ctx.db.prepare(
    tables.problems.req.select("id", "title", "severity")
      .whereLiteral("severity", "'MEDIUM'").whereNotIn("status", ["fixed", "wontfix"]).toSQL(),
  ).all();

  const rawIdeas = ctx.db.prepare(
    tables.ideas.req.select("id", "title")
      .whereLiteral("status", `'${IDEA_STATUS.raw}'`).orderBy("seq", "DESC").toSQL(),
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
      .whereLiteral("type", "'architectural'").orderBy("id", "DESC").limit(20).toSQL(),
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
): OToolResult {
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
): OToolResult {
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
): OToolResult {
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

/** Help / instructions — compact index (no args) or full detail for one tool. */
export function help(
  ctx: IToolCtx,
  input: dna.infer<typeof helpInput>,
): OToolResult {
  const res = helpInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }

  // ── Detailed mode: help({ tool: "xxx" }) ──
  if (res.data.tool) {
    const toolName = res.data.tool;
    if (!toolMeta[toolName]) {
      return err(`Unknown tool: ${toolName}. Call help() without args for the full list.`);
    }
    return ok(buildHelp(toolName, "{{name}}: {{desc}}\n\n{{sig}}\n\n{{args}}\n\n{{usage}}"));
  }

  // ── Compact index mode: help() without args ──
  const categories = Object.values(CATEGORY).sort((a, b) => a.order - b.order);

  const lines: string[] = [
    "# Governance MCP — Tools Reference",
    "",
    "Governance MCP is a persistent governance system for multi-agent projects. It stores decisions, actions, ideas, problems, and it lists specs; It has full-text search, audit trails, and inter-session handoffs.",
    "Agents register as writers, then create/update entities, log discussions, and query the log entries to recover context across sessions.",
    "",
    "## Getting Started",
    "",
    'Register: `register_me({ id, role, responsibility?, defaultScope?, displayName?, objective?, expertise?, prohibitions? })` → save your `nanoid` → use it for all writes.',
    "`whoami({ nanoid })` retrieves your profile. `list_writers({})` shows others (never nanoids).",
    "",
    "## How-To",
    "",
    '- **Discuss**: `append_log_entry({ type: "question", subject, body })` → reply with `replyTo` → `get_thread({ threadId })`',
    '- **Decide**: `create_decision({ title, decider })` → `update_decision_status({ id, newStatus: "Accepted" })`',
    '- **Act**: `create_action({ title })` → `update_action_status({ id, newStatus: "done", evidence })`',
    '- **Fix**: `create_problem({ title, severity, type })` → `update_problem_status({ id, newStatus: "fixed", fix })`',
    '- **Idea**: `create_idea({ title })` → `create_decision(...)` → `update_idea_status({ id, newStatus: "promoted", promotedTo })`',
    '- **Correct**: `correct({ entityType, entityId, field, newValue, reason })` — for log_entries use `append_log_entry({ type: "correction", replyTo })`',
    "- **Handoff**: `get_handoff()` → `append_log_entry({ type: \"handoff\", body })`",
    '- **Search**: `search_mailbox({ query })` — FTS5 syntax, quote hyphens: `"PB-0108"`',
    "- **Updates**: `get_updates({ nanoid })` — unread log entries since last read",
    "",
    "## Docs",
    "",
    "`list_docs()` — list all available docs.",
    "`get_doc({ filename })` — read a doc by filename:",
    "- `how-to.md` — register, create, update, handoff",
    "- `tools.md` — full tool reference with parameters and return shapes",
    "- `architecture.md` — architecture, SQLite-as-truth, table layout",
    "- `cascades.md` — status cascades (done → partial, superseded → reopened)",
    "- `spec-guide.md` — spec-annexes lifecycle, versioning, drift",
    "- `free-fields.md` — custom metadata, FTS indexing",
    "- `api.md` — programmatic TypeScript API",
    "- `backup-restore.md` — SQLite backup/restore",
    "- `migration.md` — Markdown → SQLite one-shot import",
    "",
  ];

  for (const cat of categories) {
    const tools = Object.entries(toolMeta).filter(([, m]) => m.category.key === cat.key);
    if (tools.length === 0) continue;
    lines.push(`## ${cat.name}`, "");
    for (const [name] of tools) {
      lines.push("- "+ buildHelp(name, "`{{name}}`: {{desc}} - `{{sig}}`."));
    }
    lines.push("");
  }

  lines.push(
    "## Notes",
    "",
    "- `nanoid` is required for all write tools. Never share it.",
    '- `scope` is an array on write tools (e.g. `["ytn"]`), a string on read tools (e.g. `"ytn"`).',
    '- `date` on write tools requires `HH:MM` (e.g. `"2026-09-12 14:30"`). Read tools accept `YYYY-MM-DD`.',
    "- Without `Z`/offset = local time; with `Z`/offset = GMT/UTC.",
    '- `help({ tool: "create_decision" })` returns full detail for one tool.',
  );

  return ok(lines.join("\n"));
}



export function getUpdates(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getUpdatesInput>,
): OToolResult {
  const res = S.getUpdatesInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const writer = ctx.queries.getWriterByNanoid.get({ nanoid: input.nanoid });
  if (!writer) return err(`Writer not found for nanoid ${input.nanoid}`);
  // last_read_at stores an ISO timestamp (not a numeric id). Fallback covers
  // freshly-registered writers and legacy null values.
  const cursor = writer.last_read_at || "1970-01-01T00:00:00.000Z";
  const limit = input.limitN ?? 50;
  const isPeek = input.peek === true;

  // ── Mode: markAllRead — set cursor to now without returning entries ──
  if (input.markAllRead) {
    const now = currentTimestamp();
    const maxRow = ctx.queries.getMaxLogEntryId.get({}) as { max_id: number | null } | undefined;
    const maxId = maxRow?.max_id ?? 0;
    if (!isPeek) {
      ctx.queries.updateWriterCursor.run({ last_read_at: now, nanoid: input.nanoid });
    }
    return ok(`Cursor ${isPeek ? "unchanged (peek)" : "set to now"}. 0 entries returned.`, {
      entries: [],
      new_cursor: isPeek ? cursor : now,
      max_entry_id: maxId,
      has_more: false,
      remaining: 0,
    });
  }

  // ── Determine order and cursor reference ──
  // - DESC (most recent first) — get_updates is about latest news
  // - lastN overrides the limit but order is always DESC
  const isDesc = true;
  const effectiveLimit = input.lastN ?? limit;

  // Build query: whereRaw for timestamp > (qb .where() only supports =),
  // .where() for type equality, .whereIn() for scope subquery.
  const params: Record<string, unknown> = { cursor };
  let builder = tables.log_entries.req.select()
    .whereRaw("timestamp > @cursor");
  if (input.type) {
    builder = builder.where(["type"]);
    params.type = input.type;
  }
  if (input.scope) {
    const es = tables.entity_scopes.names;
    let subquery = tables.entity_scopes.req.select(es.col.entity_id)
      .whereLiteral(es.col.entity_type, "'log_entry'");
    if (input.withChildren) {
      const childIds = ctx.queries.scopeTree
        .all({ scope: input.scope })
        .map((r) => (r as { id: string }).id);
      if (childIds.length > 0) {
        subquery = subquery.whereIn(es.col.scope_id, childIds);
      } else {
        subquery = subquery.where([{ col: es.col.scope_id, param: "scope" }]);
        params.scope = input.scope;
      }
    } else {
      subquery = subquery.where([{ col: es.col.scope_id, param: "scope" }]);
      params.scope = input.scope;
    }
    builder = builder.whereIn("CAST(id AS TEXT)", subquery);
  }
  // ── Audience filtering ──
  // An entry is visible to the caller if:
  // 1. audience = 'all' (broadcast)
  // 2. the caller's writer id appears in the comma-separated audience (direct address)
  // 3. the author shares the caller's default_scope (same-scope author)
  const audienceCond = `(audience = 'all' OR (',' || audience || ',') LIKE '%,' || @caller_id || ',%' OR author IN (SELECT id FROM writers WHERE default_scope = @caller_scope))`;
  builder = builder.whereRaw(audienceCond);
  params.caller_id = writer.id;
  params.caller_scope = writer.default_scope;
  const sql = builder
    .orderBy("id", isDesc ? "DESC" : "ASC")
    .limit(effectiveLimit + 1)
    .toSQL();

  // Read + cursor update must be transactional to avoid skipping entries
  // inserted between the SELECT and the cursor advancement.
  const { entries, hasMore } = ctx.db.transaction(() => {
    const rows = ctx.db.prepare(sql).all(params);
    // We always request effectiveLimit + 1 rows to detect has_more
    const hasMore = rows.length > effectiveLimit;
    const entries = hasMore ? rows.slice(0, effectiveLimit) : rows;
    // Cursor = date of reading (now), not the timestamp of the last entry.
    if (!isPeek) {
      ctx.queries.updateWriterCursor.run({ last_read_at: currentTimestamp(), nanoid: input.nanoid });
    }
    return { entries, hasMore };
  });
  const newCursor = currentTimestamp();

  const maxRow = ctx.queries.getMaxLogEntryId.get({}) as { max_id: number | null } | undefined;
  const maxId = maxRow?.max_id ?? 0;
  const lastEntryId = entries.length > 0
    ? (isDesc ? (entries[entries.length - 1].id as number) : (entries[entries.length - 1].id as number))
    : 0;
  const remaining = hasMore ? Math.max(0, maxId - lastEntryId) : 0;

  const peekNote = isPeek ? " [PEEK MODE]" : "";
  const summary = hasMore
    ? `${entries.length} entries returned (cursor: ${lastEntryId}/${maxId}). ${remaining} remaining — call get_updates again with the same nanoid to fetch the next batch.${peekNote}`
    : `${entries.length} entries returned (cursor: ${lastEntryId}/${maxId}). All caught up.${peekNote}`;

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
): OToolResult {
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
): OToolResult {
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
    .map((e): { filename: string; size: number; title: string | null } | null => {
      const fullPath = path.join(docsDir, e.name);
      try {
        const stat = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, "utf-8");
        return {
          filename: e.name,
          size: stat.size,
          title: extractMarkdownTitle(content),
        };
      } catch {
        return null;
      }
    })
    .filter((d): d is { filename: string; size: number; title: string | null } => d !== null)
    .sort((a, b) => a.filename.localeCompare(b.filename));
  return ok(`${docs.length} document(s)`, { docs, count: docs.length });
}

/** Get the content of a specific documentation file. */
export function getDoc(
  _ctx: IToolCtx,
  input: dna.infer<typeof S.getDocInput>,
): OToolResult {
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
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const stat = fs.statSync(filePath);
    return ok(`Document: ${input.filename}`, {
      filename: input.filename,
      content,
      size: stat.size,
    });
  } catch {
    return err(`Document not found: ${input.filename}`);
  }
}
