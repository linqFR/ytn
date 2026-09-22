/**
 * Shared E2E suite — run once per schema flavor (DNA, Zod, raw JSON Schema).
 * Each spec file calls `e2eSuite(label, makeSchema)`; vitest runs the files
 * in parallel workers.
 */

import { InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import { createMcpClient } from "../src/client.js";
import {
  createCore,
  dispatchTool,
  isToolInputRequired,
  toolDescription,
  type IToolEntry,
  type IToolSchema,
} from "../src/index.js";
import { startStdioServer } from "../src/server.js";

interface ICtx {
  prefix: string;
}

/**
 * The suite contract: `greet` tool taking `{name: string}` and returning
 * `structuredContent: {greeting: string}` — implemented by whatever schema
 * flavor the spec file provides.
 */
export interface ISuiteSchemas {
  /** Input schema for `greet` ({name: string} contract). */
  input: IToolSchema;
  /** Optional description override (schemas without `.meta()`). */
  description?: string;
  /** Optional output schema for `structuredContent`. */
  output?: IToolSchema;
  /**
   * Output schema for the `names` tool — an array of strings. Exercises
   * SEP-2106: `structuredContent` may be any JSON value, not only objects.
   */
  arrayOutput: IToolSchema;
  /** Expected `toolDescription()` result for this flavor. */
  expectedDescription: string;
  /** Parse `{name}` out of a raw input — each flavor its own way. */
  parseName(input: unknown): string;
}

export function e2eSuite(label: string, s: ISuiteSchemas) {
  const tools: IToolEntry<ICtx>[] = [
    {
      name: "greet",
      args: s.input,
      ...(s.output ? { output: s.output } : {}),
      ...(s.description !== undefined ? { description: s.description } : {}),
      handler(ctx, input) {
        const greeting = ctx.prefix + s.parseName(input);
        return {
          content: [{ type: "text", text: greeting }],
          structuredContent: { greeting },
          isError: false,
        };
      },
    },
    {
      name: "names",
      args: s.input,
      output: s.arrayOutput,
      handler(ctx) {
        const names = [ctx.prefix.trim(), "mcp"];
        return {
          content: [{ type: "text", text: names.join(",") }],
          structuredContent: names,
          isError: false,
        };
      },
    },
    {
      name: "broken",
      args: s.input,
      output: s.arrayOutput,
      handler() {
        // Deliberately violates the declared output schema — the SDK must
        // refuse to serve non-conforming structuredContent (spec MUST).
        return {
          content: [{ type: "text", text: "oops" }],
          structuredContent: { not: "an array" },
          isError: false,
        };
      },
    },
  ];

  /**
   * Era-aware serving: `startStdioServer` runs the SDK's `serveStdio` entry
   * over one end of an in-memory pair; the client's default `auto`
   * negotiation probes `server/discover` and lands on the modern era
   * (protocol 2026-07-28 — no `{result:…}` wrap on non-object roots).
   */
  async function setup() {
    const core = createCore({ tools, ctx: { prefix: "Hello, " } });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = await startStdioServer({
      name: "test-server",
      version: "0.0.0",
      core,
      transport: serverTransport,
    });
    const client = await createMcpClient({ transport: clientTransport });
    return { core, server, client };
  }

  describe(`e2e [${label}]`, () => {
    it("dispatches in-process via the bound ctx", () => {
      const core = createCore({ tools, ctx: { prefix: "# " } });
      const res = dispatchTool(core.tools, core.ctx, "greet", { name: "Ada" });
      if (isToolInputRequired(res)) throw new Error("unexpected input_required result");
      expect(res.isError).toBe(false);
      expect(res.structuredContent).toEqual({ greeting: "# Ada" });
    });

    it("calls a tool over the MCP protocol and returns the raw result", async () => {
      const { client, server } = await setup();
      const res = await client.call("greet", { name: "Ada" });
      expect(res.isError).toBe(false);
      expect(res.structuredContent).toEqual({ greeting: "Hello, Ada" });
      await client.close();
      await server.close();
    });

    it("advertises the registered tool names", async () => {
      const { client, server } = await setup();
      expect(client.toolNames).toEqual(["greet", "names", "broken"]);
      await client.close();
      await server.close();
    });

    it("negotiates the modern protocol era (2026-07-28)", async () => {
      const { client, server } = await setup();
      expect(client.raw.getProtocolEra()).toBe("modern");
      await client.close();
      await server.close();
    });

    it("round-trips non-object structuredContent (SEP-2106: array output)", async () => {
      const { client, server } = await setup();
      const res = await client.call("names", { name: "x" });
      // Modern-era connections project structuredContent verbatim — the
      // `{result:…}` wrap only exists on legacy-era (2025) connections.
      expect(res.structuredContent).toEqual(["Hello,", "mcp"]);
      await client.close();
      await server.close();
    });

    it("refuses non-conforming structuredContent (outputSchema enforcement)", async () => {
      const { client, server } = await setup();
      const res = await client.raw.callTool({ name: "broken", arguments: { name: "x" } });
      // Server-side validation (spec MUST): the violation surfaces as an
      // isError result carrying the output-validation failure.
      expect(res.isError).toBe(true);
      await client.close();
      await server.close();
    });

    it("exposes the advertised input JSON Schema", async () => {
      const { client, server } = await setup();
      const { tools: advertised } = await client.raw.listTools();
      const greet = advertised.find((t) => t.name === "greet");
      // CAST: the wire inputSchema is untyped JSON — narrow to the field shape we assert on.
      const json = greet?.inputSchema as { properties?: Record<string, unknown> } | undefined;
      expect(json?.properties).toHaveProperty("name");
      await client.close();
      await server.close();
    });

    it("exposes the advertised output JSON Schema when declared", async () => {
      const { client, server } = await setup();
      const { tools: advertised } = await client.raw.listTools();
      if (s.output) {
        const greet = advertised.find((t) => t.name === "greet");
        // CAST: the wire outputSchema is untyped JSON — narrow to the field shape we assert on.
        const json = greet?.outputSchema as { properties?: Record<string, unknown> } | undefined;
        expect(json?.properties).toHaveProperty("greeting");
      }
      const names = advertised.find((t) => t.name === "names");
      // CAST: modern-era connections advertise the output schema verbatim —
      // a non-object root stays non-object (no `result` wrapper).
      const arrJson = names?.outputSchema as
        | { type?: string; items?: { type?: string } }
        | undefined;
      expect(arrJson?.type).toBe("array");
      expect(arrJson?.items?.type).toBe("string");
      await client.close();
      await server.close();
    });

    it("derives the tool description", () => {
      expect(toolDescription(tools[0])).toBe(s.expectedDescription);
    });
  });
}
