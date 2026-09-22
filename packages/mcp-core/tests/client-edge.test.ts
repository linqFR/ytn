/**
 * Client edge cases — falsy `structuredContent` (SEP-2106: any JSON
 * value), transport cleanup when the post-connect handshake fails, and
 * `tools/list_changed` refresh failures routed to `onerror` rather than
 * an unhandled rejection.
 */

import { describe, expect, it, vi } from "vitest";
import { InMemoryTransport, type Transport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { dna } from "@ytrynot/dna";
import { createCore, type IToolEntry } from "../src/index.js";
import { registerTools } from "../src/server.js";
import { createMcpClient } from "../src/client.js";

const tools: IToolEntry<object>[] = [
  {
    name: "flag",
    args: dna.object({}),
    handler: () => ({
      content: [{ type: "text", text: "flag" }],
      structuredContent: false,
      isError: false,
    }),
  },
  {
    name: "zero",
    args: dna.object({}),
    handler: () => ({
      content: [{ type: "text", text: "zero" }],
      structuredContent: 0,
      isError: false,
    }),
  },
  {
    name: "nul",
    args: dna.object({}),
    handler: () => ({
      content: [{ type: "text", text: "null" }],
      structuredContent: null,
      isError: false,
    }),
  },
];

async function setup() {
  const core = createCore({ tools, ctx: {} });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(
    () => {
      const server = new McpServer(
        { name: "t", version: "0.0.0" },
        { capabilities: { tools: { listChanged: true } } },
      );
      registerTools(server, core);
      return server;
    },
    { transport: st },
  );
  const client = await createMcpClient({ transport: ct });
  return { client, handle };
}

describe("client.call — falsy structuredContent", () => {
  it("passes false/0/null through verbatim in the raw result", async () => {
    const { client, handle } = await setup();
    expect((await client.call("flag")).structuredContent).toBe(false);
    expect((await client.call("zero")).structuredContent).toBe(0);
    expect((await client.call("nul")).structuredContent).toBeNull();
    await client.close();
    await handle.close();
  });
});

describe("createMcpClient — failed handshake", () => {
  it("closes the transport when the post-connect exchange rejects", async () => {
    let closed = false;
    const dead: Transport = {
      start: async () => {},
      send: async () => {
        throw new Error("dead transport");
      },
      close: async () => {
        closed = true;
      },
    };
    await expect(createMcpClient({ transport: dead })).rejects.toThrow();
    expect(closed).toBe(true);
  });

  it("throws when `transport` and `stdio` are both provided", async () => {
    const unused: Transport = {
      start: async () => {},
      send: async () => {},
      close: async () => {},
    };
    await expect(
      createMcpClient({ transport: unused, stdio: { serverScript: "x.js" } }),
    ).rejects.toThrow("not both");
  });
});

describe("tools/list_changed refresh", () => {
  it("routes a refresh failure to onerror instead of an unhandled rejection", async () => {
    const { client, handle } = await setup();
    const errors: Error[] = [];
    client.raw.onerror = (e) => {
      errors.push(e);
    };

    // The SDK's own auto-refresh listTools succeeds (first call); the
    // listMeta refresh issued by our onChanged rejects (second call).
    vi.spyOn(client.raw, "listTools")
      .mockResolvedValueOnce({ tools: [] })
      .mockRejectedValueOnce(new Error("refresh boom"));

    client.raw.transport?.onmessage?.({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    });

    await vi.waitFor(() =>
      expect(errors.some((e) => e.message === "refresh boom")).toBe(true),
    );
    await client.close();
    await handle.close();
  });
});
