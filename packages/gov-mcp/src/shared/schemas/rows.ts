/**
 * rows.ts — DNA schemas for database table rows.
 *
 * These schemas are the single source of truth for:
 * 1. DDL generation — passed to `qb.defTable(name, schema)` (server-only).
 * 2. TypeScript types — `dna.infer<typeof writerRowSchema>` replaces manual `ts*Row` interfaces.
 * 3. MCP output validation — used in `tool-outputs.ts` instead of `dna.any()`.
 *
 * DB-specific metadata (pk, unique, fk, readonly, pkauto) is declared via `.meta()`.
 * CHECK constraints are passed as table-level `options.checks` in `schema.ts` since
 * the DNA introspector does not extract `check` from `.meta()`.
 *
 * Query-result types (tsNextSeqRow, tsCountRow, tsCursorRow, tsScopeTreeRow, tsFTS5SearchRow)
 * remain as plain interfaces in types/rows.ts — they don't map to physical tables.
 */

import { dna } from "@ytrynot/dna";
import {
  ROOT_SCOPE_ID,
  TESTED_STATUS,
} from "../enums.js";

// ─── Common defaults ─────────────────────────────────────────────────────────

const TESTED_DEFAULT = TESTED_STATUS.not_ready;

// ─── Table row schemas ────────────────────────────────────────────────────────

export const scopeRowSchema = dna.object({
  id: dna.string().meta({ pk: true }),
  label: dna.string(),
  description: dna.string().nullable(),
  parent: dna.string().nullable().meta({ fk: { table: "scopes", col: "id" } }),
  sort_order: dna.int().default(0),
  created_at: dna.string(),
  updated_at: dna.string(),
});

export const decisionRowSchema = dna.object({
  id: dna.string().meta({ pk: true, readonly: true }),
  seq: dna.int().meta({ unique: true, readonly: true }),
  title: dna.string(),
  status: dna.string(),
  date: dna.string(),
  decider: dna.string(),
  superseded_by: dna.string().nullable().meta({ fk: { table: "decisions", col: "id" }, readonly: true }),
  spec_ref: dna.string().nullable().meta({ fk: { table: "specs", col: "id" } }),
  context: dna.string().nullable(),
  decision: dna.string().nullable(),
  consequences: dna.string().nullable(),
  source: dna.string().nullable(),
  created_at: dna.string().meta({ readonly: true }),
  updated_at: dna.string().meta({ readonly: true }),
});

export const decisionSupersedesRowSchema = dna.object({
  superseding_id: dna.string().meta({ fk: { table: "decisions", col: "id" } }),
  superseded_id: dna.string().meta({ fk: { table: "decisions", col: "id" } }),
  partial: dna.int().nullable(),
});

export const entityScopeRowSchema = dna.object({
  entity_type: dna.string(),
  entity_id: dna.string(),
  scope_id: dna.string().meta({ fk: { table: "scopes", col: "id" } }),
});

export const freeFieldRowSchema = dna.object({
  id: dna.int().meta({ pk: true }),
  entity_type: dna.string(),
  entity_id: dna.string(),
  key: dna.string(),
  format: dna.string(),
  value: dna.string(),
  fts_indexed: dna.int().nullable(),
  status: dna.string().nullable(),
  created_at: dna.string(),
  updated_at: dna.string(),
});

export const actionDependencyRowSchema = dna.object({
  action_id: dna.string().meta({ fk: { table: "actions", col: "id" } }),
  depends_on: dna.string().meta({ fk: { table: "actions", col: "id" } }),
});

export const problemActionRowSchema = dna.object({
  problem_id: dna.string().meta({ fk: { table: "problems", col: "id" } }),
  action_id: dna.string().meta({ fk: { table: "actions", col: "id" } }),
  role: dna.string().nullable(),
  created_at: dna.string(),
});

export const workstreamRowSchema = dna.object({
  id: dna.string().meta({ pk: true }),
  label: dna.string(),
  description: dna.string().nullable(),
  sort_order: dna.int().default(0),
  created_at: dna.string(),
  updated_at: dna.string(),
});

export const actionWorkstreamRowSchema = dna.object({
  action_id: dna.string().meta({ fk: { table: "actions", col: "id" } }),
  workstream_id: dna.string().meta({ fk: { table: "workstreams", col: "id" } }),
});

export const ideaRowSchema = dna.object({
  id: dna.string().meta({ pk: true, readonly: true }),
  seq: dna.int().meta({ unique: true, readonly: true }),
  title: dna.string(),
  status: dna.string(),
  date: dna.string(),
  package: dna.string().nullable(),
  priority: dna.string().nullable(),
  promoted_to: dna.string().nullable().meta({ fk: { table: "decisions", col: "id" } }),
  short_desc: dna.string().nullable(),
  long_desc: dna.string().nullable(),
  abandon_reason: dna.string().nullable(),
  tested: dna.string().default(TESTED_DEFAULT),
  created_at: dna.string().meta({ readonly: true }),
  updated_at: dna.string().meta({ readonly: true }),
});

