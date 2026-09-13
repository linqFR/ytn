/**
 * tool-schemas.ts — Tool schemas without handlers (shared type-level).
 *
 * This module contains only DNA schemas (input, output) and metadata
 * (isReadonly). It does NOT import any handler code, SQLite queries,
 * or server-side logic. It is safe to import from the client for type
 * derivation.
 *
 * Tool categories are defined in the schema's `.meta({ category })` —
 * no duplication here.
 *
 * `tools.ts` imports this and adds `handler` for each tool.
 * `client.ts` imports this as `import type` only (erased at compile-time).
 */

import * as S from "./tool-inputs.js";
import * as O from "./tool-outputs.js";

export const toolSchemas = {
  // ── Writers ──
  register_writer: { schema: S.registerWriterInput, output: O.registerWriterOutputSchema, isReadonly: false },
  register_me: {
    schema: S.registerWriterInput.meta({
      description:
        "Alias for register_writer. Register yourself as a writer and receive a nanoid token.",
      usage: [
        "Alias for register_writer.",
        "See register_writer for full documentation.",
      ],
    }),
    output: O.registerWriterOutputSchema,
    isReadonly: false,
  },
  whoami: { schema: S.whoamiInput, output: O.whoamiOutputSchema, isReadonly: true },
  list_writers: { schema: S.listWritersInput, output: O.listWritersOutputSchema, isReadonly: true },
  update_me: { schema: S.updateMeInput, output: O.updateMeOutputSchema, isReadonly: false },

  // ── Read ──
  list_decisions: { schema: S.listDecisionsInput, output: O.listDecisionsOutputSchema, isReadonly: true },
  get_decision: { schema: S.getDecisionInput, output: O.getDecisionOutputSchema, isReadonly: true },
  list_actions: { schema: S.listActionsInput, output: O.listActionsOutputSchema, isReadonly: true },
  get_action: { schema: S.getActionInput, output: O.getActionOutputSchema, isReadonly: true },
  list_ideas: { schema: S.listIdeasInput, output: O.listIdeasOutputSchema, isReadonly: true },
  get_idea: { schema: S.getIdeaInput, output: O.getIdeaOutputSchema, isReadonly: true },
  list_problems: { schema: S.listProblemsInput, output: O.listProblemsOutputSchema, isReadonly: true },
  get_problem: { schema: S.getProblemInput, output: O.getProblemOutputSchema, isReadonly: true },
  list_specs: { schema: S.listSpecsInput, output: O.listSpecsOutputSchema, isReadonly: true },
  get_spec: { schema: S.getSpecInput, output: O.getSpecOutputSchema, isReadonly: true },
  list_scopes: { schema: S.listScopesInput, output: O.listScopesOutputSchema, isReadonly: true },
  get_scope_info: { schema: S.getScopeInput, output: O.getScopeOutputSchema, isReadonly: true },
  list_log_entries: { schema: S.listLogEntriesInput, output: O.listLogEntriesOutputSchema, isReadonly: true },
  get_last_log_entry: { schema: S.getLastLogEntryInput, output: O.getLastLogEntryOutputSchema, isReadonly: true },
  get_thread: { schema: S.getThreadInput, output: O.getThreadOutputSchema, isReadonly: true },
  get_updates: { schema: S.getUpdatesInput, output: O.getUpdatesOutputSchema, isReadonly: true },
  list_docs: { schema: S.listDocsInput, output: O.listDocsOutputSchema, isReadonly: true },
  get_doc: { schema: S.getDocInput, output: O.getDocOutputSchema, isReadonly: true },
  get_free_fields: { schema: S.getFreeFieldsInput, output: O.getFreeFieldsOutputSchema, isReadonly: true },

  // ── Search ──
  search_mailbox: { schema: S.searchMailboxInput, output: O.searchMailboxOutputSchema, isReadonly: true },
  mailbox_last_24h: { schema: S.mailboxLast24hInput, output: O.mailboxLast24hOutputSchema, isReadonly: true },

  // ── Read: history & lineage ──
  get_decision_history: { schema: S.getDecisionHistoryInput, output: O.getDecisionHistoryOutputSchema, isReadonly: true },
  get_action_lineage: { schema: S.getActionLineageInput, output: O.getActionLineageOutputSchema, isReadonly: true },
  get_open_actions: { schema: S.getOpenActionsInput, output: O.getOpenActionsOutputSchema, isReadonly: true },
  get_handoff: { schema: S.getHandoffInput, output: O.getHandoffOutputSchema, isReadonly: true },
  audit_consistency: { schema: S.auditConsistencyInput, output: O.auditConsistencyOutputSchema, isReadonly: true },

  // ── Write ──
  create_decision: { schema: S.createDecisionInput, output: O.createDecisionOutputSchema, isReadonly: false },
  update_decision_status: { schema: S.updateDecisionStatusInput, output: O.updateDecisionStatusOutputSchema, isReadonly: false },
  create_action: { schema: S.createActionInput, output: O.createActionOutputSchema, isReadonly: false },
  update_action_status: { schema: S.updateActionStatusInput, output: O.updateActionStatusOutputSchema, isReadonly: false },
  create_idea: { schema: S.createIdeaInput, output: O.createIdeaOutputSchema, isReadonly: false },
  update_idea_status: { schema: S.updateIdeaStatusInput, output: O.updateIdeaStatusOutputSchema, isReadonly: false },
  create_problem: { schema: S.createProblemInput, output: O.createProblemOutputSchema, isReadonly: false },
  update_problem_status: { schema: S.updateProblemStatusInput, output: O.updateProblemStatusOutputSchema, isReadonly: false },
  link_problem_action: { schema: S.linkProblemActionInput, output: O.linkProblemActionOutputSchema, isReadonly: false },
  link_action_workstream: { schema: S.linkActionWorkstreamInput, output: O.linkActionWorkstreamOutputSchema, isReadonly: false },
  link_action_dependency: { schema: S.linkActionDependencyInput, output: O.linkActionDependencyOutputSchema, isReadonly: false },
  create_spec: { schema: S.createSpecInput, output: O.createSpecOutputSchema, isReadonly: false },
  update_spec_status: { schema: S.updateSpecStatusInput, output: O.updateSpecStatusOutputSchema, isReadonly: false },
  create_scope: { schema: S.createScopeInput, output: O.createScopeOutputSchema, isReadonly: false },
  update_scope: { schema: S.updateScopeInput, output: O.updateScopeOutputSchema, isReadonly: false },
  append_log_entry: { schema: S.appendLogEntryInput, output: O.appendLogEntryOutputSchema, isReadonly: false },
  correct: { schema: S.correctInput, output: O.correctOutputSchema, isReadonly: false },
  add_free_field: { schema: S.addFreeFieldInput, output: O.addFreeFieldOutputSchema, isReadonly: false },
  deprecate_free_field: { schema: S.deprecateFreeFieldInput, output: O.deprecateFreeFieldOutputSchema, isReadonly: false },

  // ── Reports ──
  generate_daily_report: { schema: S.generateDailyReportInput, output: O.generateDailyReportOutputSchema, isReadonly: false },
  generate_decisions_report: { schema: S.generateDecisionsReportInput, output: O.generateDecisionsReportOutputSchema, isReadonly: false },
  generate_actions_report: { schema: S.generateActionsReportInput, output: O.generateActionsReportOutputSchema, isReadonly: false },
  generate_ideas_report: { schema: S.generateIdeasReportInput, output: O.generateIdeasReportOutputSchema, isReadonly: false },
  generate_problems_report: { schema: S.generateProblemsReportInput, output: O.generateProblemsReportOutputSchema, isReadonly: false },
  generate_specs_report: { schema: S.generateSpecsReportInput, output: O.generateSpecsReportOutputSchema, isReadonly: false },
  generate_decision_history_report: { schema: S.generateDecisionHistoryReportInput, output: O.generateDecisionHistoryReportOutputSchema, isReadonly: false },
  export_dump: { schema: S.exportDumpInput, output: O.exportDumpOutputSchema, isReadonly: false },
  generate_all_reports: { schema: S.generateAllReportsInput, output: O.generateAllReportsOutputSchema, isReadonly: false },
};
