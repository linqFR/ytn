/**
 * client.ts — MCP client for @ytrynot/gov-mcp (subpath: ./client).
 *
 * Provides typed readonly access to governance data via Model Context Protocol.
 * The client spawns the gov-mcp server as a subprocess and communicates over stdio.
 *
 * The client interface is fully derived from `toolSchemas` (type-only import):
 * - Input types:  `dna.infer<typeof toolSchemas[K]["schema"]>`
 * - Output types:  `dna.infer<typeof toolSchemas[K]["output"]>`
 * No manual ToolResults map, no O*Result interfaces — single source of truth.
 *
 * Only types are shared between client and server. The client does NOT import
 * any server runtime code (handlers, SQLite queries, etc.). At runtime, all
 * calls go through the MCP protocol via `callTool(name, arguments)`.
 *
 * Uses the official @modelcontextprotocol/client SDK (v2.0.0):
 * - Client from "@modelcontextprotocol/client"
 * - StdioClientTransport from "@modelcontextprotocol/client/stdio"
 *
 * @example
 * ```ts
 * import { createMcpClient } from "@ytrynot/gov-mcp/client";
 *
 * const mcp = await createMcpClient();
 * const writer = await mcp.whoami({ nanoid: "your-nanoid" });
 * await mcp.close();
 * ```
 */

import { Client, type Transport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { GOVERNANCE_DB_PATH, GOVERNANCE_REPORTS_DIR, GOVERNANCE_SERVER_SCRIPT } from "../shared/env-vars.js";
import type { toolSchemas } from "../shared/schemas/tool-schemas.js";

// Re-export public types for consumers of @ytrynot/gov-mcp/client
export type {
  OActiveProblem, OArchitecturalItem, OGetHandoffResult, OGetOpenActionsResult, OGetUpdatesResult,
  OListActionsResult, OListDecisionItem, OListDecisionsResult, OListLogEntriesResult, OListProblemsResult, OPendingDecision, ORawIdea,
  OToTestItem, OWhoamiResult
} from "../shared/types/client.ts";
export type { tsActionRow, tsLogEntryRow, tsProblemRow, tsWriterRow } from "../shared/types/rows.ts";

// ── Public interface ──
// Fully derived from toolSchemas (type-only import): readonly tools only.
// - Input:  dna.infer<typeof toolSchemas[K]["schema"]>  (DNA input schema)
// - Output: dna.infer<typeof toolSchemas[K]["output"]>  (DNA output schema)
// Flipping isReadonly on a tool adds/removes it here automatically.

// Local equivalent of dna.$Output<S> — avoids importing the `dna` namespace
// type (rollup-plugin-dts cannot serialize `dna.infer` member access yet).
type SchemaOutput<S> = S extends { _output: any } ? S["_output"] : unknown;

type ReadonlyToolName = {
  [K in keyof typeof toolSchemas]: typeof toolSchemas[K]["isReadonly"] extends true ? K : never
}[keyof typeof toolSchemas];

export type McpClient = {
  [K in ReadonlyToolName]: (input: SchemaOutput<typeof toolSchemas[K]["schema"]>) => Promise<SchemaOutput<typeof toolSchemas[K]["output"]>>
} & {
  close: () => Promise<void>;
};

// ── Factory ──

export interface CreateMcpClientOpts {
  /** Override path to the gov-mcp server entry point. */
  serverScriptPath?: string;
  /** Inject a custom transport (e.g. InMemoryTransport for tests). */
  transport?: Transport;
  env:{
    /** Explicit GOVERNANCE_DB_PATH (overrides config files). */
    GOVERNANCE_DB_PATH?: string;
    /** Explicit GOVERNANCE_REPORTS_DIR (overrides config files). */
    GOVERNANCE_REPORTS_DIR?: string;
  }
}

export async function createMcpClient(opts?: CreateMcpClientOpts): Promise<McpClient> {
  const transport = opts?.transport ?? (() => {
    const serverScript = opts?.serverScriptPath ?? GOVERNANCE_SERVER_SCRIPT;
    return new StdioClientTransport({
      command: "node",
      args: [serverScript],
      stderr: "pipe",
      env: {
        GOVERNANCE_DB_PATH: opts?.env?.GOVERNANCE_DB_PATH ?? GOVERNANCE_DB_PATH,
        GOVERNANCE_REPORTS_DIR: opts?.env?.GOVERNANCE_REPORTS_DIR ?? GOVERNANCE_REPORTS_DIR,
      },
    });
  })();

  const client = new Client(
    { name: "gov-mcp-client", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await client.callTool({ name, arguments: args });
    // Prefer structuredContent (typed data); fall back to text content
    if (result.structuredContent) {
      return result.structuredContent;
    }
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: { type: string }) => c.type === "text");
      if (textContent && "text" in textContent) {
        return (textContent as { text: string }).text;
      }
    }
    return result.content;
  }

  // Runtime: discover tools via MCP protocol (listTools), build methods dynamically.
  // No server code is imported — the MCP protocol is the only runtime channel.
  // The McpClient type (compile-time) restricts access to readonly tools only.
  const { tools } = await client.listTools();
  const methods: Record<string, (input?: Record<string, unknown>) => Promise<unknown>> = {};
  for (const tool of tools) {
    methods[tool.name] = async (input: Record<string, unknown> = {}) => callTool(tool.name, input);
  }
  methods.close = async () => { await client.close(); };

  // CAST: methods are built from listTools() results, which match the readonly tool
  // names in McpClient. callTool returns unknown; McpClient narrows it to the output
  // schema type. Double-cast via unknown: Record<string, Function> → unknown → McpClient.
  return methods as unknown as McpClient;
}
