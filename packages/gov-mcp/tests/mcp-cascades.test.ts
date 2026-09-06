/**
 * MCP protocol tests for cascade triggers.
 *
 * Verifies that SQL cascade triggers fire correctly when mutations
 * go through the full MCP transport path, not just direct DB access.
 *
 *   Client → InMemoryTransport → McpServer → DNA validation → handler → DB → trigger
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import { GovDb } from "../src/driver.js";
import { setupMcpServer, registerWriterViaMcp } from "./helpers/setup-mcp.js";

describe("MCP protocol: cascade ACT→done→PB→partial", () => {
  let client: Client;
  let db: GovDb;
  let nanoid: string;

  beforeAll(async () => {
    const setup = await setupMcpServer();
    client = setup.client;
    db = setup.db;
    nanoid = await registerWriterViaMcp(client);

    // Create action + problem + link
    await client.callTool({
      name: "create_action",
      arguments: { nanoid, title: "ACT for cascade", priority: "P1" },
    });
    await client.callTool({
      name: "create_problem",
      arguments: {
        nanoid, title: "PB for cascade", severity: "HIGH", type: "code",
      },
    });
    await client.callTool({
      name: "link_problem_action",
      arguments: { nanoid, problemId: "PB-0001", actionId: "ACT-0001", role: "primary" },
    });
  });

  afterAll(() => db.close());

  it("ACT→done cascades PB→partial via MCP", async () => {
    const result = await client.callTool({
      name: "update_action_status",
      arguments: {
        nanoid,
        id: "ACT-0001",
        newStatus: "done",
        evidence: "All tests pass",
      },
    });
    expect(result.isError).toBeFalsy();

    // Verify cascade in DB
    const pb = db.prepare("SELECT status, tested FROM problems WHERE id = ?")
      .get("PB-0001") as { status: string; tested: string };
    expect(pb.status).toBe("partial");
    expect(pb.tested).toBe("partially");
  });
});
