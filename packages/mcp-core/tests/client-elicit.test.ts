/**
 * Client elicitation — `elicitation/create` capability + handler wiring.
 * The standalone server→client elicitation is exercised on a legacy-era
 * connection (the 2025 era where a bare `elicitInput` request is legal);
 * on the modern era the same handler is auto-invoked inside the
 * `input_required` multi-round-trip flow of `tools/call`.
 */

import { InMemoryTransport, type ElicitRequestParams } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { dna } from "@ytrynot/dna";
import { describe, expect, it } from "vitest";
import { createMcpClient } from "../src/client.js";
import {
  createCore,
  toolAcceptedContent,
  toolInputRequired,
  type IToolEntry,
} from "../src/index.js";
import { registerTools } from "../src/server.js";

const tools: IToolEntry<object>[] = [
  {
    name: "noop",
    args: dna.object({}),
    handler: () => ({ content: [{ type: "text", text: "ok" }], isError: false }),
  },
  {
    name: "deploy",
    args: dna.object({}),
    handler(_ctx, _input, req) {
      const confirmed = toolAcceptedContent<{ confirm: boolean }>(
        req?.inputResponses,
        "confirm",
      );
      if (confirmed?.confirm !== true) {
        return toolInputRequired({
          inputRequests: {
            confirm: {
              kind: "form",
              message: "Deploy?",
              requestedSchema: {
                type: "object",
                properties: { confirm: { type: "boolean" } },
                required: ["confirm"],
              },
            },
          },
        });
      }
      return { content: [{ type: "text", text: "deployed" }], isError: false };
    },
  },
];

describe("client elicitation", () => {
  it("declares the capability and answers elicitation/create", async () => {
    const core = createCore({ tools, ctx: {} });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    let pinned: McpServer | undefined;
    const handle = serveStdio(
      () => {
        const server = new McpServer(
          { name: "t", version: "0.0.0" },
          { capabilities: { tools: {} } },
        );
        registerTools(server, core);
        pinned = server;
        return server;
      },
      { transport: st },
    );

    const seen: unknown[] = [];
    const client = await createMcpClient({
      transport: ct,
      versionNegotiation: { mode: "legacy" },
      elicitation: {
        onRequest(params) {
          seen.push(params);
          return { action: "accept", content: { name: "Ada" } };
        },
      },
    });

    if (!pinned) throw new Error("serveStdio did not pin an instance");
    expect(pinned.server.getClientCapabilities()?.elicitation).toBeDefined();

    const result = await pinned.server.elicitInput({
      mode: "form",
      message: "Name?",
      requestedSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    });

    expect(result.action).toBe("accept");
    expect(result.content).toEqual({ name: "Ada" });
    expect(seen).toHaveLength(1);

    await client.close();
    await handle.close();
  });

  it("auto-fulfils a registry tool's input_required on a modern-era connection", async () => {
    const core = createCore({ tools, ctx: {} });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const handle = serveStdio(
      () => {
        const server = new McpServer(
          { name: "t", version: "0.0.0" },
          { capabilities: { tools: {} } },
        );
        registerTools(server, core);
        return server;
      },
      { transport: st },
    );

    const seen: ElicitRequestParams[] = [];
    const client = await createMcpClient({
      transport: ct,
      // default { mode: "auto" } — the probe runs on the transport itself
      // (InMemoryTransport is not the base stdio transport) → modern era.
      elicitation: {
        onRequest(params) {
          seen.push(params);
          return { action: "accept", content: { confirm: true } };
        },
      },
    });

    // One logical call: `deploy` answers input_required with an embedded
    // form elicitation; the SDK fulfils it with the registered handler and
    // retries internally, resolving to the final result.
    const result = await client.call("deploy");
    expect(result.content).toEqual([{ type: "text", text: "deployed" }]);
    expect(seen).toHaveLength(1);

    await client.close();
    await handle.close();
  });
});
