/**
 * hook-v1.ts — Entry point for the Devin CLI governance hook.
 *
 * Reads stdin (JSON event payload), runs the DNA pipeline which
 * decodes, dispatches to the matching handler, encodes, and writes
 * the result to stdout.
 *
 * hooks.v1.json points to hook/dist/hook-v1.js (built from this file).
 */

import { createMcpClient, type McpClient } from "@ytrynot/gov-mcp/client";


import {main} from "./config/index.js";

const mcpClient: McpClient = await createMcpClient();

await main(mcpClient);

await mcpClient.close();