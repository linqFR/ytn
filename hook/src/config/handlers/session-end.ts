/**
 * handlers/session-end.ts — Session end logging.
 *
 * Captures the session end reason for observability. Returns null (no
 * context injection) since the session is already terminating.
 */

import type { tsSessionEndInput, tsSessionEndOutput } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";

export async function sessionEnd(
  data: tsSessionEndInput,
  ctx: HookContext,
): Promise<tsSessionEndOutput> {
  ctx.state.touchSession(data.session_id);
  return null;
}
