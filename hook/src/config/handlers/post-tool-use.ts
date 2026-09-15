/**
 * handlers/post-tool-use.ts — PostToolUse handler.
 *
 * Two responsibilities:
 * 1. Capture the nanoid from register_me / register_writer / whoami tool
 *    responses and store it in session_state for later use by other handlers.
 * 2. After edit/write tool calls, scan the written content for prohibited
 *    TypeScript casting patterns (`as any`, `as unknown as`) and inject a
 *    reminder that type casting and over-annotation must be avoided per
 *    the repository's TypeScript rules.
 */

import { buildContext, registrationCallChecker, whoamiCallChecker, handoffEntryCallChecker } from "./shared.ts";
import { messages } from "../messages.ts";
import { postToolUse as postToolUseOutput } from "../../core/responses.ts";
import type { tsPostToolUseInput, tsPostToolUseOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

/** Tools that write or edit code on disk. */
const WRITE_TOOLS: ReadonlySet<string> = new Set(["edit", "write", "notebook_edit"]);

/** Prohibited casting patterns in written code. */
const PROHIBITED_PATTERNS: ReadonlyArray<{ regex: RegExp; label: string }> = [
  { regex: /\bas\s+any\b/, label: "`as any`" },
  { regex: /\bas\s+unknown\s+as\b/, label: "`as unknown as`" },
];

export async function postToolUse(
  data: tsPostToolUseInput,
  ctx: HookContext,
): Promise<tsPostToolUseOutput> {
  const toolName = data.tool_name;

  const out: string[] = [];

  // ── 1. Nanoid capture from registration and whoami calls ──
  const captureIdentity = (out: string[]) => {
    const response = data.tool_response;
    if (response?.success) {
      const nanoid = extractNanoidFromInput(data.tool_input) ?? extractNanoid(response);
      if (nanoid) {
        const writerId = extractWriterId(response);
        ctx.state.setNanoid(data.session_id, nanoid, writerId ?? "");
        out.push(messages.nanoidCaptured(nanoid, data.session_id));
      }
    }
  };
  registrationCallChecker(out, toolName, data.tool_input, captureIdentity);
  whoamiCallChecker(out, toolName, data.tool_input, captureIdentity);

  // ── 2. Prohibited patterns reminder after edit/write ──
  if (WRITE_TOOLS.has(toolName)) {
    const content = extractWrittenContent(data.tool_input);
    if (content && containsProhibitedPatterns(content)) {
      out.push(messages.castReminder);
    }
  }

  // ── 3. Handoff detection — track when agent writes a handoff log entry ──
  handoffEntryCallChecker(out, toolName, data.tool_input, () => {
    ctx.state.setHandoff(data.session_id);
  });

  const context = buildContext(out);
  return context.length > 0 ? postToolUseOutput.add(context) : null;
}

// ---- HELPERS ----

/** Extract the written text from tool_input (edit: new_string, write: content). */
function extractWrittenContent(toolInput: Record<string, unknown>): string | null {
  if (typeof toolInput.new_string === "string") return toolInput.new_string;
  if (typeof toolInput.content === "string") return toolInput.content;
  return null;
}

function containsProhibitedPatterns(content: string): boolean {
  return PROHIBITED_PATTERNS.some((p) => p.regex.test(content));
}

/** Extract the JSON sentinel block from MCP tool response output. */
function extractMcpOutput(output: string): Record<string, unknown> | null {
  const match = output.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && typeof parsed.mcp_output === "object" && parsed.mcp_output !== null) {
      return parsed.mcp_output as Record<string, unknown>;
    }
  } catch { /* fall through */ }
  return null;
}

/** Extract nanoid from MCP tool response (sentinel-first, regex fallback). */
function extractNanoid(response: { output: string }): string | null {
  const mcpOutput = extractMcpOutput(response.output);
  if (mcpOutput) {
    if (typeof mcpOutput.nanoid === "string") return mcpOutput.nanoid;
    const writer = mcpOutput.writer;
    if (typeof writer === "object" && writer !== null && "nanoid" in writer && typeof writer.nanoid === "string") {
      return writer.nanoid;
    }
  }
  const match = response.output.match(/Nanoid:\s*([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/** Extract writer id from MCP tool response (sentinel-first, regex fallback). */
function extractWriterId(response: { output: string }): string | null {
  const mcpOutput = extractMcpOutput(response.output);
  if (mcpOutput) {
    if (typeof mcpOutput.id === "string") return mcpOutput.id;
    const writer = mcpOutput.writer;
    if (typeof writer === "object" && writer !== null && "id" in writer && typeof writer.id === "string") {
      return writer.id;
    }
  }
  const match = response.output.match(/(?:^|\n)id:\s*(\S+)/);
  return match ? match[1] : null;
}

/** Extract nanoid from tool_input (direct `nanoid` field or nested `arguments.nanoid`). */
function extractNanoidFromInput(toolInput: Record<string, unknown>): string | null {
  if (typeof toolInput.nanoid === "string") return toolInput.nanoid;
  const args = toolInput.arguments;
  if (typeof args === "object" && args !== null && "nanoid" in args && typeof args.nanoid === "string") {
    return args.nanoid;
  }
  return null;
}
