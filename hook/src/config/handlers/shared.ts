/**
 * shared.ts — Transverse helpers shared across hook handlers.
 *
 * Handlers accumulate additionalContext messages in a string array,
 * then assign the joined result to data.addPrompt. No early return,
 * no object spread — mutate data in place.
 */

import { messages } from "../messages.ts";
import {
  APPEND_LOG_ENTRY_TOOL,
  GOV_MCP_PREFIX,
  GOV_MCP_SERVER,
  HANDOFF_LOG_TYPE,
  MCP_CALL_TOOL,
  REGISTRATION_TOOLS,
  WHOAMI_TOOL,
} from "./constants.ts";

/**
 * Push a registration reminder to the messages array if nanoid is missing.
 * If nanoid is present and a subHandler is provided, execute it with the
 * confirmed nanoid. Pure dispatcher — no early return, no blocking.
 */
export async function nanoidChecker(
  outMessages: string[],
  nanoid: string | null | undefined,
  subHandler?: (nanoid: string, out?: string[]) => Promise<void>,
): Promise<void> {
  if (!nanoid) {
    outMessages.push(messages.registerReminder);
    return;
  }
  if (subHandler) {
    await subHandler(nanoid, outMessages);
  }
}

/**
 * If this tool call is a registration call on gov-test-mcp, run the subHandler.
 * No message if not a registration call — silent pass-through.
 */
export function registrationCallChecker(
  outMessages: string[],
  toolName: string,
  toolInput: Record<string, unknown>,
  subHandler: (out: string[]) => void,
): void {
  if (!isRegistrationCall(toolName, toolInput)) return;
  subHandler(outMessages);
}

/**
 * If this tool call is an append_log_entry on gov-test-mcp with type=handoff,
 * run the subHandler. No message if not a handoff entry — silent pass-through.
 */
export function handoffEntryCallChecker(
  outMessages: string[],
  toolName: string,
  toolInput: Record<string, unknown>,
  subHandler?: (out: string[]) => void,
): void {
  if (!isHandoffEntryCall(toolName, toolInput)) return;
  if (subHandler) subHandler(outMessages);
}

/**
 * If this tool call is a whoami call on gov-test-mcp, run the subHandler.
 * No message if not a whoami call — silent pass-through.
 */
export function whoamiCallChecker(
  outMessages: string[],
  toolName: string,
  toolInput: Record<string, unknown>,
  subHandler: (out: string[]) => void,
): void {
  if (!isWhoamiCall(toolName, toolInput)) return;
  subHandler(outMessages);
}

/**
 * Resolve the gov-test-mcp tool name for a call, whatever the invocation
 * form (`mcp__gov-test-mcp__<tool>` or generic `mcp_call_tool` dispatch).
 * Returns null when the call does not target the governance server.
 */
function govMcpToolName(
  toolName: string,
  toolInput: Record<string, unknown>,
): string | null {
  if (toolName.startsWith(GOV_MCP_PREFIX)) {
    return toolName.slice(GOV_MCP_PREFIX.length);
  }
  if (toolName === MCP_CALL_TOOL && toolInput.server_name === GOV_MCP_SERVER) {
    const tool = toolInput.tool_name;
    if (typeof tool === "string") return tool;
  }
  return null;
}

function isRegistrationCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  const tool = govMcpToolName(toolName, toolInput);
  return tool !== null && REGISTRATION_TOOLS.has(tool);
}

/** True if this tool call is a `whoami` call on gov-test-mcp. */
function isWhoamiCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  return govMcpToolName(toolName, toolInput) === WHOAMI_TOOL;
}

function isHandoffEntryCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  if (govMcpToolName(toolName, toolInput) !== APPEND_LOG_ENTRY_TOOL) return false;
  const args = toolName === MCP_CALL_TOOL ? toolInput.arguments : toolInput;
  return typeof args === "object" && args !== null && "type" in args && args.type === HANDOFF_LOG_TYPE;
}

/**
 * Join accumulated messages into a single additionalContext string.
 * Empty array = "" (engine interprets as silence).
 */
export function buildContext(messages: string[]): string {
  return messages.join("\n\n");
}
