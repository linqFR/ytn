/**
 * handlers/stop.ts — #14 Handoff reminder.
 *
 * Blocks the stop if no handoff log entry has been written this session.
 * Once the agent writes a handoff (tracked via last_handoff_at), the
 * stop is allowed.
 */

import { messages } from "../messages.ts";
import { nanoidChecker } from "./shared.ts";
import { stop as stopOutput } from "../../core/responses.ts";
import type { tsStopInput, tsStopOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

export async function stop(
  data: tsStopInput,
  ctx: HookContext,
): Promise<tsStopOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const out: string[] = [];

  let blocked = false;
  await nanoidChecker(out, nanoid, async () => {
    const session = ctx.state.getSession(data.session_id);
    if (!session?.last_handoff_at) {
      blocked = true;
    }
  });

  return blocked ? stopOutput.block(messages.handoffReminder) : null;
}
