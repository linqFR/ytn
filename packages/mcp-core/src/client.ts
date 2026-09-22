/**
 * Client layer — generic MCP client factory on `@modelcontextprotocol/client`.
 *
 * Connects to a server over a caller-provided transport or by spawning a
 * stdio subprocess, then exposes `call(name, args)` — the protocol is the
 * only runtime channel.
 *
 * The SDK client validates `structuredContent` against the advertised
 * `outputSchema` on every `tools/call` (spec: clients SHOULD) — inherited
 * here for free.
 */

import {
  Client,
  type CallToolResult,
  type ClientOptions,
  type ElicitRequestParams,
  type ElicitResult,
  type ListToolsResult,
  type Tool,
  type Transport,
} from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export interface IStdioClientOpts {
  /** Path to the server entry point to spawn (e.g. `dist/server.js`). */
  serverScript: string;
  /** Spawn command; defaults to `"node"`. */
  command?: string;
  /** Extra args placed before `serverScript`. */
  args?: string[];
  /**
   * Extra env vars for the child process, merged over the SDK's
   * `getDefaultEnvironment()` safe-inherit set.
   */
  env?: Record<string, string>;
}

export interface IMcpClientOpts {
  /** Client identity sent in the MCP handshake. */
  name?: string;
  version?: string;
  /** Ready-made transport (e.g. `InMemoryTransport` for tests). Mutually exclusive with `stdio`. */
  transport?: Transport;
  /** Or spawn a stdio server subprocess. Mutually exclusive with `transport`. */
  stdio?: IStdioClientOpts;
  /**
   * Protocol-era negotiation. Defaults to `{ mode: "auto" }`: the client
   * probes `server/discover` (modern era, protocol 2026-07-28) and falls back
   * to the legacy `initialize` handshake. Use `{ mode: "legacy" }` to skip
   * the probe, or `{ mode: { pin: "2026-07-28" } }` to require the modern
   * era with no fallback.
   *
   * Cost on `stdio`: the base `StdioClientTransport` probes on a short-lived
   * sibling process — one extra spawn per `connect`. For spawn-per-call
   * patterns, prefer `{ mode: "legacy" }` when the target is known-legacy,
   * or a custom transport (probes in place, no extra spawn).
   */
  versionNegotiation?: ClientOptions["versionNegotiation"];
  /**
   * Called after the advertised tool list has been refreshed following a
   * `notifications/tools/list_changed` (servers declaring
   * `capabilities.tools.listChanged` only).
   */
  onToolsChanged?: (tools: readonly Tool[]) => void;
  /**
   * Elicitation support (MCP `elicitation/create`): declares the capability
   * and registers `onRequest` as the handler. On modern-era connections the
   * same handler also auto-fulfils `input_required` rounds embedded inside
   * `tools/call` results. Form mode is the spec default and always
   * declared; `url: true` additionally declares URL-mode support.
   */
  elicitation?: {
    url?: boolean;
    onRequest(params: ElicitRequestParams): ElicitResult | Promise<ElicitResult>;
  };
}

/** Cacheability hints carried by the latest `tools/list` result. */
export interface IToolListMeta {
  readonly ttlMs?: number;
  readonly cacheScope?: string;
}

/** Narrow the `tools/list` cache hints — the SDK result types them `unknown`. */
function readListMeta(list: ListToolsResult): IToolListMeta {
  return {
    ...(typeof list.ttlMs === "number" ? { ttlMs: list.ttlMs } : {}),
    ...(typeof list.cacheScope === "string" ? { cacheScope: list.cacheScope } : {}),
  };
}

export interface IMcpClient {
  /**
   * Call a tool by name — a thin pass-through to `client.callTool`: the raw
   * `CallToolResult` is returned verbatim (`content`, `structuredContent`,
   * `isError`…). mcp-core does not interpret the payload; how to read the
   * result is the caller's business.
   */
  call(name: string, args?: Record<string, unknown>): Promise<CallToolResult>;
  /** Tools as last advertised — refreshed on `tools/list_changed`. */
  readonly tools: readonly Tool[];
  /** Names of the currently advertised tools. */
  readonly toolNames: readonly string[];
  /** Cache hints (`ttlMs`/`cacheScope`) from the latest `tools/list` result. */
  readonly listMeta: IToolListMeta;
  /** The underlying SDK client, for protocol features not wrapped here. */
  readonly raw: Client;
  close(): Promise<void>;
}

/** Connect an MCP client over stdio spawn or a caller-provided transport. */
export async function createMcpClient(opts: IMcpClientOpts = {}): Promise<IMcpClient> {
  if (opts.transport && opts.stdio) {
    throw new Error("createMcpClient: provide `transport` or `stdio`, not both");
  }
  const transport =
    opts.transport ??
    (() => {
      if (!opts.stdio) {
        throw new Error("createMcpClient: provide either `transport` or `stdio`");
      }
      return new StdioClientTransport({
        command: opts.stdio.command ?? "node",
        args: [...(opts.stdio.args ?? []), opts.stdio.serverScript],
        stderr: "pipe",
        env: { ...getDefaultEnvironment(), ...opts.stdio.env },
      });
    })();

  let tools: readonly Tool[] = [];
  let listMeta: IToolListMeta = {};

  const client = new Client(
    { name: opts.name ?? "mcp-core-client", version: opts.version ?? "0.0.0" },
    {
      capabilities: {
        ...(opts.elicitation
          ? { elicitation: opts.elicitation.url ? { form: {}, url: {} } : {} }
          : {}),
      },
      versionNegotiation: opts.versionNegotiation ?? { mode: "auto" },
      listChanged: {
        tools: {
          autoRefresh: true,
          onChanged: (error, items) => {
            if (error) {
              client.onerror?.(error);
              return;
            }
            if (items) tools = items;
            // Refresh the cache hints alongside the list (served from the
            // SDK's response cache — no extra round trip). A failure (e.g.
            // the transport died between notification and refresh) routes
            // to onerror — never an unhandled rejection.
            void client.listTools().then(
              (list) => {
                listMeta = readListMeta(list);
              },
              (refreshError: unknown) => {
                client.onerror?.(
                  refreshError instanceof Error
                    ? refreshError
                    : new Error(String(refreshError)),
                );
              },
            );
            opts.onToolsChanged?.(tools);
          },
        },
      },
    },
  );
  if (opts.elicitation) {
    const onRequest = opts.elicitation.onRequest;
    client.setRequestHandler("elicitation/create", (request) => onRequest(request.params));
  }
  // Don't leak the transport (or the spawned subprocess) when the
  // post-connect handshake fails.
  const list: ListToolsResult = await client
    .connect(transport)
    .then(() => client.listTools())
    .catch(async (error: unknown) => {
      await client.close().catch(() => {});
      throw error;
    });
  tools = list.tools;
  listMeta = readListMeta(list);

  function call(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
    return client.callTool({ name, arguments: args });
  }

  return {
    call,
    get tools() {
      return tools;
    },
    get toolNames() {
      return tools.map((t) => t.name);
    },
    get listMeta() {
      return listMeta;
    },
    raw: client,
    close: () => client.close(),
  };
}
