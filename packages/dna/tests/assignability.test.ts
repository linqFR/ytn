import { expectTypeOf, test } from "vitest";

import { dna } from "../src/index.js";
import { z, ZodNonOptional, ZodObject } from "zod";
import type { tsDnaEnumInput } from "../src/types/api-builder.types.js";
import type { $AppendToTemplateLiteral, $TemplateLiteral } from "../src/types/helpers.types.js";
import type { DnaType } from "../src/builder/dna-interfaces.js";

// Temporary type probes for diagnostic
const _tuple = ["a", true, 12] as const;
type t_checkTuple = typeof _tuple extends tsDnaEnumInput ? true : false;
const _checkTuple: false = null as any as t_checkTuple;
function probe<const T extends tsDnaEnumInput>(x: T): T { return x; }
const _probe = probe(["a", true, 12]);
const _probeObj = probe({ a: "a", b: true });
type t_dnaEnum = typeof dna.enum;
type t_probe = typeof probe;
const dnaErrTop = dna.enum(["a", true, 12]);



test("assignability", () => {

  const sch = dna.string();
  const _probeObjInside = probe({ a: "a", b: true });

  // String
  expectTypeOf(dna.string()._output).toEqualTypeOf<string>();
  const zodString = z.string();
  expectTypeOf<z.infer<typeof zodString>>().toEqualTypeOf<string>();

  // Number
  expectTypeOf(dna.number()._output).toEqualTypeOf<number>();
  const zodNumber = z.number();
  expectTypeOf<z.infer<typeof zodNumber>>().toEqualTypeOf<number>();

  // BigInt
  expectTypeOf(dna.bigint()._output).toEqualTypeOf<bigint>();
  const zodBigInt = z.bigint();
  expectTypeOf<z.infer<typeof zodBigInt>>().toEqualTypeOf<bigint>();

  // Boolean
  expectTypeOf(dna.boolean()._output).toEqualTypeOf<boolean>();
  const zodBoolean = z.boolean();
  expectTypeOf<z.infer<typeof zodBoolean>>().toEqualTypeOf<boolean>();

  // Date
  expectTypeOf(dna.date()._output).toEqualTypeOf<Date>();
  const zodDate = z.date();
  expectTypeOf<z.infer<typeof zodDate>>().toEqualTypeOf<Date>();

  // Undefined
  expectTypeOf(dna.undefined()._output).toEqualTypeOf<undefined>();
  const zodUndefined = z.undefined();
  expectTypeOf<z.infer<typeof zodUndefined>>().toEqualTypeOf<undefined>();

  // Nullable
  expectTypeOf(dna.string().nullable()._output).toEqualTypeOf<string | null>();
  expectTypeOf(dna.string().nullable().unwrap()._output).toEqualTypeOf<string>();
  const zodNullable = z.string().nullable();
  expectTypeOf<z.infer<typeof zodNullable>>().toEqualTypeOf<string | null>();

  // Null
  expectTypeOf(dna.null()._output).toEqualTypeOf<null>();
  const zodNull = z.null();
  expectTypeOf<z.infer<typeof zodNull>>().toEqualTypeOf<null>();

  // Any
  expectTypeOf(dna.any()._output).toEqualTypeOf<any>();
  const zodAny = z.any();
  expectTypeOf<z.infer<typeof zodAny>>().toEqualTypeOf<any>();

  // Unknown
  expectTypeOf(dna.unknown()._output).toEqualTypeOf<unknown>();
  const zodUnknown = z.unknown();
  expectTypeOf<z.infer<typeof zodUnknown>>().toEqualTypeOf<unknown>();

  // Never
  expectTypeOf(dna.never()._output).toEqualTypeOf<never>();
  const zodNever = z.never();
  expectTypeOf<z.infer<typeof zodNever>>().toEqualTypeOf<never>();

  // Void
  expectTypeOf(dna.void()._output).toEqualTypeOf<void>();
  const zodVoid = z.void();
  expectTypeOf<z.infer<typeof zodVoid>>().toEqualTypeOf<void>();

  // Array
  const da = dna.array(dna.string());
  type tda = dna.infer<typeof da>;
  expectTypeOf(da._output).toEqualTypeOf<string[]>();
  const zodArray = z.array(z.string());
  type rzodArray = z.infer<typeof zodArray>
  expectTypeOf<z.infer<typeof zodArray>>().toEqualTypeOf<string[]>();

  type s = PropertyKey

  // Object
  const dob = dna.object({ key: dna.string() });
  type tdob = dna.infer<typeof dob>;
  expectTypeOf(dob._output).toEqualTypeOf<{ key: string }>();
  const zodObject = z.object({ key: z.string() });
  type tZodOb = z.infer<typeof zodObject>;
  expectTypeOf<z.infer<typeof zodObject>>().toEqualTypeOf<{ key: string }>();

  // Union
  expectTypeOf(dna.union([dna.string(), dna.number()])._output).toEqualTypeOf<string | number>();
  const zodUnion = z.union([z.string(), z.number()]);
  expectTypeOf<z.infer<typeof zodUnion>>().toEqualTypeOf<string | number>();

  // Intersection
  const zodIntersection = z.intersection(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodIntersection>>().toEqualTypeOf<string & number>();

  // Tuple
  const zodTuple = z.tuple([z.string(), z.number()]);
  expectTypeOf<z.infer<typeof zodTuple>>().toEqualTypeOf<[string, number]>();

  // Record
  expectTypeOf(dna.record(dna.string(), dna.number())._output).toEqualTypeOf<Record<string, number>>();
  const zodRecord = z.record(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodRecord>>().toEqualTypeOf<Record<string, number>>();

  // Map
  const dmap = dna.map(dna.string(), dna.number());
  type tdmap = dna.infer<typeof dmap>;
  expectTypeOf(dmap._output).toEqualTypeOf<Map<string, number>>();
  const zodMap = z.map(z.string(), z.number());
  expectTypeOf<z.infer<typeof zodMap>>().toEqualTypeOf<Map<string, number>>();

  // Set
  expectTypeOf(dna.set(dna.string())._output).toEqualTypeOf<Set<string>>();
  const zodSet = z.set(z.string());
  expectTypeOf<z.infer<typeof zodSet>>().toEqualTypeOf<Set<string>>();

  // Literal
  const dl = dna.literal("example"); //DnaLiteral<"example">
  type tdl = dna.infer<typeof dl>; // = "example"
  const dlV = dl.value;
  const dlVs = dl.values;

  expectTypeOf(dl._output).toEqualTypeOf<"example">();
  const zodLiteral = z.literal("example");
  const zl = zodLiteral.value;
  const zls = zodLiteral.values;
  // console.log(zl, dlV, zls, dlVs);

  expectTypeOf<z.infer<typeof zodLiteral>>().toEqualTypeOf<"example">();

  // Literal
  const dl2 = dna.literal([1, "1", true, "example"]);
  type tdl2 = dna.infer<typeof dl2>;
  const dl2V = dl2.values;
  // const dl3V = dl2.value;
  expectTypeOf(dl2._output).toEqualTypeOf<1 | "1" | true | "example">();
  const zodLiteral2 = z.literal([1, "1", true, "example"]);
  const zl2 = zodLiteral2.values;
  // const zl3 = zodLiteral2.value;
  // console.log(zl2, dl2V);
  type tzodLiteral2 = z.infer<typeof zodLiteral2>;
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
  type t_denumArrConst = typeof denumArrConst;
  expectTypeOf(denumArrConst._output).toEqualTypeOf<"a" | "b" | "c" | "d">();
  const denumObjConst = dna.enum(EnumObjConst);
  type t_denumObjConst = typeof denumObjConst;
  expectTypeOf(denumObjConst._output).toEqualTypeOf<"aa" | "bb" | 24 | 48>();

  // --- dna.enum without as const (types are widened) ---
  const denumArr = dna.enum(EnumArr);
  type t_denumArr = typeof denumArr;
  expectTypeOf(denumArr._output).toEqualTypeOf<string>();
  const denumObj = dna.enum(EnumObj);
  type t_denumObj = typeof denumObj;
  expectTypeOf(denumObj._output).toEqualTypeOf<string | number>();

  // --- dna.enum inline literals ---
  const denumInlineArr = dna.enum(["a", "b", "c", "d"]);
  type t_denumInlineArr = typeof denumInlineArr;
  expectTypeOf(denumInlineArr._output).toEqualTypeOf<"a" | "b" | "c" | "d">();
  const denumInlineObj = dna.enum({ "p1": "aa", "p2": "bb", "p3": 24, "p4": 48 });
  type t_denumInlineObj = typeof denumInlineObj;
  expectTypeOf(denumInlineObj._output).toEqualTypeOf<"aa" | "bb" | 24 | 48>();

  // --- dna.enum from TypeScript enum ---
  const denumFenum = dna.enum(Fenum);
  type t_denumFenum = dna.infer<typeof denumFenum>;
    // Heterogeneous numeric enums have reverse mappings; the inferred value type is string | 2.
    expectTypeOf(denumFenum._output).toEqualTypeOf<Fenum>();
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
  expectTypeOf(lazySchema._output).toEqualTypeOf<string>();
  const zodLazySchema = z.lazy(() => z.string());
  expectTypeOf<z.infer<typeof zodLazySchema>>().toEqualTypeOf<string>();

  // Optional
  const dso = dna.string().optional();
  type tdso = dna.infer<typeof dso>;
  expectTypeOf(dna.string().optional()._output).toEqualTypeOf<string | undefined>();
  const zodOptional = z.string().optional();
  type tzodOptional = z.infer<typeof zodOptional>;
  expectTypeOf<z.infer<typeof zodOptional>>().toEqualTypeOf<string | undefined>();

  // Default
  expectTypeOf(dna.string().default("default")._output).toEqualTypeOf<string>();
  const zodDefault = z.string().default("default");
  expectTypeOf<z.infer<typeof zodDefault>>().toEqualTypeOf<string>();

  // TemplateLiteral
  const parts = [dna.literal("a"), dna.number().min(3), "b"];
  const dtl = dna.templateLiteral(parts);
  type tdtl = dna.infer<typeof dtl>;
  type hdtl = $TemplateLiteral<typeof parts>;
  expectTypeOf(dtl._output).not.toEqualTypeOf<`a${number}b`>();
  // Test with inline array
  const dtl2 = dna.templateLiteral([dna.literal("a"), dna.number().min(3), "b"]);
  type arr = typeof parts; //= (string, DnaNumber, DnaLiteral<"a">)[]
  type tdtl2 = dna.infer<typeof dtl2>;
  expectTypeOf<typeof dtl2._output>().toEqualTypeOf<`a${number}b`>();
  expectTypeOf(dtl2._output).toEqualTypeOf<`a${number}b`>();
  expectTypeOf<typeof dtl2._output>().not.toEqualTypeOf<`${any}${number}b`>();

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
  expectTypeOf(dna.unknown().transform((val) => val as string)._output).toEqualTypeOf<string>();
  const zodTransform = z.unknown().transform((val) => val as string);
  expectTypeOf<z.infer<typeof zodTransform>>().toEqualTypeOf<string>();

  // NonOptional
  const dsonon = dna.string().optional().nonoptional();
  type tdsonon = dna.infer<typeof dsonon>;
  expectTypeOf(dsonon._output).toEqualTypeOf<string>();
  const zodNonOptional = z.string().optional().nonoptional();
  zodNonOptional._zod.def.innerType;
  zodNonOptional._zod.def.type;
  const znonopt = z.nonoptional(z.string())
  z.any().nullish()
  type tzodNonOptional = z.infer<typeof ZodNonOptional>;
  expectTypeOf<z.infer<typeof zodNonOptional>>().toEqualTypeOf<string>();

  // Readonly
  expectTypeOf(dna.object({ key: dna.string() }).readonly()._output).toEqualTypeOf<{ readonly key: string }>();
  const zodReadonly = z.object({ key: z.string() }).readonly();
  expectTypeOf<z.infer<typeof zodReadonly>>().toEqualTypeOf<{ readonly key: string }>();

  // NaN
  expectTypeOf(dna.nan()._output).toEqualTypeOf<number>();
  const zodNan = z.nan();
  expectTypeOf<z.infer<typeof zodNan>>().toEqualTypeOf<number>();

  // Pipe
  expectTypeOf(dna.unknown().pipe(dna.number())._output).toEqualTypeOf<number>();
  const zodPipe = z.unknown().pipe(z.number());
  expectTypeOf<z.infer<typeof zodPipe>>().toEqualTypeOf<number>();

  // Preprocess
  expectTypeOf(dna.preprocess((v) => v, dna.number())._output).toEqualTypeOf<number>();
  const zodPreprocess = z.preprocess((v) => v, z.number());
  expectTypeOf<z.infer<typeof zodPreprocess>>().toEqualTypeOf<number>();

  // Catch
  expectTypeOf(dna.string().catch("fallback")._output).toEqualTypeOf<string>();
  const zodCatch = z.string().catch("fallback");
  expectTypeOf<z.infer<typeof zodCatch>>().toEqualTypeOf<string>();
});

test("checks", () => {
  const _a: any = {} as any;
  const _b: any = {} as any;
});
