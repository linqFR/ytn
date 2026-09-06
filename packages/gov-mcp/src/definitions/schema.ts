/**
 * Schema definitions for the governance database.
 *
 * 16 tables, 40 indexes (3 partial), FTS5 virtual table.
 * All tables are defined via @ytrynot/qb defTable.
 * CHECK constraints use qb column-level check. FTS5 uses raw SQL (qb escape hatch).
 */

import { QueryBuilder, type qbTable } from "@ytrynot/qb";
import { ROOT_SCOPE_ID } from "./constants.js";
import { CASCADE_DDL } from "./cascade.js";
import { FTS5_DDL } from "./fts5.js";
import { TESTED_STATUS, TESTED_STATUSES } from "./enums.js";
import { ENTITY_TYPES, SOURCE_TYPES, LOG_ENTRY_TYPES, WRITER_ROLES } from "./enums.js";

/** SQL-quoted default value for scope columns — single-quoted ROOT_SCOPE_ID. */
const DEFAULT_SCOPE = `'${ROOT_SCOPE_ID}'`;

/** CHECK constraint for tested column — derived from TESTED_STATUSES enum. */
const TESTED_CHECK = `tested IN (${TESTED_STATUSES.map((v) => `'${v}'`).join(", ")})`;
const TESTED_DEFAULT = `'${TESTED_STATUS.not_ready}'`;

/** CHECK constraint helpers — derived from enum objects. */
const entityTypeCheck = (col: string) => `${col} IN (${ENTITY_TYPES.map((v) => `'${v}'`).join(",")})`;
const sourceTypeCheck = `source_type IN (${SOURCE_TYPES.map((v) => `'${v}'`).join(", ")})`;
const logEntryTypeCheck = `type IN (${LOG_ENTRY_TYPES.map((v) => `'${v}'`).join(",")})`;
const writerRoleCheck = `role IN (${WRITER_ROLES.map((v) => `'${v}'`).join(",")})`;

// ─── Table column definitions ────────────────────────────────────────────────

const scopesColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true },
  { name: "label", sqliteType: "TEXT" },
  { name: "description", sqliteType: "TEXT", optional: true },
  { name: "parent", sqliteType: "TEXT", optional: true, fk: { table: "scopes", col: "id" } },
  { name: "sort_order", sqliteType: "INTEGER", hasDefault: true, defaultValue: "0" },
  { name: "created_at", sqliteType: "TEXT" },
  { name: "updated_at", sqliteType: "TEXT" },
];

const decisionsColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true, readonly: true },
  { name: "seq", sqliteType: "INTEGER", unique: true, readonly: true },
  { name: "title", sqliteType: "TEXT" },
  { name: "status", sqliteType: "TEXT" },
  { name: "date", sqliteType: "TEXT" },
  { name: "decider", sqliteType: "TEXT" },
  { name: "superseded_by", sqliteType: "TEXT", optional: true, fk: { table: "decisions", col: "id" }, readonly: true },
  { name: "spec_ref", sqliteType: "TEXT", optional: true, fk: { table: "specs", col: "id" } },
  { name: "context", sqliteType: "TEXT", optional: true },
  { name: "decision", sqliteType: "TEXT", optional: true },
  { name: "consequences", sqliteType: "TEXT", optional: true },
  { name: "source", sqliteType: "TEXT", optional: true },
  { name: "created_at", sqliteType: "TEXT", readonly: true },
  { name: "updated_at", sqliteType: "TEXT", readonly: true },
];

const decisionSupersedesColumns: qbTable = [
  { name: "superseding_id", sqliteType: "TEXT", fk: { table: "decisions", col: "id" } },
  { name: "superseded_id", sqliteType: "TEXT", fk: { table: "decisions", col: "id" } },
  { name: "partial", sqliteType: "INTEGER", optional: true, check: "partial IN (0, 1)" },
];

const entityScopesColumns: qbTable = [
  { name: "entity_type", sqliteType: "TEXT", check: "entity_type IN ('decision','action','idea','problem','spec','log_entry','status_history','workstream')" },
  { name: "entity_id", sqliteType: "TEXT" },
  { name: "scope_id", sqliteType: "TEXT", fk: { table: "scopes", col: "id" } },
];

