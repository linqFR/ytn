import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";
import type { DnaType } from "../src/index.js";

/**
 * Type-regression tests for bugs discovered by the Zod v4.5 compatibility suite.
 * Each test documents a DNA type-system defect (PB-0063 to PB-0069) by asserting
 * what the type SHOULD be (matching Zod) — these tests FAIL until the bugs are fixed.
 *
 * Convention: each test is named after its PB ID and asserts the Zod-equivalent
 * type behavior. Tests use `expectTypeOf` with `.toExtend` for "extends" checks
 * and `.toEqualTypeOf` for strict identity checks.
 * Note: `toMatchTypeOf` is deprecated since expect-type v1.2.0 — use `toExtend`
 * or `toMatchObjectType` instead.
 */

// ============================================================================
// PB-0063 — apply() args type: A[] should be A (or spread args like Zod)
// DNA:  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A[]) => R, args: A[] = []): R
// Zod:  apply<R, A extends unknown[] = []>(fn: (schema: this, ...args: A) => R, ...args: A): R
// Bug:  dna.string().apply((schema, defaultValue) => ..., "default-id") fails
//       because "default-id" is not assignable to A[] (which defaults to [][])
// ============================================================================
test("PB-0063 — apply() forwards extra args with correct typing", () => {
  // Zod: extra arg "default-id" is typed as string in the callback
  const zodSchema = z.string().apply(
    (schema, defaultValue) => schema.nullish().transform((x) => x ?? defaultValue),
    "default-id",
  );
  expectTypeOf<typeof zodSchema>().toExtend<z.ZodType<string>>();

  // DNA: should work the same way — "default-id" typed as string in the callback
  // This currently fails because args is typed A[] instead of A
  const dnaSchema = dna.string().apply(
    (schema, defaultValue) => schema.nullish().transform((x) => x ?? defaultValue),
    "default-id",
  );
  expectTypeOf<typeof dnaSchema>().toExtend<DnaType<string>>();
});

// ============================================================================
// PB-0064 — catch() overload ambiguity: function value matches catchValue: R first
// DNA:  catch<R>(catchValue: R) | catch<R>(catchfn: (ctx: tsDnaBaseCtx<unknown>) => R)
// Bug:  dna.string().catch((ctx) => String(ctx.input)) — ctx is implicitly any
//       because the first overload matches with R = function type
// ============================================================================
test("PB-0064 — catch() with context function types ctx correctly", () => {
  // Zod: ctx is typed as $ZodCatchCtx
  const zodSchema = z.string().catch((ctx) => String(ctx.input));
  expectTypeOf<typeof zodSchema>().toExtend<z.ZodType<string>>();

  // DNA: ctx should be typed as tsDnaBaseCtx<unknown>, not any
  // This currently fails because the overload resolution picks the wrong overload
  const dnaSchema = dna.string().catch((ctx) => String(ctx.input));
  expectTypeOf<typeof dnaSchema>().toExtend<DnaType<string>>();
});

// ============================================================================
// PB-0065 — Uint8Array<ArrayBufferLike> not assignable to Uint8Array<ArrayBuffer>
// Bug:  dna.util.base64ToUint8Array() returns Uint8Array<ArrayBufferLike> but
//       dna.instanceof(Uint8Array) expects Uint8Array<ArrayBuffer>
// ============================================================================
test("PB-0065 — base64ToUint8Array return type matches instanceof(Uint8Array)", () => {
  const decoded = dna.util.base64ToUint8Array("aGVsbG8=");
  // Should be assignable to the type expected by dna.instanceof(Uint8Array)
  const instanceSchema = dna.instanceof(Uint8Array);
  // The decoded value should be parseable by the instanceof schema
  const result = instanceSchema.safeParse(decoded);
  expectTypeOf<typeof result>().toExtend<{ success: boolean }>();
});

