import type { McpClient } from "@ytrynot/gov-mcp/client";

import { runHook } from "../core/engine.ts";
import { stateMgr } from "./state.ts";

const state = stateMgr();

import { handlers, handlerLog } from "./handlers/index.ts";

export const main = async (mcp: McpClient) => {

  try {
    await runHook(handlers, { state, mcp }, handlerLog);
  } catch (e) {
    console.error("HOOK ERROR", e)
  }
}
