/**
 * Report generation and export tools.
 *
 * All report tools generate Markdown from the DB and write it to
 * `mailbox/generated/` on disk. SQLite is the source of truth;
 * these files are human-readable views.
 *
 * All queries use pre-compiled QB statements from `queries/index.ts`.
 * All Markdown is built with native JS template literals (no template engine dependency).
 */

import { dna } from "@ytrynot/dna";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { currentDate } from "../helpers.js";
import * as S from "../schemas/tool-inputs.js";
import { resolveMonorepoRoot } from "../seed.js";
import { err, ok } from "./results.js";
import type { IToolCtx, IToolResult } from "../types/types.ts";
import { ACTION_STATUS, PROBLEM_STATUS, IDEA_STATUS, DECISION_STATUS } from "../definitions/enums.js";

// ─── File writing helper ─────────────────────────────────────────────────────

/** Resolve the `mailbox/generated/` directory from the monorepo root. */
function generatedDir(): string {
  const root = resolveMonorepoRoot();
  const dir = resolve(root, "mailbox", "generated");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write a Markdown file to `mailbox/generated/<filename>` and return the path. */
function writeReport(filename: string, markdown: string): string {
  const dir = generatedDir();
  const filepath = join(dir, filename);
  writeFileSync(filepath, markdown, "utf8");
  return filepath;
}

// ─── generate_daily_report ───────────────────────────────────────────────────

/** Map entity IDs (DEC-NNNN, ACT-NNNN, IDEA-NNNN, PB-NNNN) to cross-report
 *  markdown links. Finds all IDs in the string and links each individually,
 *  leaving surrounding text (suffixes, commas, labels) intact.
 *  Returns "—" if the input is null/empty. */
function entityLink(id: string | null): string {
  if (!id) return "—";
  const reportMap: Record<string, string> = {
    DEC: "mailbox-decisions.md",
    ACT: "mailbox-actions.md",
    IDEA: "features-ideas.md",
    PB: "mailbox-problems.md",
  };
  return id.replace(/\b(DEC|ACT|IDEA|PB)-(\d+)\b/g, (match, prefix, num) => {
    const report = reportMap[prefix];
    if (!report) return match;
    const anchor = `${prefix}-${num}`.toLowerCase();
    return `[${match}](${report}#${anchor})`;
  });
}

/** Sanitize a text field for inline Markdown rendering.
 *  Promotes any heading (#, ##, ###) to #### minimum so user content cannot
 *  break the report structure (## = sections, ### = entity titles).
 *  Escapes < and > to HTML entities in plain text to prevent generic type
 *  parameters like <S>, <S,T> from being interpreted as HTML tags.
 *  Code spans (backticks) and code blocks (triple backticks) are left untouched. */
function mdField(text: string | null): string {
  if (!text) return "";
  // Split on code spans/blocks to escape only outside code.
  const parts = text.split(/(```[\s\S]*?```|`[^`]*`)/g);
  const escaped = parts.map((part, i) => {
    // Odd indices are code spans/blocks (captured by the split regex).
    if (i % 2 === 1) return part;
    return part.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }).join("");
  return escaped.replace(/^(#{1,3})\s/gm, "#### ");
}

/** Generate a daily report in Markdown format and write it to disk. */
export function generateDailyReport(
  ctx: IToolCtx,
  input: dna.infer<typeof S.generateDailyReportInput>,
): IToolResult {
  const res = S.generateDailyReportInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const date = input.date;
  const q = ctx.queries;
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };

  // Items dated today (new today)
  const newDecisions = q.reportDecisionsByDate.all({ date: `${date}%` });
  const newActions = q.reportActionsByDate.all({ date: `${date}%` });
  const newProblems = q.reportProblemsByDate.all({ date: `${date}%` });
  const newIdeas = q.reportIdeasByDate.all({ date: `${date}%` });
  const newSpecs = q.reportSpecsByDate.all({ date: `${date}%` });
  const logEntries = q.reportLogEntriesByDate.all({ date });

  // Open items (still actionable, not new today)
  const OPEN_ACTIONS: readonly string[] = [ACTION_STATUS.pending, ACTION_STATUS.in_progress, ACTION_STATUS.blocked];
  const OPEN_PROBLEMS: readonly string[] = [PROBLEM_STATUS.open, PROBLEM_STATUS.critical, PROBLEM_STATUS.in_progress, PROBLEM_STATUS.partial];
  const OPEN_IDEAS: readonly string[] = [IDEA_STATUS.raw, IDEA_STATUS.explored];
  const OPEN_DECISIONS: readonly string[] = [DECISION_STATUS.Proposed, DECISION_STATUS.Suspended];

  const newIds = new Set([...newDecisions, ...newActions, ...newProblems, ...newIdeas].map(r => r.id));
  const openActions = q.getOpenActions.all().filter(a => !newIds.has(a.id));
  const openProblems = q.reportAllProblems.all().filter(p => OPEN_PROBLEMS.includes(p.status) && !newIds.has(p.id));
  const openIdeas = q.reportAllIdeas.all().filter(i => OPEN_IDEAS.includes(i.status) && !newIds.has(i.id));
  const openDecisions = q.reportAllDecisions.all().filter(d => OPEN_DECISIONS.includes(d.status) && !newIds.has(d.id));

  const allActions = [...newActions, ...openActions];
  const allProblems = [...newProblems, ...openProblems];
  const allIdeas = [...newIdeas, ...openIdeas];
  const allDecisions = [...newDecisions, ...openDecisions];

  // Writers mentioned in log entries (as authors), without nanoid
  const authorIds = [...new Set(logEntries.map((e) => e.author).filter((a): a is string => a !== null))];
  const writers = authorIds.map((id) => q.getWriterById.get({ id })).filter((w): w is NonNullable<typeof w> => w !== null);
  const writersMd = writers.map((w) => `### ${w.id}

- **Display name:** ${w.display_name ?? "—"}
- **Role:** ${w.role}
- **Objective:** ${w.objective ?? "—"}
- **Expertise:** ${w.expertise ?? "—"}
- **Responsibility:** ${w.responsibility ?? "—"}
- **Prohibitions:** ${w.prohibitions ?? "—"}`).join("\n\n");

  const md = `# Mailbox — ${date} (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Decisions
${allDecisions.length > 0 ? allDecisions.map((d) => `- ${entityLink(d.id)} ${d.title} (${d.status}, scopes: ${scopesFor("decision", d.id)})`).join("\n") : "_(none)_"}

## Actions
${allActions.length > 0 ? allActions.map((a) => `- ${entityLink(a.id)} ${a.title} (${a.status}, scopes: ${scopesFor("action", a.id)})`).join("\n") : "_(none)_"}

## Problems
${allProblems.length > 0 ? allProblems.map((p) => `- ${entityLink(p.id)} ${p.title} (${p.status}, ${p.severity})`).join("\n") : "_(none)_"}

## Ideas
${allIdeas.length > 0 ? allIdeas.map((i) => `- ${entityLink(i.id)} ${i.title} (${i.status}, scopes: ${scopesFor("idea", i.id)})`).join("\n") : "_(none)_"}

## Specs
${newSpecs.length > 0 ? newSpecs.map((s) => `- ${entityLink(s.id)} ${s.filename} (${s.status})`).join("\n") : "_(none)_"}

## Writers
${writers.length > 0 ? writersMd : "_(none)_"}

## Log
${logEntries.length > 0 ? "\n" + logEntries.map((e) => `### ${e.date} - ${e.type} - ${e.subject ?? "—"}

**From:** ${e.author ?? "—"}
**For:** ${e.audience ?? "—"}

${mdField(e.body) ?? ""}`).join("\n\n") : "_(none)_"}
`;

  const filename = `mailbox-${date.slice(0, 10)}.md`;
  const filepath = writeReport(filename, md);

  return ok(`Daily report for ${date} (${logEntries.length} entries)`, {
    date,
    filename,
    filepath,
    markdown: md,
    counts: {
      decisions: allDecisions.length,
      actions: allActions.length,
      problems: allProblems.length,
      ideas: allIdeas.length,
      specs: newSpecs.length,
      logEntries: logEntries.length,
    },
  });
}

// ─── generate_decisions_report ───────────────────────────────────────────────

/** Generate the full decisions registry as Markdown and write it to disk. */
export function generateDecisionsReport(ctx: IToolCtx): IToolResult {
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };
  const rows = ctx.queries.reportAllDecisions.all() as {
    id: string; title: string; status: string; date: string;
    decider: string; superseded_by: string | null;
    spec_ref: string | null; source: string | null;
    context: string | null; decision: string | null; consequences: string | null;
  }[];

  const supersedesOf = (id: string): string => {
    const rows = ctx.queries.getDecisionSupersedes.all({ superseding_id: id });
    if (rows.length === 0) return "—";
    return rows.map((r) => r.partial ? `${entityLink(r.superseded_id)} (partial)` : entityLink(r.superseded_id)).join(", ");
  };
  const md = `# Mailbox — Decision Log (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Index

| ID | Status | Title | Scopes | Date | Decider | Supersedes |
|----|--------|-------|--------|------|---------|------------|
${rows.map((r) => `| [${r.id}](#${r.id.toLowerCase()}) | ${r.status} | ${r.title} | ${scopesFor("decision", r.id)} | ${r.date} | ${r.decider} | ${supersedesOf(r.id)} |`).join("\n")}

---

${rows.map((r) => `<a id="${r.id.toLowerCase()}"></a>
## ${r.id} — ${r.title}

| Field | Value |
|-------|-------|
| Status | ${r.status} |
| Date | ${r.date} |
| Decider | ${r.decider} |
| Scopes | ${scopesFor("decision", r.id)} |
| Supersedes | ${supersedesOf(r.id)} |
| Superseded by | ${r.superseded_by ? entityLink(r.superseded_by) : "—"} |
| Spec ref | ${r.spec_ref ? entityLink(r.spec_ref) : "—"} |
| Source | ${r.source ?? "—"} |
${r.context ? `\n### Context\n\n${mdField(r.context)}\n` : ""}${r.decision ? `\n### Decision\n\n${mdField(r.decision)}\n` : ""}${r.consequences ? `\n### Consequences\n\n${mdField(r.consequences)}\n` : ""}
---
`).join("\n")}
`;

  const filename = "mailbox-decisions.md";
  const filepath = writeReport(filename, md);

  return ok(`Decisions report (${rows.length} decisions)`, {
    filename,
    filepath,
    markdown: md,
    count: rows.length,
  });
}

// ─── generate_actions_report ─────────────────────────────────────────────────

/** Generate the full actions registry as Markdown and write it to disk. */
export function generateActionsReport(ctx: IToolCtx): IToolResult {
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };
  const rows = ctx.queries.reportAllActions.all() as {
    id: string; title: string; status: string;
    owner: string | null; priority: string | null; source: string | null;
    source_type: string | null; spec_ref: string | null;
    body: string | null; evidence: string | null; blockers: string | null;
    defer_reason: string | null; cancel_reason: string | null; tested: string;
  }[];

  const md = `# Mailbox — Action Log (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Index

| ID | Status | Title | Scopes | Priority | Owner | Source |
|----|--------|-------|--------|----------|-------|--------|
${rows.map((r) => `| [${r.id}](#${r.id.toLowerCase()}) | ${r.status} | ${r.title} | ${scopesFor("action", r.id)} | ${r.priority ?? "—"} | ${r.owner ?? "—"} | ${r.source ? entityLink(r.source) : "—"} |`).join("\n")}

---

${rows.map((r) => `<a id="${r.id.toLowerCase()}"></a>
## ${r.id} — ${r.title}

| Field | Value |
|-------|-------|
| Status | ${r.status} |
| Scopes | ${scopesFor("action", r.id)} |
| Priority | ${r.priority ?? "—"} |
| Owner | ${r.owner ?? "—"} |
| Source | ${r.source ? entityLink(r.source) : "—"} |
| Spec ref | ${r.spec_ref ? entityLink(r.spec_ref) : "—"} |
| Tested | ${r.tested} |
${r.body ? `\n### Body\n\n${mdField(r.body)}\n` : ""}${r.evidence ? `\n### Evidence\n\n${mdField(r.evidence)}\n` : ""}${r.blockers ? `\n### Blockers\n\n${mdField(r.blockers)}\n` : ""}${r.defer_reason ? `\n### Defer reason\n\n${mdField(r.defer_reason)}\n` : ""}${r.cancel_reason ? `\n### Cancel reason\n\n${mdField(r.cancel_reason)}\n` : ""}
---
`).join("\n")}
`;

  const filename = "mailbox-actions.md";
  const filepath = writeReport(filename, md);

  return ok(`Actions report (${rows.length} actions)`, {
    filename,
    filepath,
    markdown: md,
    count: rows.length,
  });
}

// ─── generate_ideas_report ───────────────────────────────────────────────────

/** Generate the full ideas registry as Markdown and write it to disk. */
export function generateIdeasReport(ctx: IToolCtx): IToolResult {
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };
  const rows = ctx.queries.reportAllIdeas.all() as {
    id: string; title: string; status: string;
    package: string | null; priority: string | null; promoted_to: string | null;
    short_desc: string | null; long_desc: string | null; abandon_reason: string | null;
    tested: string;
  }[];

  const md = `# Mailbox — Ideas & Features (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Index

| ID | Status | Title | Scopes | Package | Priority | Promoted to |
|----|--------|-------|--------|---------|----------|-------------|
${rows.map((r) => `| [${r.id}](#${r.id.toLowerCase()}) | ${r.status} | ${r.title} | ${scopesFor("idea", r.id)} | ${r.package ?? "—"} | ${r.priority ?? "—"} | ${r.promoted_to ? entityLink(r.promoted_to) : "—"} |`).join("\n")}

---

${rows.map((r) => `<a id="${r.id.toLowerCase()}"></a>
## ${r.id} — ${r.title}

| Field | Value |
|-------|-------|
| Status | ${r.status} |
| Scopes | ${scopesFor("idea", r.id)} |
| Package | ${r.package ?? "—"} |
| Priority | ${r.priority ?? "—"} |
| Promoted to | ${r.promoted_to ? entityLink(r.promoted_to) : "—"} |
| Tested | ${r.tested} |
${r.short_desc ? `\n### Short description\n\n${mdField(r.short_desc)}\n` : ""}${r.long_desc ? `\n### Long description\n\n${mdField(r.long_desc)}\n` : ""}${r.abandon_reason ? `\n### Abandon reason\n\n${mdField(r.abandon_reason)}\n` : ""}
---
`).join("\n")}
`;

  const filename = "features-ideas.md";
  const filepath = writeReport(filename, md);

  return ok(`Ideas report (${rows.length} ideas)`, {
    filename,
    filepath,
    markdown: md,
    count: rows.length,
  });
}

// ─── generate_problems_report ────────────────────────────────────────────────

/** Generate the full problems registry as Markdown and write it to disk. */
export function generateProblemsReport(ctx: IToolCtx): IToolResult {
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };
  const linkedActsOf = (id: string): string => {
    const rows = ctx.queries.getProblemActions.all({ problem_id: id });
    if (rows.length === 0) return "—";
    return rows.map((r) => r.role && r.role !== "primary" ? `${entityLink(r.action_id)} (${r.role})` : entityLink(r.action_id)).join(", ");
  };
  const rows = ctx.queries.reportAllProblems.all() as {
    id: string; title: string; status: string;
    severity: string; type: string; linked_spec: string | null;
    linked_act: string | null; description: string | null;
    root_cause: string | null; fix: string | null;
    wontfix_reason: string | null; fast_track: number; tested: string;
    fixed_at: string | null;
  }[];

  const md = `# Mailbox — Problems & Bugs (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Index

| ID | Status | Title | Scopes | Severity | Type | Linked spec | Linked act |
|----|--------|-------|--------|----------|------|-------------|------------|
${rows.map((r) => `| [${r.id}](#${r.id.toLowerCase()}) | ${r.status} | ${r.title} | ${scopesFor("problem", r.id)} | ${r.severity} | ${r.type} | ${r.linked_spec ? entityLink(r.linked_spec) : "—"} | ${linkedActsOf(r.id)} |`).join("\n")}

---

${rows.map((r) => `<a id="${r.id.toLowerCase()}"></a>
## ${r.id} — ${r.title}

| Field | Value |
|-------|-------|
| Status | ${r.status} |
| Scopes | ${scopesFor("problem", r.id)} |
| Severity | ${r.severity} |
| Type | ${r.type} |
| Linked spec | ${r.linked_spec ? entityLink(r.linked_spec) : "—"} |
| Linked act | ${linkedActsOf(r.id)} |
| Fast track | ${r.fast_track ? "yes" : "no"} |
| Tested | ${r.tested} |
| Fixed at | ${r.fixed_at ?? "—"} |
${r.description ? `\n### Description\n\n${mdField(r.description)}\n` : ""}${r.root_cause ? `\n### Root cause\n\n${mdField(r.root_cause)}\n` : ""}${r.fix ? `\n### Fix\n\n${mdField(r.fix)}\n` : ""}${r.wontfix_reason ? `\n### Wontfix reason\n\n${mdField(r.wontfix_reason)}\n` : ""}
---
`).join("\n")}
`;

  const filename = "mailbox-problems.md";
  const filepath = writeReport(filename, md);

  return ok(`Problems report (${rows.length} problems)`, {
    filename,
    filepath,
    markdown: md,
    count: rows.length,
  });
}

// ─── generate_decision_history_report ────────────────────────────────────────

/** Generate a full decision history report (timeline) as Markdown and write it to disk. */
export function generateDecisionHistoryReport(
  ctx: IToolCtx,
  input: dna.infer<typeof S.generateDecisionHistoryReportInput>,
): IToolResult {
  const res = S.generateDecisionHistoryReportInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }
  const q = ctx.queries;
  const scopesFor = (entityType: string, entityId: string): string => {
    const rows = ctx.queries.getEntityScopes.all({ entity_type: entityType, entity_id: entityId });
    return rows.map((r) => r.scope_id).join(", ") || "—";
  };
  const supersedesOf = (id: string): string => {
    const rows = q.getDecisionSupersedes.all({ superseding_id: id });
    if (rows.length === 0) return "—";
    return rows.map((r) => r.partial ? `${entityLink(r.superseded_id)} (partial)` : entityLink(r.superseded_id)).join(", ");
  };
  const dec = q.getDecisionById.get({ id: input.id }) as Record<string, unknown> | undefined;
  if (!dec) return err(`Decision ${input.id} not found`);

  const acts = q.reportActionsBySource.all({ source: input.id }) as {
    id: string; title: string; status: string; priority: string | null; owner: string | null;
  }[];

  const ideas = q.reportIdeasByPromotedTo.all({ promoted_to: input.id }) as {
    id: string; title: string; status: string;
  }[];

  const problems = q.reportProblemsByDecisionActions.all({ source: input.id }) as {
    id: string; title: string; status: string; severity: string;
  }[];

  const history = q.getStatusHistory.all({ entity_type: "decision", entity_id: input.id }) as {
    old_status: string | null; new_status: string; changed_at: string; changed_by: string; reason: string | null;
  }[];

  const logs = q.reportLogEntriesByRef.all({ ref_id: input.id }) as {
    id: number; timestamp: string; type: string; author: string; subject: string; body: string | null;
  }[];

  const md = `# Decision History — ${input.id} (generated)

Generated by @ytrynot/gov-mcp on ${currentDate()}.

## Decision

| Field | Value |
|-------|-------|
| ID | ${dec.id} |
| Title | ${dec.title} |
| Status | ${dec.status} |
| Scopes | ${scopesFor("decision", String(dec.id))} |
| Date | ${dec.date} |
| Decider | ${dec.decider} |
| Supersedes | ${supersedesOf(String(dec.id))} |
${dec.context ? `\n### Context\n\n${mdField(String(dec.context))}\n` : ""}${dec.decision ? `\n### Decision\n\n${mdField(String(dec.decision))}\n` : ""}${dec.consequences ? `\n### Consequences\n\n${mdField(String(dec.consequences))}\n` : ""}
## Actions
${acts.length === 0 ? "_No actions._" : `| ID | Status | Title | Scopes | Priority | Owner |
|----|--------|-------|--------|----------|-------|
${acts.map((a) => `| ${a.id} | ${a.status} | ${a.title} | ${scopesFor("action", a.id)} | ${a.priority ?? "—"} | ${a.owner ?? "—"} |`).join("\n")}`}

## Ideas
${ideas.length === 0 ? "_No ideas._" : `| ID | Status | Title | Scopes |
|----|--------|-------|--------|
${ideas.map((i) => `| ${i.id} | ${i.status} | ${i.title} | ${scopesFor("idea", i.id)} |`).join("\n")}`}

## Problems
${problems.length === 0 ? "_No problems._" : `| ID | Status | Title | Severity | Scopes |
|----|--------|-------|----------|--------|
${problems.map((p) => `| ${p.id} | ${p.status} | ${p.title} | ${p.severity} | ${scopesFor("problem", p.id)} |`).join("\n")}`}

## Status History
${history.length === 0 ? "_No status changes._" : `| Old status | New status | Changed at | Changed by | Reason |
|------------|------------|------------|------------|--------|
${history.map((h) => `| ${h.old_status ?? "—"} | ${h.new_status} | ${h.changed_at} | ${h.changed_by} | ${h.reason ?? "—"} |`).join("\n")}`}

## Log Entries
${logs.length === 0 ? "_No log entries._" : logs.map((l) => `### [${l.timestamp}] — ${l.type}

**From:** ${l.author}  **Subject:** ${l.subject}
${mdField(l.body) ?? ""}`).join("\n\n")}
`;

  const filename = `decision-history-${input.id.toLowerCase()}.md`;
  const filepath = writeReport(filename, md);

  return ok(`Decision history for ${input.id}`, {
    id: input.id,
    filename,
    filepath,
    markdown: md,
    counts: {
      actions: acts.length,
      ideas: ideas.length,
      problems: problems.length,
      history: history.length,
      logs: logs.length,
    },
  });
}

// ─── export_dump ─────────────────────────────────────────────────────────────

/** Export a SQL text dump (DDL + INSERTs). */
export function exportDump(ctx: IToolCtx): IToolResult {
  const tables = ctx.db.listTables().filter(
    (t) => !t.startsWith("search_index") && !t.startsWith("sqlite_"),
  );
  const lines: string[] = [
    "-- Governance MCP database dump",
    `-- Generated: ${currentDate()}`,
    "",
  ];

  for (const table of tables) {
    // Get DDL
    const ddlRow = ctx.db.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(table) as { sql: string } | undefined;
    if (ddlRow?.sql) {
      lines.push(`-- Table: ${table}`);
      lines.push(ddlRow.sql + ";");
      lines.push("");
    }
    // Get rows
    const rows = ctx.db.prepare(`SELECT * FROM "${table}"`).all();
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((c) => {
        const v = (row as Record<string, unknown>)[c];
        if (v === null) return "NULL";
        if (typeof v === "number") return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(
        `INSERT INTO "${table}" (${cols.join(", ")}) VALUES (${vals.join(", ")});`,
      );
    }
    lines.push("");
  }

  return ok(`Dump: ${tables.length} tables`, {
    sql: lines.join("\n"),
    tables: tables.length,
  });
}

// ─── generate_all_reports ────────────────────────────────────────────────────

/** Generate all 5 main reports (decisions, actions, ideas, problems, daily) in one call. */
export function generateAllReports(ctx: IToolCtx): IToolResult {
  const results: { report: string; filepath: string }[] = [];
  const errors: string[] = [];

  const reports: { name: string; fn: (ctx: IToolCtx) => IToolResult }[] = [
    { name: "decisions", fn: generateDecisionsReport },
    { name: "actions", fn: generateActionsReport },
    { name: "ideas", fn: generateIdeasReport },
    { name: "problems", fn: generateProblemsReport },
    { name: "daily", fn: (c: IToolCtx) => generateDailyReport(c, { date: currentDate() }) },
  ];

  for (const { name, fn } of reports) {
    const r = fn(ctx);
    if (r.structuredContent && typeof r.structuredContent === "object" && "filepath" in r.structuredContent) {
      results.push({ report: name, filepath: (r.structuredContent as { filepath: string }).filepath });
    } else {
      errors.push(`${name}: ${r.content[0]?.text ?? "unknown error"}`);
    }
  }

  if (errors.length > 0) {
    return err(`Some reports failed:\n${errors.join("\n")}`);
  }

  return ok(`Generated ${results.length} reports`, {
    reports: results,
  });
}
