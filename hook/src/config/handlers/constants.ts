/** Re-inject identity every N stops to combat context window scrolling. */
export const IDENTITY_REFRESH_INTERVAL = 50;

/** Governance MCP server name used in tool routing and messages. */
export const GOV_MCP_SERVER = "gov-test-mcp";

/** Devin tool-name prefix for direct gov-test-mcp calls (`mcp__gov-test-mcp__`). */
export const GOV_MCP_PREFIX = `mcp__${GOV_MCP_SERVER}__`;

/** Generic MCP dispatch tool name routed through the IDE. */
export const MCP_CALL_TOOL = "mcp_call_tool";

/** Registration tool names on the gov-test-mcp server. */
export const REGISTRATION_TOOLS = new Set(["register_me", "register_writer"]);

/** Identity lookup tool name on the gov-test-mcp server. */
export const WHOAMI_TOOL = "whoami";

/** Log entry tool name on the gov-test-mcp server. */
export const APPEND_LOG_ENTRY_TOOL = "append_log_entry";

/** Log entry type marking a session handoff. */
export const HANDOFF_LOG_TYPE = "handoff";
