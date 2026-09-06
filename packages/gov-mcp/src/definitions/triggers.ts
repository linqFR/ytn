/**
 * SQL triggers for the governance database.
 *
 * 4 cascade triggers (AFTER UPDATE) + 1 supersession trigger (AFTER INSERT) + 21 FTS5 sync triggers (7 tables × INSERT/UPDATE/DELETE).
 * Trigger structure (timing, event, table, columns) is generated via qb.createTrigger.
 * Trigger bodies and WHEN clauses remain raw SQL — SQLite trigger bodies contain
 * imperative multi-statement logic (INSERT...SELECT, UPDATE with NEW/OLD refs,
 * EXISTS subqueries) that cannot be expressed by the fluent Builder.
 * Exported to schema/triggers.sql for the future Python implementation.
 */

import { QueryBuilder, type ITriggerDefinition } from "@ytrynot/qb";
import { tables } from "./schema.js";
import {
  TESTED_STATUS, ACTION_STATUS, PROBLEM_STATUS, IDEA_STATUS,
  DECISION_STATUS, SPEC_STATUS, SOURCE_TYPE, PROBLEM_TYPE,
} from "./enums.js";

// ─── Shorthand table/column name references ──────────────────────────────────
// Derived from tables.xxx.names so renames propagate automatically.
const a = tables.actions.names;
const d = tables.decisions.names;
const p = tables.problems.names;
const i = tables.ideas.names;
const s = tables.specs.names;
const sh = tables.status_history.names;
const es = tables.entity_scopes.names;
const pa = tables.problem_actions.names;
const ds = tables.decision_supersedes.names;
const ff = tables.free_fields.names;
const le = tables.log_entries.names;

// ─── Cascade triggers (AFTER UPDATE) ─────────────────────────────────────────
// Unidirectional, atomic, impossible to bypass.
// Cascades can be disabled via a flag table:
//   UPDATE _cascade_disabled SET value = 1;  -- disable
//   UPDATE _cascade_disabled SET value = 0;  -- re-enable

