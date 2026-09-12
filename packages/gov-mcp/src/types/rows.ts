/**
 * Row types — typed interfaces for SQLite query results (IStatement<T>).
 */

export interface tsDecisionRow {
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

export interface tsActionRow {
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

export interface tsIdeaRow {
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

export interface tsProblemRow {
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

export interface tsSpecRow {
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

export interface tsScopeRow {
  id: string;
  label: string;
  description: string | null;
  parent: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface tsWriterRow {
  id: string;
  nanoid: string;
  role: string;
  responsibility: string | null;
  default_scope: string;
  display_name: string | null;
  objective: string | null;
  expertise: string | null;
  prohibitions: string | null;
  last_read_at: string;
  created_at: string;
}

export interface tsLogEntryRow {
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

export interface tsStatusHistoryRow {
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

export interface tsActionDependencyRow {
  action_id: string;
  depends_on: string;
}

export interface tsProblemActionRow {
  problem_id: string;
  action_id: string;
  role: string | null;
  created_at: string;
}

export interface tsActionWorkstreamRow {
  action_id: string;
  workstream_id: string;
}

export interface tsNextSeqRow {
  next_seq: number;
}

export interface tsCountRow {
  count: number;
}

export interface tsCursorRow {
  last_read_at: string;
}

export interface tsScopeTreeRow {
  id: string;
}

export interface tsFTS5SearchRow {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
}

export interface tsDecisionSupersedesRow {
  superseding_id: string;
  superseded_id: string;
  partial: number | null;
}

export interface tsEntityScopeRow {
  entity_type: string;
  entity_id: string;
  scope_id: string;
}

export interface tsFreeFieldRow {
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
