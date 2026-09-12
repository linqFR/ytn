/**
 * Centralized tool registry — single source of truth for all MCP tools.
 *
 * Each tool is defined once here with its name, DNA schema (args), handler function,
 * and category. `server.ts` iterates over `toolList` to register all tools.
 * `meta.ts` derives metadata from the schemas. `describe-signature.ts` derives
 * signatures. `helpInput` is built dynamically from the tool names.
 *
 * Adding a new tool = adding one entry here + the schema in tool-inputs.ts + the
 * handler function. No other file needs updating.
 */

import { dna } from "@ytrynot/dna";
import * as S from "../schemas/tool-inputs.js";
import * as read from "../tools/read.js";
import * as reports from "../tools/reports.js";
import * as write from "../tools/write.js";
import { CATEGORY } from "./enums.js";
import type { IToolCategory } from "./enums.js";
import type { IToolCtx, OToolResult } from "../types/types.ts";
import { buildHelpInput } from "./help-input.js";

// ─── Tool definition type ────────────────────────────────────────────────────


type tsHandlerFn<A> = (ctx: IToolCtx, args: A) => OToolResult;

export interface IToolDef<A extends dna.DnaSomeType = dna.DnaSomeType> {
  args: A;
  handler: tsHandlerFn<dna.infer<A>>;
  category: IToolCategory;
}


const toolDefs = {
  // ── Writers ──
  register_writer: { handler: write.registerWriter, schema: S.registerWriterInput },
  register_me: {
    handler: write.registerWriter,
    schema: S.registerWriterInput.meta({
      description:
        "Alias for register_writer. Register yourself as a writer and receive a nanoid token.",
      usage: [
        "Alias for register_writer.",
        "See register_writer for full documentation.",
      ],
      category: CATEGORY.id,
    }),
  },
  whoami: { handler: read.whoami, schema: S.whoamiInput },
  list_writers: { handler: read.listWriters, schema: S.listWritersInput },
  update_me: { handler: write.updateMe, schema: S.updateMeInput },

  // ── Read ──
  list_decisions: { handler: read.listDecisions, schema: S.listDecisionsInput },
  get_decision: { handler: read.getDecision, schema: S.getDecisionInput },
  list_actions: { handler: read.listActions, schema: S.listActionsInput },
  get_action: { handler: read.getAction, schema: S.getActionInput },
  list_ideas: { handler: read.listIdeas, schema: S.listIdeasInput },
  get_idea: { handler: read.getIdea, schema: S.getIdeaInput },
  list_problems: { handler: read.listProblems, schema: S.listProblemsInput },
  get_problem: { handler: read.getProblem, schema: S.getProblemInput },
  list_specs: { handler: read.listSpecs, schema: S.listSpecsInput },
  get_spec: { handler: read.getSpec, schema: S.getSpecInput },
  list_scopes: { handler: read.listScopes, schema: S.listScopesInput },
  get_scope_info: { handler: read.getScope, schema: S.getScopeInput },
  list_log_entries: { handler: read.listLogEntries, schema: S.listLogEntriesInput },
  get_last_log_entry: { handler: read.getLastLogEntry, schema: S.getLastLogEntryInput },
  get_thread: { handler: read.getThread, schema: S.getThreadInput },
  get_updates: { handler: read.getUpdates, schema: S.getUpdatesInput },
  list_docs: { handler: read.listDocs, schema: S.listDocsInput },
  get_doc: { handler: read.getDoc, schema: S.getDocInput },
  get_free_fields: { handler: read.getFreeFields, schema: S.getFreeFieldsInput },

  // ── Search ──
  search_mailbox: { handler: read.searchMailbox, schema: S.searchMailboxInput },
  mailbox_last_24h: { handler: read.mailboxLast24h, schema: S.mailboxLast24hInput },

  // ── Read: history & lineage ──
  get_decision_history: { handler: read.getDecisionHistory, schema: S.getDecisionHistoryInput },
  get_action_lineage: { handler: read.getActionLineage, schema: S.getActionLineageInput },
  get_open_actions: { handler: read.getOpenActions, schema: S.getOpenActionsInput },
  get_handoff: { handler: read.getHandoff, schema: S.getHandoffInput },
  audit_consistency: { handler: read.auditConsistency, schema: S.auditConsistencyInput },

  // ── Write ──
  create_decision: { handler: write.createDecision, schema: S.createDecisionInput },
  update_decision_status: { handler: write.updateDecisionStatus, schema: S.updateDecisionStatusInput },
  create_action: { handler: write.createAction, schema: S.createActionInput },
  update_action_status: { handler: write.updateActionStatus, schema: S.updateActionStatusInput },
  create_idea: { handler: write.createIdea, schema: S.createIdeaInput },
  update_idea_status: { handler: write.updateIdeaStatus, schema: S.updateIdeaStatusInput },
  create_problem: { handler: write.createProblem, schema: S.createProblemInput },
  update_problem_status: { handler: write.updateProblemStatus, schema: S.updateProblemStatusInput },
  link_problem_action: { handler: write.linkProblemAction, schema: S.linkProblemActionInput },
  link_action_workstream: { handler: write.linkActionWorkstream, schema: S.linkActionWorkstreamInput },
  link_action_dependency: { handler: write.linkActionDependency, schema: S.linkActionDependencyInput },
  create_spec: { handler: write.createSpec, schema: S.createSpecInput },
  update_spec_status: { handler: write.updateSpecStatus, schema: S.updateSpecStatusInput },
  create_scope: { handler: write.createScope, schema: S.createScopeInput },
  update_scope: { handler: write.updateScope, schema: S.updateScopeInput },
  append_log_entry: { handler: write.appendLogEntry, schema: S.appendLogEntryInput },
  correct: { handler: write.correct, schema: S.correctInput },
  add_free_field: { handler: write.addFreeField, schema: S.addFreeFieldInput },
  deprecate_free_field: { handler: write.deprecateFreeField, schema: S.deprecateFreeFieldInput },

  // ── Reports ──
  generate_daily_report: { handler: reports.generateDailyReport, schema: S.generateDailyReportInput },
  generate_decisions_report: { handler: reports.generateDecisionsReport, schema: S.generateDecisionsReportInput },
  generate_actions_report: { handler: reports.generateActionsReport, schema: S.generateActionsReportInput },
  generate_ideas_report: { handler: reports.generateIdeasReport, schema: S.generateIdeasReportInput },
  generate_problems_report: { handler: reports.generateProblemsReport, schema: S.generateProblemsReportInput },
  generate_specs_report: { handler: reports.generateSpecsReport, schema: S.generateSpecsReportInput },
  generate_decision_history_report: { handler: reports.generateDecisionHistoryReport, schema: S.generateDecisionHistoryReportInput },
  export_dump: { handler: reports.exportDump, schema: S.exportDumpInput },
  generate_all_reports: { handler: reports.generateAllReports, schema: S.generateAllReportsInput },
};

// ─── Help tool (built dynamically from toolDefs) ─────────────────────────────

const toolNames = Object.keys(toolDefs);

export const helpInput = buildHelpInput(toolNames);

const toolList = [
  ...Object.entries(toolDefs).map(([name, e]) => ({
    name,
    args: e.schema,
    handler: e.handler,
    category: e.schema.meta().category ?? CATEGORY.system,
  })),
  { name: "help", args: helpInput, handler: read.help, category: CATEGORY.system },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

export { CATEGORY as TOOL_CATEGORIES, toolList };
