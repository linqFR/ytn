/**
 * @ytrynot/cli — AOT compilation.
 *
 * Compiles the DNA pipeline into a standalone JS function via `toJS`.
 * The compiled function requires no DNA runtime — only the externals
 * captured at compile time.
 *
 * @module @ytrynot/cli/compile
 */

import { toJS } from "@ytrynot/dna/toJs";
import type { IProcessedContract, OExecuteResult, CliError } from "./types/contract.types.js";

/** A compiled parser function that takes argv and returns an execution result. */
export type CompiledParser = (argv: string[]) => OExecuteResult;

const compileCache = new WeakMap<IProcessedContract, CompiledParser>();

/**
 * Compiles a processed contract into a standalone parser function.
 *
 * Uses `toJS(false, true)` (parser mode + enhanced mapper for builder opcodes)
 * and instantiates the generated function via `new Function`.
 *
 * The compiled parser captures `processed.externals` at compile time.
 * Externals are immutable after `createContract()` — mutating them after
 * `compile()` will NOT be reflected in the compiled parser.
 *
 * Results are cached per contract (WeakMap, identity-based). Subsequent
 * calls with the same `IProcessedContract` reference return the cached parser.
 *
 * @param processed - The processed contract to compile
 * @returns A compiled parser function
 */
export function compile(processed: IProcessedContract): CompiledParser {
  const cached = compileCache.get(processed);
  if (cached) return cached;

  const compiled = toJS(false, true)(processed.pipeline.toDna());

  // CAST: new Function — standard DNA AOT pattern
  const generatedParser = (
    new Function(...compiled.code) as (e: Record<string, unknown>) =>
      (v: unknown) => { success: boolean; data?: unknown; errors?: unknown[] }
  )(processed.externals);

  const parser: CompiledParser = (argv: string[]) => {
    const result = generatedParser(argv);
    if (!result.success) {
      // CAST: errors is unknown[] from new Function — matches CliError structurally
      return { success: false, errors: result.errors as CliError[] };
    }
    // CAST: data is unknown from new Function — transform produces { route, payload }
    const { route, payload } = result.data as { route: string; payload: Record<string, unknown> };
    return { success: true, route, payload };
  };

  compileCache.set(processed, parser);
  return parser;
}
