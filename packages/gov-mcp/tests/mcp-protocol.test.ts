/**
 * MCP protocol integration tests — full client → server round-trip.
 *
 * Unlike integration.test.ts (which calls tool functions directly),
 * these tests go through the real MCP protocol:
 *   Client.callTool() → InMemoryTransport → McpServer → DNA validation → tool handler → DB
 *
 * This verifies:
 * - All 35+ tools are registered and discoverable via tools/list
 * - DNA schemas are correctly exposed as JSON Schema
 * - DNA validation rejects invalid input at the protocol level
 * - Full workflows work end-to-end through the protocol
 * - Cascades fire through MCP calls
 * - withChildren scope filtering works through MCP
 * - Error responses are correctly formatted
 */

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as S from "../src/schemas/tool-inputs.js";
import { toCallToolResult } from "../src/server.js";
import { resolveMonorepoRoot } from "../src/seed.js";
import * as read from "../src/tools/read.js";
import * as reports from "../src/tools/reports.js";
import type { IToolCtx } from "../src/types/types.ts";
import * as write from "../src/tools/write.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract text content from a CallToolResult for error message assertions. */
function resultText(result: { content: Array<{ type: string; text?: string }> }): string {
  const textItem = result.content.find((c) => c.type === "text");
  return textItem?.text ?? "";
}

/** Extract structured content from a CallToolResult. */
function structured<T = Record<string, unknown>>(result: { structuredContent?: unknown }): T {
  if (result.structuredContent === undefined) {
    throw new Error("Expected structuredContent but got undefined");
  }
  // CAST: structuredContent is unknown from MCP SDK; we assert the shape the tool produces.
  return result.structuredContent as T;
}

// ─── Test fixture: full MCP server with all tools ────────────────────────────

