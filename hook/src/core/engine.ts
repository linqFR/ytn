/**
 * engine.ts — Hook pipeline (single DNA chain).
 *
 * Reads stdin → dispatch via pre-built implementAsync handlers → stdout.
 *
 * Exit codes (Devin CLI protocol):
 *   0 = success — hook continues normally
 *   2 = block — action is denied
 *   other = error — logged but doesn't block
 *
 * Logging is a config concern — passed as an optional onResult callback.
 */

import { dna } from "@ytrynot/dna";
import { readFileSync } from "node:fs";
import {
  handlerEvents,
  handlerSchemas,
  type tsHandlerMap
} from "./schema.ts";

// ── implementAsync helper (distributive object type — microsoft/TypeScript#47109) ──
// When S is a union of schema types, Parameters<S["implementAsync"]>[0] distributes
// to the matching union of handler types — no cast on the call, no hardcoding.
type SchemaMap = typeof handlerSchemas;
type ImplMap = { -readonly [K in keyof SchemaMap]: ReturnType<SchemaMap[K]["implementAsync"]> | undefined };
type ImplValue = ImplMap[keyof SchemaMap];

function buildImpl<S extends { implementAsync: (fn: (...args: any[]) => any) => any }>(
  schema: S,
  handler: Parameters<S["implementAsync"]>[0] | undefined,
): ReturnType<S["implementAsync"]> | undefined {
  return handler ? schema.implementAsync(handler) : undefined;
}

// ── Pipeline result ──

export interface HookResult {
  input: Record<string, unknown> & { hook_event_name: string; session_id: string };
  output: unknown;
  exitCode: number;
}


// ── Pipeline ──
//
// dna.any() → transform (read stdin, dispatch via implFns) → transform (stdout + exit code)

export async function runHook<C = unknown>(
  handlerMap: Partial<tsHandlerMap<C>>,
  hookCtx: C,
  onResult?: (result: HookResult, ctx: C) => void,
): Promise<void> {

  // Pre-build implementAsync wrappers — buildImpl distributes over the union.
  // CAST: TS #30581 — union-keyed property writes can't be correlated.
  // The object is built correctly at runtime; the cast asserts structural truth.
  const implFns = handlerEvents.reduce<Record<string, ImplValue>>(
    (acc, event) => { acc[event] = buildImpl(handlerSchemas[event], handlerMap[event]); return acc; },
    {},
  ) as ImplMap;

  const pipeline = dna
    .any()
    .transform(
      async (handlers, ctx) => {
        const stdinStr = readFileSync(0, "utf8");
        if (!stdinStr || stdinStr.trim().length === 0) {
          throw new Error("Empty stdin");
        }
        const parsed = JSON.parse(stdinStr);
        const event = parsed.hook_event_name;
        const handler = handlers[event];
        const output = typeof handler === "function" ? await handler(parsed, hookCtx) : null;
        return { input: parsed, output, event };
      },
      { readFileSync, hookCtx },
    )
    .transform((result, ctx): HookResult => {
      // Issues from validation or earlier transforms — error, doesn't block
      if (ctx.issues?.length || !result) {
        process.stderr.write(JSON.stringify({ error: "hook failed", issues: ctx.issues }));
        return {
          input: result?.input ?? { hook_event_name: "", session_id: "" },
          output: null,
          exitCode: 1,
        };
      }

      const { output } = result;

      // Stringify output to stdout (null = silence)
      if (output !== null) {
        process.stdout.write(JSON.stringify(output));
      }

      // Exit codes (Devin CLI protocol):
      //   0 = success, 2 = block, other = error (logged, doesn't block)
      const blocked = output !== null && typeof output === "object" && "decision" in output && output.decision === "block";
      return {
        input: result.input,
        output,
        exitCode: blocked ? 2 : 0,
      };
    });

  const result = await pipeline.safeParseAsync(implFns, {
    readFileSync,
    hookCtx,
  });

  if (!result.success) {
    process.stderr.write(
      JSON.stringify({ error: "hook validation failed", issues: result.errors }),
    );
    process.exit(1);
  }

  const hookResult: HookResult = result.data;

  // Config-level logging callback (before exit)
  if (onResult) {
    onResult(hookResult, hookCtx);
  }

  process.exit(hookResult.exitCode);
}
