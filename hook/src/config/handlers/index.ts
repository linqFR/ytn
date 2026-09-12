/**
 * handlers/index.ts — Handler map for all hook events.
 *
 * Raw handler functions — validation via implementAsync is done in
 * encapsHandlers() in the engine, not here.
 *
 * The handler map is typed by tsHandlerMap, giving per-event key typing
 * without Record<string, ...> contravariance.
 */

import { type tsHandlerMap } from "../../core/schema.ts";
import type { HookContext } from "../types.ts";
import { sessionStart } from "./session-start.ts";
import { userPromptSubmit } from "./user-prompt-submit.ts";
import { stop } from "./stop.ts";
import { postCompaction } from "./post-compaction.ts";
import { postToolUse } from "./post-tool-use.ts";
import { sessionEnd } from "./session-end.ts";

export const handlers: Partial<tsHandlerMap<HookContext>> = {
  SessionStart: sessionStart,
  UserPromptSubmit: userPromptSubmit,
  Stop: stop,
  PostCompaction: postCompaction,
  PostToolUse: postToolUse,
  SessionEnd: sessionEnd,
};

export { handlerLog } from "./handlerLog.ts";
