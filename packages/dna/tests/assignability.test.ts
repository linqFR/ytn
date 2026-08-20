import { expectTypeOf, test } from "vitest";

import { dna } from "../src/index.js";
import { z, ZodNonOptional, ZodObject, ZodReadonly } from "zod";
import type { tsDnaEnumInput } from "../src/types/api-builder.types.js";
import type { $AppendToTemplateLiteral, $TemplateLiteral } from "../src/types/helpers.types.js";
import type { DnaType } from "../src/builder/dna-interfaces.js";

// Temporary type probes for diagnostic
const _tuple = ["a", true, 12] as const;
type t_checkTuple = typeof _tuple extends tsDnaEnumInput ? true : false;
const _checkTuple: false = null as any as t_checkTuple;
function probe<const T extends tsDnaEnumInput>(x: T): T { return x; }
const _probe = probe(["a", 1, 12]);
const _probeObj = probe({ a: "a", b: true });
type t_dnaEnum = typeof dna.enum;
type t_probe = typeof probe;
const dnaErrTop = dna.enum(["a", 1, 12]);



test("assignability", () => {

  const sch = dna.string();
  const _probeObjInside = probe({ a: "a", b: true });

  // String
  const dnaString = dna.string();
  expectTypeOf<dna.infer<typeof dnaString>>().toEqualTypeOf<string>();
  const zodString = z.string();
  expectTypeOf<z.infer<typeof zodString>>().toEqualTypeOf<string>();

  // Number
  const dnaNumber = dna.number();
  expectTypeOf<dna.infer<typeof dnaNumber>>().toEqualTypeOf<number>();
  const zodNumber = z.number();
  expectTypeOf<z.infer<typeof zodNumber>>().toEqualTypeOf<number>();

  // BigInt
  const dnaBigInt = dna.bigint();
  expectTypeOf<dna.infer<typeof dnaBigInt>>().toEqualTypeOf<bigint>();
  const zodBigInt = z.bigint();
  expectTypeOf<z.infer<typeof zodBigInt>>().toEqualTypeOf<bigint>();

  // Boolean
  const dnaBoolean = dna.boolean();
  expectTypeOf<dna.infer<typeof dnaBoolean>>().toEqualTypeOf<boolean>();
  const zodBoolean = z.boolean();
  expectTypeOf<z.infer<typeof zodBoolean>>().toEqualTypeOf<boolean>();

  // Date
  const dnaDate = dna.date();
  expectTypeOf<dna.infer<typeof dnaDate>>().toEqualTypeOf<Date>();
  const zodDate = z.date();
  expectTypeOf<z.infer<typeof zodDate>>().toEqualTypeOf<Date>();

  // Undefined
  const dnaUndefined = dna.undefined();
  expectTypeOf<dna.infer<typeof dnaUndefined>>().toEqualTypeOf<undefined>();
  const zodUndefined = z.undefined();
  expectTypeOf<z.infer<typeof zodUndefined>>().toEqualTypeOf<undefined>();

  // Nullable
  const dnaNullable = dna.string().nullable();
  expectTypeOf<dna.infer<typeof dnaNullable>>().toEqualTypeOf<string | null>();
  expectTypeOf<dna.infer<typeof dnaNullable>>().not.toEqualTypeOf<unknown>();
  const dnaNullableUnwrapped = dnaNullable.unwrap();
  expectTypeOf<dna.infer<typeof dnaNullableUnwrapped>>().toEqualTypeOf<string>();
  const zodNullable = z.string().nullable();
  expectTypeOf<z.infer<typeof zodNullable>>().toEqualTypeOf<string | null>();

  // Null
  const dnaNull = dna.null();
  expectTypeOf<dna.infer<typeof dnaNull>>().toEqualTypeOf<null>();
  const zodNull = z.null();
  expectTypeOf<z.infer<typeof zodNull>>().toEqualTypeOf<null>();

  // Any
  const dnaAny = dna.any();
  expectTypeOf<dna.infer<typeof dnaAny>>().toEqualTypeOf<any>();
  const zodAny = z.any();
  expectTypeOf<z.infer<typeof zodAny>>().toEqualTypeOf<any>();

  // Unknown
  const dnaUnknown = dna.unknown();
  expectTypeOf<dna.infer<typeof dnaUnknown>>().toEqualTypeOf<unknown>();
  const zodUnknown = z.unknown();
  expectTypeOf<z.infer<typeof zodUnknown>>().toEqualTypeOf<unknown>();

  // Never
  const dnaNever = dna.never();
  expectTypeOf<dna.infer<typeof dnaNever>>().toEqualTypeOf<never>();
  const zodNever = z.never();
  expectTypeOf<z.infer<typeof zodNever>>().toEqualTypeOf<never>();

  // Void
  const dnaVoid = dna.void();
  expectTypeOf<dna.infer<typeof dnaVoid>>().toEqualTypeOf<void>();
  const zodVoid = z.void();
  expectTypeOf<z.infer<typeof zodVoid>>().toEqualTypeOf<void>();

  // Array
  const da = dna.array(dna.string());
  expectTypeOf<dna.infer<typeof da>>().toEqualTypeOf<string[]>();
  expectTypeOf<dna.infer<typeof da>>().not.toEqualTypeOf<unknown[]>();
  const zodArray = z.array(z.string());
  expectTypeOf<z.infer<typeof zodArray>>().toEqualTypeOf<string[]>();

  type s = PropertyKey

  // Object
  const dob = dna.object({ key: dna.string() });
  expectTypeOf<dna.infer<typeof dob>>().toEqualTypeOf<{ key: string }>();
  expectTypeOf<dna.infer<typeof dob>>().not.toEqualTypeOf<unknown>();
  const zodObject = z.object({ key: z.string() });
  expectTypeOf<z.infer<typeof zodObject>>().toEqualTypeOf<{ key: string }>();

  // Union
  const dnaUnion = dna.union([dna.string(), dna.number()]);
  expectTypeOf<dna.infer<typeof dnaUnion>>().toEqualTypeOf<string | number>();
  const zodUnion = z.union([z.string(), z.number()]);
  expectTypeOf<z.infer<typeof zodUnion>>().toEqualTypeOf<string | number>();

  // Intersection
  const dnaIntersection = dna.intersection(dna.string(), dna.number());
  expectTypeOf<dna.infer<typeof dnaIntersection>>().toEqualTypeOf<string & number>();
  expectTypeOf<dna.infer<typeof dnaIntersection>>().not.toEqualTypeOf<unknown>();
  const zodIntersection = z.intersection(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodIntersection>>().toEqualTypeOf<string & number>();

  // Tuple
  const dnaTuple = dna.tuple([dna.string(), dna.number()]);
  expectTypeOf<dna.infer<typeof dnaTuple>>().toEqualTypeOf<[string, number]>();
  expectTypeOf<dna.infer<typeof dnaTuple>>().not.toEqualTypeOf<unknown[]>();
  const zodTuple = z.tuple([z.string(), z.number()]);
  expectTypeOf<z.infer<typeof zodTuple>>().toEqualTypeOf<[string, number]>();

  // Record
  const dnaRecord = dna.record(dna.string(), dna.number());
  expectTypeOf<dna.infer<typeof dnaRecord>>().toEqualTypeOf<Record<string, number>>();
  expectTypeOf<dna.infer<typeof dnaRecord>>().not.toEqualTypeOf<Record<string, unknown>>();
  const zodRecord = z.record(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodRecord>>().toEqualTypeOf<Record<string, number>>();

  // Map
  const dmap = dna.map(dna.string(), dna.number());
  expectTypeOf<dna.infer<typeof dmap>>().toEqualTypeOf<Map<string, number>>();
  const zodMap = z.map(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodMap>>().toEqualTypeOf<Map<string, number>>();

  // Set
  const dnaSet = dna.set(dna.string());
  expectTypeOf<dna.infer<typeof dnaSet>>().toEqualTypeOf<Set<string>>();
  const zodSet = z.set(z.string());
  expectTypeOf<z.infer<typeof zodSet>>().toEqualTypeOf<Set<string>>();

  // Literal
  const dl = dna.literal("example");
  const dlV = dl.value;
  const dlVs = dl.values;
  expectTypeOf<dna.infer<typeof dl>>().toEqualTypeOf<"example">();
  expectTypeOf<dna.infer<typeof dl>>().not.toEqualTypeOf<unknown>();
  const zodLiteral = z.literal("example");
  const zl = zodLiteral.value;
  const zls = zodLiteral.values;
  expectTypeOf<z.infer<typeof zodLiteral>>().toEqualTypeOf<"example">();

  // Literal (multi)
  const dl2 = dna.literal([1, "1", true, "example"]);
  const dl2V = dl2.values;
  expectTypeOf<dna.infer<typeof dl2>>().toEqualTypeOf<1 | "1" | true | "example">();
  const zodLiteral2 = z.literal([1, "1", true, "example"]);
  const zl2 = zodLiteral2.values;
  expectTypeOf<z.infer<typeof zodLiteral2>>().toEqualTypeOf<1 | "1" | true | "example">();


  // Enum
  const EnumArrConst = ["a", "b", "c", "d"] as const;
  type t_EnumArrConst = typeof EnumArrConst;
  const EnumArr = ["a", "b", "c", "d"];
  type t_EnumArr = typeof EnumArr;
  const EnumObjConst = { "p1": "aa", "p2": "bb", "p3": 24, "p4": 48 } as const;
  type t_EnumObjConst = typeof EnumObjConst;
  const EnumObj = { "p1": "aa", "p2": "bb", "p3": 24, "p4": 48 };
  type t_EnumObj = typeof EnumObj;


  enum Fenum { pp1 = "toto", pp2 = 2 }

  // Type probes for inspecting the enum and schema types
  type t_Fenum = typeof Fenum;
  type t_FenumKeys = keyof t_Fenum;
  type t_FenumValues = t_Fenum[t_FenumKeys];
  type t_FenumExtendsZodEnumLike = t_Fenum extends import("zod").util.EnumLike ? true : false;
  const _checkFenumZod: true = null as any as t_FenumExtendsZodEnumLike;

  // --- dna.enum with as const variables ---
  const denumArrConst = dna.enum(EnumArrConst);
  expectTypeOf<dna.infer<typeof denumArrConst>>().toEqualTypeOf<"a" | "b" | "c" | "d">();
  expectTypeOf<dna.infer<typeof denumArrConst>>().not.toEqualTypeOf<unknown>();
  const denumObjConst = dna.enum(EnumObjConst);
  expectTypeOf<dna.infer<typeof denumObjConst>>().toEqualTypeOf<"aa" | "bb" | 24 | 48>();

  // --- dna.enum without as const (types are widened) ---
  const denumArr = dna.enum(EnumArr);
  expectTypeOf<dna.infer<typeof denumArr>>().toEqualTypeOf<string>();
  const denumObj = dna.enum(EnumObj);
  expectTypeOf<dna.infer<typeof denumObj>>().toEqualTypeOf<string | number>();

  // --- dna.enum inline literals ---
  const denumInlineArr = dna.enum(["a", "b", "c", "d"]);
  expectTypeOf<dna.infer<typeof denumInlineArr>>().toEqualTypeOf<"a" | "b" | "c" | "d">();
  const denumInlineObj = dna.enum({ "p1": "aa", "p2": "bb", "p3": 24, "p4": 48 });
  expectTypeOf<dna.infer<typeof denumInlineObj>>().toEqualTypeOf<"aa" | "bb" | 24 | 48>();

  // --- dna.enum from TypeScript enum ---
  const denumFenum = dna.enum(Fenum);
  expectTypeOf<dna.infer<typeof denumFenum>>().toEqualTypeOf<Fenum>();
  const zEEnum = z.enum(Fenum)
  type t_zEEnum = z.infer<typeof zEEnum>;
  expectTypeOf<t_zEEnum>().toEqualTypeOf<Fenum>();

  // --- zod.enum with as const variables ---
  const zodEnumArrConst = z.enum(EnumArrConst);
  type t_zodEnumArrConst = typeof zodEnumArrConst;
  type tzodEnumArrConst = z.infer<typeof zodEnumArrConst>;
  expectTypeOf<tzodEnumArrConst>().toEqualTypeOf<"a" | "b" | "c" | "d">();
  const zodEnumObjConst = z.enum(EnumObjConst);
  type t_zodEnumObjConst = typeof zodEnumObjConst;
  type tzodEnumObjConst = z.infer<typeof zodEnumObjConst>;
  expectTypeOf<tzodEnumObjConst>().toEqualTypeOf<"aa" | "bb" | 24 | 48>();

  // --- zod.enum without as const (types are widened) ---
  const zodEnumArr = z.enum(EnumArr);
  type t_zodEnumArr = typeof zodEnumArr;
  type tzodEnumArr = z.infer<typeof zodEnumArr>;
  expectTypeOf<tzodEnumArr>().toEqualTypeOf<string>();
  const zodEnumObj = z.enum(EnumObj);
  type t_zodEnumObj = typeof zodEnumObj;
  type tzodEnumObj = z.infer<typeof zodEnumObj>;
  expectTypeOf<tzodEnumObj>().toEqualTypeOf<string | number>();

  // --- zod.enum inline array ---
  const zodEnum3 = z.enum(["a", "b", "24"]);
  type t_zodEnum3 = typeof zodEnum3;
  type tzodEnum3 = z.infer<typeof zodEnum3>;
  expectTypeOf<tzodEnum3>().toEqualTypeOf<"a" | "b" | "24">();

  // --- zod.enum inline object literals ---
  const zodEnum1 = z.enum({ a: "a", b: "b", c: 12, d: 24 });
  type t_zodEnum1 = typeof zodEnum1;
  type tzodEnum1 = z.infer<typeof zodEnum1>;
  const zodEnum4 = z.enum({ a: 1, b: 2, c: 1 });
  type t_zodEnum4 = typeof zodEnum4;
  type tzodEnum4 = z.infer<typeof zodEnum4>;
  const zodEnum5 = z.enum({ a: 1, b: 2, c: 3 });
  type t_zodEnum5 = typeof zodEnum5;
  type tzodEnum5 = z.infer<typeof zodEnum5>;
  const zodEnum7 = z.enum({ p1: 1, p2: 2 });
  type t_zodEnum7 = typeof zodEnum7;
  type tzodEnum7 = z.infer<typeof zodEnum7>;
  expectTypeOf<tzodEnum7>().toEqualTypeOf<1 | 2>();
  const zodEnum8 = z.enum({ p1: "r", p2: 2 });
  type t_zodEnum8 = typeof zodEnum8;
  type tzodEnum8 = z.infer<typeof zodEnum8>;
  expectTypeOf<tzodEnum8>().toEqualTypeOf<"r" | 2>();

  // --- zod.enum from TypeScript enum ---
  const zodEnumFenum = z.enum(Fenum);
  type t_zodEnumFenum = typeof zodEnumFenum;
  type tzodEnumFenum = z.infer<typeof zodEnumFenum>;
  // Zod exposes the enum value type; for heterogeneous numeric enums this is string | 2.
  expectTypeOf<tzodEnumFenum>().toEqualTypeOf<Fenum>();

  // --- Zod overload limits: the array overload only accepts strings ---
  // @ts-expect-error z.enum array overload accepts readonly string[]; numbers are not allowed.
  const zodErr1 = z.enum(["a", "b", 12, 24]);
  type t_zodErr1 = typeof zodErr1;
  // @ts-expect-error z.enum array overload accepts readonly string[]; numbers are not allowed.
  const zodErr2 = z.enum([1, 2, 3]);
  type t_zodErr2 = typeof zodErr2;

  // --- Error cases: disallowed value types ---
  // @ts-expect-error dna.enum values must be string | number | bigint.
  const dnaErr1 = dna.enum(["a", true, 12]);
  type t_dnaErr1 = typeof dnaErr1;
  const dnaErr2 = dna.enum({ a: "a", b: true });
  type t_dnaErr2 = typeof dnaErr2;
  // @ts-expect-error z.enum array overload only accepts strings.
  const zodErr3 = z.enum(["a", true, "b"]);
  type t_zodErr3 = typeof zodErr3;
  // @ts-expect-error z.enum object values must be string | number.
  const zodErr4 = z.enum({ a: true, b: false });
  type t_zodErr4 = typeof zodErr4;

  // Lazy
  const lazySchema = dna.lazy(() => dna.string());
  expectTypeOf<dna.infer<typeof lazySchema>>().toEqualTypeOf<string>();
  expectTypeOf<dna.infer<typeof lazySchema>>().not.toEqualTypeOf<unknown>();
  const zodLazySchema = z.lazy(() => z.string());
  expectTypeOf<z.infer<typeof zodLazySchema>>().toEqualTypeOf<string>();

  // Optional
  const dso = dna.string().optional();
  expectTypeOf<dna.infer<typeof dso>>().toEqualTypeOf<string | undefined>();
  expectTypeOf<dna.infer<typeof dso>>().not.toEqualTypeOf<unknown>();
  const zodOptional = z.string().optional();
  expectTypeOf<z.infer<typeof zodOptional>>().toEqualTypeOf<string | undefined>();

  // Default
  const dnaDefault = dna.string().default("default");
  expectTypeOf<dna.infer<typeof dnaDefault>>().toEqualTypeOf<string>();
  expectTypeOf<dna.infer<typeof dnaDefault>>().not.toEqualTypeOf<unknown>();
  const zodDefault = z.string().default("default");
  expectTypeOf<z.infer<typeof zodDefault>>().toEqualTypeOf<string>();

  // TemplateLiteral
  const parts = [dna.literal("a"), dna.number().min(3), "b"];
  const dtl = dna.templateLiteral(parts);
  type hdtl = $TemplateLiteral<typeof parts>;
  expectTypeOf<dna.infer<typeof dtl>>().not.toEqualTypeOf<`a${number}b`>();
  // Test with inline array
  const dtl2 = dna.templateLiteral([dna.literal("a"), dna.number().min(3), "b"]);
  type arr = typeof parts; //= (string, DnaNumber, DnaLiteral<"a">)[]
  expectTypeOf<dna.infer<typeof dtl2>>().toEqualTypeOf<`a${number}b`>();
  expectTypeOf<dna.infer<typeof dtl2>>().not.toEqualTypeOf<`${any}${number}b`>();

  const zparts = [z.literal("a"), z.number().min(3), "b"];
  const zodTemplateLiteral = z.templateLiteral(zparts);
  type tzodTemplateLiteral = z.infer<typeof zodTemplateLiteral>;
  expectTypeOf<z.infer<typeof zodTemplateLiteral>>().not.toEqualTypeOf<`a${number}b`>();
  const zodTemplateLiteral2 = z.templateLiteral([z.literal("a"), z.number().min(3), "b"]);
  type tzodTemplateLiteral2 = z.infer<typeof zodTemplateLiteral2>;
  expectTypeOf<z.infer<typeof zodTemplateLiteral2>>().toEqualTypeOf<`a${number}b`>();

  // Test if DnaLiteral is recognized as DnaType
  const dlTest = dna.literal("a");
  type testDnaLiteral = typeof dlTest extends DnaType<any, any> ? true : false;
  expectTypeOf<testDnaLiteral>().toEqualTypeOf<true>();

  // Test the helper directly
  type testHelper = $AppendToTemplateLiteral<"", typeof dlTest>;
  expectTypeOf<testHelper>().toEqualTypeOf<"a">();

  // Test direct _output access
  type testOutput = typeof dlTest extends { _output: infer O } ? O : never;
  expectTypeOf<testOutput>().toEqualTypeOf<"a">();

  // Test helper with inline array
  const numSchema = dna.number();
  type testInlineArray = $TemplateLiteral<[typeof dlTest, typeof numSchema, "b"]>;
  expectTypeOf<testInlineArray>().toEqualTypeOf<`a${number}b`>();

  // Transform
  const dnaTransform = dna.unknown().transform((val) => val as string);
  expectTypeOf<dna.infer<typeof dnaTransform>>().toEqualTypeOf<string>();
  expectTypeOf<dna.infer<typeof dnaTransform>>().not.toEqualTypeOf<unknown>();
  const zodTransform = z.unknown().transform((val) => val as string);
  expectTypeOf<z.infer<typeof zodTransform>>().toEqualTypeOf<string>();

  // NonOptional
  const dsonon = dna.string().optional().nonoptional();
  expectTypeOf<dna.infer<typeof dsonon>>().toEqualTypeOf<string>();
  const zodNonOptional = z.string().optional().nonoptional();
  zodNonOptional._zod.def.innerType;
  zodNonOptional._zod.def.type;
  const znonopt = z.nonoptional(z.string())
  z.any().nullish()
  type tzodNonOptional = z.infer<typeof ZodNonOptional>;
  expectTypeOf<z.infer<typeof zodNonOptional>>().toEqualTypeOf<string>();

  // Readonly
  const dnaReadonly = dna.object({ key: dna.string() }).readonly();
  expectTypeOf<dna.infer<typeof dnaReadonly>>().toEqualTypeOf<{ readonly key: string }>();
  const zodReadonly = z.object({ key: z.string() }).readonly();
  expectTypeOf<z.infer<typeof zodReadonly>>().toEqualTypeOf<{ readonly key: string }>();

  // Readonly after transform — verifies out variance on DnaObject/DnaPipe/DnaTransform
  const dnaTransformReadonly = dna.object({ key: dna.string() }).transform((v) => v).readonly();
  expectTypeOf<dna.infer<typeof dnaTransformReadonly>>().toEqualTypeOf<{ readonly key: string }>();

  // NaN
  const dnaNan = dna.nan();
  expectTypeOf<dna.infer<typeof dnaNan>>().toEqualTypeOf<number>();
  const zodNan = z.nan();
  expectTypeOf<z.infer<typeof zodNan>>().toEqualTypeOf<number>();

  // Pipe
  const dnaPipe = dna.unknown().pipe(dna.number());
  expectTypeOf<dna.infer<typeof dnaPipe>>().toEqualTypeOf<number>();
  const zodPipe = z.unknown().pipe(z.number());
  expectTypeOf<z.infer<typeof zodPipe>>().toEqualTypeOf<number>();

  // Preprocess
  const dnaPreprocess = dna.preprocess((v) => v, dna.number());
  expectTypeOf<dna.infer<typeof dnaPreprocess>>().toEqualTypeOf<number>();
  const zodPreprocess = z.preprocess((v) => v, z.number());
  expectTypeOf<z.infer<typeof zodPreprocess>>().toEqualTypeOf<number>();

  // Catch
  const dnaCatch = dna.string().catch("fallback");
  expectTypeOf<dna.infer<typeof dnaCatch>>().toEqualTypeOf<string>();
  const zodCatch = z.string().catch("fallback");
  expectTypeOf<z.infer<typeof zodCatch>>().toEqualTypeOf<string>();

  // Nullish — missing from original test suite
  const dnaNullish = dna.string().nullish();
  expectTypeOf<dna.infer<typeof dnaNullish>>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<dna.infer<typeof dnaNullish>>().not.toEqualTypeOf<unknown>();
  const zodNullish = z.string().nullish();
  expectTypeOf<z.infer<typeof zodNullish>>().toEqualTypeOf<string | null | undefined>();

  // Prefault — missing from original test suite
  const dnaPrefault = dna.string().prefault("prefaultValue");
  expectTypeOf<dna.infer<typeof dnaPrefault>>().toEqualTypeOf<string>();
  expectTypeOf<dna.infer<typeof dnaPrefault>>().not.toEqualTypeOf<unknown>();

  // ExactOptional — missing from original test suite
  const dnaExactOptional = dna.string().exactOptional();
  expectTypeOf<dna.infer<typeof dnaExactOptional>>().toEqualTypeOf<string>();
  expectTypeOf<dna.infer<typeof dnaExactOptional>>().not.toEqualTypeOf<unknown>();

  // _input type verification — DnaDefault._input was silently `any` before fix
  // Verify _input is correctly typed (not any) on all wrappers that redeclare it
  const dnaDefaultInput = dna.string().default("x");
  expectTypeOf<(typeof dnaDefaultInput)["_input"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<(typeof dnaDefaultInput)["_input"]>().not.toEqualTypeOf<any>();

  const dnaOptionalInput = dna.string().optional();
  expectTypeOf<(typeof dnaOptionalInput)["_input"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<(typeof dnaOptionalInput)["_input"]>().not.toEqualTypeOf<any>();

  const dnaNullableInput = dna.string().nullable();
  expectTypeOf<(typeof dnaNullableInput)["_input"]>().toEqualTypeOf<string | null>();
  expectTypeOf<(typeof dnaNullableInput)["_input"]>().not.toEqualTypeOf<any>();

  const dnaNullishInput = dna.string().nullish();
  expectTypeOf<(typeof dnaNullishInput)["_input"]>().toEqualTypeOf<string | null | undefined>();
  expectTypeOf<(typeof dnaNullishInput)["_input"]>().not.toEqualTypeOf<any>();

  const dnaNonOptionalInput = dna.string().optional().nonoptional();
  expectTypeOf<(typeof dnaNonOptionalInput)["_input"]>().toEqualTypeOf<string>();
  expectTypeOf<(typeof dnaNonOptionalInput)["_input"]>().not.toEqualTypeOf<any>();
});
