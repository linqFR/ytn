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
import type { DnaSomeType } from "@ytrynot/dna/core";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import * as S from "../schemas/tool-inputs.js";
import * as read from "../tools/read.js";
import * as write from "../tools/write.js";
import * as reports from "../tools/reports.js";
import type { IToolCtx, OToolResult } from "../types/types.ts";

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORY = {
  writers: { name: "Writers & Identity", key: "writers", order: 1 },
  read: { name: "Read & Browse", key: "read", order: 2 },
  search: { name: "Search & Transverse", key: "search", order: 3 },
  write: { name: "Write & Mutations", key: "write", order: 4 },
  reports: { name: "Reports & Export", key: "reports", order: 5 },
  system: { name: "System", key: "system", order: 6 },
} as const;

// ─── Tool definition type ────────────────────────────────────────────────────

export interface IToolDef {
  name: string;
  category: (typeof CATEGORY)[keyof typeof CATEGORY];
  args?: DnaSomeType & StandardSchemaWithJSON<unknown, unknown>;
  handler: (ctx: IToolCtx, args: any) => OToolResult;
  /** Override description (for aliases). If omitted, derived from schema .meta(). */
  descriptionOverride?: string;
  /** Override usage (for aliases). If omitted, derived from schema .meta(). */
  usageOverride?: string;
}


// ─── Tool list (all tools except help) ───────────────────────────────────────

