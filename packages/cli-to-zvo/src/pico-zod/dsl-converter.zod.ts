import { z } from "zod";
import { PICO_ATOMIC_FACTORIES, PICO_FACTORIES } from "./pico-overrides.js";

const ATOMIC_KEYS = Object.keys(PICO_ATOMIC_FACTORIES) as [
  keyof typeof PICO_ATOMIC_FACTORIES,
  ...Array<keyof typeof PICO_ATOMIC_FACTORIES>,
];

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

// validation schema
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

export type DslType = z.infer<typeof dslSchema>;

//  tranformation schema
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
