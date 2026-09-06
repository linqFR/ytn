/**
 * Shared MCP test harness — registers all governance tools on a McpServer
 * and connects a Client via InMemoryTransport.
 *
 * Used by all mcp-*.test.ts files to test the full protocol path:
 *   Client → InMemoryTransport → McpServer → DNA validation → handler → DB
 */

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { GovDb } from "../../src/driver.js";
import { initDatabase } from "../../src/init.js";
import { compileQueries } from "../../src/queries/index.js";
import * as S from "../../src/schemas/tool-inputs.js";
import { toCallToolResult } from "../../src/server.js";
import * as read from "../../src/tools/read.js";
import * as write from "../../src/tools/write.js";
import type { IToolCtx } from "../../src/types/types.ts";

export interface IMcpTestHarness {
  client: Client;
  ctx: IToolCtx;
  db: GovDb;
}

/**
 * Register all tools on a McpServer and connect a Client via InMemoryTransport.
 * Returns { client, ctx, db } so tests can call tools via the client
 * and inspect the DB directly when needed.
 */
export async function setupMcpServer(): Promise<IMcpTestHarness> {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db) };

  const server = new McpServer(
    { name: "test-gov-protocol", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  // Read: entities
  server.registerTool("list_decisions",
    { description: "List decisions", inputSchema: S.listDecisionsInput },
    async (args) => toCallToolResult(read.listDecisions(ctx, args)),
  );
  server.registerTool("list_actions",
    { description: "List actions", inputSchema: S.listActionsInput },
    async (args) => toCallToolResult(read.listActions(ctx, args)),
  );
  server.registerTool("list_ideas",
    { description: "List ideas", inputSchema: S.listIdeasInput },
    async (args) => toCallToolResult(read.listIdeas(ctx, args)),
  );
  server.registerTool("list_problems",
    { description: "List problems", inputSchema: S.listProblemsInput },
    async (args) => toCallToolResult(read.listProblems(ctx, args)),
  );
  server.registerTool("list_specs",
    { description: "List specs", inputSchema: S.listSpecsInput },
    async (args) => toCallToolResult(read.listSpecs(ctx, args)),
  );
  server.registerTool("get_action_lineage",
    { description: "Action lineage", inputSchema: S.getActionLineageInput },
    async (args) => toCallToolResult(read.getActionLineage(ctx, args)),
  );

  // Write: writer + scopes
  server.registerTool("register_writer",
    { description: "Register writer", inputSchema: S.registerWriterInput },
    async (args) => toCallToolResult(write.registerWriter(ctx, args)),
  );
  server.registerTool("create_scope",
    { description: "Create scope", inputSchema: S.createScopeInput },
    async (args) => toCallToolResult(write.createScope(ctx, args)),
  );

  // Write: entities
  server.registerTool("create_decision",
    { description: "Create decision", inputSchema: S.createDecisionInput },
    async (args) => toCallToolResult(write.createDecision(ctx, args)),
  );
  server.registerTool("create_action",
    { description: "Create action", inputSchema: S.createActionInput },
    async (args) => toCallToolResult(write.createAction(ctx, args)),
  );
  server.registerTool("create_idea",
    { description: "Create idea", inputSchema: S.createIdeaInput },
    async (args) => toCallToolResult(write.createIdea(ctx, args)),
  );
  server.registerTool("create_problem",
    { description: "Create problem", inputSchema: S.createProblemInput },
    async (args) => toCallToolResult(write.createProblem(ctx, args)),
  );
  server.registerTool("create_spec",
    { description: "Create spec", inputSchema: S.createSpecInput },
    async (args) => toCallToolResult(write.createSpec(ctx, args)),
  );
  server.registerTool("link_problem_action",
    { description: "Link problem to action", inputSchema: S.linkProblemActionInput },
    async (args) => toCallToolResult(write.linkProblemAction(ctx, args)),
  );
  server.registerTool("update_action_status",
    { description: "Update action status", inputSchema: S.updateActionStatusInput },
    async (args) => toCallToolResult(write.updateActionStatus(ctx, args)),
  );

  // Write: correct
  server.registerTool("correct",
    { description: "Correct a field", inputSchema: S.correctInput },
    async (args) => toCallToolResult(write.correct(ctx, args)),
  );

  // Connect client
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return { client, ctx, db };
}

/**
 * Register a writer and return its nanoid via the MCP client.
 */
export async function registerWriterViaMcp(
  client: Client,
  id = "admin",
): Promise<string> {
  const result = await client.callTool({
    name: "register_writer",
    arguments: { id, role: "admin" },
  });
  return (result.structuredContent as { nanoid: string }).nanoid;
}
