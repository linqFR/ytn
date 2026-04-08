import {z} from "zod";
import {
  safeRunInContext,
  createContext,
  type tsVMSandbox,
} from "../js/vm-ops.js";
import { getFnUndeclared } from "../js/fn-reflect.js";

/**
 * Regex for valid serialized JavaScript functions (Async/Sync/Arrow/Standard).
 */
export const FUNC_SERIALIZED_REGEX =
  /^(async\s+)?(function\s*[\w$]*\s*\([^)]*\)\s*\{[\s\S]*\}|(\([^)]*\)|[\w$]+)\s*=>\s*([\s\S]*))$/;

/**
 * @constant {z.ZodCodec} funcCodec
 * @description Zod codec for serializing and rehydrating JavaScript functions (Lightweight 'new Function' version).
 */
export const funcCodec = z.codec(
  z.string().trim().regex(FUNC_SERIALIZED_REGEX),
  z.custom<Function>((v) => typeof v === "function"),
  {
    decode: (v, ctx) => {
      try {
        return new Function(`return ${v.trim()}`)();
      } catch (e) {
        ctx.issues.push({
          code: "custom",
          message: `Function rehydration failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
          input: v,
        });

        return z.NEVER;
      }
    },
    encode: (v: Function) => v.toString(),
  },
);

/**
 * @constant {z.ZodCodec} vmCodecFactory
 * @description Zod codec for secure isolation rehydrating of functions via 'node:vm'.
 * Includes AST-based static analysis and a high-performance caching layer to avoid redundant VM/AST work.
 * Supports explicit typing of the produced function via the generic T.
 */
export const vmCodecFactory = <T extends Function = Function>(
  sandbox: tsVMSandbox,
): z.ZodType<T> => {
  // 1. Pre-create the execution context once for this factory instance
  const vmCtx = createContext(sandbox);

  // 2. High-performance cache for rehydrated functions and analysis results
  const cache = new Map<string, T>();
  const analysisCache = new Map<string, string[]>();

  return z.codec(
    z.string().trim().regex(FUNC_SERIALIZED_REGEX),
    z.custom<T>((v) => typeof v === "function"),
    {
      decode: (v, ctx) => {
        const code = v.trim();

        // 3. Fast-path: Return from memory if already processed
        const cachedFn = cache.get(code);
        if (cachedFn) return cachedFn;

        // 4. Analysis: Identify required globals
        const required = analysisCache.get(code) ?? getFnUndeclared(code);
        analysisCache.set(code, required);

        const missing = required.filter((key) => !(key in sandbox));

        if (missing.length > 0) {
          ctx.issues.push({
            code: "custom",
            message: `VM isolated rehydration failed: missing sandbox dependencies [${missing.join(
              ", ",
            )}]`,
            path: ["vmCodec"],
            input: v,
          });
          return z.NEVER;
        }

        // 5. Execution: Run once to rehydrate in our SHARED context
        const [err, res] = safeRunInContext<T>(code, vmCtx);
        if (err) {
          ctx.issues.push({
            code: "custom",
            message: `VM execution failed: ${
              err instanceof Error ? err.message : String(err)
            }`,
            path: ["vmCodec"],
            input: v,
          });

          return z.NEVER;
        }

        // 6. Validation: Ensure we actually got a function (Gate)
        if (typeof res !== "function") {
          ctx.issues.push({
            code: "custom",
            message: `VM execution succeeded but returned a non-callable value [type: ${typeof res}]. Rehydrated gates MUST be functions.`,
            path: ["vmCodec"],
            input: v,
          });
          return z.NEVER;
        }

        // 7. Persist to cache
        cache.set(code, res);
        return res;
      },
      encode: (v: Function) => v.toString(),
    },
  );
};