const cascadeTriggers: ReadonlyArray<{ name: string; def: ITriggerDefinition }> = [
  {
    name: "trg_act_done_pb",
    def: {
      timing: "AFTER",
      event: "UPDATE",
      of: [a.col.status],
      table: a.table,
      when: `NEW.${a.col.status} = '${ACTION_STATUS.done}' AND OLD.${a.col.status} != '${ACTION_STATUS.done}'
  AND NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)`,
      body: `INSERT INTO ${sh.table} (${sh.col.entity_type}, ${sh.col.entity_id}, ${sh.col.old_status}, ${sh.col.new_status}, ${sh.col.changed_at}, ${sh.col.changed_by}, ${sh.col.reason}, ${sh.col.cascade_trigger})
  SELECT 'problem', ${p.col.id}, ${p.col.status}, '${PROBLEM_STATUS.partial}', datetime('now'), 'cascade:auto',
         'ACT ' || NEW.${a.col.id} || ' done', NEW.${a.col.id}
  FROM ${p.table} p
  WHERE (EXISTS (SELECT 1 FROM ${pa.table} pa WHERE pa.${pa.col.problem_id} = p.${p.col.id} AND pa.${pa.col.action_id} = NEW.${a.col.id})
         OR p.${p.col.linked_act} = NEW.${a.col.id})
    AND p.${p.col.status} NOT IN ('${PROBLEM_STATUS.fixed}', '${PROBLEM_STATUS.wontfix}', '${PROBLEM_STATUS.partial}');

  UPDATE ${p.table}
  SET ${p.col.status} = '${PROBLEM_STATUS.partial}',
      ${p.col.tested} = '${TESTED_STATUS.partially}',
      ${p.col.updated_at} = datetime('now')
  WHERE (EXISTS (SELECT 1 FROM ${pa.table} pa WHERE pa.${pa.col.problem_id} = ${p.table}.${p.col.id} AND pa.${pa.col.action_id} = NEW.${a.col.id})
         OR ${p.col.linked_act} = NEW.${a.col.id})
    AND ${p.col.status} NOT IN ('${PROBLEM_STATUS.fixed}', '${PROBLEM_STATUS.wontfix}', '${PROBLEM_STATUS.partial}');`,
    },
  },
  {
    name: "trg_act_done_idea",
    def: {
      timing: "AFTER",
      event: "UPDATE",
      of: [a.col.status],
      table: a.table,
      when: `NEW.${a.col.status} = '${ACTION_STATUS.done}' AND OLD.${a.col.status} != '${ACTION_STATUS.done}'
  AND NEW.${a.col.source_type} = '${SOURCE_TYPE.decision}'
  AND NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)`,
      body: `INSERT INTO ${sh.table} (${sh.col.entity_type}, ${sh.col.entity_id}, ${sh.col.old_status}, ${sh.col.new_status}, ${sh.col.changed_at}, ${sh.col.changed_by}, ${sh.col.reason}, ${sh.col.cascade_trigger})
  SELECT 'idea', ${i.col.id}, ${i.col.status}, '${IDEA_STATUS.implemented}', datetime('now'), 'cascade:auto',
         'All ACTs of ' || NEW.${a.col.source} || ' done', NEW.${a.col.id}
  FROM ${i.table}
  WHERE ${i.col.promoted_to} = NEW.${a.col.source}
    AND ${i.col.status} = '${IDEA_STATUS.promoted}'
    AND NOT EXISTS (
      SELECT 1 FROM ${a.table} a2
      WHERE a2.${a.col.source} = NEW.${a.col.source}
        AND a2.${a.col.source_type} = '${SOURCE_TYPE.decision}'
        AND a2.${a.col.status} NOT IN ('${ACTION_STATUS.done}', '${ACTION_STATUS.cancelled}')
    );

  UPDATE ${i.table}
  SET ${i.col.status} = '${IDEA_STATUS.implemented}',
      ${i.col.tested} = '${TESTED_STATUS.partially}',
      ${i.col.updated_at} = datetime('now')
  WHERE ${i.col.promoted_to} = NEW.${a.col.source}
    AND ${i.col.status} = '${IDEA_STATUS.promoted}'
    AND NOT EXISTS (
      SELECT 1 FROM ${a.table} a2
      WHERE a2.${a.col.source} = NEW.${a.col.source}
        AND a2.${a.col.source_type} = '${SOURCE_TYPE.decision}'
        AND a2.${a.col.status} NOT IN ('${ACTION_STATUS.done}', '${ACTION_STATUS.cancelled}')
    );`,
    },
  },
  {
    name: "trg_dec_cancelled_idea",
    def: {
      timing: "AFTER",
      event: "UPDATE",
      of: [d.col.status],
      table: d.table,
      when: `NEW.${d.col.status} = '${DECISION_STATUS.Cancelled}' AND OLD.${d.col.status} != '${DECISION_STATUS.Cancelled}'
  AND NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)`,
      body: `INSERT INTO ${sh.table} (${sh.col.entity_type}, ${sh.col.entity_id}, ${sh.col.old_status}, ${sh.col.new_status}, ${sh.col.changed_at}, ${sh.col.changed_by}, ${sh.col.reason}, ${sh.col.cascade_trigger})
  SELECT 'idea', ${i.col.id}, ${i.col.status}, '${IDEA_STATUS.abandoned}', datetime('now'), 'cascade:auto',
         'DEC ' || NEW.${d.col.id} || ' cancelled', NEW.${d.col.id}
  FROM ${i.table}
  WHERE ${i.col.promoted_to} = NEW.${d.col.id}
    AND ${i.col.status} NOT IN ('${IDEA_STATUS.abandoned}', '${IDEA_STATUS.implemented}');

  UPDATE ${i.table}
  SET ${i.col.status} = '${IDEA_STATUS.abandoned}',
      ${i.col.abandon_reason} = 'DEC ' || NEW.${d.col.id} || ' cancelled',
      ${i.col.updated_at} = datetime('now')
  WHERE ${i.col.promoted_to} = NEW.${d.col.id}
    AND ${i.col.status} NOT IN ('${IDEA_STATUS.abandoned}', '${IDEA_STATUS.implemented}');`,
    },
  },
  {
    name: "trg_spec_superseded_pb",
    def: {
      timing: "AFTER",
      event: "UPDATE",
      of: [s.col.status],
      table: s.table,
      when: `NEW.${s.col.status} = '${SPEC_STATUS.superseded}' AND OLD.${s.col.status} != '${SPEC_STATUS.superseded}'
  AND NOT EXISTS (SELECT 1 FROM _cascade_disabled WHERE value = 1)`,
      body: `INSERT INTO ${sh.table} (${sh.col.entity_type}, ${sh.col.entity_id}, ${sh.col.old_status}, ${sh.col.new_status}, ${sh.col.changed_at}, ${sh.col.changed_by}, ${sh.col.reason}, ${sh.col.cascade_trigger})
  SELECT 'problem', ${p.col.id}, ${p.col.status}, '${PROBLEM_STATUS.open}', datetime('now'), 'cascade:auto',
         'SPEC ' || NEW.${s.col.id} || ' superseded', NEW.${s.col.id}
  FROM ${p.table}
  WHERE ${p.col.linked_spec} = NEW.${s.col.id}
    AND ${p.col.type} = '${PROBLEM_TYPE.spec}'
    AND ${p.col.status} = '${PROBLEM_STATUS.fixed}';

  UPDATE ${p.table}
  SET ${p.col.status} = '${PROBLEM_STATUS.open}',
      ${p.col.fix} = NULL,
      ${p.col.fixed_at} = NULL,
      ${p.col.tested} = '${TESTED_STATUS.not_ready}',
      ${p.col.updated_at} = datetime('now')
  WHERE ${p.col.linked_spec} = NEW.${s.col.id}
    AND ${p.col.type} = '${PROBLEM_TYPE.spec}'
    AND ${p.col.status} = '${PROBLEM_STATUS.fixed}';`,
    },
  },
];