const freeFieldsColumns: qbTable = [
  { name: "id", sqliteType: "INTEGER", pk: true },
  { name: "entity_type", sqliteType: "TEXT", check: entityTypeCheck("entity_type") },
  { name: "entity_id", sqliteType: "TEXT" },
  { name: "key", sqliteType: "TEXT" },
  { name: "format", sqliteType: "TEXT", check: "format IN ('md','json','link','url','text')" },
  { name: "value", sqliteType: "TEXT" },
  { name: "fts_indexed", sqliteType: "INTEGER", optional: true, check: "fts_indexed IN (0, 1)" },
  { name: "status", sqliteType: "TEXT", check: "status IN ('active','deprecated')", optional: true },
  { name: "created_at", sqliteType: "TEXT" },
  { name: "updated_at", sqliteType: "TEXT" },
];

const actionDependenciesColumns: qbTable = [
  { name: "action_id", sqliteType: "TEXT", fk: { table: "actions", col: "id" } },
  { name: "depends_on", sqliteType: "TEXT", fk: { table: "actions", col: "id" } },
];

const problemActionsColumns: qbTable = [
  { name: "problem_id", sqliteType: "TEXT", fk: { table: "problems", col: "id" } },
  { name: "action_id", sqliteType: "TEXT", fk: { table: "actions", col: "id" } },
  { name: "role", sqliteType: "TEXT", optional: true },
  { name: "created_at", sqliteType: "TEXT" },
];

const workstreamsColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true },
  { name: "label", sqliteType: "TEXT" },
  { name: "description", sqliteType: "TEXT", optional: true },
  { name: "sort_order", sqliteType: "INTEGER", hasDefault: true, defaultValue: "0" },
  { name: "created_at", sqliteType: "TEXT" },
  { name: "updated_at", sqliteType: "TEXT" },
];

const actionWorkstreamsColumns: qbTable = [
  { name: "action_id", sqliteType: "TEXT", fk: { table: "actions", col: "id" } },
  { name: "workstream_id", sqliteType: "TEXT", fk: { table: "workstreams", col: "id" } },
];

const ideasColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true, readonly: true },
  { name: "seq", sqliteType: "INTEGER", unique: true, readonly: true },
  { name: "title", sqliteType: "TEXT" },
  { name: "status", sqliteType: "TEXT" },
  { name: "date", sqliteType: "TEXT" },
  { name: "package", sqliteType: "TEXT", optional: true },
  { name: "priority", sqliteType: "TEXT", optional: true },
  { name: "promoted_to", sqliteType: "TEXT", optional: true, fk: { table: "decisions", col: "id" } },
  { name: "short_desc", sqliteType: "TEXT", optional: true },
  { name: "long_desc", sqliteType: "TEXT", optional: true },
  { name: "abandon_reason", sqliteType: "TEXT", optional: true },
  { name: "tested", sqliteType: "TEXT", hasDefault: true, defaultValue: TESTED_DEFAULT, check: TESTED_CHECK },
  { name: "created_at", sqliteType: "TEXT", readonly: true },
  { name: "updated_at", sqliteType: "TEXT", readonly: true },
];

const problemsColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true, readonly: true },
  { name: "seq", sqliteType: "INTEGER", unique: true, readonly: true },
  { name: "title", sqliteType: "TEXT" },
  { name: "status", sqliteType: "TEXT" },
  { name: "date", sqliteType: "TEXT" },
  { name: "severity", sqliteType: "TEXT" },
  { name: "type", sqliteType: "TEXT" },
  { name: "linked_spec", sqliteType: "TEXT", optional: true, fk: { table: "specs", col: "id" } },
  { name: "linked_act", sqliteType: "TEXT", optional: true, fk: { table: "actions", col: "id" } },
  { name: "description", sqliteType: "TEXT", optional: true },
  { name: "root_cause", sqliteType: "TEXT", optional: true },
  { name: "fix", sqliteType: "TEXT", optional: true },
  { name: "wontfix_reason", sqliteType: "TEXT", optional: true },
  { name: "fast_track", sqliteType: "INTEGER", hasDefault: true, defaultValue: "0" },
  { name: "tested", sqliteType: "TEXT", hasDefault: true, defaultValue: TESTED_DEFAULT, check: TESTED_CHECK },
  { name: "created_at", sqliteType: "TEXT", readonly: true },
  { name: "updated_at", sqliteType: "TEXT", readonly: true },
  { name: "fixed_at", sqliteType: "TEXT", optional: true },
];

