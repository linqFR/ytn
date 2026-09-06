/**
 * Row types — typed interfaces for SQLite query results (IStatement<T>).
 */

export interface IDecisionRow {
  id: string;
  seq: number;
  title: string;
  status: string;
  date: string;
  decider: string;
  superseded_by: string | null;
  spec_ref: string | null;
  context: string | null;
  decision: string | null;
  consequences: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface IActionRow {
  id: string;
  seq: number;
  title: string;
  status: string;
  date: string;
  owner: string | null;
  priority: string | null;
  source: string | null;
  source_type: string | null;
  spec_ref: string | null;
  body: string | null;
  blockers: string | null;
  evidence: string | null;
  defer_reason: string | null;
  cancel_reason: string | null;
  tested: string;
  created_at: string;
  updated_at: string;
}

export interface IIdeaRow {
  id: string;
  seq: number;
  title: string;
  status: string;
  date: string;
  package: string | null;
  priority: string | null;
  promoted_to: string | null;
  short_desc: string | null;
  long_desc: string | null;
  abandon_reason: string | null;
  tested: string;
  created_at: string;
  updated_at: string;
}

export interface IProblemRow {
  id: string;
  seq: number;
  title: string;
  status: string;
  date: string;
  severity: string;
  type: string;
  linked_spec: string | null;
  linked_act: string | null;
  description: string | null;
  root_cause: string | null;
  fix: string | null;
  wontfix_reason: string | null;
  fast_track: number;
  tested: string;
  created_at: string;
  updated_at: string;
  fixed_at: string | null;
}

export interface ISpecRow {
  id: string;
  filename: string;
  date: string;
  package: string | null;
  version: number;
  status: string;
  supersedes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IScopeRow {
  id: string;
  label: string;
  description: string | null;
  parent: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IWriterRow {
  id: string;
  nanoid: string;
  role: string;
  responsibility: string | null;
  default_scope: string;
  display_name: string | null;
  objective: string | null;
  expertise: string | null;
  prohibitions: string | null;
  last_read_log_id: number;
  created_at: string;
}

export interface ILogEntryRow {
  id: number;
  date: string;
  timestamp: string;
  type: string;
  author: string | null;
  audience: string | null;
  subject: string | null;
  body: string | null;
  ref_id: string | null;
  reply_to: number | null;
  thread_id: number | null;
}

export interface IStatusHistoryRow {
  id: number;
  entity_type: string;
  entity_id: string;
  old_status: string | null;
  new_status: string;
  changed_at: string;
  changed_by: string;
  reason: string | null;
  cascade_trigger: string | null;
}

export interface IActionDependencyRow {
  action_id: string;
  depends_on: string;
}

export interface IProblemActionRow {
  problem_id: string;
  action_id: string;
  role: string | null;
  created_at: string;
}

export interface IActionWorkstreamRow {
  action_id: string;
  workstream_id: string;
}

export interface INextSeqRow {
  next_seq: number;
}

export interface ICountRow {
  count: number;
}

export interface ICursorRow {
  last_read_log_id: number;
}

export interface IScopeTreeRow {
  id: string;
}

export interface IFTS5SearchRow {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
}

export interface IDecisionSupersedesRow {
  superseding_id: string;
  superseded_id: string;
  partial: number | null;
}

export interface IEntityScopeRow {
  entity_type: string;
  entity_id: string;
  scope_id: string;
}

export interface IFreeFieldRow {
  id: number;
  entity_type: string;
  entity_id: string;
  key: string;
  format: string;
  value: string;
  fts_indexed: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}