// ─── Scope inheritance trigger (AFTER INSERT on status_history) ─────────────
// Copies scopes from the parent entity to the new status_history row.
// This ensures audit trail rows carry the scope context at the moment of change,
// for both write-tool insertions and cascade-trigger insertions.

const scopeInheritanceTriggers: ReadonlyArray<{ name: string; def: ITriggerDefinition }> = [
  {
    name: "trg_status_history_scopes",
    def: {
      timing: "AFTER",
      event: "INSERT",
      table: tables.status_history.names.table,
      when: "",
      body: `INSERT INTO ${tables.entity_scopes.names.table} (${tables.entity_scopes.names.col.entity_type}, ${tables.entity_scopes.names.col.entity_id}, ${tables.entity_scopes.names.col.scope_id})
  SELECT 'status_history', CAST(NEW.${tables.status_history.names.col.id} AS TEXT), es.${tables.entity_scopes.names.col.scope_id}
  FROM ${tables.entity_scopes.names.table} es
  WHERE es.${tables.entity_scopes.names.col.entity_type} = NEW.${tables.status_history.names.col.entity_type} AND es.${tables.entity_scopes.names.col.entity_id} = NEW.${tables.status_history.names.col.entity_id};`,
    },
  },
];

// ─── Supersession trigger (AFTER INSERT on decision_supersedes) ──────────────
// Updates decisions.superseded_by on the superseded decision to point to the superseding decision.
// Last INSERT wins (most recent superseding decision chronologically).

const supersessionTriggers: ReadonlyArray<{ name: string; def: ITriggerDefinition }> = [
  {
    name: "trg_decision_supersedes_insert",
    def: {
      timing: "AFTER",
      event: "INSERT",
      table: ds.table,
      when: "",
      body: `UPDATE ${d.table}
  SET ${d.col.superseded_by} = NEW.${ds.col.superseding_id},
      ${d.col.updated_at} = datetime('now')
  WHERE ${d.col.id} = NEW.${ds.col.superseded_id};`,
    },
  },
];

// ─── FTS5 sync triggers (6 tables × INSERT/UPDATE/DELETE = 18 triggers) ──────
// Pattern: INSERT → index new row. UPDATE → delete old + insert new. DELETE → delete.
// FTS5 rowid is INTEGER (auto-assigned). Entity IDs are TEXT — filtered by (entity_id, entity_type).

/** Extract column names referenced as NEW.col or OLD.col from a SQL expression. */
function extractCols(expr: string): string[] {
  const matches = expr.match(/(?:NEW|OLD)\.(\w+)/g) ?? [];
  return [...new Set(matches.map((m) => m.split(".")[1]))];
}

