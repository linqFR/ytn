#!/usr/bin/env node
/**
 * MCP server entry point for @ytrynot/gov-mcp.
 *
 * Exposes governance tools via the Model Context Protocol (stdio transport).
 * Uses @modelcontextprotocol/server 2.0.0 McpServer with DNA schemas (Standard Schema).
 */

import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { GovDb, resolveReportsDir } from "./driver.js";
import { initDatabase } from "./init.js";
import { compileQueries } from "./queries/index.js";
import { toolList } from "./definitions/tools.js";
import { toolMeta } from "./tools/meta.js";
import type { IToolCtx, OToolResult } from "./types/types.ts";
import pkg from "../package.json" with { type: "json" };

// ─── Server startup ──────────────────────────────────────────────────────────

export interface IServerOptions {
  dbPath?: string;
}

/** Convert an IToolResult to the McpServer CallToolResult format. */
export function toCallToolResult(result: OToolResult) {
  return {
    content: result.content,
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}

/** Create and start the MCP server. */
export async function startServer(options: IServerOptions = {}): Promise<void> {
  const db = GovDb.open({ dbPath: options.dbPath });
  initDatabase(db);
  const queries = compileQueries(db);
  const ctx: IToolCtx = { db, queries, reportsDir: resolveReportsDir() };

  const server = new McpServer(
    { name: pkg.name, version: pkg.version },
    {
      capabilities: { tools: {} },
      instructions: [
        `Governance MCP server (${pkg.name} v${pkg.version}).`,
        ``,
        `START HERE: Call the \`help\` tool to get the full tool reference, common workflows, and a Recommended Reading table that maps intents to documentation files.`,
        ``,
        `Quick start:`,
        `1. Call \`help\` — full tool reference + workflows + doc recommendations`,
        `2. Ask ADMIN for your scope, role, and responsibilities (questions/answers)`,
        `3. Synthesize the answers and ask ADMIN to validate before registering`,
        `4. Call \`register_me\` with the validated profile — SAVE the returned nanoid (it is shown only once and cannot be retrieved)`,
        `5. Call \`list_docs\` to see available documentation, \`get_doc\` to read any doc`,
        `6. Use \`get_updates\` with your nanoid to read unread log entries`,
      ].join("\n"),
    },
  );

  // ── Register all tools from the central registry ──

  for (const tool of toolList) {
    const meta = toolMeta[tool.name];
    server.registerTool(
      tool.name,
      { description: meta.description, inputSchema: tool.args },
      async (args) => toCallToolResult(tool.handler(ctx, args)),
    );
  }

  // ── Start ──

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start if run directly
import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((e) => {
    console.error("Failed to start gov-mcp server:", e);
    process.exit(1);
  });
}