const specsColumns: qbTable = [
  { name: "id", sqliteType: "TEXT", pk: true, readonly: true },
  { name: "filename", sqliteType: "TEXT" },
  { name: "package", sqliteType: "TEXT", optional: true },
  { name: "version", sqliteType: "INTEGER" },
  { name: "status", sqliteType: "TEXT" },
  { name: "date", sqliteType: "TEXT" },
  { name: "supersedes", sqliteType: "TEXT", optional: true, fk: { table: "specs", col: "id" } },
  { name: "created_at", sqliteType: "TEXT", readonly: true },
  { name: "updated_at", sqliteType: "TEXT", readonly: true },
];

const statusHistoryColumns: qbTable = [
  { name: "id", sqliteType: "INTEGER", pkauto: true },
  { name: "entity_type", sqliteType: "TEXT" },
  { name: "entity_id", sqliteType: "TEXT" },
  { name: "old_status", sqliteType: "TEXT", optional: true },
  { name: "new_status", sqliteType: "TEXT" },
  { name: "changed_at", sqliteType: "TEXT" },
  { name: "changed_by", sqliteType: "TEXT" },
  { name: "reason", sqliteType: "TEXT", optional: true },
  { name: "cascade_trigger", sqliteType: "TEXT", optional: true },
];

// ─── Table definitions via qb ────────────────────────────────────────────────

export const tables = {
  scopes: QueryBuilder.defTable("scopes", scopesColumns),
  decisions: QueryBuilder.defTable("decisions", decisionsColumns),
  decision_supersedes: QueryBuilder.defTable(
    "decision_supersedes",
    decisionSupersedesColumns,
    { primaryKey: ["superseding_id", "superseded_id"] },
  ),
  entity_scopes: QueryBuilder.defTable(
    "entity_scopes",
    entityScopesColumns,
    { primaryKey: ["entity_type", "entity_id", "scope_id"] },
  ),
  free_fields: QueryBuilder.defTable(
    "free_fields",
    freeFieldsColumns,
    { primaryKey: ["id"] },
  ),
  action_dependencies: QueryBuilder.defTable(
    "action_dependencies",
    actionDependenciesColumns,
    { primaryKey: ["action_id", "depends_on"] },
  ),
  problem_actions: QueryBuilder.defTable(
    "problem_actions",
    problemActionsColumns,
    { primaryKey: ["problem_id", "action_id"] },
  ),
  workstreams: QueryBuilder.defTable("workstreams", workstreamsColumns),
  action_workstreams: QueryBuilder.defTable(
    "action_workstreams",
    actionWorkstreamsColumns,
    { primaryKey: ["action_id", "workstream_id"] },
  ),
  ideas: QueryBuilder.defTable("ideas", ideasColumns),
  problems: QueryBuilder.defTable("problems", problemsColumns),
  specs: QueryBuilder.defTable("specs", specsColumns),
  // actions, log_entries, writers: defined here with column-level CHECK constraints
  // via qb's check option. DDL is generated by defTable like all other tables.
  actions: QueryBuilder.defTable("actions", [
    { name: "id", sqliteType: "TEXT", pk: true, readonly: true },
    { name: "seq", sqliteType: "INTEGER", unique: true, readonly: true },
    { name: "title", sqliteType: "TEXT" },
    { name: "status", sqliteType: "TEXT" },
    { name: "date", sqliteType: "TEXT" },
    { name: "owner", sqliteType: "TEXT", optional: true },
    { name: "priority", sqliteType: "TEXT", optional: true },
    { name: "source", sqliteType: "TEXT", optional: true },
    { name: "source_type", sqliteType: "TEXT", optional: true, check: sourceTypeCheck, readonly: true },
    { name: "spec_ref", sqliteType: "TEXT", optional: true, fk: { table: "specs", col: "id" } },
    { name: "body", sqliteType: "TEXT", optional: true },
    { name: "blockers", sqliteType: "TEXT", optional: true },
    { name: "evidence", sqliteType: "TEXT", optional: true },
    { name: "defer_reason", sqliteType: "TEXT", optional: true },
    { name: "cancel_reason", sqliteType: "TEXT", optional: true },
    { name: "tested", sqliteType: "TEXT", hasDefault: true, defaultValue: TESTED_DEFAULT, check: TESTED_CHECK },
    { name: "created_at", sqliteType: "TEXT", readonly: true },
    { name: "updated_at", sqliteType: "TEXT", readonly: true },
  ]),
  log_entries: QueryBuilder.defTable("log_entries", [
    { name: "id", sqliteType: "INTEGER", pkauto: true },
    { name: "date", sqliteType: "TEXT" },
    { name: "timestamp", sqliteType: "TEXT" },
    { name: "type", sqliteType: "TEXT", check: logEntryTypeCheck },
    { name: "author", sqliteType: "TEXT", optional: true },
    { name: "audience", sqliteType: "TEXT", optional: true },
    { name: "subject", sqliteType: "TEXT", optional: true },
    { name: "body", sqliteType: "TEXT", optional: true },
    { name: "ref_id", sqliteType: "TEXT", optional: true },
    { name: "reply_to", sqliteType: "INTEGER", optional: true, fk: { table: "log_entries", col: "id" } },
    { name: "thread_id", sqliteType: "INTEGER", optional: true },
  ]),
  writers: QueryBuilder.defTable("writers", [
    { name: "id", sqliteType: "TEXT", pk: true },
    { name: "nanoid", sqliteType: "TEXT", unique: true },
    { name: "role", sqliteType: "TEXT", check: writerRoleCheck },
    { name: "responsibility", sqliteType: "TEXT", optional: true },
    { name: "default_scope", sqliteType: "TEXT", hasDefault: true, defaultValue: DEFAULT_SCOPE, fk: { table: "scopes", col: "id" } },
    { name: "display_name", sqliteType: "TEXT", optional: true },
    { name: "objective", sqliteType: "TEXT", optional: true },
    { name: "expertise", sqliteType: "TEXT", optional: true },
    { name: "prohibitions", sqliteType: "TEXT", optional: true },
    { name: "last_read_log_id", sqliteType: "INTEGER", hasDefault: true, defaultValue: "0" },
    { name: "created_at", sqliteType: "TEXT" },
  ]),
  status_history: QueryBuilder.defTable("status_history", statusHistoryColumns),
} as const;

