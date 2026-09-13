/**
 * client.test.ts — Tests for the gov-mcp client (subpath ./client).
 *
 * Uses InMemoryTransport to test the client against a real McpServer
 * with an in-memory governance DB. No subprocess needed.
 */

import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GovDb, resolveReportsDir, initDatabase, compileQueries, schemas as S, readTools as read, writeTools as write, type IToolCtx } from "../src/index.js";
import { toCallToolResult } from "../src/server.js";
import { createMcpClient } from "../src/client.ts";
import type { McpClient } from "../src/client.ts";

let mcp: McpClient;
let nanoid: string;

beforeAll(async () => {
  const db = GovDb.memory();
  initDatabase(db);
  const ctx: IToolCtx = { db, queries: compileQueries(db), reportsDir: resolveReportsDir() };

  // Register writer directly (no MCP roundtrip for setup)
  const regResult = write.registerWriter(ctx, { id: "test-writer", role: "admin" });
  if (regResult.isError) {
    const text = regResult.content[0]?.text ?? "unknown error";
    throw new Error(`Failed to register test writer: ${text}`);
  }
  nanoid = regResult.structuredContent!.nanoid as string;

  const server = new McpServer(
    { name: "test-gov-client", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  // Register tools needed for tests
  server.registerTool("whoami",
    { description: "Whoami", inputSchema: S.whoamiInput },
    async (args) => toCallToolResult(read.whoami(ctx, args)),
  );
  server.registerTool("get_updates",
    { description: "Get updates", inputSchema: S.getUpdatesInput },
    async (args) => toCallToolResult(read.getUpdates(ctx, args)),
  );
  server.registerTool("list_actions",
    { description: "List actions", inputSchema: S.listActionsInput },
    async (args) => toCallToolResult(read.listActions(ctx, args)),
  );
  server.registerTool("list_problems",
    { description: "List problems", inputSchema: S.listProblemsInput },
    async (args) => toCallToolResult(read.listProblems(ctx, args)),
  );
  server.registerTool("get_open_actions",
    { description: "Get open actions", inputSchema: S.getOpenActionsInput },
    async (args) => toCallToolResult(read.getOpenActions(ctx, args)),
  );
  server.registerTool("get_handoff",
    { description: "Get handoff", inputSchema: S.getHandoffInput },
    async (args) => toCallToolResult(read.getHandoff(ctx, args)),
  );

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  mcp = await createMcpClient({ transport: clientTransport });
});

afterAll(async () => {
  await mcp.close();
});

describe("McpClient", () => {
  it("whoami returns the writer profile", async () => {
    const writer = await mcp.whoami(nanoid);
    expect(writer).not.toBeNull();
    expect(writer?.id).toBe("test-writer");
    expect(writer?.role).toBe("admin");
    expect(writer?.nanoid).toBe(nanoid);
    expect(writer?.last_read_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("whoami returns null for unknown nanoid", async () => {
    const writer = await mcp.whoami("invalid-nanoid-1234567");
    expect(writer).toBeNull();
  });

  it("getUpdates returns the correct shape", async () => {
    const result = await mcp.getUpdates(nanoid);
    expect(result).toHaveProperty("entries");
    expect(result).toHaveProperty("new_cursor");
    expect(result).toHaveProperty("has_more");
    expect(result).toHaveProperty("remaining");
    expect(Array.isArray(result.entries)).toBe(true);
  });

  it("listActions returns { actions, count }", async () => {
    const result = await mcp.listActions();
    expect(result).toHaveProperty("actions");
    expect(result).toHaveProperty("count");
    expect(Array.isArray(result.actions)).toBe(true);
    expect(typeof result.count).toBe("number");
  });

  it("listProblems returns { problems, count }", async () => {
    const result = await mcp.listProblems();
    expect(result).toHaveProperty("problems");
    expect(result).toHaveProperty("count");
    expect(Array.isArray(result.problems)).toBe(true);
    expect(typeof result.count).toBe("number");
  });

  it("getOpenActions returns { actions, count }", async () => {
    const result = await mcp.getOpenActions();
    expect(result).toHaveProperty("actions");
    expect(result).toHaveProperty("count");
    expect(Array.isArray(result.actions)).toBe(true);
    expect(typeof result.count).toBe("number");
  });

  it("getHandoff returns the handoff snapshot shape", async () => {
    const result = await mcp.getHandoff();
    expect(result).toHaveProperty("date");
    expect(result).toHaveProperty("open_actions");
    expect(result).toHaveProperty("pending_decisions");
    expect(result).toHaveProperty("active_problems");
    expect(result).toHaveProperty("raw_ideas");
    expect(result).toHaveProperty("to_test");
    expect(result).toHaveProperty("architectural_items");
    expect(Array.isArray(result.open_actions)).toBe(true);
    expect(result.active_problems).toHaveProperty("critical");
    expect(result.active_problems).toHaveProperty("high");
    expect(result.active_problems).toHaveProperty("medium");
  });
});
