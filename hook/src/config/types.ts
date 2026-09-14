/**
 * types.ts — Hook context types (config layer).
 *
 * HookContext groups the runtime services available to handlers.
 * Owned by config (not core) — core/engine.ts uses generics to avoid
 * a circular dependency.
 */

import type { tsStateDb } from "./state.ts";
import type { McpClient } from "@ytrynot/gov-mcp/client";

export interface HookContext {
  state: tsStateDb;
  mcp: McpClient;
}