const toolList: IToolDef[] = [
  // ── Writers ──
  {
    name: "register_writer",
    category: CATEGORY.writers,
    args: S.registerWriterInput,
    handler: write.registerWriter,
  },
  {
    name: "register_me",
    category: CATEGORY.writers,
    args: S.registerWriterInput,
    handler: write.registerWriter,
    descriptionOverride:
      "Alias for register_writer. Register yourself as a writer and receive a nanoid token.",
    usageOverride:
      "Alias for register_writer. See register_writer for full documentation.",
  },
  {
    name: "whoami",
    category: CATEGORY.writers,
    args: S.whoamiInput,
    handler: read.whoami,
  },
  {
    name: "list_writers",
    category: CATEGORY.writers,
    args: S.listWritersInput,
    handler: read.listWriters,
  },
  {
    name: "update_me",
    category: CATEGORY.writers,
    args: S.updateMeInput,
    handler: write.updateMe,
  },

  // ── Read: entities ──
  {
    name: "list_decisions",
    category: CATEGORY.read,
    args: S.listDecisionsInput,
    handler: read.listDecisions,
  },
  {
    name: "get_decision",
    category: CATEGORY.read,
    args: S.getDecisionInput,
    handler: read.getDecision,
  },
  {
    name: "list_actions",
    category: CATEGORY.read,
    args: S.listActionsInput,
    handler: read.listActions,
  },
  {
    name: "get_action",
    category: CATEGORY.read,
    args: S.getActionInput,
    handler: read.getAction,
  },
  {
    name: "list_ideas",
    category: CATEGORY.read,
    args: S.listIdeasInput,
    handler: read.listIdeas,
  },
  {
    name: "get_idea",
    category: CATEGORY.read,
    args: S.getIdeaInput,
    handler: read.getIdea,
  },
  {
    name: "list_problems",
    category: CATEGORY.read,
    args: S.listProblemsInput,
    handler: read.listProblems,
  },
  {
    name: "get_problem",
    category: CATEGORY.read,
    args: S.getProblemInput,
    handler: read.getProblem,
  },
  {
    name: "list_specs",
    category: CATEGORY.read,
    args: S.listSpecsInput,
    handler: read.listSpecs,
  },
  {
    name: "get_spec",
    category: CATEGORY.read,
    args: S.getSpecInput,
    handler: read.getSpec,
  },
  {
    name: "list_scopes",
    category: CATEGORY.read,
    args: S.listScopesInput,
    handler: read.listScopes,
  },
  {
    name: "get_scope_info",
    category: CATEGORY.read,
    args: S.getScopeInput,
    handler: read.getScope,
  },

  // ── Read: log entries ──
  {
    name: "list_log_entries",
    category: CATEGORY.read,
    args: S.listLogEntriesInput,
    handler: read.listLogEntries,
  },
  {
    name: "get_last_log_entry",
    category: CATEGORY.read,
    args: S.getLastLogEntryInput,
    handler: read.getLastLogEntry,
  },
  {
    name: "get_thread",
    category: CATEGORY.read,
    args: S.getThreadInput,
    handler: read.getThread,
  },
  {
    name: "get_updates",
    category: CATEGORY.read,
    args: S.getUpdatesInput,
    handler: read.getUpdates,
  },

  // ── Search & transverse ──
  {
    name: "search_mailbox",
    category: CATEGORY.search,
    args: S.searchMailboxInput,
    handler: read.searchMailbox,
  },
  {
    name: "mailbox_last_24h",
    category: CATEGORY.search,
    args: S.mailboxLast24hInput,
    handler: read.mailboxLast24h,
  },
  {
    name: "get_decision_history",
    category: CATEGORY.search,
    args: S.getDecisionHistoryInput,
    handler: read.getDecisionHistory,
  },
  {
    name: "get_action_lineage",
    category: CATEGORY.search,
    args: S.getActionLineageInput,
    handler: read.getActionLineage,
  },
  {
    name: "get_open_actions",
    category: CATEGORY.search,
    args: S.getOpenActionsInput,
    handler: read.getOpenActions,
  },
  { name: "get_handoff", category: CATEGORY.search, handler: read.getHandoff },
  {
    name: "audit_consistency",
    category: CATEGORY.search,
    args: S.auditConsistencyInput,
    handler: read.auditConsistency,
  },

  // ── Read: docs & free fields ──
  {
    name: "list_docs",
    category: CATEGORY.read,
    args: S.listDocsInput,
    handler: read.listDocs,
  },
  {
    name: "get_doc",
    category: CATEGORY.read,
    args: S.getDocInput,
    handler: read.getDoc,
  },
  {
    name: "get_free_fields",
    category: CATEGORY.read,
    args: S.getFreeFieldsInput,
    handler: read.getFreeFields,
  },

  // ── Write: decisions ──
  {
    name: "create_decision",
    category: CATEGORY.write,
    args: S.createDecisionInput,
    handler: write.createDecision,
  },
  {
    name: "update_decision_status",
    category: CATEGORY.write,
    args: S.updateDecisionStatusInput,
    handler: write.updateDecisionStatus,
  },

  // ── Write: actions ──
  {
    name: "create_action",
    category: CATEGORY.write,
    args: S.createActionInput,
    handler: write.createAction,
  },
  {
    name: "update_action_status",
    category: CATEGORY.write,
    args: S.updateActionStatusInput,
    handler: write.updateActionStatus,
  },

  // ── Write: ideas ──
  {
    name: "create_idea",
    category: CATEGORY.write,
    args: S.createIdeaInput,
    handler: write.createIdea,
  },
  {
    name: "update_idea_status",
    category: CATEGORY.write,
    args: S.updateIdeaStatusInput,
    handler: write.updateIdeaStatus,
  },

  // ── Write: problems ──
  {
    name: "create_problem",
    category: CATEGORY.write,
    args: S.createProblemInput,
    handler: write.createProblem,
  },
  {
    name: "update_problem_status",
    category: CATEGORY.write,
    args: S.updateProblemStatusInput,
    handler: write.updateProblemStatus,
  },

  // ── Write: links ──
  {
    name: "link_problem_action",
    category: CATEGORY.write,
    args: S.linkProblemActionInput,
    handler: write.linkProblemAction,
  },
  {
    name: "link_action_workstream",
    category: CATEGORY.write,
    args: S.linkActionWorkstreamInput,
    handler: write.linkActionWorkstream,
  },
  {
    name: "link_action_dependency",
    category: CATEGORY.write,
    args: S.linkActionDependencyInput,
    handler: write.linkActionDependency,
  },

  // ── Write: specs ──
  {
    name: "create_spec",
    category: CATEGORY.write,
    args: S.createSpecInput,
    handler: write.createSpec,
  },
  {
    name: "update_spec_status",
    category: CATEGORY.write,
    args: S.updateSpecStatusInput,
    handler: write.updateSpecStatus,
  },

  // ── Write: scopes ──
  {
    name: "create_scope",
    category: CATEGORY.write,
    args: S.createScopeInput,
    handler: write.createScope,
  },
  {
    name: "update_scope",
    category: CATEGORY.write,
    args: S.updateScopeInput,
    handler: write.updateScope,
  },

  // ── Write: log & correct ──
  {
    name: "append_log_entry",
    category: CATEGORY.write,
    args: S.appendLogEntryInput,
    handler: write.appendLogEntry,
  },
  {
    name: "correct",
    category: CATEGORY.write,
    args: S.correctInput,
    handler: write.correct,
  },

  // ── Write: free fields ──
  {
    name: "add_free_field",
    category: CATEGORY.write,
    args: S.addFreeFieldInput,
    handler: write.addFreeField,
  },
  {
    name: "deprecate_free_field",
    category: CATEGORY.write,
    args: S.deprecateFreeFieldInput,
    handler: write.deprecateFreeField,
  },

  // ── Reports ──
  {
    name: "generate_daily_report",
    category: CATEGORY.reports,
    args: S.generateDailyReportInput,
    handler: reports.generateDailyReport,
  },
  {
    name: "generate_decisions_report",
    category: CATEGORY.reports,
    handler: reports.generateDecisionsReport,
  },
  {
    name: "generate_actions_report",
    category: CATEGORY.reports,
    handler: reports.generateActionsReport,
  },
  {
    name: "generate_ideas_report",
    category: CATEGORY.reports,
    handler: reports.generateIdeasReport,
  },
  {
    name: "generate_problems_report",
    category: CATEGORY.reports,
    handler: reports.generateProblemsReport,
  },
  {
    name: "generate_specs_report",
    category: CATEGORY.reports,
    handler: reports.generateSpecsReport,
  },
  {
    name: "generate_decision_history_report",
    category: CATEGORY.reports,
    args: S.generateDecisionHistoryReportInput,
    handler: reports.generateDecisionHistoryReport,
  },
  {
    name: "export_dump",
    category: CATEGORY.reports,
    handler: reports.exportDump,
  },
  {
    name: "generate_all_reports",
    category: CATEGORY.reports,
    handler: reports.generateAllReports,
  },
];

