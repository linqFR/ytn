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

import * as O from "../../shared/schemas/tool-outputs.js";
import * as read from "../tools/read.js";
import * as reports from "../tools/reports.js";
import * as write from "../tools/write.js";
import { CATEGORY } from "../../shared/enums.js";
import { toolSchemas } from "../../shared/schemas/tool-schemas.js";
import { buildHelpInput } from "./help-input.js";

// ─── Tool definition type ────────────────────────────────────────────────────


// type tsHandlerFn<A> = (ctx: IToolCtx, args: A) => OToolResult;

// export interface IToolDef<A extends dna.DnaSomeType = dna.DnaSomeType> {
//   args: A;
//   handler: tsHandlerFn<dna.infer<A>>;
//   category: IToolCategory;
//   isReadonly: boolean;
// }


export const toolDefs = {
  // ── Writers ──
  register_writer: { ...toolSchemas.register_writer, handler: write.registerWriter },
  register_me: { ...toolSchemas.register_me, handler: write.registerWriter },
  whoami: { ...toolSchemas.whoami, handler: read.whoami },
  list_writers: { ...toolSchemas.list_writers, handler: read.listWriters },
  update_me: { ...toolSchemas.update_me, handler: write.updateMe },

  // ── Read ──
  list_decisions: { ...toolSchemas.list_decisions, handler: read.listDecisions },
  get_decision: { ...toolSchemas.get_decision, handler: read.getDecision },
  list_actions: { ...toolSchemas.list_actions, handler: read.listActions },
  get_action: { ...toolSchemas.get_action, handler: read.getAction },
  list_ideas: { ...toolSchemas.list_ideas, handler: read.listIdeas },
  get_idea: { ...toolSchemas.get_idea, handler: read.getIdea },
  list_problems: { ...toolSchemas.list_problems, handler: read.listProblems },
  get_problem: { ...toolSchemas.get_problem, handler: read.getProblem },
  list_specs: { ...toolSchemas.list_specs, handler: read.listSpecs },
  get_spec: { ...toolSchemas.get_spec, handler: read.getSpec },
  list_scopes: { ...toolSchemas.list_scopes, handler: read.listScopes },
  get_scope_info: { ...toolSchemas.get_scope_info, handler: read.getScope },
  list_log_entries: { ...toolSchemas.list_log_entries, handler: read.listLogEntries },
  get_last_log_entry: { ...toolSchemas.get_last_log_entry, handler: read.getLastLogEntry },
  get_thread: { ...toolSchemas.get_thread, handler: read.getThread },
  get_updates: { ...toolSchemas.get_updates, handler: read.getUpdates },
  list_docs: { ...toolSchemas.list_docs, handler: read.listDocs },
  get_doc: { ...toolSchemas.get_doc, handler: read.getDoc },
  get_free_fields: { ...toolSchemas.get_free_fields, handler: read.getFreeFields },

  // ── Search ──
  search_mailbox: { ...toolSchemas.search_mailbox, handler: read.searchMailbox },
  mailbox_last_24h: { ...toolSchemas.mailbox_last_24h, handler: read.mailboxLast24h },

  // ── Read: history & lineage ──
  get_decision_history: { ...toolSchemas.get_decision_history, handler: read.getDecisionHistory },
  get_action_lineage: { ...toolSchemas.get_action_lineage, handler: read.getActionLineage },
  get_open_actions: { ...toolSchemas.get_open_actions, handler: read.getOpenActions },
  get_handoff: { ...toolSchemas.get_handoff, handler: read.getHandoff },
  audit_consistency: { ...toolSchemas.audit_consistency, handler: read.auditConsistency },

  // ── Write ──
  create_decision: { ...toolSchemas.create_decision, handler: write.createDecision },
  update_decision_status: { ...toolSchemas.update_decision_status, handler: write.updateDecisionStatus },
  create_action: { ...toolSchemas.create_action, handler: write.createAction },
  update_action_status: { ...toolSchemas.update_action_status, handler: write.updateActionStatus },
  create_idea: { ...toolSchemas.create_idea, handler: write.createIdea },
  update_idea_status: { ...toolSchemas.update_idea_status, handler: write.updateIdeaStatus },
  create_problem: { ...toolSchemas.create_problem, handler: write.createProblem },
  update_problem_status: { ...toolSchemas.update_problem_status, handler: write.updateProblemStatus },
  link_problem_action: { ...toolSchemas.link_problem_action, handler: write.linkProblemAction },
  link_action_workstream: { ...toolSchemas.link_action_workstream, handler: write.linkActionWorkstream },
  link_action_dependency: { ...toolSchemas.link_action_dependency, handler: write.linkActionDependency },
  create_spec: { ...toolSchemas.create_spec, handler: write.createSpec },
  update_spec_status: { ...toolSchemas.update_spec_status, handler: write.updateSpecStatus },
  create_scope: { ...toolSchemas.create_scope, handler: write.createScope },
  update_scope: { ...toolSchemas.update_scope, handler: write.updateScope },
  append_log_entry: { ...toolSchemas.append_log_entry, handler: write.appendLogEntry },
  correct: { ...toolSchemas.correct, handler: write.correct },
  add_free_field: { ...toolSchemas.add_free_field, handler: write.addFreeField },
  deprecate_free_field: { ...toolSchemas.deprecate_free_field, handler: write.deprecateFreeField },

  // ── Reports ──
  generate_daily_report: { ...toolSchemas.generate_daily_report, handler: reports.generateDailyReport },
  generate_decisions_report: { ...toolSchemas.generate_decisions_report, handler: reports.generateDecisionsReport },
  generate_actions_report: { ...toolSchemas.generate_actions_report, handler: reports.generateActionsReport },
  generate_ideas_report: { ...toolSchemas.generate_ideas_report, handler: reports.generateIdeasReport },
  generate_problems_report: { ...toolSchemas.generate_problems_report, handler: reports.generateProblemsReport },
  generate_specs_report: { ...toolSchemas.generate_specs_report, handler: reports.generateSpecsReport },
  generate_decision_history_report: { ...toolSchemas.generate_decision_history_report, handler: reports.generateDecisionHistoryReport },
  export_dump: { ...toolSchemas.export_dump, handler: reports.exportDump },
  generate_all_reports: { ...toolSchemas.generate_all_reports, handler: reports.generateAllReports },
};

// ─── Help tool (built dynamically from toolDefs) ─────────────────────────────

const toolNames = Object.keys(toolDefs);

export const helpInput = buildHelpInput(toolNames);

// ─── Readonly tool names (derived from toolDefs.isReadonly) ──────────────────
export const READONLY_TOOL_NAMES = Object.entries(toolDefs)
  .filter(([, def]) => def.isReadonly)
  .map(([name]) => name) as ReadonlyArray<keyof typeof toolDefs>;

const toolList = [
  ...Object.entries(toolDefs).map(([name, e]) => ({
    name,
    args: e.schema,
    output: e.output,
    handler: e.handler,
    category: e.schema.meta().category ?? CATEGORY.system,
    isReadonly: e.isReadonly,
  })),
  { name: "help", args: helpInput, output: O.helpOutputSchema, handler: read.help, category: CATEGORY.system, isReadonly: true },
];

// ─── Exports ─────────────────────────────────────────────────────────────────

export { CATEGORY as TOOL_CATEGORIES, toolList };
