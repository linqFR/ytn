/**
 * MCP protocol tests for tools/list schema inspection.
 *
 * Verifies that DNA schemas are correctly exposed as JSON Schema in the
 * MCP tools/list response, and that the enum constraints match the spec.
 *
 *   Client → InMemoryTransport → McpServer → tools/list → JSON Schema
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import { GovDb } from "../src/driver.js";
import { setupMcpServer } from "./helpers/setup-mcp.js";

describe("MCP protocol: tools/list exposes DNA schemas", () => {
  let client: Client;
  let db: GovDb;

  beforeAll(async () => {
    const setup = await setupMcpServer();
    client = setup.client;
    db = setup.db;
  });

  afterAll(() => db.close());

  it("returns all registered tools", async () => {
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    // Verify the tools we registered are exposed
    expect(names).toContain("list_actions");
    expect(names).toContain("list_ideas");
    expect(names).toContain("list_problems");
    expect(names).toContain("list_specs");
    expect(names).toContain("correct");
    expect(names).toContain("get_action_lineage");
    expect(names).toContain("create_scope");
    expect(names).toContain("update_action_status");
  });

  it("list_actions exposes scope and withChildren in its schema", async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === "list_actions");
    expect(tool).toBeDefined();
    const props = tool!.inputSchema.properties as Record<string, unknown>;
    expect(props.scope).toBeDefined();
    expect(props.withChildren).toBeDefined();
  });

  it("correct exposes entityType enum without log_entry", async () => {
    const result = await client.listTools();
    const tool = result.tools.find((t) => t.name === "correct");
    expect(tool).toBeDefined();
    const entityType = (tool!.inputSchema.properties as Record<string, { enum?: string[] }>).entityType;
    expect(entityType).toBeDefined();
    expect(entityType!.enum).toBeDefined();
    expect(entityType!.enum).toContain("decision");
    expect(entityType!.enum).toContain("action");
    expect(entityType!.enum).toContain("idea");
    expect(entityType!.enum).toContain("problem");
    expect(entityType!.enum).toContain("spec");
    // log_entry must NOT be in the enum
    expect(entityType!.enum).not.toContain("log_entry");
    expect(entityType!.enum).not.toContain("log_entries");
  });
});