// ─── Help tool (built dynamically from toolList) ─────────────────────────────

const toolNames = toolList.map((t) => t.name);

export const helpInput = dna
  .strictObject({
    tool: dna
      .enum([...toolNames, "help"])
      .optional()
      .describe(
        "Tool name to get help for. If omitted, returns the full reference.",
      ),
  })
  .meta({
    title: "HelpInput",
    description:
      "START HERE — call this first. Returns usage instructions, all tools grouped by category, common workflows, and a Recommended Reading table mapping intents to documentation files.",
    usage: `Return this help text with all tools, their descriptions, parameters, and return shapes.

This is the recommended first call for any agent connecting to the governance MCP. It includes:
- Getting Started (writer registration, nanoid)
- How-To: Common Workflows (decisions, actions, problems, ideas, corrections, handoff, search)
- Recommended Reading (intent → doc filename table; use list_docs/get_doc to read them)
- Full tool reference grouped by category (Writers, Read, Search, Write, Reports, System)

Returns:
  Markdown text with all tool descriptions grouped by category.`,
    category: "system",
  });

toolList.push({
  name: "help",
  category: CATEGORY.system,
  args: helpInput,
  handler: read.help,
});

// ─── Exports ─────────────────────────────────────────────────────────────────

export { toolList };
export { CATEGORY as TOOL_CATEGORIES };
