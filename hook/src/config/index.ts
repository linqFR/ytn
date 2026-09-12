import { createMcpClient, type McpClient } from "@ytrynot/gov-mcp/client";

import { runHook } from "../core/engine.ts";
import { stateMgr } from "./state.ts";

const state = stateMgr();

let mcpClient: McpClient | null = null;
const getMcp = async (): Promise<McpClient> => {
  if (!mcpClient) {
    mcpClient = await createMcpClient();
  }
  return mcpClient;
};

import { handlers, handlerLog } from "./handlers/index.ts";

export const main = async () => {

  try {
    await runHook(handlers, { state, getMcp }, handlerLog);
  } finally {
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}
