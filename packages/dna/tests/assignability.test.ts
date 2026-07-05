import { expectTypeOf, test } from "vitest";

import { dna } from "../src/index.js";
import { z } from "zod";

test("assignability", () => {

  const sch = dna.string();

  // tsDnaString
  expectTypeOf(dna.string()).toEqualTypeOf<dna.tsDnaString>();
  expectTypeOf(z.string()).toEqualTypeOf<z.ZodString>();
  expectTypeOf(z.string()).not.toEqualTypeOf<z.ZodType<string>>();
  expectTypeOf(z.string()).toEqualTypeOf<z.ZodType<string>>();

  // tsDnaNumber
  expectTypeOf(dna.number()).toEqualTypeOf<dna.tsDnaNumber>();
  expectTypeOf(z.number()).toEqualTypeOf<z.ZodNumber>();
  expectTypeOf(z.number()).toEqualTypeOf<z.ZodType<number>>();

  // tsDnaBigInt
  expectTypeOf(dna.bigint()).toEqualTypeOf<dna.tsDnaBigInt>();
  expectTypeOf(z.bigint()).toEqualTypeOf<z.ZodBigInt>();
  expectTypeOf(z.bigint()).toEqualTypeOf<z.ZodType<bigint>>();

  // tsDnaBoolean
  expectTypeOf(dna.boolean()).toEqualTypeOf<dna.tsDnaBoolean>();
  expectTypeOf(z.boolean()).toEqualTypeOf<z.ZodBoolean>();
  expectTypeOf(z.boolean()).toEqualTypeOf<z.ZodType<boolean>>();

  // tsDnaDate
  expectTypeOf(dna.date()).toEqualTypeOf<dna.tsDnaDate>();
  expectTypeOf(z.date()).toEqualTypeOf<z.ZodDate>();
  expectTypeOf(z.date()).toEqualTypeOf<z.ZodType<Date>>();

  // tsDnaUndefined
  expectTypeOf(dna.undefined()).toEqualTypeOf<dna.tsDnaUndefined>();
  expectTypeOf(z.undefined()).toEqualTypeOf<z.ZodUndefined>();
  expectTypeOf(z.undefined()).toEqualTypeOf<z.ZodType<undefined>>();

  // tsDnaNullable
  expectTypeOf(dna.string().nullable()).toEqualTypeOf<dna.tsDnaNullable>();
  expectTypeOf(dna.string().nullable()).toEqualTypeOf<dna.tsDnaNullable<dna.tsDnaString>>();
  expectTypeOf(z.string().nullable()).toEqualTypeOf<z.ZodNullable>();
  expectTypeOf(z.string().nullable()).toEqualTypeOf<z.ZodNullable<z.ZodString>>();
  expectTypeOf(z.string().nullable()).toEqualTypeOf<z.ZodType<string | null>>();

  // tsDnaNull
  expectTypeOf(dna.null()).toEqualTypeOf<dna.tsDnaNull>();
  expectTypeOf(z.null()).toEqualTypeOf<z.ZodNull>();
  expectTypeOf(z.null()).toEqualTypeOf<z.ZodType<null>>();

  // tsDnaAny
  expectTypeOf(dna.any()).toEqualTypeOf<dna.tsDnaAny>();
  expectTypeOf(z.any()).toEqualTypeOf<z.ZodAny>();
  expectTypeOf(z.any()).toEqualTypeOf<z.ZodType<any>>();

  // tsDnaUnknown
  expectTypeOf(dna.unknown()).toEqualTypeOf<dna.tsDnaUnknown>();
  expectTypeOf(z.unknown()).toEqualTypeOf<z.ZodUnknown>();
  expectTypeOf(z.unknown()).toEqualTypeOf<z.ZodType<unknown>>();

  // tsDnaNever
  expectTypeOf(dna.never()).toEqualTypeOf<dna.tsDnaNever>();
  expectTypeOf(z.never()).toEqualTypeOf<z.ZodNever>();
  expectTypeOf(z.never()).toEqualTypeOf<z.ZodType<never>>();

  // tsDnaVoid (not implemented in DNA, only tsDnaUndefined)
  dna.void() satisfies dna.tsDnaVoid;
  expectTypeOf(z.void()).toEqualTypeOf<z.ZodVoid>();
  expectTypeOf(z.void()).toEqualTypeOf<z.ZodType<void>>();

  // tsDnaArray
  expectTypeOf(dna.array(dna.string())).toEqualTypeOf<dna.tsDnaArray>();
  expectTypeOf(dna.array(dna.string())).toEqualTypeOf<dna.tsDnaArray<dna.tsDnaString>>();
  expectTypeOf(z.array(z.string())).toEqualTypeOf<z.ZodArray>();
  expectTypeOf(z.array(z.string())).toEqualTypeOf<z.ZodArray<z.ZodString>>();
  expectTypeOf(z.array(z.string())).toEqualTypeOf<z.ZodType<Array<string>>>();

  // tsDnaObject
  expectTypeOf(dna.object({ key: dna.string() })).toEqualTypeOf<dna.tsDnaObject>();
  expectTypeOf(dna.object({ key: dna.string() })).toEqualTypeOf<dna.tsDnaObject<{ key: string }>>();
  expectTypeOf(z.object({ key: z.string() })).toEqualTypeOf<z.ZodObject>();
  expectTypeOf(z.object({ key: z.string() })).toEqualTypeOf<z.ZodObject<{ key: z.ZodString }>>();
  expectTypeOf(z.object({ key: z.string() })).toEqualTypeOf<z.ZodType<{ key: string }>>();
  expectTypeOf(z.object({ key: z.string() })).toEqualTypeOf<z.ZodType<{ key: string }, { key: string }>>();

  // tsDnaUnion
  expectTypeOf(dna.union([dna.string(), dna.number()])).toEqualTypeOf<dna.tsDnaUnion>();
  expectTypeOf(dna.union([dna.string(), dna.number()])).toEqualTypeOf<dna.tsDnaUnion<dna.tsDnaString | dna.tsDnaNumber>>();
  expectTypeOf(z.union([z.string(), z.number()])).toEqualTypeOf<z.ZodUnion>();
  expectTypeOf(z.union([z.string(), z.number()])).toEqualTypeOf<z.ZodType<string | number>>();

  // tsDnaIntersection
  expectTypeOf(z.intersection(z.string(), z.number())).toEqualTypeOf<z.ZodType<string & number>>();

  // tsDnaTuple
  expectTypeOf(z.tuple([z.string(), z.number()])).toEqualTypeOf<z.ZodType<[string, number]>>();

  // tsDnaRecord
  expectTypeOf(dna.record(dna.string(), dna.number())).toEqualTypeOf<dna.tsDnaRecord>();
  expectTypeOf(dna.record(dna.string(), dna.number())).toEqualTypeOf<dna.tsDnaRecord<dna.tsDnaString, dna.tsDnaNumber>>();
  expectTypeOf(z.record(z.string(), z.number())).toEqualTypeOf<z.ZodRecord>();
  expectTypeOf(z.record(z.string(), z.number())).toEqualTypeOf<z.ZodRecord<z.ZodString, z.ZodNumber>>();
  expectTypeOf(z.record(z.string(), z.number())).toEqualTypeOf<z.ZodType<Record<string, number>>>();

  // tsDnaMap
  expectTypeOf(dna.map(dna.string(), dna.number())).toEqualTypeOf<dna.tsDnaMap>();
  expectTypeOf(dna.map(dna.string(), dna.number())).toEqualTypeOf<dna.tsDnaMap<dna.tsDnaString, dna.tsDnaNumber>>();
  expectTypeOf(z.map(z.string(), z.number())).toEqualTypeOf<z.ZodMap>();
  expectTypeOf(z.map(z.string(), z.number())).toEqualTypeOf<z.ZodMap<z.ZodString, z.ZodNumber>>();
  expectTypeOf(z.map(z.string(), z.number())).toEqualTypeOf<z.ZodType<Map<string, number>>>();

  // tsDnaSet
  expectTypeOf(dna.set(dna.string())).toEqualTypeOf<dna.tsDnaSet>();
  expectTypeOf(dna.set(dna.string())).toEqualTypeOf<dna.tsDnaSet<dna.tsDnaString>>();
  expectTypeOf(z.set(z.string())).toEqualTypeOf<z.ZodSet>();
  expectTypeOf(z.set(z.string())).toEqualTypeOf<z.ZodSet<z.ZodString>>();
  expectTypeOf(z.set(z.string())).toEqualTypeOf<z.ZodType<Set<string>>>();

  // tsDnaLiteral
  expectTypeOf(dna.literal("example")).toEqualTypeOf<dna.tsDnaLiteral<"example">>();
  expectTypeOf(z.literal("example")).toEqualTypeOf<z.ZodLiteral<"example">>();
  expectTypeOf(z.literal("example")).toEqualTypeOf<z.ZodType<"example">>();

  // tsDnaEnum
  expectTypeOf(dna.enum(["a", "b", "c"])).toEqualTypeOf<dna.tsDnaEnum<["a", "b", "c"]>>();
  expectTypeOf(z.enum(["a", "b", "c"])).toEqualTypeOf<z.ZodEnum<["a", "b", "c"]>>();
  expectTypeOf(z.enum(["a", "b", "c"])).toEqualTypeOf<z.ZodType<"a" | "b" | "c">>();

  // tsDnaLazy
  const lazySchema = dna.lazy(() => dna.string());
  expectTypeOf(lazySchema).toEqualTypeOf<dna.tsDnaLazy<dna.tsDnaString>>();
  const zodLazySchema = z.lazy(() => z.string());
  expectTypeOf(zodLazySchema).toEqualTypeOf<z.ZodLazy<z.ZodString>>();
  expectTypeOf(zodLazySchema).toEqualTypeOf<z.ZodType<string>>();

  // tsDnaOptional
  expectTypeOf(dna.string().optional()).toEqualTypeOf<dna.tsDnaOptional<dna.tsDnaString>>();
  expectTypeOf(z.string().optional()).toEqualTypeOf<z.ZodOptional<z.ZodString>>();
  expectTypeOf(z.string().optional()).toEqualTypeOf<z.ZodType<string | undefined>>();

  // tsDnaDefault
  expectTypeOf(dna.string().default("default")).toEqualTypeOf<dna.tsDnaDefault<dna.tsDnaString>>();
  expectTypeOf(z.string().default("default")).toEqualTypeOf<z.ZodDefault<z.ZodString, string>>();
  expectTypeOf(z.string().default("default")).toEqualTypeOf<z.ZodType<string>>();

  // dna.tsDnaTemplateLiteral
  expectTypeOf(dna.templateLiteral([dna.literal("a"), dna.literal("b")])).toEqualTypeOf<dna.tsDnaTmplLit>();
  expectTypeOf(z.templateLiteral([z.literal("a"), z.literal("b")])).toEqualTypeOf<z.ZodTemplateLiteral>();
  expectTypeOf(z.templateLiteral([z.literal("a"), z.literal("b")])).toEqualTypeOf<z.ZodType<string>>();
  expectTypeOf(z.templateLiteral([z.literal("a"), z.literal("b")])).toEqualTypeOf<z.ZodType<"a" | "b">>();

  // tsDnaTransform
  expectTypeOf(dna.unknown().transform((val) => val as string)).toEqualTypeOf<dna.tsDnaMutate<dna.tsDnaString>>();
  expectTypeOf(z.unknown().transform((val) => val as string)).toEqualTypeOf<z.ZodPipe<z.ZodUnknown, z.ZodTransform<string>>>();
  expectTypeOf(z.unknown().transform((val) => val as string)).toEqualTypeOf<z.ZodType<string>>();

  // tsDnaNonOptional
  expectTypeOf(dna.string().optional().nonoptional()).toEqualTypeOf<dna.tsDnaNonOptional<dna.tsDnaString>>();
  expectTypeOf(z.string().optional().nonoptional()).toEqualTypeOf<z.ZodNonOptional<z.ZodString>>();
  expectTypeOf(z.string().optional().nonoptional()).toEqualTypeOf<z.ZodType<string>>();

  // tsDnaReadonly
  expectTypeOf(dna.object({ key: dna.string() }).readonly()).toEqualTypeOf<dna.tsDnaObject<{ readonly key: string }>>();
  expectTypeOf(z.object({ key: z.string() }).readonly()).toEqualTypeOf<z.ZodReadonly<z.ZodObject<{ key: z.ZodString }>>>();
  expectTypeOf(z.object({ key: z.string() }).readonly()).toEqualTypeOf<z.ZodType<{ readonly key: string }>>();

  // tsDnaNaN
  expectTypeOf(dna.nan()).toEqualTypeOf<dna.tsDnaNan>();
  expectTypeOf(z.nan()).toEqualTypeOf<z.ZodNaN>();
  expectTypeOf(z.nan()).toEqualTypeOf<z.ZodType<number>>();
  expectTypeOf(z.nan()).toEqualTypeOf<z.ZodType<typeof NaN>>();


  // dna.tsDnaPipe
  expectTypeOf(dna.unknown().pipe(dna.number())).toEqualTypeOf<dna.tsDnaPipe<number>>();
  expectTypeOf(dna.unknown().pipe(dna.number())).toEqualTypeOf<dna.tsDnaPipe<dna.tsDnaNumber>>();
  expectTypeOf(z.unknown().pipe(z.number())).toEqualTypeOf<z.ZodPipe<z.ZodUnknown, z.ZodNumber, number>>();
  expectTypeOf(z.unknown().pipe(z.number())).toEqualTypeOf<z.ZodType<number>>();

  // tsDnaPreprocess
  expectTypeOf(dna.preprocess((v) => v, dna.number())).toEqualTypeOf<dna.tsDnaPipe<number>>();
  expectTypeOf(dna.preprocess((v) => v, dna.number())).toEqualTypeOf<dna.tsDnaPipe<dna.tsDnaNumber>>();
  expectTypeOf(z.preprocess((v) => v, z.number())).toEqualTypeOf<z.ZodPipe<z.ZodUnknown, z.ZodNumber, number>>();
  expectTypeOf(z.preprocess((v) => v, z.number())).toEqualTypeOf<z.ZodType<number>>();

  // dna.tsDnaCatch
  expectTypeOf(dna.string().catch("fallback")).toEqualTypeOf<dna.tsDnaCatch<dna.tsDnaString>>();
  expectTypeOf(z.string().catch("fallback")).toEqualTypeOf<z.ZodCatch<z.ZodString, string>>();
  expectTypeOf(z.string().catch("fallback")).toEqualTypeOf<z.ZodType<string>>();
});

test("checks", () => {
  const _a: any = {} as any as any;
  const _b: any = {} as any as any;
});
