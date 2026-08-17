import { expectTypeOf, test } from "vitest";

import { dna } from "../src/index.js";
import { DnaPipe, DnaTransform, DnaOptional, DnaString, DnaNumber } from "../src/core.js";

// Type-regression tests for dna.preprocess return type propagation.
// Before the fix, preprocess returned DnaType<O, unknown>, losing the concrete
// target type. It now returns DnaPipe<DnaTransform<unknown, unknown>, T>,
// preserving the exact target schema type T (Zod v4 parity: ZodPreprocess<U>).

test("preprocess returns DnaPipe preserving the target type (string optional)", () => {
  const pp = dna.preprocess((v) => v, dna.string().optional());
  expectTypeOf(pp).toEqualTypeOf<DnaPipe<DnaTransform<unknown, unknown>, DnaOptional<DnaString>>>();
  expectTypeOf<(typeof pp)["_output"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<(typeof pp)["_input"]>().toEqualTypeOf<unknown>();
});

test("preprocess preserves a required number target", () => {
  const pp = dna.preprocess((v) => v, dna.number());
  expectTypeOf(pp).toEqualTypeOf<DnaPipe<DnaTransform<unknown, unknown>, DnaNumber>>();
  expectTypeOf<(typeof pp)["_output"]>().toEqualTypeOf<number>();
});

test("preprocess overload with ctx argument still propagates the target", () => {
  const pp = dna.preprocess((v, ctx) => v, dna.number().optional());
  expectTypeOf(pp).toEqualTypeOf<DnaPipe<DnaTransform<unknown, unknown>, DnaOptional<DnaNumber>>>();
  expectTypeOf<(typeof pp)["_output"]>().toEqualTypeOf<number | undefined>();
});

test("preprocess captures the fn return type R in DnaTransform", () => {
  const pp = dna.preprocess((v: unknown): string => String(v), dna.string());
  expectTypeOf(pp).toEqualTypeOf<DnaPipe<DnaTransform<unknown, string>, DnaString>>();
  // pipe output is still the target's output, not R
  expectTypeOf<(typeof pp)["_output"]>().toEqualTypeOf<string>();
  expectTypeOf<(typeof pp)["_input"]>().toEqualTypeOf<unknown>();
});

test("preprocess captures R with ctx overload", () => {
  const pp = dna.preprocess((v: unknown, ctx): number => Number(v), dna.number().optional());
  expectTypeOf(pp).toEqualTypeOf<DnaPipe<DnaTransform<unknown, number>, DnaOptional<DnaNumber>>>();
});