// ─── Row types re-exported from types/rows.ts ────────────────────────────────
export type {
  IDecisionRow, IActionRow, IIdeaRow, IProblemRow, ISpecRow, IScopeRow,
  IWriterRow, ILogEntryRow, IStatusHistoryRow, IActionDependencyRow,
  IProblemActionRow, IActionWorkstreamRow, INextSeqRow, ICountRow,
  ICursorRow, IScopeTreeRow, IFTS5SearchRow,
} from "../types/rows.ts";

// FTS5_DDL and CASCADE_DDL are re-exported from their dedicated files.
export { FTS5_DDL } from "./fts5.js";
export { CASCADE_DDL } from "./cascade.js";

// ─── Indexes (generated by qb) ──────────────────────────────────────────────

/** Index definitions — generated via qb.createIndex. */
const indexDefs: ReadonlyArray<() => string> = [
  // decisions
  () => QueryBuilder.table("decisions").createIndex("idx_decisions_status", ["status"]).toSQL(),
  () => QueryBuilder.table("decisions").createIndex("idx_decisions_date", ["date"]).toSQL(),
  // actions
  () => QueryBuilder.table("actions").createIndex("idx_actions_status", ["status"]).toSQL(),
  () => QueryBuilder.table("actions").createIndex("idx_actions_source", ["source"]).toSQL(),
  () => QueryBuilder.table("actions").createIndex("idx_actions_source_type", ["source_type"]).toSQL(),
  () => QueryBuilder.table("actions").createIndex("idx_actions_priority", ["priority"]).toSQL(),
  // ideas
  () => QueryBuilder.table("ideas").createIndex("idx_ideas_promoted_to", ["promoted_to"]).toSQL(),
  () => QueryBuilder.table("ideas").createIndex("idx_ideas_status", ["status"]).toSQL(),
  () => QueryBuilder.table("ideas").createIndex("idx_ideas_package", ["package"]).toSQL(),
  // problems
  () => QueryBuilder.table("problems").createIndex("idx_problems_linked_act", ["linked_act"]).toSQL(),
  () => QueryBuilder.table("problems").createIndex("idx_problems_severity", ["severity"]).toSQL(),
  () => QueryBuilder.table("problems").createIndex("idx_problems_status", ["status"]).toSQL(),
  () => QueryBuilder.table("problems").createIndex("idx_problems_type", ["type"]).toSQL(),
  // specs
  () => QueryBuilder.table("specs").createIndex("idx_specs_status", ["status"]).toSQL(),
  () => QueryBuilder.table("specs").createIndex("idx_specs_package", ["package"]).toSQL(),
  // log_entries (2 partial)
  () => QueryBuilder.table("log_entries").createIndex("idx_log_entries_date", ["date"]).toSQL(),
  () => QueryBuilder.table("log_entries").createIndex("idx_log_entries_ref", ["ref_id"]).toSQL(),
  () => QueryBuilder.table("log_entries").createIndex("idx_log_entries_type", ["type"]).toSQL(),
  () => QueryBuilder.table("log_entries").createIndex("idx_log_entries_reply_to", ["reply_to"], { where: "reply_to IS NOT NULL" }).toSQL(),
  () => QueryBuilder.table("log_entries").createIndex("idx_log_entries_thread", ["thread_id"], { where: "thread_id IS NOT NULL" }).toSQL(),
  // status_history
  () => QueryBuilder.table("status_history").createIndex("idx_status_history_entity", ["entity_type", "entity_id"]).toSQL(),
  () => QueryBuilder.table("status_history").createIndex("idx_status_history_cascade", ["cascade_trigger"]).toSQL(),
  // junction tables
  () => QueryBuilder.table("problem_actions").createIndex("idx_problem_actions_action", ["action_id"]).toSQL(),
  () => QueryBuilder.table("action_workstreams").createIndex("idx_action_workstreams_workstream", ["workstream_id"]).toSQL(),
  () => QueryBuilder.table("decision_supersedes").createIndex("idx_decision_supersedes_superseded", ["superseded_id"]).toSQL(),
  () => QueryBuilder.table("entity_scopes").createIndex("idx_entity_scopes_scope", ["scope_id"]).toSQL(),
  () => QueryBuilder.table("entity_scopes").createIndex("idx_entity_scopes_entity", ["entity_type", "entity_id"]).toSQL(),
  () => QueryBuilder.table("free_fields").createIndex("idx_free_fields_entity", ["entity_type", "entity_id"]).toSQL(),
  () => QueryBuilder.table("free_fields").createIndex("idx_free_fields_key", ["key"]).toSQL(),
  // workstreams
  () => QueryBuilder.table("workstreams").createIndex("idx_workstreams_sort", ["sort_order"]).toSQL(),
  // scopes
  () => QueryBuilder.table("scopes").createIndex("idx_scopes_parent", ["parent"]).toSQL(),
  () => QueryBuilder.table("scopes").createIndex("idx_scopes_sort", ["sort_order"]).toSQL(),
];

