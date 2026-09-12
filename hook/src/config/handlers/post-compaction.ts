/**
 * handlers/post-compaction.ts — #46 Identity recovery.
 *
 * After context compaction, re-injects the writer identity so the agent
 * remembers its role, scope, and prohibitions.
 * If no nanoid is stored, injects a registration reminder (rule 2).
 */

import { formatIdentity } from "../format.ts";
import { messages } from "../messages.ts";
import { nanoidChecker, buildContext } from "./shared.ts";
import { postCompaction as postCompactionOutput } from "../../core/responses.ts";
import type { tsPostCompactionInput, tsPostCompactionOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

export async function postCompaction(
  data: tsPostCompactionInput,
  ctx: HookContext,
): Promise<tsPostCompactionOutput> {
  const session = ctx.state.getSession(data.session_id);
  const nanoid = session?.nanoid;
  const out: string[] = [];

  await nanoidChecker(out, nanoid, async (nanoid) => {
    const writer = await (await ctx.getMcp()).whoami(nanoid);
    if (writer) {
      out.push(`${messages.compactionLabel} ${formatIdentity(writer)}`);
    }
  });

  const context = buildContext(out);
  return context.length > 0 ? postCompactionOutput.add(context) : null;
}