/** Validate that columns referenced in NEW/OLD expressions exist in the table definition. */
function assertColsExist(table: string, ...exprs: string[]): void {
  const tableCols = tables[table as keyof typeof tables]?.cols;
  if (!tableCols) throw new Error(`FTS5 trigger: unknown table "${table}"`);
  for (const expr of exprs) {
    for (const col of extractCols(expr)) {
      if (!tableCols.includes(col)) {
        throw new Error(`FTS5 trigger on "${table}": column "${col}" not found in table definition`);
      }
    }
  }
}

/** Build the 3 FTS5 sync triggers (insert/update/delete) for a given table. */
function fts5TriggersFor(
  table: string,
  entityType: string,
  titleExpr: string,
  bodyExpr: string,
): Array<{ name: string; def: ITriggerDefinition }> {
  assertColsExist(table, titleExpr, bodyExpr);
  const idExpr = table === le.table ? "CAST(NEW.id AS TEXT)" : "NEW.id";
  const oldIdExpr = table === le.table ? "CAST(OLD.id AS TEXT)" : "OLD.id";
  return [
    {
      name: `trg_${table}_fts_insert`,
      def: {
        timing: "AFTER",
        event: "INSERT",
        table,
        body: `INSERT INTO search_index (entity_type, entity_id, title, body)
  VALUES ('${entityType}', ${idExpr}, ${titleExpr},
          ${bodyExpr});`,
      },
    },
    {
      name: `trg_${table}_fts_update`,
      def: {
        timing: "AFTER",
        event: "UPDATE",
        table,
        body: `DELETE FROM search_index WHERE entity_id = ${oldIdExpr} AND entity_type = '${entityType}';
  INSERT INTO search_index (entity_type, entity_id, title, body)
  VALUES ('${entityType}', ${idExpr}, ${titleExpr},
          ${bodyExpr});`,
      },
    },
    {
      name: `trg_${table}_fts_delete`,
      def: {
        timing: "AFTER",
        event: "DELETE",
        table,
        body: `DELETE FROM search_index WHERE entity_id = ${oldIdExpr} AND entity_type = '${entityType}';`,
      },
    },
  ];
}

// ─── FTS5 triggers for free_fields (conditional) ─────────────────────────────
// Unlike entity tables, free_fields uses:
// - CAST(NEW.id AS TEXT) as FTS entity_id (free_fields has INTEGER PK)
// - entity_type 'free_field' in FTS (distinct from parent entity types)
// - Conditional indexing: only when fts_indexed = 1 AND status = 'active'
// - INSERT ... SELECT ... WHERE pattern for conditional insert

const freeFieldFtsTriggers: ReadonlyArray<{ name: string; def: ITriggerDefinition }> = [
  {
    name: "trg_free_fields_fts_insert",
    def: {
      timing: "AFTER",
      event: "INSERT",
      table: ff.table,
      when: `NEW.${ff.col.fts_indexed} = 1 AND NEW.${ff.col.status} = 'active'`,
      body: `INSERT INTO search_index (entity_type, entity_id, title, body)
  SELECT 'free_field', CAST(NEW.${ff.col.id} AS TEXT), NEW.${ff.col.key}, NEW.${ff.col.value}
  WHERE NEW.${ff.col.fts_indexed} = 1 AND NEW.${ff.col.status} = 'active';`,
    },
  },
  {
    name: "trg_free_fields_fts_update",
    def: {
      timing: "AFTER",
      event: "UPDATE",
      table: ff.table,
      when: "",
      body: `DELETE FROM search_index WHERE entity_id = CAST(OLD.${ff.col.id} AS TEXT) AND entity_type = 'free_field';
  INSERT INTO search_index (entity_type, entity_id, title, body)
  SELECT 'free_field', CAST(NEW.${ff.col.id} AS TEXT), NEW.${ff.col.key}, NEW.${ff.col.value}
  WHERE NEW.${ff.col.fts_indexed} = 1 AND NEW.${ff.col.status} = 'active';`,
    },
  },
  {
    name: "trg_free_fields_fts_delete",
    def: {
      timing: "AFTER",
      event: "DELETE",
      table: ff.table,
      when: "",
      body: `DELETE FROM search_index WHERE entity_id = CAST(OLD.${ff.col.id} AS TEXT) AND entity_type = 'free_field';`,
    },
  },
];

