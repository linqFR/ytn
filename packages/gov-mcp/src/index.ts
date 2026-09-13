/**
 * @ytrynot/gov-mcp — SQLite-centric governance MCP server.
 *
 * Public API: driver, schema, triggers, init, server, tools, schemas.
 */

// Driver
export { GovDb, resolveReportsDir, type IDriverOptions, type IStatement, type TxFn } from "./server/driver.js";

// Schema
export { FTS5_DDL, generateIndexDDL, generateSchemaSQL, tables } from "./server/definitions/schema.js";

// Triggers
export { generateTriggersSQL, triggerDefinitions } from "./server/definitions/triggers.js";

// Init
export { initDatabase, initIfEmpty } from "./server/init.js";

// Seed (scope discovery utilities — for agents to declare scopes via create_scope)
export { ROOT_SCOPE_ID } from "./server/definitions/constants.js";
export * as enums from "./shared/enums.js";
export { discoverScopes, generateSeedSQL, resolveMonorepoRoot } from "./server/seed.js";

// Server
export { startServer, type IServerOptions } from "./server/server.js";

// Helpers
export {
  currentDate,
  currentTimestamp, formatId, generateWriterNanoid, resolveScopeWildcard
} from "./server/helpers.js";

// Queries
export { compileQueries, type IQueries } from "./server/queries/index.js";

// Tool schemas (DNA)
export * as schemas from "./shared/schemas/tool-inputs.js";

// Tool types
export type { IToolCtx, OToolResult as IToolResult } from "./server/types/types.ts";

// Tools (for direct programmatic use)
export * as readTools from "./server/tools/read.js";
export * as writeTools from "./server/tools/write.js";
export * as reportTools from "./server/tools/reports.js";
