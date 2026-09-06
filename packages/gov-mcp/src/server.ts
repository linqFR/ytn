#!/usr/bin/env node
/**
 * MCP server entry point for @ytrynot/gov-mcp.
 *
 * Exposes governance tools via the Model Context Protocol (stdio transport).
 * Uses @modelcontextprotocol/server 2.0.0 McpServer with DNA schemas (Standard Schema).
 */

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { GovDb } from "./driver.js";
import { initDatabase } from "./init.js";
import { compileQueries } from "./queries/index.js";
import type { IToolCtx, IToolResult } from "./types/types.ts";
import pkg from "../package.json" with { type: "json" };

// ─── Tool handlers ───────────────────────────────────────────────────────────

import * as read from "./tools/read.js";
import * as reports from "./tools/reports.js";
import * as write from "./tools/write.js";
import { toolMeta } from "./tools/meta.js";

// ─── DNA schemas ─────────────────────────────────────────────────────────────

import * as S from "./schemas/tool-inputs.js";

// ─── Server startup ──────────────────────────────────────────────────────────

export interface IServerOptions {
  dbPath?: string;
}

/** Convert an IToolResult to the McpServer CallToolResult format. */
export function toCallToolResult(result: IToolResult) {
  return {
    content: result.content,
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}

/** Create and start the MCP server. */
export async function startServer(options: IServerOptions = {}): Promise<void> {
  const db = GovDb.open({ dbPath: options.dbPath });
  initDatabase(db);
  const queries = compileQueries(db);
  const ctx: IToolCtx = { db, queries };

  const server = new McpServer(
    { name: pkg.name, version: pkg.version },
    {
      capabilities: { tools: {} },
      instructions: [
        `Governance MCP server (${pkg.name} v${pkg.version}).`,
        ``,
        `START HERE: Call the \`help\` tool to get the full tool reference, common workflows, and a Recommended Reading table that maps intents to documentation files.`,
        ``,
        `Quick start:`,
        `1. Call \`help\` — full tool reference + workflows + doc recommendations`,
        `2. Ask ADMIN for your scope, role, and responsibilities (questions/answers)`,
        `3. Synthesize the answers and ask ADMIN to validate before registering`,
        `4. Call \`register_me\` with the validated profile — SAVE the returned nanoid (it is shown only once and cannot be retrieved)`,
        `5. Call \`list_docs\` to see available documentation, \`get_doc\` to read any doc`,
        `6. Use \`get_updates\` with your nanoid to read unread log entries`,
      ].join("\n"),
    },
  );

  // ── Getting started ──

  server.registerTool("help",
    { description: toolMeta.help.description, inputSchema: S.helpInput },
    async (args) => toCallToolResult(read.help(ctx, args)),
  );
  server.registerTool("register_me",
    { description: toolMeta.register_me.description, inputSchema: S.registerWriterInput },
    async (args) => toCallToolResult(write.registerWriter(ctx, args)),
  );
  server.registerTool("register_writer",
    { description: toolMeta.register_writer.description, inputSchema: S.registerWriterInput },
    async (args) => toCallToolResult(write.registerWriter(ctx, args)),
  );
  server.registerTool("whoami",
    { description: toolMeta.whoami.description, inputSchema: S.whoamiInput },
    async (args) => toCallToolResult(read.whoami(ctx, args)),
  );
  server.registerTool("list_writers",
    { description: toolMeta.list_writers.description, inputSchema: S.listWritersInput },
    async (args) => toCallToolResult(read.listWriters(ctx, args)),
  );

  // ── Read: entities ──

  server.registerTool("list_decisions",
    { description: toolMeta.list_decisions.description, inputSchema: S.listDecisionsInput },
    async (args) => toCallToolResult(read.listDecisions(ctx, args)),
  );
  server.registerTool("get_decision",
    { description: toolMeta.get_decision.description, inputSchema: S.getDecisionInput },
    async (args) => toCallToolResult(read.getDecision(ctx, args)),
  );
  server.registerTool("list_actions",
    { description: toolMeta.list_actions.description, inputSchema: S.listActionsInput },
    async (args) => toCallToolResult(read.listActions(ctx, args)),
  );
  server.registerTool("get_action",
    { description: toolMeta.get_action.description, inputSchema: S.getActionInput },
    async (args) => toCallToolResult(read.getAction(ctx, args)),
  );
  server.registerTool("list_ideas",
    { description: toolMeta.list_ideas.description, inputSchema: S.listIdeasInput },
    async (args) => toCallToolResult(read.listIdeas(ctx, args)),
  );
  server.registerTool("get_idea",
    { description: toolMeta.get_idea.description, inputSchema: S.getIdeaInput },
    async (args) => toCallToolResult(read.getIdea(ctx, args)),
  );
  server.registerTool("list_problems",
    { description: toolMeta.list_problems.description, inputSchema: S.listProblemsInput },
    async (args) => toCallToolResult(read.listProblems(ctx, args)),
  );
  server.registerTool("get_problem",
    { description: toolMeta.get_problem.description, inputSchema: S.getProblemInput },
    async (args) => toCallToolResult(read.getProblem(ctx, args)),
  );
  server.registerTool("list_specs",
    { description: toolMeta.list_specs.description, inputSchema: S.listSpecsInput },
    async (args) => toCallToolResult(read.listSpecs(ctx, args)),
  );
  server.registerTool("get_spec",
    { description: toolMeta.get_spec.description, inputSchema: S.getSpecInput },
    async (args) => toCallToolResult(read.getSpec(ctx, args)),
  );
  server.registerTool("list_scopes",
    { description: toolMeta.list_scopes.description, inputSchema: S.listScopesInput },
    async (args) => toCallToolResult(read.listScopes(ctx, args)),
  );
  server.registerTool("get_scope_info",
    { description: toolMeta.get_scope_info.description, inputSchema: S.getScopeInput },
    async (args) => toCallToolResult(read.getScope(ctx, args)),
  );

  // ── Read: log & communication ──

  server.registerTool("list_log_entries",
    { description: toolMeta.list_log_entries.description, inputSchema: S.listLogEntriesInput },
    async (args) => toCallToolResult(read.listLogEntries(ctx, args)),
  );
  server.registerTool("get_last_log_entry",
    { description: toolMeta.get_last_log_entry.description, inputSchema: S.getLastLogEntryInput },
    async (args) => toCallToolResult(read.getLastLogEntry(ctx, args)),
  );
  server.registerTool("get_thread",
    { description: toolMeta.get_thread.description, inputSchema: S.getThreadInput },
    async (args) => toCallToolResult(read.getThread(ctx, args)),
  );
  server.registerTool("get_updates",
    { description: toolMeta.get_updates.description, inputSchema: S.getUpdatesInput },
    async (args) => toCallToolResult(read.getUpdates(ctx, args)),
  );

  // ── Read: search & transverse ──

  server.registerTool("search_mailbox",
    { description: toolMeta.search_mailbox.description, inputSchema: S.searchMailboxInput },
    async (args) => toCallToolResult(read.searchMailbox(ctx, args)),
  );
  server.registerTool("mailbox_last_24h",
    { description: toolMeta.mailbox_last_24h.description, inputSchema: S.mailboxLast24hInput },
    async (args) => toCallToolResult(read.mailboxLast24h(ctx, args)),
  );
  server.registerTool("get_decision_history",
    { description: toolMeta.get_decision_history.description, inputSchema: S.getDecisionHistoryInput },
    async (args) => toCallToolResult(read.getDecisionHistory(ctx, args)),
  );
  server.registerTool("get_action_lineage",
    { description: toolMeta.get_action_lineage.description, inputSchema: S.getActionLineageInput },
    async (args) => toCallToolResult(read.getActionLineage(ctx, args)),
  );
  server.registerTool("get_open_actions",
    { description: toolMeta.get_open_actions.description, inputSchema: S.getOpenActionsInput },
    async (args) => toCallToolResult(read.getOpenActions(ctx, args)),
  );
  server.registerTool("get_handoff",
    { description: toolMeta.get_handoff.description, inputSchema: undefined },
    async () => toCallToolResult(read.getHandoff(ctx)),
  );
  server.registerTool("audit_consistency",
    { description: toolMeta.audit_consistency.description, inputSchema: S.auditConsistencyInput },
    async (args) => toCallToolResult(read.auditConsistency(ctx, args)),
  );

  // ── Read: docs & free fields ──

  server.registerTool("list_docs",
    { description: toolMeta.list_docs.description, inputSchema: S.listDocsInput },
    async (args) => toCallToolResult(read.listDocs(ctx, args)),
  );
  server.registerTool("get_doc",
    { description: toolMeta.get_doc.description, inputSchema: S.getDocInput },
    async (args) => toCallToolResult(read.getDoc(ctx, args)),
  );
  server.registerTool("get_free_fields",
    { description: toolMeta.get_free_fields.description, inputSchema: S.getFreeFieldsInput },
    async (args) => toCallToolResult(read.getFreeFields(ctx, args)),
  );

  // ── Write: decisions ──

  server.registerTool("create_decision",
    { description: toolMeta.create_decision.description, inputSchema: S.createDecisionInput },
    async (args) => toCallToolResult(write.createDecision(ctx, args)),
  );
  server.registerTool("update_decision_status",
    { description: toolMeta.update_decision_status.description, inputSchema: S.updateDecisionStatusInput },
    async (args) => toCallToolResult(write.updateDecisionStatus(ctx, args)),
  );

  // ── Write: actions ──

  server.registerTool("create_action",
    { description: toolMeta.create_action.description, inputSchema: S.createActionInput },
    async (args) => toCallToolResult(write.createAction(ctx, args)),
  );
  server.registerTool("update_action_status",
    { description: toolMeta.update_action_status.description, inputSchema: S.updateActionStatusInput },
    async (args) => toCallToolResult(write.updateActionStatus(ctx, args)),
  );

  // ── Write: ideas ──

  server.registerTool("create_idea",
    { description: toolMeta.create_idea.description, inputSchema: S.createIdeaInput },
    async (args) => toCallToolResult(write.createIdea(ctx, args)),
  );
  server.registerTool("update_idea_status",
    { description: toolMeta.update_idea_status.description, inputSchema: S.updateIdeaStatusInput },
    async (args) => toCallToolResult(write.updateIdeaStatus(ctx, args)),
  );

  // ── Write: problems ──

  server.registerTool("create_problem",
    { description: toolMeta.create_problem.description, inputSchema: S.createProblemInput },
    async (args) => toCallToolResult(write.createProblem(ctx, args)),
  );
  server.registerTool("update_problem_status",
    { description: toolMeta.update_problem_status.description, inputSchema: S.updateProblemStatusInput },
    async (args) => toCallToolResult(write.updateProblemStatus(ctx, args)),
  );

  // ── Write: links ──

  server.registerTool("link_problem_action",
    { description: toolMeta.link_problem_action.description, inputSchema: S.linkProblemActionInput },
    async (args) => toCallToolResult(write.linkProblemAction(ctx, args)),
  );
  server.registerTool("link_action_workstream",
    { description: toolMeta.link_action_workstream.description, inputSchema: S.linkActionWorkstreamInput },
    async (args) => toCallToolResult(write.linkActionWorkstream(ctx, args)),
  );
  server.registerTool("link_action_dependency",
    { description: toolMeta.link_action_dependency.description, inputSchema: S.linkActionDependencyInput },
    async (args) => toCallToolResult(write.linkActionDependency(ctx, args)),
  );

  // ── Write: specs ──

  server.registerTool("create_spec",
    { description: toolMeta.create_spec.description, inputSchema: S.createSpecInput },
    async (args) => toCallToolResult(write.createSpec(ctx, args)),
  );
  server.registerTool("update_spec_status",
    { description: toolMeta.update_spec_status.description, inputSchema: S.updateSpecStatusInput },
    async (args) => toCallToolResult(write.updateSpecStatus(ctx, args)),
  );

  // ── Write: scopes ──

  server.registerTool("create_scope",
    { description: toolMeta.create_scope.description, inputSchema: S.createScopeInput },
    async (args) => toCallToolResult(write.createScope(ctx, args)),
  );
  server.registerTool("update_scope",
    { description: toolMeta.update_scope.description, inputSchema: S.updateScopeInput },
    async (args) => toCallToolResult(write.updateScope(ctx, args)),
  );

  // ── Write: log & corrections ──

  server.registerTool("append_log_entry",
    { description: toolMeta.append_log_entry.description, inputSchema: S.appendLogEntryInput },
    async (args) => toCallToolResult(write.appendLogEntry(ctx, args)),
  );
  server.registerTool("correct",
    { description: toolMeta.correct.description, inputSchema: S.correctInput },
    async (args) => toCallToolResult(write.correct(ctx, args)),
  );

  // ── Write: free fields ──

  server.registerTool("add_free_field",
    { description: toolMeta.add_free_field.description, inputSchema: S.addFreeFieldInput },
    async (args) => toCallToolResult(write.addFreeField(ctx, args)),
  );
  server.registerTool("deprecate_free_field",
    { description: toolMeta.deprecate_free_field.description, inputSchema: S.deprecateFreeFieldInput },
    async (args) => toCallToolResult(write.deprecateFreeField(ctx, args)),
  );

  // ── Reports ──

  server.registerTool("generate_daily_report",
    { description: toolMeta.generate_daily_report.description, inputSchema: S.generateDailyReportInput },
    async (args) => toCallToolResult(reports.generateDailyReport(ctx, args)),
  );
  server.registerTool("generate_decisions_report",
    { description: toolMeta.generate_decisions_report.description, inputSchema: undefined },
    async () => toCallToolResult(reports.generateDecisionsReport(ctx)),
  );
  server.registerTool("generate_actions_report",
    { description: toolMeta.generate_actions_report.description, inputSchema: undefined },
    async () => toCallToolResult(reports.generateActionsReport(ctx)),
  );
  server.registerTool("generate_ideas_report",
    { description: toolMeta.generate_ideas_report.description, inputSchema: undefined },
    async () => toCallToolResult(reports.generateIdeasReport(ctx)),
  );
  server.registerTool("generate_problems_report",
    { description: toolMeta.generate_problems_report.description, inputSchema: undefined },
    async () => toCallToolResult(reports.generateProblemsReport(ctx)),
  );
  server.registerTool("generate_decision_history_report",
    { description: toolMeta.generate_decision_history_report.description, inputSchema: S.generateDecisionHistoryReportInput },
    async (args) => toCallToolResult(reports.generateDecisionHistoryReport(ctx, args)),
  );
  server.registerTool("export_dump",
    { description: toolMeta.export_dump.description, inputSchema: undefined },
    async () => toCallToolResult(reports.exportDump(ctx)),
  );
  server.registerTool("generate_all_reports",
    { description: toolMeta.generate_all_reports.description, inputSchema: undefined },
    async () => toCallToolResult(reports.generateAllReports(ctx)),
  );

  // ── Start ──

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start if run directly
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((e) => {
    console.error("Failed to start gov-mcp server:", e);
    process.exit(1);
  });
}
