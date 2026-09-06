/**
 * Tool metadata — structured descriptions for all MCP tools.
 *
 * The DNA schemas in `src/schemas/tool-inputs.ts` are the single source of
 * truth for tool documentation. Each schema carries `description`, `usage`,
 * and `category` via `.meta()`. This module derives `toolMeta` from those
 * schemas so the metadata never goes stale.
 *
 * `help` aggregates `toolMeta`; `server.ts` uses `description` for
 * registerTool.
 */

import * as S from "../schemas/tool-inputs.js";

export interface IToolMeta {
  /** Short description for MCP tools/list. */
  description: string;
  /** Detailed usage: what it does, parameters, return shape. */
  usage: string;
  /** Category for help grouping. */
  category: "writers" | "read" | "write" | "reports" | "search" | "system";
}

/**
 * Derive `IToolMeta` from a DNA schema's `.meta()` payload.
 *
 * The schema's `.meta()` getter returns the metadata object set via
 * `.meta({ description, usage, category, ... })`. This helper extracts the
 * three fields `IToolMeta` requires, with sensible fallbacks.
 *
 * @param schema - A DNA schema instance with `.meta()` metadata.
 * @param _toolName - The MCP tool name (unused, kept for readability).
 * @param overrides - Optional partial overrides (e.g. for alias tools).
 */
function metaFromSchema(
  schema: { meta(): Record<string, unknown> },
  _toolName: string,
  overrides?: Partial<IToolMeta>,
): IToolMeta {
  const m = schema.meta();
  return {
    description: (m.description as string) ?? "",
    usage: (m.usage as string) ?? "",
    category: (m.category as IToolMeta["category"]) ?? "system",
    ...overrides,
  };
}

