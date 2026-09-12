/**
 * handlers/user-prompt-submit.ts — #5 Unread mailbox injection + identity refresh.
 *
 * Fetches unread mailbox entries for the session's writer and injects
 * a summary into the agent context before each user prompt.
 * If no nanoid is stored, injects a registration reminder (rule 2).
 * Every IDENTITY_REFRESH_INTERVAL stops, re-injects identity + nanoid
 * to combat context window scrolling. get_updates manages its own cursor.
 */

import { formatIdentity, formatMailboxSummary, formatReadBeforeWriteReminder } from "../format.ts";
import { nanoidChecker, buildContext } from "./shared.ts";
import { userPromptSubmit as userPromptSubmitOutput } from "../../core/responses.ts";
import type { tsUserPromptSubmitInput, tsUserPromptSubmitOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

/** Re-inject identity every N stops to combat context window scrolling. */
const IDENTITY_REFRESH_INTERVAL = 50;

export async function userPromptSubmit(
  data: tsUserPromptSubmitInput,
  ctx: HookContext,
): Promise<tsUserPromptSubmitOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const stopCount = session?.stop_count ?? 0;
  const shouldRefreshIdentity = stopCount > 0 && stopCount % IDENTITY_REFRESH_INTERVAL === 0;
  const out: string[] = [];

  await nanoidChecker(out, nanoid, async (nanoid) => {
    if (shouldRefreshIdentity) {
      const writer = await (await ctx.getMcp()).whoami(nanoid);
      if (writer) {
        out.push(formatIdentity(writer));
        out.push(`[SESSION] nanoid: \`${nanoid}\``);
      }
    }
    const updates = await (await ctx.getMcp()).getUpdates(nanoid);
    const entries = updates.entries ?? [];
    if (entries.length > 0) {
      out.push(formatMailboxSummary(entries));
      out.push(formatReadBeforeWriteReminder());
    }
  });

  const context = buildContext(out);
  return context.length > 0 ? userPromptSubmitOutput.add(context) : null;
}
