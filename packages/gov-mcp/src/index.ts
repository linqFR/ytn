/**
 * @ytrynot/gov-mcp — SQLite-centric governance MCP server.
 *
 * Public API: driver, schema, triggers, init, server, tools, schemas.
 */

// Driver
export { GovDb, type IDriverOptions, type IStatement, type TxFn } from "./driver.js";

// Schema
export { FTS5_DDL, generateIndexDDL, generateSchemaSQL, tables } from "./definitions/schema.js";

// Triggers
export { generateTriggersSQL, triggerDefinitions } from "./definitions/triggers.js";

// Init
export { initDatabase, initIfEmpty } from "./init.js";

// Seed (scope discovery utilities — for agents to declare scopes via create_scope)
export { ROOT_SCOPE_ID } from "./definitions/constants.js";
export * as enums from "./definitions/enums.js";
export { discoverScopes, generateSeedSQL, resolveMonorepoRoot } from "./seed.js";

// Server
export { startServer, type IServerOptions } from "./server.js";

// Helpers
export {
  currentDate,
  currentTimestamp, formatId, generateWriterNanoid, resolveScopeWildcard
} from "./helpers.js";

// Queries
export { compileQueries, type IQueries } from "./queries/index.js";

// Tool schemas (DNA)
export * as schemas from "./schemas/tool-inputs.js";

// Tool types
export type { IToolCtx, IToolResult } from "./types/types.ts";

// Tools (for direct programmatic use)
export * as readTools from "./tools/read.js";
export * as writeTools from "./tools/write.js";
export * as reportTools from "./tools/reports.js";

