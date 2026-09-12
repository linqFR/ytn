/**
 * client.ts — MCP client for @ytrynot/gov-mcp (subpath: ./client).
 *
 * Provides typed readonly access to governance data via Model Context Protocol.
 * The client spawns the gov-mcp server as a subprocess and communicates over stdio.
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
 * const writer = await mcp.whoami("your-nanoid");
 * await mcp.close();
 * ```
 */

import { Client, type Transport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { resolve } from "node:path";
import type { tsWriterRow } from "./types/rows.ts";
import type {
  OGetHandoffResult,
  OGetOpenActionsResult,
  OGetUpdatesResult,
  OListActionsResult,
  OListDecisionsResult,
  OListProblemsResult,
  OWhoamiResult,
} from "./types/client.ts";

// Re-export public types for consumers of @ytrynot/gov-mcp/client
export type {
  OActiveProblem, OArchitecturalItem, OGetHandoffResult, OGetOpenActionsResult, OGetUpdatesResult,
  OListActionsResult, OListDecisionItem, OListDecisionsResult, OListProblemsResult, OPendingDecision, ORawIdea,
  OToTestItem, OWhoamiResult
} from "./types/client.ts";
export type { tsActionRow, tsLogEntryRow, tsProblemRow, tsWriterRow} from "./types/rows.ts";

// ── Public interface ──

export interface McpClient {
  whoami: (nanoid: string) => Promise<tsWriterRow | null>;
  getUpdates: (nanoid: string, opts?: {
    scope?: string;
    withChildren?: boolean;
    type?: string;
    since?: number;
    last?: number;
    resetCursor?: boolean;
    limit?: number;
  }) => Promise<OGetUpdatesResult>;
  getOpenActions: (priority?: string) => Promise<OGetOpenActionsResult>;
  getHandoff: () => Promise<OGetHandoffResult>;
  listProblems: (filter?: {
    status?: string;
    severity?: string;
    type?: string;
    scope?: string;
    withChildren?: boolean;
    limit?: number;
  }) => Promise<OListProblemsResult>;
  listActions: (filter?: {
    status?: string;
    owner?: string;
    priority?: string;
    scope?: string;
    withChildren?: boolean;
    limit?: number;
  }) => Promise<OListActionsResult>;
  listDecisions: (filter?: {
    status?: string;
    scope?: string;
    withChildren?: boolean;
    limit?: number;
  }) => Promise<OListDecisionsResult>;
  close: () => Promise<void>;
}

// ── Factory ──

export interface CreateMcpClientOpts {
  /** Override path to the gov-mcp server entry point. */
  serverScriptPath?: string;
  /** Inject a custom transport (e.g. InMemoryTransport for tests). */
  transport?: Transport;
}

export async function createMcpClient(opts?: CreateMcpClientOpts): Promise<McpClient> {
  const transport = opts?.transport ?? (() => {
    const projectDir = process.env.DEVIN_PROJECT_DIR ?? ".";
    const serverScript = opts?.serverScriptPath ?? resolve(projectDir, "packages", "gov-mcp", "dist", "server.js");
    return new StdioClientTransport({
      command: "node",
      args: [serverScript],
      stderr: "pipe",
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

  return {
    async whoami(nanoid: string): Promise<tsWriterRow | null> {
      const result = await callTool("whoami", { nanoid }) as OWhoamiResult | null;
      return result?.writer ?? null;
    },

    async getUpdates(nanoid: string, opts?: {
      scope?: string;
      withChildren?: boolean;
      type?: string;
      since?: number;
      last?: number;
      resetCursor?: boolean;
      limit?: number;
    }): Promise<OGetUpdatesResult> {
      const result = await callTool("get_updates", { nanoid, ...opts }) as OGetUpdatesResult;
      return result;
    },

    async getOpenActions(priority?: string): Promise<OGetOpenActionsResult> {
      const result = await callTool("get_open_actions", priority ? { priority } : {}) as OGetOpenActionsResult;
      return result;
    },

    async getHandoff(): Promise<OGetHandoffResult> {
      const result = await callTool("get_handoff", {}) as OGetHandoffResult;
      return result;
    },

    async listProblems(filter?: {
      status?: string;
      severity?: string;
      type?: string;
      scope?: string;
      withChildren?: boolean;
      limit?: number;
    }): Promise<OListProblemsResult> {
      const result = await callTool("list_problems", filter ?? {}) as OListProblemsResult;
      return result;
    },

    async listActions(filter?: {
      status?: string;
      owner?: string;
      priority?: string;
      scope?: string;
      withChildren?: boolean;
      limit?: number;
    }): Promise<OListActionsResult> {
      const result = await callTool("list_actions", filter ?? {}) as OListActionsResult;
      return result;
    },

    async listDecisions(filter?: {
      status?: string;
      scope?: string;
      withChildren?: boolean;
      limit?: number;
    }): Promise<OListDecisionsResult> {
      const result = await callTool("list_decisions", filter ?? {}) as OListDecisionsResult;
      return result;
    },

    async close(): Promise<void> {
      await client.close();
    },
  };
}
