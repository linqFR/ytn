/**
 * shared.ts — Transverse helpers shared across hook handlers.
 *
 * Handlers accumulate additionalContext messages in a string array,
 * then assign the joined result to data.addPrompt. No early return,
 * no object spread — mutate data in place.
 */

import { messages } from "../messages.ts";

/** Registration tool names on the gov-test-mcp server. */
const REGISTRATION_TOOLS = new Set(["register_me", "register_writer"]);

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

function isRegistrationCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  if (toolName.startsWith("mcp__gov-test-mcp__")) {
    const fn = toolName.slice("mcp__gov-test-mcp__".length);
    return REGISTRATION_TOOLS.has(fn);
  }
  if (toolName === "mcp_call_tool" && toolInput) {
    const server = toolInput.server_name;
    const tool = toolInput.tool_name;
    if (server === "gov-test-mcp" && typeof tool === "string") {
      return REGISTRATION_TOOLS.has(tool);
    }
  }
  return false;
}

function isHandoffEntryCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  if (toolName === "mcp__gov-test-mcp__append_log_entry" && toolInput) {
    return toolInput.type === "handoff";
  }
  if (toolName === "mcp_call_tool" && toolInput) {
    const server = toolInput.server_name;
    const tool = toolInput.tool_name;
    const args = toolInput.arguments;
    if (server === "gov-test-mcp" && tool === "append_log_entry" && typeof args === "object" && args !== null && "type" in args) {
      return args.type === "handoff";
    }
  }
  return false;
}

/**
 * Join accumulated messages into a single additionalContext string.
 * Empty array = "" (engine interprets as silence).
 */
export function buildContext(messages: string[]): string {
  return messages.join("\n\n");
}
