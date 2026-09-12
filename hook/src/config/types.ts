/**
 * types.ts — Hook context types (config layer).
 *
 * HookContext groups the runtime services available to handlers.
 * Owned by config (not core) — core/engine.ts uses generics to avoid
 * a circular dependency.
 *
 * `getMcp` is a lazy async getter: the MCP client is only spawned when
 * a handler actually needs it (e.g. SessionStart calls whoami).
 * PostToolUse patterns-only handlers never trigger the MCP connection.
 */

import type { tsStateDb } from "./state.ts";
import type { McpClient } from "@ytrynot/gov-mcp/client";

export interface HookContext {
  state: tsStateDb;
  getMcp: () => Promise<McpClient>;
}
