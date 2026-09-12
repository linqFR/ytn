/**
 * handlers/session-start.ts — #1 Identity injection.
 *
 * At SessionStart, looks up the writer identity from the stored nanoid
 * and injects role, scope, prohibitions, objective, nanoid into context.
 * If no nanoid is stored, injects a registration reminder (rule 2).
 * Mailbox unread injection is handled by UserPromptSubmit (#5).
 */

import { formatIdentity } from "../format.ts";
import { nanoidChecker, buildContext } from "./shared.ts";
import { sessionStart as sessionStartOutput } from "../../core/responses.ts";
import type { tsSessionStartInput, tsSessionStartOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

export async function sessionStart(
  data: tsSessionStartInput,
  ctx: HookContext,
): Promise<tsSessionStartOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const out: string[] = [];

  await nanoidChecker(out, nanoid, async (nanoid) => {
    const writer = await (await ctx.getMcp()).whoami(nanoid);
    if (writer) {
      out.push(formatIdentity(writer));
      out.push(`[SESSION] nanoid: \`${nanoid}\``);
    }
  });

  const context = buildContext(out);
  return context.length > 0 ? sessionStartOutput.add(context) : null;
}
