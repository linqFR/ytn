import { z } from "zod";
import { PICO_ATOMIC_FACTORIES, PICO_FACTORIES } from "./pico-overrides.js";

const ATOMIC_KEYS = Object.keys(PICO_ATOMIC_FACTORIES) as [
  keyof typeof PICO_ATOMIC_FACTORIES,
  ...Array<keyof typeof PICO_ATOMIC_FACTORIES>,
];

/**
 * @function isAtomic
 * @description Internal type guard that checks if a DSL string segment matches
 * a known atomic factory (e.g., "string", "bool", "number").
 *
 * @param {string} entry - The string segment to test.
 * @param {z.core.$RefinementCtx} [ctx] - Optional Zod context for error reporting.
 * @returns {entry is keyof typeof PICO_ATOMIC_FACTORIES} True if it's a known atomic type.
 */
const isAtomic = (
  entry: string,
  ctx?: z.core.$RefinementCtx,
): entry is keyof typeof PICO_ATOMIC_FACTORIES => {
  const ok = entry in PICO_ATOMIC_FACTORIES;
  if (!ok && ctx) {
    ctx.addIssue({
      code: "custom",
      message: `Unknown type '${entry}' in DSL.`,
    });
  }
  return ok;
};

export const checkPICO_ATOMIC_FACTORIES = z.enum(ATOMIC_KEYS);

const checkListFormat = z.stringFormat(
  "list-format",
  /^\s*\w+(\s*,\s*\w+)+\s*$/,
);

const checkXOrFormat = z.stringFormat(
  "xor-format",
  /^\s*\w+(\s*\|\s*\w+)+\s*$/,
);

/**
 * @constant dslSchema
 * @description Validation schema for the CZVO Domain Specific Language (DSL).
 * It supports:
 * - **Atomic types**: "string", "number", "bool"
 * - **List format (Comma)**: "string, number" (maps to a Zod Tuple)
 * - **XOR format (Pipe)**: "string | number" (maps to a Zod Union/XOR)
 */
export const dslSchema = z
  .string()
  .pipe(
    z.union([
      checkPICO_ATOMIC_FACTORIES,
      checkListFormat.refine((s) =>
        s.split(",").every((v) => isAtomic(v.trim())),
      ),
      checkXOrFormat.refine((s) =>
        s.split("|").every((v) => isAtomic(v.trim())),
      ),
    ]),
  );

/**
 * @type DslType
 * @description TypeScript type representing valid CZVO DSL strings.
 */
export type DslType = z.infer<typeof dslSchema>;

/**
 * @constant dslToZod
 * @description The transformation schema that compiles a DSL string into its
 * corresponding Zod schema branch.
 */
export const dslToZod = z.string().pipe(
  z.union([
    checkPICO_ATOMIC_FACTORIES.transform(
      (v: keyof typeof PICO_ATOMIC_FACTORIES): z.ZodType =>
        PICO_ATOMIC_FACTORIES[v](),
    ),
    checkListFormat.transform((v, ctx) => {
      const vlist = [...new Set(v.split(",").map((v) => v.trim()))];
      if (vlist.length === 1)
        return PICO_ATOMIC_FACTORIES[
          isAtomic(vlist[0], ctx) ? vlist[0] : "string"
        ]();
      return PICO_FACTORIES["tuple"](
        ...vlist.map((v) =>
          PICO_ATOMIC_FACTORIES[isAtomic(v, ctx) ? v : "string"](),
        ),
      );
    }),
    checkXOrFormat.transform((v, ctx) => {
      const vlist = [...new Set(v.split("|").map((v) => v.trim()))];
      if (vlist.length === 1)
        return PICO_ATOMIC_FACTORIES[
          isAtomic(vlist[0], ctx) ? vlist[0] : "string"
        ]();
      return PICO_FACTORIES["xor"](
        ...vlist.map((v) =>
          PICO_ATOMIC_FACTORIES[isAtomic(v, ctx) ? v : "string"](),
        ),
      );
    }),
  ]),
);
