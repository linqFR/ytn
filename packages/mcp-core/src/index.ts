/**
 * @ytrynot/mcp-core — generic MCP server factory.
 *
 * A domain package owns its tool list: `{ name, args, output?, handler }`
 * entries whose handlers are pure `(ctx, input, req?) → tsToolOutcome`
 * functions (a final `IToolResult`, or an `IToolInputRequired` round for
 * the modern-era multi-round-trip flow).
 * This package provides the two ways to serve them:
 *
 * - `dispatchTool` / `createDispatcher` — in-process calls (hooks, tests),
 *   no MCP transport.
 * - `@ytrynot/mcp-core/server` — `registerTools` + `startStdioServer` on top
 *   of `@modelcontextprotocol/server`.
 *
 * This entry point stays free of SDK imports so embedders can dispatch tools
 * without loading the MCP stack.
 */

export {
  createCore,
  createDispatcher,
  dispatchTool,
  isToolInputRequired,
  toolAcceptedContent,
  toolDescription,
  toolError,
  toolInputRequired,
  type IContentAnnotations,
  type IMcpCore,
  type IToolCallInfo,
  type IToolEntry,
  type IToolHelpCategory,
  type IToolInputRequest,
  type IToolInputRequestForm,
  type IToolInputRequestUrl,
  type IToolInputRequired,
  type IToolResult,
  type IToolSchema,
  type IToolSchemaResult,
  type tsJsonSchemaTarget,
  type tsToolContent,
  type tsToolOutcome
} from "./types.js";

export {
  buildToolHelp,
  compactSig,
  describeEntry,
  helpParts,
  type IToolHelpMeta,
  type tsHelpToken
} from "./help.js";

