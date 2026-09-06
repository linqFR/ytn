/**
 * Integration test: McpServer + DNA schemas via InMemoryTransport.
 * Verifies that @modelcontextprotocol/server 2.0.0 accepts DNA schemas
 * and that tools/list + tools/call work end-to-end.
 */

import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GovDb } from "../src/driver.js";
import { initDatabase } from "../src/init.js";
import { compileQueries } from "../src/queries/index.js";
import * as S from "../src/schemas/tool-inputs.js";
import { toCallToolResult } from "../src/server.js";
import * as read from "../src/tools/read.js";
import type { IToolCtx } from "../src/types/types.ts";
import * as write from "../src/tools/write.js";

describe("McpServer + DNA schemas", () => {
  let db: GovDb;
  let ctx: IToolCtx;
  let server: McpServer;
  let client: Client;

  beforeAll(async () => {
    db = GovDb.memory();
    initDatabase(db);
    ctx = { db, queries: compileQueries(db) };

    server = new McpServer(
      { name: "test-gov", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );

    // Register a subset of tools with DNA schemas
    server.registerTool("list_decisions",
      { description: "List decisions", inputSchema: S.listDecisionsInput },
      async (args) => toCallToolResult(read.listDecisions(ctx, args)),
    );
    server.registerTool("register_writer",
      { description: "Register a writer", inputSchema: S.registerWriterInput },
      async (args) => toCallToolResult(write.registerWriter(ctx, args)),
    );
    server.registerTool("create_decision",
      { description: "Create a decision", inputSchema: S.createDecisionInput },
      async (args) => toCallToolResult(write.createDecision(ctx, args)),
    );
    server.registerTool("search_mailbox",
      { description: "Search", inputSchema: S.searchMailboxInput },
      async (args) => toCallToolResult(read.searchMailbox(ctx, args)),
    );

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(clientTransport);
  });

  afterAll(() => {
    db.close();
  });

  it("tools/list returns JSON Schema from DNA", async () => {
    const result = await client.listTools();
    expect(result.tools).toHaveLength(4);
    const searchTool = result.tools.find((t) => t.name === "search_mailbox");
    expect(searchTool).toBeDefined();
    expect(searchTool!.inputSchema.type).toBe("object");
    expect(searchTool!.inputSchema.properties).toBeDefined();
    expect(searchTool!.inputSchema.properties!.query).toBeDefined();
  });

  it("tools/call with valid DNA-validated input succeeds", async () => {
    // First register a writer
    const writerResult = await client.callTool({
      name: "register_writer",
      arguments: { id: "test-admin", role: "admin" },
    });
    expect(writerResult.isError).toBeFalsy();

    // Create a decision using the nanoid from the writer result
    const writerStructured = writerResult.structuredContent as { nanoid: string } | undefined;
    const nanoid = writerStructured?.nanoid;
    expect(nanoid).toBeDefined();

    const decResult = await client.callTool({
      name: "create_decision",
      arguments: {
        nanoid,
        title: "Test decision via MCP",
        decider: "test-admin",
      },
    });
    expect(decResult.isError).toBeFalsy();
    const decStructured = decResult.structuredContent as { id: string } | undefined;
    expect(decStructured?.id).toMatch(/^DEC-\d{4}$/);
  });

  it("tools/call with invalid input is rejected by DNA validation", async () => {
    // Missing required field: nanoid
    const result = await client.callTool({
      name: "create_decision",
      arguments: { title: "Missing nanoid", decider: "admin" },
    });
    expect(result.isError).toBe(true);
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toMatch(/validation|invalid|required|missing/i);
  });

  it("tools/call with wrong type is rejected by DNA validation", async () => {
    const result = await client.callTool({
      name: "search_mailbox",
      arguments: { query: 12345 },
    });
    expect(result.isError).toBe(true);
  });

  it("list_decisions returns created decision", async () => {
    const result = await client.callTool({
      name: "list_decisions",
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    const structured = result.structuredContent as { decisions: unknown[] };
    expect(structured?.decisions).toBeDefined();
    expect(structured!.decisions.length).toBeGreaterThanOrEqual(1);
  });
});
