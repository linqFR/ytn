/**
 * Transport layer — the only module importing `@modelcontextprotocol/server`.
 *
 * `registerTools` wires a declarative `IToolEntry` list onto an `McpServer`;
 * `startStdioServer` serves the registry over stdio through `serveStdio`,
 * the SDK's era-aware serving entry (the opening exchange — `server/discover`
 * vs `initialize` — selects the protocol era per connection);
 * `publishDiscoveryFile` writes a JSON descriptor (OS temp dir by default)
 * so sibling processes can discover connection settings.
 */

import {
  inputRequired,
  McpServer,
  type CallToolResult,
  type ElicitInputParams,
  type InputRequest,
  type InputRequiredResult,
  type ServerContext,
} from "@modelcontextprotocol/server";
import {
  serveStdio,
  type ServeStdioOptions,
  type StdioServerHandle,
} from "@modelcontextprotocol/server/stdio";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  isToolInputRequired,
  toolDescription,
  type IMcpCore,
  type IToolInputRequest,
  type tsToolOutcome,
} from "./types.js";

/** Convert an embedded-request descriptor to the SDK's `InputRequest`. */
function toInputRequest(req: IToolInputRequest): InputRequest {
  switch (req.kind) {
    case "form":
      return inputRequired.elicit({
        message: req.message,
        // CAST: the SDK accepts a wire JSON Schema document or a Standard
        // Schema here, but its declared parameter type is the inferred
        // restricted wire shape — `Record<string, unknown>` is not
        // provably assignable to it.
        requestedSchema: req.requestedSchema as ElicitInputParams["requestedSchema"],
      });
    case "url":
      return inputRequired.elicitUrl({ message: req.message, url: req.url });
  }
}

/**
 * Convert a handler's {@link tsToolOutcome} to the McpServer callback
 * format: a `CallToolResult`, or an `InputRequiredResult` when the
 * handler answered `input_required` (multi-round-trip, era 2026-07-28).
 */
export function toCallToolResult(
  result: tsToolOutcome,
): CallToolResult | InputRequiredResult {
  if (isToolInputRequired(result)) {
    return inputRequired({
      ...(result.inputRequests !== undefined
        ? {
            inputRequests: Object.fromEntries(
              Object.entries(result.inputRequests).map(([key, req]) => [
                key,
                toInputRequest(req),
              ]),
            ),
          }
        : {}),
      ...(result.requestState !== undefined ? { requestState: result.requestState } : {}),
    });
  }
  return {
    content: result.content,
    structuredContent: result.structuredContent,
    isError: result.isError,
  };
}

/**
 * Register every entry of `core.tools` on `server`. Descriptions default to
 * the input schema's `.meta().description` (when the schema library provides
 * one); `output` becomes the MCP `outputSchema` when declared.
 */
export function registerTools<Ctx>(server: McpServer, core: IMcpCore<Ctx>): void {
  for (const tool of core.tools) {
    server.registerTool(
      tool.name,
      {
        description: toolDescription(tool),
        inputSchema: tool.args,
        ...(tool.output ? { outputSchema: tool.output } : {}),
      },
      async (args: unknown, sctx: ServerContext) =>
        toCallToolResult(
          tool.handler(core.ctx, args, {
            inputResponses: sctx.mcpReq.inputResponses,
            droppedInputResponseKeys: sctx.mcpReq.droppedInputResponseKeys,
            requestState: sctx.mcpReq.requestState(),
          }),
        ),
    );
  }
}

export interface IStdioServerOpts<Ctx> {
  /** Server identity advertised in the MCP handshake (usually pkg.name). */
  name: string;
  version: string;
  /** Optional `instructions` string shown to clients. */
  instructions?: string;
  /** The core to serve — tools bound to their domain context. */
  core: IMcpCore<Ctx>;
  /**
   * How a 2025-era opening (`initialize`, or any claim-less message) is
   * handled: `"serve"` (default) pins a legacy-era instance built by the
   * same factory; `"reject"` answers with the unsupported-protocol-version
   * error so only modern-era (2026-07-28) clients are served.
   */
  legacy?: ServeStdioOptions["legacy"];
  /**
   * Bring-your-own transport for the serving entry — defaults to a
   * `StdioServerTransport` over the process's stdio. Tests pass one end of
   * `InMemoryTransport.createLinkedPair()` to serve the era-aware protocol
   * in-process.
   */
  transport?: ServeStdioOptions["transport"];
  /**
   * Publish a JSON discovery file after connecting, so other processes can
   * locate this server's configuration (env vars, paths). `dir` defaults to
   * the OS temp dir; pass another directory when the temp dir is not the
   * agreed rendezvous (e.g. a per-user state directory).
   */
  discovery?: {
    fileName: string;
    fields: Record<string, string | undefined>;
    dir?: string;
  };
}

/**
 * Serve the core's registry over stdio via `serveStdio`.
 *
 * The serving entry owns the era decision: it answers `server/discover`
 * probes itself (modern era, protocol 2026-07-28) and routes `initialize`
 * openings to a legacy-pinned instance. The factory runs once per
 * connection (plus once for a discarded discover probe), so every era gets
 * the same registered surface.
 *
 * Returns the serving handle — `close()` tears down the pinned instance
 * and the transport.
 */
export async function startStdioServer<Ctx>(
  opts: IStdioServerOpts<Ctx>,
): Promise<StdioServerHandle> {
  const handle = serveStdio(
    () => {
      const server = new McpServer(
        { name: opts.name, version: opts.version },
        {
          capabilities: { tools: {} },
          ...(opts.instructions !== undefined ? { instructions: opts.instructions } : {}),
        },
      );
      registerTools(server, opts.core);
      return server;
    },
    {
      ...(opts.legacy !== undefined ? { legacy: opts.legacy } : {}),
      ...(opts.transport !== undefined ? { transport: opts.transport } : {}),
    },
  );
  if (opts.discovery) {
    publishDiscoveryFile(
      opts.discovery.fileName,
      {
        ...opts.discovery.fields,
        startedAt: new Date().toISOString(),
      },
      opts.discovery.dir,
    );
  }
  return handle;
}

/**
 * Write a JSON discovery file and return its absolute path. Used to publish
 * env/config values to processes that did not spawn this server (e.g. a
 * second agent looking up the DB path).
 *
 * `dir` defaults to the OS temp dir (`tmpdir()`); pass another directory when
 * the temp dir is not the agreed rendezvous.
 *
 * The file is written world-readable (default umask) — never put secrets,
 * tokens, or credentials in `fields`.
 */
export function publishDiscoveryFile(
  fileName: string,
  fields: Record<string, string | undefined>,
  dir?: string,
): string {
  const filePath = join(dir ?? tmpdir(), fileName);
  writeFileSync(filePath, JSON.stringify(fields), "utf-8");
  return filePath;
}
