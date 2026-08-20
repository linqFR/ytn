/**
 * @ytrynot/cli — CLI factory (DEC-0029: 5-layer architecture).
 *
 * Layer 1: createContract()          → IProcessedContract   (1 external: parseArgs)
 * Layer 2: executeContract()         → IExecutableContract  (2 externals: parseArgs, handlers)
 * Layer 3: cliFactory()              → IFormattedContract   (3 externals: parseArgs, handlers, formatter)
 * Layer 4: fullCli()                 → (argv) => Promise<void>  (3 externals + Node globals)
 *
 */

import type {
  IProcessedContract,
  IExecutableContract,
  IFormattedContract,
  IHandlers,
  FormatterFn,
} from "./types/contract.types.js";

/**
 * Layer 1 helper — runs the processed contract pipeline synchronously and
 * extracts `{ route, payload }` from the DNA result.
 *
 * This is a convenience wrapper around `processed.pipeline.safeParse(argv,
 * processed.externals)`. The pipeline is sync (no async transforms) so
 * `safeParse` works. For layers 2-4 (which add async transforms), use
 * `executeContract()` + `safeParseAsync` instead.
 *
 * @param processed - The processed contract (layer 1)
 * @param argv - Raw argv string array
 * @returns `{ success: true, route, payload }` or `{ success: false, errors }`
 */
export function execute(
  processed: IProcessedContract,
  argv: string[],
) {
  const result = processed.pipeline.safeParse(argv, processed.externals);
  if (!result.success) {
    return { success: false as const, errors: result.errors };
  }
  // CAST: data is unknown from safeParse — transform produces { route, payload }
  const { route, payload } = result.data as { route: string; payload: Record<string, unknown> };
  return { success: true as const, route, payload };
}

/**
 * Layer 2 — adds a handler-dispatch transform to the processed contract pipeline.
 *
 * The transform dispatches by `\x00ID` (route), calls the handler, and returns
 * `{success: true, data}` or `{success: false, error}`. Handlers that return
 * nothing get a default error. Async handlers are supported (the transform is
 * async → use `safeParseAsync`).
 *
 * @param processed - The processed contract (layer 1)
 * @param handlers - Route → handler mapping
 * @returns An executable contract with the handler transform chained
 */
export function executeContract(
  processed: IProcessedContract,
  handlers: IHandlers,
) {
  const pipeline = processed.pipeline.transform(
    async (validated) => {
      if (!validated) {
        return { success: false as const, error: "No matching route" };
      }
      const { route, payload } = validated;
      const handler = handlers[route];
      if (!handler) {
        return { success: false as const, error: `No handler for route: ${route}` };
      }
      const result = await handler(payload);
      if (!result) {
        return { success: false as const, error: "Handler returned no result" };
      }
      return result;
    },
    { handlers },
  );

  return {
    name: processed.name,
    description: processed.description,
    pipeline,
    externals: { ...processed.externals, handlers },
    handlers,
  };
}

/**
 * Layer 3 — adds a formatter transform to the executable contract pipeline.
 *
 * The transform calls the formatter on the handler result and returns
 * `{exit: 0|1, message: string}`.
 *
 * @param executable - The executable contract (layer 2)
 * @param formatter - Formats handler results into `{exit, message}`
 * @returns A formatted contract with the formatter transform chained
 */
export function cliFactory(
  executable: IExecutableContract,
  formatter: FormatterFn,
) {
  const pipeline = executable.pipeline.transform(
    (result) => {
      return formatter(result);
    },
    { formatter },
  );

  return {
    name: executable.name,
    description: executable.description,
    pipeline,
    externals: { ...executable.externals, formatter },
    handlers: executable.handlers,
    formatter,
  };
}

/**
 * Layer 4 — binds a formatted contract to Node.js globals (process.argv,
 * console, process.exit).
 *
 * Returns a function that reads `process.argv.slice(2)`, runs the full
 * pipeline via `safeParseAsync`, prints the message, and exits.
 *
 * @param formatted - The formatted contract (layer 3)
 * @returns A function `() => Promise<void>` that runs the CLI
 */
export function fullCli(
  formatted: IFormattedContract,
) {
  return async () => {
    const argv = process.argv.slice(2);
    const result = await formatted.pipeline.safeParseAsync(argv, formatted.externals);
    if (!result.success) {
      // Validation error (cliUnion rejected) — format DNA errors
      const message = result.errors.map((e) => e.message).join("\n");
      console.error(message);
      process.exit(1);
    }
    const { exit, message } = result.data;
    if (message) {
      if (exit === 0) console.log(message);
      else console.error(message);
    }
    process.exit(exit);
  };
}