const fts5Triggers: ReadonlyArray<{ name: string; def: ITriggerDefinition }> = [
  ...fts5TriggersFor(d.table, "decision",
    `NEW.${d.col.title}`,
    `NEW.${d.col.context} || ' ' || NEW.${d.col.decision} || ' ' || NEW.${d.col.consequences}`),
  ...fts5TriggersFor(a.table, "action",
    `NEW.${a.col.title}`,
    `NEW.${a.col.body} || ' ' || COALESCE(NEW.${a.col.evidence}, '') || ' ' || COALESCE(NEW.${a.col.blockers}, '')`),
  ...fts5TriggersFor(i.table, "idea",
    `NEW.${i.col.title}`,
    `COALESCE(NEW.${i.col.short_desc}, '') || ' ' || COALESCE(NEW.${i.col.long_desc}, '')`),
  ...fts5TriggersFor(p.table, "problem",
    `NEW.${p.col.title}`,
    `COALESCE(NEW.${p.col.description}, '') || ' ' || COALESCE(NEW.${p.col.root_cause}, '') || ' ' || COALESCE(NEW.${p.col.fix}, '')`),
  ...fts5TriggersFor(s.table, "spec",
    `NEW.${s.col.filename}`,
    `''`),
  ...fts5TriggersFor(le.table, "log_entry",
    `COALESCE(NEW.${le.col.subject}, '')`,
    `COALESCE(NEW.${le.col.body}, '')`),
  ...freeFieldFtsTriggers,
];

const allTriggers = [...cascadeTriggers, ...scopeInheritanceTriggers, ...supersessionTriggers, ...fts5Triggers];

/** Generate the complete triggers SQL via qb.createTrigger. */
export function generateTriggersSQL(): string {
  const lines: string[] = [
    "-- Governance MCP triggers (generated by @ytrynot/gov-mcp via @ytrynot/qb.createTrigger)",
    "-- 4 cascade triggers + 1 scope inheritance trigger + 1 supersession trigger + 21 FTS5 sync triggers = 27 triggers total",
    "",
    "-- ═══ Cascade triggers (AFTER UPDATE) ═══════════════════════════════════════",
    "-- Unidirectional, atomic, impossible to bypass.",
    "-- Cascades can be disabled via a flag table:",
    "--   UPDATE _cascade_disabled SET value = 1;  -- disable",
    "--   UPDATE _cascade_disabled SET value = 0;  -- re-enable",
    "",
  ];

  for (const { name, def } of cascadeTriggers) {
    lines.push(QueryBuilder.createTrigger(name, def));
    lines.push("");
  }

  lines.push("-- ═══ Scope inheritance trigger (AFTER INSERT on status_history) ══════════");
  lines.push("-- Copies scopes from the parent entity to the new status_history row.");
  lines.push("-- Ensures audit trail rows carry the scope context at the moment of change.");
  lines.push("");

  for (const { name, def } of scopeInheritanceTriggers) {
    lines.push(QueryBuilder.createTrigger(name, def));
    lines.push("");
  }

  lines.push("-- ═══ Supersession trigger (AFTER INSERT on decision_supersedes) ════════════");
  lines.push("-- Updates decisions.superseded_by on the superseded decision.");
  lines.push("");

  for (const { name, def } of supersessionTriggers) {
    lines.push(QueryBuilder.createTrigger(name, def));
    lines.push("");
  }

  lines.push("-- ═══ FTS5 sync triggers ═════════════════════════════════════════════════════");
  lines.push("-- Pattern: INSERT → index new row. UPDATE → delete old + insert new. DELETE → delete.");
  lines.push("-- FTS5 rowid is INTEGER (auto-assigned). Entity IDs are TEXT — filtered by (entity_id, entity_type).");
  lines.push("");

  for (const { name, def } of fts5Triggers) {
    lines.push(QueryBuilder.createTrigger(name, def));
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/** All trigger definitions (for inspection or programmatic use). */
export const triggerDefinitions = allTriggers;