describe("MCP protocol: full server with all tools", () => {
  let db: GovDb;
  let ctx: IToolCtx;
  let server: McpServer;
  let client: Client;
  let nanoid: string;

  beforeAll(async () => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    server = new McpServer(
      { name: "test-gov-full", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );

    // ── Register ALL tools (mirrors src/server.ts) ──

    // Read: entities
    server.registerTool("list_decisions",
      { description: "List decisions", inputSchema: S.listDecisionsInput },
      async (args) => toCallToolResult(read.listDecisions(ctx, args)));
    server.registerTool("get_decision",
      { description: "Get a decision", inputSchema: S.getDecisionInput },
      async (args) => toCallToolResult(read.getDecision(ctx, args)));
    server.registerTool("list_actions",
      { description: "List actions", inputSchema: S.listActionsInput },
      async (args) => toCallToolResult(read.listActions(ctx, args)));
    server.registerTool("get_action",
      { description: "Get an action", inputSchema: S.getActionInput },
      async (args) => toCallToolResult(read.getAction(ctx, args)));
    server.registerTool("list_ideas",
      { description: "List ideas", inputSchema: S.listIdeasInput },
      async (args) => toCallToolResult(read.listIdeas(ctx, args)));
    server.registerTool("get_idea",
      { description: "Get an idea", inputSchema: S.getIdeaInput },
      async (args) => toCallToolResult(read.getIdea(ctx, args)));
    server.registerTool("list_problems",
      { description: "List problems", inputSchema: S.listProblemsInput },
      async (args) => toCallToolResult(read.listProblems(ctx, args)));
    server.registerTool("get_problem",
      { description: "Get a problem", inputSchema: S.getProblemInput },
      async (args) => toCallToolResult(read.getProblem(ctx, args)));
    server.registerTool("list_specs",
      { description: "List specs", inputSchema: S.listSpecsInput },
      async (args) => toCallToolResult(read.listSpecs(ctx, args)));
    server.registerTool("get_spec",
      { description: "Get a spec", inputSchema: S.getSpecInput },
      async (args) => toCallToolResult(read.getSpec(ctx, args)));
    server.registerTool("list_scopes",
      { description: "List scopes", inputSchema: S.listScopesInput },
      async (args) => toCallToolResult(read.listScopes(ctx, args)));
    server.registerTool("get_scope",
      { description: "Get a scope", inputSchema: S.getScopeInput },
      async (args) => toCallToolResult(read.getScope(ctx, args)));

    // Read: log entries
    server.registerTool("list_log_entries",
      { description: "List log entries", inputSchema: S.listLogEntriesInput },
      async (args) => toCallToolResult(read.listLogEntries(ctx, args)));
    server.registerTool("get_last_log_entry",
      { description: "Get last log entry", inputSchema: S.getLastLogEntryInput },
      async (args) => toCallToolResult(read.getLastLogEntry(ctx, args)));
    server.registerTool("get_thread",
      { description: "Get thread", inputSchema: S.getThreadInput },
      async (args) => toCallToolResult(read.getThread(ctx, args)));
    server.registerTool("get_updates",
      { description: "Get updates", inputSchema: S.getUpdatesInput },
      async (args) => toCallToolResult(read.getUpdates(ctx, args)));
    server.registerTool("whoami",
      { description: "Whoami", inputSchema: S.whoamiInput },
      async (args) => toCallToolResult(read.whoami(ctx, args)));
    server.registerTool("search_mailbox",
      { description: "Search", inputSchema: S.searchMailboxInput },
      async (args) => toCallToolResult(read.searchMailbox(ctx, args)));

    // Read: transverse
    server.registerTool("mailbox_last_24h",
      { description: "Mailbox last 24h", inputSchema: S.mailboxLast24hInput },
      async (args) => toCallToolResult(read.mailboxLast24h(ctx, args)));
    server.registerTool("get_decision_history",
      { description: "Decision history", inputSchema: S.getDecisionHistoryInput },
      async (args) => toCallToolResult(read.getDecisionHistory(ctx, args)));
    server.registerTool("get_action_lineage",
      { description: "Action lineage", inputSchema: S.getActionLineageInput },
      async (args) => toCallToolResult(read.getActionLineage(ctx, args)));
    server.registerTool("get_open_actions",
      { description: "Open actions", inputSchema: S.getOpenActionsInput },
      async (args) => toCallToolResult(read.getOpenActions(ctx, args)));
    server.registerTool("get_handoff",
      { description: "Handoff snapshot", inputSchema: undefined },
      async () => toCallToolResult(read.getHandoff(ctx)));
    server.registerTool("audit_consistency",
      { description: "Audit consistency", inputSchema: S.auditConsistencyInput },
      async (args) => toCallToolResult(read.auditConsistency(ctx, args)));

    // Write: writer
    server.registerTool("register_writer",
      { description: "Register a writer", inputSchema: S.registerWriterInput },
      async (args) => toCallToolResult(write.registerWriter(ctx, args)));

    // Write: decisions
    server.registerTool("create_decision",
      { description: "Create a decision", inputSchema: S.createDecisionInput },
      async (args) => toCallToolResult(write.createDecision(ctx, args)));
    server.registerTool("update_decision_status",
      { description: "Update decision status", inputSchema: S.updateDecisionStatusInput },
      async (args) => toCallToolResult(write.updateDecisionStatus(ctx, args)));

    // Write: actions
    server.registerTool("create_action",
      { description: "Create an action", inputSchema: S.createActionInput },
      async (args) => toCallToolResult(write.createAction(ctx, args)));
    server.registerTool("update_action_status",
      { description: "Update action status", inputSchema: S.updateActionStatusInput },
      async (args) => toCallToolResult(write.updateActionStatus(ctx, args)));

    // Write: ideas
    server.registerTool("create_idea",
      { description: "Create an idea", inputSchema: S.createIdeaInput },
      async (args) => toCallToolResult(write.createIdea(ctx, args)));
    server.registerTool("update_idea_status",
      { description: "Update idea status", inputSchema: S.updateIdeaStatusInput },
      async (args) => toCallToolResult(write.updateIdeaStatus(ctx, args)));

    // Write: problems
    server.registerTool("create_problem",
      { description: "Create a problem", inputSchema: S.createProblemInput },
      async (args) => toCallToolResult(write.createProblem(ctx, args)));
    server.registerTool("update_problem_status",
      { description: "Update problem status", inputSchema: S.updateProblemStatusInput },
      async (args) => toCallToolResult(write.updateProblemStatus(ctx, args)));

    // Write: links
    server.registerTool("link_problem_action",
      { description: "Link problem to action", inputSchema: S.linkProblemActionInput },
      async (args) => toCallToolResult(write.linkProblemAction(ctx, args)));
    server.registerTool("link_action_workstream",
      { description: "Link action to workstream", inputSchema: S.linkActionWorkstreamInput },
      async (args) => toCallToolResult(write.linkActionWorkstream(ctx, args)));

    // Write: specs
    server.registerTool("create_spec",
      { description: "Create a spec", inputSchema: S.createSpecInput },
      async (args) => toCallToolResult(write.createSpec(ctx, args)));
    server.registerTool("update_spec_status",
      { description: "Update spec status", inputSchema: S.updateSpecStatusInput },
      async (args) => toCallToolResult(write.updateSpecStatus(ctx, args)));

    // Write: scopes
    server.registerTool("create_scope",
      { description: "Create a scope", inputSchema: S.createScopeInput },
      async (args) => toCallToolResult(write.createScope(ctx, args)));
    server.registerTool("update_scope",
      { description: "Update a scope", inputSchema: S.updateScopeInput },
      async (args) => toCallToolResult(write.updateScope(ctx, args)));

    // Write: log entries
    server.registerTool("append_log_entry",
      { description: "Append a log entry", inputSchema: S.appendLogEntryInput },
      async (args) => toCallToolResult(write.appendLogEntry(ctx, args)));
    server.registerTool("correct",
      { description: "Correct a field", inputSchema: S.correctInput },
      async (args) => toCallToolResult(write.correct(ctx, args)));

    // Reports
    server.registerTool("generate_daily_report",
      { description: "Generate daily report", inputSchema: S.generateDailyReportInput },
      async (args) => toCallToolResult(reports.generateDailyReport(ctx, args)));
    server.registerTool("generate_decisions_report",
      { description: "Generate decisions report", inputSchema: undefined },
      async () => toCallToolResult(reports.generateDecisionsReport(ctx)));
    server.registerTool("generate_actions_report",
      { description: "Generate actions report", inputSchema: undefined },
      async () => toCallToolResult(reports.generateActionsReport(ctx)));
    server.registerTool("generate_ideas_report",
      { description: "Generate ideas report", inputSchema: undefined },
      async () => toCallToolResult(reports.generateIdeasReport(ctx)));
    server.registerTool("generate_problems_report",
      { description: "Generate problems report", inputSchema: undefined },
      async () => toCallToolResult(reports.generateProblemsReport(ctx)));
    server.registerTool("generate_decision_history_report",
      { description: "Generate decision history report", inputSchema: S.generateDecisionHistoryReportInput },
      async (args) => toCallToolResult(reports.generateDecisionHistoryReport(ctx, args)));
    server.registerTool("export_dump",
      { description: "Export dump", inputSchema: undefined },
      async () => toCallToolResult(reports.exportDump(ctx)));

    // Connect client ↔ server via in-memory transport
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);

    // Register a writer for all subsequent tests
    const writerResult = await client.callTool({
      name: "register_writer",
      arguments: {
        id: "admin",
        role: "admin",
        responsibility: "governance",
        objective: "test the MCP protocol",
        expertise: "TypeScript, SQLite, MCP",
      },
    });
    expect(writerResult.isError).toBeFalsy();
    nanoid = structured<{ nanoid: string }>(writerResult).nanoid;
    expect(nanoid).toHaveLength(21);
  });

  afterAll(() => {
    db.close();
    // Clean up generated report files
    try {
      const dir = `${resolveMonorepoRoot()}/mailbox/generated`;
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ─── tools/list ────────────────────────────────────────────────────────────

  it("tools/list exposes all 35 tools with JSON Schema", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(48);

    // Verify a few tool schemas are properly exposed
    const listDecisions = result.tools.find((t) => t.name === "list_decisions");
    expect(listDecisions).toBeDefined();
    expect(listDecisions!.inputSchema.type).toBe("object");
    expect(listDecisions!.inputSchema.properties).toBeDefined();
    expect(listDecisions!.inputSchema.properties!.scope).toBeDefined();
    expect(listDecisions!.inputSchema.properties!.withChildren).toBeDefined();

    // get_handoff has no input schema (undefined)
    const handoff = result.tools.find((t) => t.name === "get_handoff");
    expect(handoff).toBeDefined();
  });

  // ─── Workflow: scope hierarchy ─────────────────────────────────────────────

  it("create_scope creates child scopes via MCP", async () => {
    const ytnResult = await client.callTool({
      name: "create_scope",
      arguments: { nanoid, id: "ytn", label: "ytn repo", description: "ytn monorepo", parent: "workspace", sortOrder: 1 },
    });
    expect(ytnResult.isError).toBeFalsy();

    const dnaResult = await client.callTool({
      name: "create_scope",
      arguments: { nanoid, id: "dna", label: "@ytrynot/dna", description: "DNA package", parent: "ytn", sortOrder: 2 },
    });
    expect(dnaResult.isError).toBeFalsy();

    // list_scopes should now show 3 scopes
    const listResult = await client.callTool({
      name: "list_scopes",
      arguments: {},
    });
    expect(listResult.isError).toBeFalsy();
    const scopes = structured<{ scopes: { id: string }[] }>(listResult).scopes;
    expect(scopes).toHaveLength(3);
    expect(scopes.map((s) => s.id).sort()).toEqual(["dna", "workspace", "ytn"]);
  });

  // ─── Workflow: decision → action → cascade ─────────────────────────────────

  it("create_decision via MCP returns DEC-NNNN ID", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Use SQLite as source of truth",
        decider: "admin",
        scope: "ytn",
        context: "Need a local governance DB",
        decision: "SQLite is the authoritative source",
        consequences: "Markdown becomes generated views",
      },
    });
    expect(result.isError).toBeFalsy();
    const dec = structured<{ id: string }>(result);
    expect(dec.id).toMatch(/^DEC-\d{4}$/);
  });

  it("list_decisions via MCP returns created decision", async () => {
    const result = await client.callTool({
      name: "list_decisions",
      arguments: { scope: "ytn" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ decisions: { id: string; title: string }[] }>(result);
    expect(data.decisions).toHaveLength(1);
    expect(data.decisions[0].title).toBe("Use SQLite as source of truth");
  });

  it("create_action via MCP with source decision", async () => {
    const result = await client.callTool({
      name: "create_action",
      arguments: {
        nanoid,
        title: "Implement schema migration",
        scope: "ytn",
        priority: "P0",
        source: "DEC-0001",
        source_type: "decision",
        body: "Migrate from markdown to SQLite",
      },
    });
    expect(result.isError).toBeFalsy();
    const action = structured<{ id: string }>(result);
    expect(action.id).toMatch(/^ACT-\d{4}$/);
  });

  it("update_action_status → done triggers cascade to problem", async () => {
    // Create a problem linked to the action
    const pbResult = await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "Schema migration blocker",
        severity: "HIGH",
        type: "code",
        scope: "ytn",
        description: "Need to handle FTS5 triggers",
        linkedAct: "ACT-0001",
      },
    });
    expect(pbResult.isError).toBeFalsy();
    const pb = structured<{ id: string }>(pbResult);
    expect(pb.id).toMatch(/^PB-\d{4}$/);

    // Mark the action as done with evidence
    const updateResult = await client.callTool({
      name: "update_action_status",
      arguments: {
        nanoid,
        id: "ACT-0001",
        newStatus: "done",
        evidence: "All tests pass, FTS5 triggers work",
      },
    });
    expect(updateResult.isError).toBeFalsy();

    // Verify cascade: problem should be "partial" with tested='partially'
    const getPbResult = await client.callTool({
      name: "get_problem",
      arguments: { id: pb.id },
    });
    expect(getPbResult.isError).toBeFalsy();
    const pbData = structured<{ problem: { status: string; tested: string } }>(getPbResult);
    expect(pbData.problem.status).toBe("partial");
    expect(pbData.problem.tested).toBe("partially");
  });

  // ─── Workflow: idea → promoted → cascade ───────────────────────────────────

  it("create_idea → promoted → action done → implemented cascade", async () => {
    // Create an idea
    const ideaResult = await client.callTool({
      name: "create_idea",
      arguments: {
        nanoid,
        title: "Add Python implementation",
        scope: "ytn",
        shortDesc: "Share the same SQLite schema",
      },
    });
    expect(ideaResult.isError).toBeFalsy();
    const ideaId = structured<{ id: string }>(ideaResult).id;
    expect(ideaId).toMatch(/^IDEA-\d{4}$/);

    // Create a decision that the idea is promoted to
    const decResult = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Add Python implementation alongside Node.js",
        decider: "admin",
        scope: "ytn",
      },
    });
    const decId = structured<{ id: string }>(decResult).id;

    // Promote the idea
    const promoteResult = await client.callTool({
      name: "update_idea_status",
      arguments: {
        nanoid,
        id: ideaId,
        newStatus: "promoted",
        promotedTo: decId,
      },
    });
    expect(promoteResult.isError).toBeFalsy();

    // Create an action sourced from the decision
    const actResult = await client.callTool({
      name: "create_action",
      arguments: {
        nanoid,
        title: "Implement Python schema module",
        scope: "ytn",
        priority: "P1",
        source: decId,
        source_type: "decision",
      },
    });
    const actId = structured<{ id: string }>(actResult).id;

    // Mark action as done → should cascade to idea → implemented
    const doneResult = await client.callTool({
      name: "update_action_status",
      arguments: {
        nanoid,
        id: actId,
        newStatus: "done",
        evidence: "Python schema module complete",
      },
    });
    expect(doneResult.isError).toBeFalsy();

    // Verify idea is now implemented
    const getIdeaResult = await client.callTool({
      name: "get_idea",
      arguments: { id: ideaId },
    });
    expect(getIdeaResult.isError).toBeFalsy();
    const ideaData = structured<{ idea: { status: string; tested: string } }>(getIdeaResult);
    expect(ideaData.idea.status).toBe("implemented");
    expect(ideaData.idea.tested).toBe("partially");
  });

  // ─── Workflow: DEC cancelled → IDEA abandoned ──────────────────────────────

  it("update_decision_status → Cancelled cascades to idea abandoned", async () => {
    // Create idea + decision + promote
    const ideaRes = await client.callTool({
      name: "create_idea",
      arguments: { nanoid, title: "Use NoSQL instead", scope: "ytn", shortDesc: "bad idea" },
    });
    const ideaId = structured<{ id: string }>(ideaRes).id;

    const decRes = await client.callTool({
      name: "create_decision",
      arguments: { nanoid, title: "Switch to NoSQL", decider: "admin", scope: "ytn" },
    });
    const decId = structured<{ id: string }>(decRes).id;

    await client.callTool({
      name: "update_idea_status",
      arguments: { nanoid, id: ideaId, newStatus: "promoted", promotedTo: decId },
    });

    // Cancel the decision
    const cancelResult = await client.callTool({
      name: "update_decision_status",
      arguments: { nanoid, id: decId, newStatus: "Cancelled", reason: "NoSQL is overkill" },
    });
    expect(cancelResult.isError).toBeFalsy();

    // Verify idea is abandoned
    const getIdeaResult = await client.callTool({
      name: "get_idea",
      arguments: { id: ideaId },
    });
    const ideaData = structured<{ idea: { status: string; abandon_reason: string | null } }>(getIdeaResult);
    expect(ideaData.idea.status).toBe("abandoned");
    expect(ideaData.idea.abandon_reason).toContain("cancelled");
  });

  // ─── withChildren scope filtering via MCP ──────────────────────────────────

  it("withChildren: true includes descendant scopes via MCP", async () => {
    // Create actions in different scopes
    await client.callTool({
      name: "create_action",
      arguments: { nanoid, title: "workspace ACT", scope: "workspace", priority: "P2" },
    });
    await client.callTool({
      name: "create_action",
      arguments: { nanoid, title: "ytn ACT", scope: "ytn", priority: "P2" },
    });
    await client.callTool({
      name: "create_action",
      arguments: { nanoid, title: "dna ACT", scope: "dna", priority: "P2" },
    });

    // workspace withChildren → all scopes
    const wsResult = await client.callTool({
      name: "list_actions",
      arguments: { scope: "workspace", withChildren: true },
    });
    expect(wsResult.isError).toBeFalsy();
    const wsData = structured<{ actions: { id: string }[] }>(wsResult);
    expect(wsData.actions.length).toBeGreaterThanOrEqual(3);
    const wsScopes = wsData.actions.flatMap((a) =>
      ctx.queries.getEntityScopes.all({ entity_type: "action", entity_id: a.id }).map((s) => s.scope_id),
    );
    expect(wsScopes).toContain("workspace");
    expect(wsScopes).toContain("ytn");
    expect(wsScopes).toContain("dna");

    // ytn withChildren → ytn + dna (not workspace)
    const ytnResult = await client.callTool({
      name: "list_actions",
      arguments: { scope: "ytn", withChildren: true },
    });
    const ytnData = structured<{ actions: { id: string }[] }>(ytnResult);
    const ytnScopes = ytnData.actions.flatMap((a) =>
      ctx.queries.getEntityScopes.all({ entity_type: "action", entity_id: a.id }).map((s) => s.scope_id),
    );
    expect(ytnScopes).toContain("ytn");
    expect(ytnScopes).toContain("dna");
    expect(ytnScopes).not.toContain("workspace");

    // exact match (no withChildren) → only ytn
    const exactResult = await client.callTool({
      name: "list_actions",
      arguments: { scope: "ytn" },
    });
    const exactData = structured<{ actions: { id: string }[] }>(exactResult);
    expect(exactData.actions.every((a) =>
      ctx.queries.getEntityScopes.all({ entity_type: "action", entity_id: a.id }).some((s) => s.scope_id === "ytn"),
    )).toBe(true);
  });

  // ─── search_mailbox via MCP ────────────────────────────────────────────────

  it("search_mailbox finds decisions by keyword via MCP", async () => {
    const result = await client.callTool({
      name: "search_mailbox",
      arguments: { query: "SQLite" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ results: { entity_type: string; entity_id: string }[] }>(result);
    expect(data.results.length).toBeGreaterThanOrEqual(1);
    const decResults = data.results.filter((r) => r.entity_type === "decision");
    expect(decResults.length).toBeGreaterThanOrEqual(1);
  });

  it("search_mailbox with entityType filter", async () => {
    const result = await client.callTool({
      name: "search_mailbox",
      arguments: { query: "SQLite", entityType: "decision" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ results: { entity_type: string }[] }>(result);
    expect(data.results.every((r) => r.entity_type === "decision")).toBe(true);
  });

  // ─── get_updates cursor via MCP ────────────────────────────────────────────

  it("get_updates returns entries and advances cursor via MCP", async () => {
    // Append a log entry first
    const today = new Date().toISOString().slice(0, 10);
    await client.callTool({
      name: "append_log_entry",
      arguments: {
        nanoid,
        date: today,
        type: "action",
        subject: "Test log entry via MCP",
        body: "Verifying get_updates cursor",
        scope: "ytn",
      },
    });

    // Get updates — should return entries
    const result = await client.callTool({
      name: "get_updates",
      arguments: { nanoid },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ entries: { id: number }[]; has_more: boolean }>(result);
    expect(data.entries.length).toBeGreaterThanOrEqual(1);

    // Second call should return fewer (cursor advanced)
    const result2 = await client.callTool({
      name: "get_updates",
      arguments: { nanoid },
    });
    const data2 = structured<{ entries: { id: number }[] }>(result2);
    expect(data2.entries.length).toBeLessThan(data.entries.length);
  });

  // ─── correct via MCP ───────────────────────────────────────────────────────

  it("correct updates a field and logs the correction via MCP", async () => {
    const result = await client.callTool({
      name: "correct",
      arguments: {
        nanoid,
        entityType: "decision",
        entityId: "DEC-0001",
        field: "title",
        newValue: "Use SQLite as the authoritative source of truth",
        reason: "Clarifying the title for future reference",
      },
    });
    expect(result.isError).toBeFalsy();

    // Verify the title was updated
    const getDecResult = await client.callTool({
      name: "get_decision",
      arguments: { id: "DEC-0001" },
    });
    const decData = structured<{ decision: { title: string } }>(getDecResult);
    expect(decData.decision.title).toBe("Use SQLite as the authoritative source of truth");

    // Verify a correction log entry was created
    const logsResult = await client.callTool({
      name: "list_log_entries",
      arguments: { type: "correction", refId: "DEC-0001" },
    });
    const logsData = structured<{ entries: { subject: string; body: string }[] }>(logsResult);
    expect(logsData.entries.length).toBeGreaterThanOrEqual(1);
    expect(logsData.entries[0].subject).toContain("DEC-0001");
    expect(logsData.entries[0].subject).toContain("title");
  });

  it("correct rejects log_entry entityType at DNA level", async () => {
    const result = await client.callTool({
      name: "correct",
      arguments: {
        nanoid,
        entityType: "log_entry",
        entityId: "1",
        field: "body",
        newValue: "edited",
        reason: "should be rejected",
      },
    });
    // DNA should reject "log_entry" — it's not in the entityType enum
    expect(result.isError).toBe(true);
  });

  // ─── audit_consistency via MCP ─────────────────────────────────────────────

  it("audit_consistency runs without error via MCP", async () => {
    const result = await client.callTool({
      name: "audit_consistency",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ findings: unknown[]; summary: { errors: number; warnings: number; info: number } }>(result);
    expect(data.summary).toBeDefined();
    expect(Array.isArray(data.findings)).toBe(true);
  });

  // ─── get_handoff via MCP ───────────────────────────────────────────────────

  it("get_handoff returns a snapshot via MCP", async () => {
    const result = await client.callTool({
      name: "get_handoff",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ open_actions: unknown[]; pending_decisions: unknown[] }>(result);
    expect(Array.isArray(data.open_actions)).toBe(true);
    expect(Array.isArray(data.pending_decisions)).toBe(true);
  });

  // ─── get_action_lineage via MCP ────────────────────────────────────────────

  it("get_action_lineage returns lineage via MCP", async () => {
    const result = await client.callTool({
      name: "get_action_lineage",
      arguments: { id: "ACT-0001" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ action: { id: string }; history: unknown[] }>(result);
    expect(data.action.id).toBe("ACT-0001");
    expect(Array.isArray(data.history)).toBe(true);
  });

  // ─── mailbox_last_24h via MCP ──────────────────────────────────────────────

  it("mailbox_last_24h returns timeline via MCP", async () => {
    const result = await client.callTool({
      name: "mailbox_last_24h",
      arguments: { hours: 24 },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ timeline: unknown[] }>(result);
    expect(Array.isArray(data.timeline)).toBe(true);
  });

  // ─── generate_daily_report via MCP ─────────────────────────────────────────

  it("generate_daily_report writes markdown file to disk via MCP", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await client.callTool({
      name: "generate_daily_report",
      arguments: { date: today },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string }>(result);
    expect(data.markdown).toContain("# Mailbox");
    expect(data.filename).toBe(`mailbox-${today}.md`);
    expect(data.filepath).toContain("mailbox");
    expect(data.filepath).toContain("generated");
    // Verify file exists on disk
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_decisions_report writes decisions registry to disk via MCP", async () => {
    const result = await client.callTool({
      name: "generate_decisions_report",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string; count: number }>(result);
    expect(data.filename).toBe("mailbox-decisions.md");
    expect(data.markdown).toContain("# Mailbox — Decision Log");
    expect(data.markdown).toContain("## Index");
    expect(data.count).toBeGreaterThanOrEqual(1);
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_actions_report writes actions registry to disk via MCP", async () => {
    const result = await client.callTool({
      name: "generate_actions_report",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string; count: number }>(result);
    expect(data.filename).toBe("mailbox-actions.md");
    expect(data.markdown).toContain("# Mailbox — Action Log");
    expect(data.count).toBeGreaterThanOrEqual(1);
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_ideas_report writes ideas registry to disk via MCP", async () => {
    const result = await client.callTool({
      name: "generate_ideas_report",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string; count: number }>(result);
    expect(data.filename).toBe("features-ideas.md");
    expect(data.markdown).toContain("# Mailbox — Ideas & Features");
    expect(data.count).toBeGreaterThanOrEqual(1);
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_problems_report writes problems registry to disk via MCP", async () => {
    const result = await client.callTool({
      name: "generate_problems_report",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string; count: number }>(result);
    expect(data.filename).toBe("mailbox-problems.md");
    expect(data.markdown).toContain("# Mailbox — Problems & Bugs");
    expect(data.count).toBeGreaterThanOrEqual(1);
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_decision_history_report writes timeline to disk via MCP", async () => {
    const result = await client.callTool({
      name: "generate_decision_history_report",
      arguments: { id: "DEC-0001" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ markdown: string; filename: string; filepath: string; counts: { actions: number; ideas: number; problems: number } }>(result);
    expect(data.filename).toBe("decision-history-dec-0001.md");
    expect(data.markdown).toContain("# Decision History — DEC-0001");
    expect(data.markdown).toContain("## Decision");
    expect(data.markdown).toContain("## Actions");
    const { existsSync } = await import("node:fs");
    expect(existsSync(data.filepath)).toBe(true);
  });

  it("generate_decision_history_report rejects unknown decision via MCP", async () => {
    const result = await client.callTool({
      name: "generate_decision_history_report",
      arguments: { id: "DEC-9999" },
    });
    expect(result.isError).toBe(true);
  });

  // ─── export_dump via MCP ───────────────────────────────────────────────────

  it("export_dump returns SQL dump via MCP", async () => {
    const result = await client.callTool({
      name: "export_dump",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ sql: string }>(result);
    expect(data.sql).toContain("CREATE TABLE");
    expect(data.sql).toContain("INSERT INTO");
  });

  // ─── whoami via MCP ────────────────────────────────────────────────────────

  it("whoami returns the writer profile via MCP", async () => {
    const result = await client.callTool({
      name: "whoami",
      arguments: { nanoid },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ writer: { id: string; role: string; objective: string } }>(result);
    expect(data.writer.id).toBe("admin");
    expect(data.writer.role).toBe("admin");
    expect(data.writer.objective).toBe("test the MCP protocol");
  });

  it("whoami rejects unknown nanoid via MCP", async () => {
    const result = await client.callTool({
      name: "whoami",
      arguments: { nanoid: "invalid-nanoid-12345" },
    });
    expect(result.isError).toBe(true);
  });

  // ─── DNA validation at protocol level ──────────────────────────────────────

  it("rejects missing required field (nanoid) at DNA level", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: { title: "Missing nanoid", decider: "admin" },
    });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toMatch(/validation|invalid|required|missing/i);
  });

  it("rejects wrong type (query as number) at DNA level", async () => {
    const result = await client.callTool({
      name: "search_mailbox",
      arguments: { query: 12345 },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects invalid enum value at DNA level", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: { nanoid, title: "Bad status", decider: "admin", status: "INVALID_STATUS" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects nanoid with wrong length at DNA level", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: { nanoid: "too-short", title: "Bad nanoid", decider: "admin" },
    });
    expect(result.isError).toBe(true);
  });

  it("rejects unknown tool name at protocol level", async () => {
    await expect(
      client.callTool({ name: "nonexistent_tool", arguments: {} }),
    ).rejects.toThrow();
  });

  // ─── Threading via MCP ─────────────────────────────────────────────────────

  it("append_log_entry with replyTo creates a thread via MCP", async () => {
    const today = new Date().toISOString().slice(0, 10);

    // First entry
    const firstResult = await client.callTool({
      name: "append_log_entry",
      arguments: {
        nanoid,
        date: today,
        type: "question",
        subject: "How does the cascade work?",
        body: "I need to understand the ACT→PB cascade",
        scope: "ytn",
      },
    });
    expect(firstResult.isError).toBeFalsy();
    const firstEntry = structured<{ id: number; thread_id: number }>(firstResult);
    expect(firstEntry.thread_id).toBeGreaterThan(0);

    // Reply
    const replyResult = await client.callTool({
      name: "append_log_entry",
      arguments: {
        nanoid,
        date: today,
        type: "answer",
        subject: "Re: How does the cascade work?",
        body: "When an action is done, linked problems become partial",
        scope: "ytn",
        replyTo: firstEntry.id,
        threadId: firstEntry.thread_id,
      },
    });
    expect(replyResult.isError).toBeFalsy();

    // Get thread
    const threadResult = await client.callTool({
      name: "get_thread",
      arguments: { threadId: firstEntry.thread_id },
    });
    expect(threadResult.isError).toBeFalsy();
    const threadData = structured<{ entries: { id: number; type: string }[] }>(threadResult);
    expect(threadData.entries).toHaveLength(2);
    expect(threadData.entries[0].type).toBe("question");
    expect(threadData.entries[1].type).toBe("answer");
  });

  // ─── create_spec + update_spec_status cascade ──────────────────────────────

  it("create_spec → superseded → reopens linked problem via MCP", async () => {
    // Create a spec
    const specResult = await client.callTool({
      name: "create_spec",
      arguments: {
        nanoid,
        id: "SPEC-0001",
        filename: "spec-gov-mcp.md",
        scope: "ytn",
        version: 1,
        status: "locked",
      },
    });
    expect(specResult.isError).toBeFalsy();

    // Create a problem of type "spec" linked to the spec, mark it fixed
    const pbResult = await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "Spec drift in gov-mcp",
        severity: "MEDIUM",
        type: "spec",
        scope: "ytn",
        linkedSpec: "SPEC-0001",
        description: "Spec doesn't match implementation",
      },
    });
    const pbId = structured<{ id: string }>(pbResult).id;

    // Mark problem as fixed
    await client.callTool({
      name: "update_problem_status",
      arguments: { nanoid, id: pbId, newStatus: "fixed", fix: "Updated spec to match" },
    });

    // Now supersede the spec → should reopen the problem
    const supersedeResult = await client.callTool({
      name: "update_spec_status",
      arguments: { nanoid, id: "SPEC-0001", newStatus: "superseded" },
    });
    expect(supersedeResult.isError).toBeFalsy();

    // Verify problem is reopened
    const getPbResult = await client.callTool({
      name: "get_problem",
      arguments: { id: pbId },
    });
    const pbData = structured<{ problem: { status: string } }>(getPbResult);
    expect(pbData.problem.status).toBe("open");
  });

  // ─── get_open_actions via MCP ──────────────────────────────────────────────

  it("get_open_actions returns pending/in_progress/blocked actions via MCP", async () => {
    // Create a pending action
    await client.callTool({
      name: "create_action",
      arguments: { nanoid, title: "Open action for handoff", scope: "ytn", priority: "P1" },
    });

    const result = await client.callTool({
      name: "get_open_actions",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ actions: { status: string }[] }>(result);
    expect(data.actions.length).toBeGreaterThanOrEqual(1);
    expect(data.actions.every((a) => ["pending", "in_progress", "blocked"].includes(a.status))).toBe(true);
  });

  // ─── get_decision_history via MCP ──────────────────────────────────────────

  it("get_decision_history returns full history via MCP", async () => {
    const result = await client.callTool({
      name: "get_decision_history",
      arguments: { id: "DEC-0001" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ decision: { id: string }; actions: unknown[]; ideas: unknown[]; history: unknown[] }>(result);
    expect(data.decision.id).toBe("DEC-0001");
    expect(Array.isArray(data.actions)).toBe(true);
    expect(Array.isArray(data.history)).toBe(true);
  });

  // ─── get_scope with entity counts via MCP ──────────────────────────────────

  it("get_scope returns entity counts via MCP", async () => {
    const result = await client.callTool({
      name: "get_scope",
      arguments: { id: "ytn" },
    });
    expect(result.isError).toBeFalsy();
    const data = structured<{ scope: { id: string; label: string }; counts: { decisions: { count: number }; actions: { count: number } } }>(result);
    expect(data.scope.id).toBe("ytn");
    expect(data.counts).toBeDefined();
    expect(data.counts.decisions.count).toBeGreaterThanOrEqual(1);
    expect(data.counts.actions.count).toBeGreaterThanOrEqual(1);
  });

  // ─── forcedNumId option on create_* tools ──────────────────────────────────

  it("create_decision with forcedNumId uses the forced ID", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Forced decision",
        decider: "admin",
        scope: "ytn",
        forcedNumId: 5001,
      },
    });
    expect(result.isError).toBeFalsy();
    const dec = structured<{ id: string; seq: number }>(result);
    expect(dec.id).toBe("DEC-5001");
    expect(dec.seq).toBe(5001);
  });

  it("create_decision with forcedNumId rejects if ID already exists", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Duplicate forced decision",
        decider: "admin",
        scope: "ytn",
        forcedNumId: 5001,
      },
    });
    expect(result.isError).toBe(true);
  });

  it("create_decision with forcedNumId rejects number too small", async () => {
    const result = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Too small",
        decider: "admin",
        scope: "ytn",
        forcedNumId: 0,
      },
    });
    expect(result.isError).toBe(true);
  });

  it("create_action with forcedNumId uses the forced ID", async () => {
    const result = await client.callTool({
      name: "create_action",
      arguments: {
        nanoid,
        title: "Forced action",
        scope: "ytn",
        forcedNumId: 5002,
      },
    });
    expect(result.isError).toBeFalsy();
    const act = structured<{ id: string; seq: number }>(result);
    expect(act.id).toBe("ACT-5002");
    expect(act.seq).toBe(5002);
  });

  it("create_idea with forcedNumId uses the forced ID", async () => {
    const result = await client.callTool({
      name: "create_idea",
      arguments: {
        nanoid,
        title: "Forced idea",
        scope: "ytn",
        forcedNumId: 5003,
      },
    });
    expect(result.isError).toBeFalsy();
    const idea = structured<{ id: string; seq: number }>(result);
    expect(idea.id).toBe("IDEA-5003");
    expect(idea.seq).toBe(5003);
  });

  it("create_problem with forcedNumId uses the forced ID", async () => {
    const result = await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid,
        title: "Forced problem",
        severity: "HIGH",
        type: "code",
        scope: "ytn",
        forcedNumId: 5004,
      },
    });
    expect(result.isError).toBeFalsy();
    const pb = structured<{ id: string; seq: number }>(result);
    expect(pb.id).toBe("PB-5004");
    expect(pb.seq).toBe(5004);
  });
});