export const toolMeta: Record<string, IToolMeta> = {
  // ── Writers ──────────────────────────────────────────────────────────────
  register_writer: metaFromSchema(S.registerWriterInput, "register_writer"),
  register_me: metaFromSchema(S.registerWriterInput, "register_me", {
    description: "Alias for register_writer. Register yourself as a writer and receive a nanoid token.",
    usage: `Alias for register_writer. See register_writer for full documentation.`,
  }),
  whoami: metaFromSchema(S.whoamiInput, "whoami"),
  list_writers: metaFromSchema(S.listWritersInput, "list_writers"),

  // ── Read: entities ───────────────────────────────────────────────────────
  list_decisions: metaFromSchema(S.listDecisionsInput, "list_decisions"),
  get_decision: metaFromSchema(S.getDecisionInput, "get_decision"),
  list_actions: metaFromSchema(S.listActionsInput, "list_actions"),
  get_action: metaFromSchema(S.getActionInput, "get_action"),
  list_ideas: metaFromSchema(S.listIdeasInput, "list_ideas"),
  get_idea: metaFromSchema(S.getIdeaInput, "get_idea"),
  list_problems: metaFromSchema(S.listProblemsInput, "list_problems"),
  get_problem: metaFromSchema(S.getProblemInput, "get_problem"),
  list_specs: metaFromSchema(S.listSpecsInput, "list_specs"),
  get_spec: metaFromSchema(S.getSpecInput, "get_spec"),
  list_scopes: metaFromSchema(S.listScopesInput, "list_scopes"),
  get_scope_info: metaFromSchema(S.getScopeInput, "get_scope_info"),

  // ── Read: log entries ────────────────────────────────────────────────────
  list_log_entries: metaFromSchema(S.listLogEntriesInput, "list_log_entries"),
  get_last_log_entry: metaFromSchema(S.getLastLogEntryInput, "get_last_log_entry"),
  get_thread: metaFromSchema(S.getThreadInput, "get_thread"),
  get_updates: metaFromSchema(S.getUpdatesInput, "get_updates"),

  // ── Search & transverse ──────────────────────────────────────────────────
  search_mailbox: metaFromSchema(S.searchMailboxInput, "search_mailbox"),
  mailbox_last_24h: metaFromSchema(S.mailboxLast24hInput, "mailbox_last_24h"),

  // ── Read: lineage & handoff ──────────────────────────────────────────────
  get_decision_history: metaFromSchema(S.getDecisionHistoryInput, "get_decision_history"),
  get_action_lineage: metaFromSchema(S.getActionLineageInput, "get_action_lineage"),
  get_open_actions: metaFromSchema(S.getOpenActionsInput, "get_open_actions"),
  get_handoff: metaFromSchema(S.getHandoffInput, "get_handoff"),
  audit_consistency: metaFromSchema(S.auditConsistencyInput, "audit_consistency"),

  // ── Write: decisions ─────────────────────────────────────────────────────
  create_decision: metaFromSchema(S.createDecisionInput, "create_decision"),
  update_decision_status: metaFromSchema(S.updateDecisionStatusInput, "update_decision_status"),

  // ── Write: actions ───────────────────────────────────────────────────────
  create_action: metaFromSchema(S.createActionInput, "create_action"),
  update_action_status: metaFromSchema(S.updateActionStatusInput, "update_action_status"),

  // ── Write: ideas ─────────────────────────────────────────────────────────
  create_idea: metaFromSchema(S.createIdeaInput, "create_idea"),
  update_idea_status: metaFromSchema(S.updateIdeaStatusInput, "update_idea_status"),

  // ── Write: problems ──────────────────────────────────────────────────────
  create_problem: metaFromSchema(S.createProblemInput, "create_problem"),
  update_problem_status: metaFromSchema(S.updateProblemStatusInput, "update_problem_status"),

  // ── Write: linking ───────────────────────────────────────────────────────
  link_problem_action: metaFromSchema(S.linkProblemActionInput, "link_problem_action"),
  link_action_workstream: metaFromSchema(S.linkActionWorkstreamInput, "link_action_workstream"),
  link_action_dependency: metaFromSchema(S.linkActionDependencyInput, "link_action_dependency"),

  // ── Write: specs ─────────────────────────────────────────────────────────
  create_spec: metaFromSchema(S.createSpecInput, "create_spec"),
  update_spec_status: metaFromSchema(S.updateSpecStatusInput, "update_spec_status"),

  // ── Write: scopes ────────────────────────────────────────────────────────
  create_scope: metaFromSchema(S.createScopeInput, "create_scope"),
  update_scope: metaFromSchema(S.updateScopeInput, "update_scope"),

  // ── Write: log & correct ─────────────────────────────────────────────────
  append_log_entry: metaFromSchema(S.appendLogEntryInput, "append_log_entry"),
  correct: metaFromSchema(S.correctInput, "correct"),

  // ── Write: free fields ────────────────────────────────────────────────────
  add_free_field: metaFromSchema(S.addFreeFieldInput, "add_free_field"),
  deprecate_free_field: metaFromSchema(S.deprecateFreeFieldInput, "deprecate_free_field"),

  // ── Read: free fields ─────────────────────────────────────────────────────
  get_free_fields: metaFromSchema(S.getFreeFieldsInput, "get_free_fields"),

  // ── Read: documentation ───────────────────────────────────────────────────
  list_docs: metaFromSchema(S.listDocsInput, "list_docs"),
  get_doc: metaFromSchema(S.getDocInput, "get_doc"),

  // ── Reports ──────────────────────────────────────────────────────────────
  generate_daily_report: metaFromSchema(S.generateDailyReportInput, "generate_daily_report"),
  generate_decisions_report: metaFromSchema(S.generateDecisionsReportInput, "generate_decisions_report"),
  generate_actions_report: metaFromSchema(S.generateActionsReportInput, "generate_actions_report"),
  generate_ideas_report: metaFromSchema(S.generateIdeasReportInput, "generate_ideas_report"),
  generate_problems_report: metaFromSchema(S.generateProblemsReportInput, "generate_problems_report"),
  generate_decision_history_report: metaFromSchema(S.generateDecisionHistoryReportInput, "generate_decision_history_report"),
  export_dump: metaFromSchema(S.exportDumpInput, "export_dump"),
  generate_all_reports: metaFromSchema(S.generateAllReportsInput, "generate_all_reports"),

  // ── System ───────────────────────────────────────────────────────────────
  help: metaFromSchema(S.helpInput, "help"),
};
