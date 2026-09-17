/**
 * handlerLog.ts — Logging handler for hook events.
 *
 * Logs hook input/output to hook-state.db with structured fields.
 * Called by the engine via the onResult callback after the pipeline completes.
 */

import type { HookResult } from "../../core/engine.ts";
import type { HookContext } from "../types.ts";

/** Devin hook event input fields relevant for logging (config-level concern). */
interface tsHookLogInput {
  tool_name?: string;
  prompt?: string;
  tool_input?: unknown;
  tool_response?: unknown;
  reason?: string;
  summary?: string;
}

/** Truncate a string for log storage. */
function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function handlerLog(result: HookResult, hookCtx: HookContext): void {
  const event = result.input.hook_event_name;
  const session_id = result.input.session_id;
  const input = result.input as tsHookLogInput;

  hookCtx.state.touchSession(session_id);
  hookCtx.state.incrementSeen(session_id);

  // Extract additionalContext from hookSpecificOutput if present
  const output = result.output;
  const specific =
    output !== null && typeof output === "object" && "hookSpecificOutput" in output
      ? (output as { hookSpecificOutput: { additionalContext?: string } }).hookSpecificOutput
      : null;
  const additionalContext =
    specific && typeof specific.additionalContext === "string"
      ? truncate(specific.additionalContext, 500)
      : null;

  // Build input summary for log
  const inputSummary = input.prompt
    ? truncate(String(input.prompt), 200)
    : input.tool_input
      ? truncate(JSON.stringify(input.tool_input), 200)
      : input.reason
        ? truncate(String(input.reason), 200)
        : input.summary
          ? truncate(String(input.summary), 200)
          : null;

  hookCtx.state.log({
    event,
    session_id,
    tool_name: input.tool_name ?? null,
    input: inputSummary,
    output: additionalContext,
    meta: { exit_code: result.exitCode },
  });
}