/** Generate all index DDL statements via qb. Each statement ends with `;` for db.exec(). */
export function generateIndexDDL(): string[] {
  return indexDefs.map((fn) => `${fn()};`);
}

// ─── Full schema assembly ────────────────────────────────────────────────────

/** Generate the complete schema SQL (tables + CHECK + FTS5 + indexes). */
export function generateSchemaSQL(): string {
  // Tables without CHECK constraints — generated by qb
  const qbTables = [
    tables.scopes.createTable,
    tables.decisions.createTable,
    tables.decision_supersedes.createTable,
    tables.entity_scopes.createTable,
    tables.free_fields.createTable,
    tables.action_dependencies.createTable,
    tables.problem_actions.createTable,
    tables.workstreams.createTable,
    tables.action_workstreams.createTable,
    tables.ideas.createTable,
    tables.problems.createTable,
    tables.specs.createTable,
    tables.status_history.createTable,
    tables.actions.createTable,
    tables.log_entries.createTable,
    tables.writers.createTable,
  ];

  return [
    "-- Governance MCP schema (generated by @ytrynot/gov-mcp)",
    "-- All tables and indexes generated by @ytrynot/qb (CHECK constraints via column-level check)",
    ...qbTables,
    "",
    CASCADE_DDL,
    "",
    "-- FTS5 full-text search index",
    FTS5_DDL,
    "",
    "-- Indexes (40 total, 3 partial)",
    ...generateIndexDDL(),
  ].join("\n");
}