// ============================================================================
// PB-0066 — tsDecodeFn/tsEncodeFn don't support async
// DNA:  tsDecodeFn<I, O> = (inVal: I, ctx: tsDnaBaseCtx<I>) => O  (sync only)
// Zod:  codec supports async decode/encode
// Bug:  async decode/encode functions rejected at type level
// ============================================================================
test("PB-0066 — codec async decode/encode type-accepted", () => {
  // Zod: async decode/encode accepted
  const zodCodec = z.codec(z.string(), z.number(), {
    decode: async (str) => Number.parseFloat(str),
    encode: async (num) => num.toString(),
  });
  expectTypeOf<z.infer<typeof zodCodec>>().toEqualTypeOf<number>();

  // DNA: async decode/encode should be accepted too
  // This currently fails because tsDecodeFn returns O, not $MaybeAsync<O>
  const dnaCodec = dna.codec(dna.string(), dna.number(), {
    decode: async (str) => Number.parseFloat(str),
    encode: async (num) => num.toString(),
  });
  expectTypeOf<dna.infer<typeof dnaCodec>>().toEqualTypeOf<number>();
});

// ============================================================================
// PB-0067 — dna.transform() doesn't default T to unknown
// DNA:  transform = <T, R>(fn: tsTransformFn<T, R>, ...) — T has no default
// Zod:  z.transform((val) => ...) — val is typed as unknown
// Bug:  standalone transform's val is implicitly any
// ============================================================================
test("PB-0067 — standalone dna.transform() defaults T to unknown", () => {
  // Zod: val is typed as unknown (no annotation needed)
  const zodTransform = z.transform((val) => String(val).toUpperCase());
  expectTypeOf<z.output<typeof zodTransform>>().toEqualTypeOf<string>();

  // DNA: val should be typed as unknown, not any
  // This currently fails because T has no default
  const dnaTransform = dna.transform((val) => String(val).toUpperCase());
  expectTypeOf<(typeof dnaTransform)["_output"]>().toEqualTypeOf<string>();
});

// ============================================================================
// PB-0068 — dna.pipe() doesn't provide contextual typing
// DNA:  pipe<S, T>(src: S, target: T) — S and T are independent
// Zod:  z.pipe(z.string(), z.transform(...)) — transform's val typed from string
// Bug:  second step's input not inferred from first step's output
// ============================================================================
test("PB-0068 — pipe() provides contextual typing for second step", () => {
  // Zod: val in transform is typed as string from z.string()
  const zodPipe = z.pipe(
    z.string(),
    z.transform((val) => val.toUpperCase()),
  );
  expectTypeOf<z.output<typeof zodPipe>>().toEqualTypeOf<string>();

  // DNA: val in transform should be typed as string from dna.string()
  // This currently fails because pipe doesn't link S output to T input
  const dnaPipe = dna.pipe(
    dna.string(),
    dna.transform((val) => val.toUpperCase()),
  );
  expectTypeOf<(typeof dnaPipe)["_output"]>().toEqualTypeOf<string>();
});

// ============================================================================
// PB-0069 — .readonly() breaks DnaType chain
// DNA:  readonly(): $ReadonlyReturnType<this> — not assignable to DnaType
// Zod:  .readonly() preserves ZodType interface
// Bug:  dna.string().default("x").readonly() can't be used as tuple element
// ============================================================================
test("PB-0069 — .readonly() result is assignable to DnaType", () => {
  // Zod: .readonly() preserves ZodType, can be used in tuple
  const zodTuple = z.tuple([
    z.string(),
    z.string().default("x").readonly(),
  ]);
  expectTypeOf<z.infer<typeof zodTuple>>().toEqualTypeOf<[string, string]>();

  // DNA: .readonly() should preserve DnaType, can be used in tuple
  // This currently fails because $ReadonlyReturnType is not DnaType
  const dnaTuple = dna.tuple([
    dna.string(),
    dna.string().default("x").readonly(),
  ]);
  expectTypeOf<(typeof dnaTuple)["_output"]>().toEqualTypeOf<[string, string]>();
});
