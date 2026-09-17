/**
 * handlers/user-prompt-submit.ts — #5 Unread mailbox injection + identity refresh.
 *
 * Fetches unread mailbox entries for the session's writer and injects
 * a summary into the agent context before each user prompt.
 * If no nanoid is stored, injects a registration reminder (rule 2).
 * Every IDENTITY_REFRESH_INTERVAL events, re-injects identity + nanoid
 * to combat context window scrolling. get_updates manages its own cursor.
 */

import { userPromptSubmit as userPromptSubmitOutput } from "../../core/responses.ts";
import type { tsUserPromptSubmitInput, tsUserPromptSubmitOutput } from "../../core/schema.ts";
import { formatIdentity, formatMailboxSummary, formatReadBeforeWriteReminder } from "../format.ts";
import type { HookContext } from "../types.ts";
import { IDENTITY_REFRESH_INTERVAL } from "./constants.ts";
import { buildContext, nanoidChecker } from "./shared.ts";


export async function userPromptSubmit(
  data: tsUserPromptSubmitInput,
  ctx: HookContext,
): Promise<tsUserPromptSubmitOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const stopCount = session?.stop_count ?? 0;
  const shouldRefreshIdentity = stopCount >= IDENTITY_REFRESH_INTERVAL;
  const out: string[] = [];

  await nanoidChecker(out, nanoid, async (nanoid) => {
    if (shouldRefreshIdentity) {
      const result = await ctx.mcp.whoami({ nanoid });
      if (result?.writer) {
        out.push(formatIdentity(result.writer));
        out.push(`[SESSION] nanoid: \`${nanoid}\``);
        ctx.state.resetStopCount(data.session_id);
      }
    }
    const updates = await ctx.mcp.get_updates({ nanoid, peek: true, lastN: 10 });
    const entries = updates.entries ?? [];
    if (entries.length > 0) {
      out.push(formatMailboxSummary(entries));
      out.push(formatReadBeforeWriteReminder());
    }
  });

  const context = buildContext(out);
  return context.length > 0 ? userPromptSubmitOutput.add(context) : null;
}