export const problemRowSchema = dna.object({
  id: dna.string().meta({ pk: true, readonly: true }),
  seq: dna.int().meta({ unique: true, readonly: true }),
  title: dna.string(),
  status: dna.string(),
  date: dna.string(),
  severity: dna.string(),
  type: dna.string(),
  linked_spec: dna.string().nullable().meta({ fk: { table: "specs", col: "id" } }),
  linked_act: dna.string().nullable().meta({ fk: { table: "actions", col: "id" } }),
  description: dna.string().nullable(),
  root_cause: dna.string().nullable(),
  fix: dna.string().nullable(),
  wontfix_reason: dna.string().nullable(),
  fast_track: dna.int().default(0),
  tested: dna.string().default(TESTED_DEFAULT),
  created_at: dna.string().meta({ readonly: true }),
  updated_at: dna.string().meta({ readonly: true }),
  fixed_at: dna.string().nullable(),
});

export const specRowSchema = dna.object({
  id: dna.string().meta({ pk: true, readonly: true }),
  filename: dna.string(),
  package: dna.string().nullable(),
  version: dna.int(),
  status: dna.string(),
  date: dna.string(),
  supersedes: dna.string().nullable().meta({ fk: { table: "specs", col: "id" } }),
  created_at: dna.string().meta({ readonly: true }),
  updated_at: dna.string().meta({ readonly: true }),
});

export const statusHistoryRowSchema = dna.object({
  id: dna.int().meta({ pkauto: true }),
  entity_type: dna.string(),
  entity_id: dna.string(),
  old_status: dna.string().nullable(),
  new_status: dna.string(),
  changed_at: dna.string(),
  changed_by: dna.string(),
  reason: dna.string().nullable(),
  cascade_trigger: dna.string().nullable(),
});

export const actionRowSchema = dna.object({
  id: dna.string().meta({ pk: true, readonly: true }),
  seq: dna.int().meta({ unique: true, readonly: true }),
  title: dna.string(),
  status: dna.string(),
  date: dna.string(),
  owner: dna.string().nullable(),
  priority: dna.string().nullable(),
  source: dna.string().nullable(),
  source_type: dna.string().nullable().meta({ readonly: true }),
  spec_ref: dna.string().nullable().meta({ fk: { table: "specs", col: "id" } }),
  body: dna.string().nullable(),
  blockers: dna.string().nullable(),
  evidence: dna.string().nullable(),
  defer_reason: dna.string().nullable(),
  cancel_reason: dna.string().nullable(),
  tested: dna.string().default(TESTED_DEFAULT),
  created_at: dna.string().meta({ readonly: true }),
  updated_at: dna.string().meta({ readonly: true }),
});

export const logEntryRowSchema = dna.object({
  id: dna.int().meta({ pkauto: true }),
  date: dna.string(),
  timestamp: dna.string(),
  type: dna.string(),
  author: dna.string().nullable(),
  audience: dna.string().nullable(),
  subject: dna.string().nullable(),
  body: dna.string().nullable(),
  ref_id: dna.string().nullable(),
  reply_to: dna.int().nullable().meta({ fk: { table: "log_entries", col: "id" } }),
  thread_id: dna.int().nullable(),
});

export const writerRowSchema = dna.object({
  id: dna.string().meta({ pk: true }),
  nanoid: dna.string().meta({ unique: true }),
  role: dna.string(),
  responsibility: dna.string().nullable(),
  default_scope: dna.string().default(ROOT_SCOPE_ID).meta({ fk: { table: "scopes", col: "id" } }),
  display_name: dna.string().nullable(),
  objective: dna.string().nullable(),
  expertise: dna.string().nullable(),
  prohibitions: dna.string().nullable(),
  last_read_at: dna.string().default("1970-01-01T00:00:00.000Z"),
  created_at: dna.string(),
});

// ─── Inferred TypeScript types (replace ts*Row interfaces) ───────────────────

export type tsScopeRow = dna.infer<typeof scopeRowSchema>;
export type tsDecisionRow = dna.infer<typeof decisionRowSchema>;
export type tsDecisionSupersedesRow = dna.infer<typeof decisionSupersedesRowSchema>;
export type tsEntityScopeRow = dna.infer<typeof entityScopeRowSchema>;
export type tsFreeFieldRow = dna.infer<typeof freeFieldRowSchema>;
export type tsActionDependencyRow = dna.infer<typeof actionDependencyRowSchema>;
export type tsProblemActionRow = dna.infer<typeof problemActionRowSchema>;
export type tsWorkstreamRow = dna.infer<typeof workstreamRowSchema>;
export type tsActionWorkstreamRow = dna.infer<typeof actionWorkstreamRowSchema>;
export type tsIdeaRow = dna.infer<typeof ideaRowSchema>;
export type tsProblemRow = dna.infer<typeof problemRowSchema>;
export type tsSpecRow = dna.infer<typeof specRowSchema>;
export type tsStatusHistoryRow = dna.infer<typeof statusHistoryRowSchema>;
export type tsActionRow = dna.infer<typeof actionRowSchema>;
export type tsLogEntryRow = dna.infer<typeof logEntryRowSchema>;
export type tsWriterRow = dna.infer<typeof writerRowSchema>;

// ─── Query-result types (not physical tables — remain as interfaces) ─────────

export interface tsNextSeqRow { next_seq: number; }
export interface tsCountRow { count: number; }
export interface tsCursorRow { last_read_at: string; }
export interface tsScopeTreeRow { id: string; }
export interface tsFTS5SearchRow { entity_type: string; entity_id: string; title: string; snippet: string; }
