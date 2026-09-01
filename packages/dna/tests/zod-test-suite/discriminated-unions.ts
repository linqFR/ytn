import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const stringDiscriminatorZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const stringDiscriminatorDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a"), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const optionalDiscriminatorZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a").optional(), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const optionalDiscriminatorDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a").optional(), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const variousPrimitivesZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("1"), val: z.string() }),
  z.object({ type: z.literal(1), val: z.string() }),
  z.object({ type: z.literal(BigInt(1)), val: z.string() }),
  z.object({ type: z.literal("true"), val: z.string() }),
  z.object({ type: z.literal(true), val: z.string() }),
  z.object({ type: z.literal("null"), val: z.string() }),
  z.object({ type: z.null(), val: z.string() }),
  z.object({ type: z.literal("undefined"), val: z.string() }),
  z.object({ type: z.undefined(), val: z.string() }),
]);
const variousPrimitivesDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("1"), val: dna.string() }),
  dna.object({ type: dna.literal(1), val: dna.string() }),
  dna.object({ type: dna.literal(BigInt(1)), val: dna.string() }),
  dna.object({ type: dna.literal("true"), val: dna.string() }),
  dna.object({ type: dna.literal(true), val: dna.string() }),
  dna.object({ type: dna.literal("null"), val: dna.string() }),
  dna.object({ type: dna.null(), val: dna.string() }),
  dna.object({ type: dna.literal("undefined"), val: dna.string() }),
  dna.object({ type: dna.undefined(), val: dna.string() }),
]);

const invalidNullZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const invalidNullDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a"), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const validDiscInvalidDataZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a"), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const validDiscInvalidDataDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a"), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

const literalsDefaultPipeZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("foo").default("foo"), a: z.string() }),
  z.object({ type: z.literal("custom"), method: z.string() }),
  z.object({ type: z.literal("bar").transform((val) => val), c: z.string() }),
]);
const literalsDefaultPipeDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("foo").default("foo"), a: dna.string() }),
  dna.object({ type: dna.literal("custom"), method: dna.string() }),
  dna.object({ type: dna.literal("bar").transform((val: string) => val), c: dna.string() }),
]);

enum MyEnum {
  d = 0,
  e = "e",
}

const enumNativeEnumZod = z.discriminatedUnion("key", [
  z.object({ key: z.literal("a") }),
  z.object({ key: z.enum(["b", "c"]) }),
  z.object({ key: z.nativeEnum(MyEnum) }),
]);
const enumNativeEnumDna = dna.discriminatedUnion("key", [
  dna.object({ key: dna.literal("a") }),
  dna.object({ key: dna.enum(["b", "c"]) }),
  dna.object({ key: dna.enum({ d: 0, e: "e" }) }),
]);

const brandedZod = z.discriminatedUnion("key", [
  z.object({ key: z.literal("a") }),
  z.object({ key: z.literal("b").brand<"asdfasdf">() }),
]);
const brandedDna = dna.discriminatedUnion("key", [
  dna.object({ key: dna.literal("a") }),
  dna.object({ key: dna.literal("b").brand("asdfasdf") }),
]);

const optionalNullableZod = z.discriminatedUnion("key", [
  z.object({ key: z.literal("a").optional(), a: z.literal(true) }),
  z.object({ key: z.literal("b").nullable(), b: z.literal(true) }),
]);
const optionalNullableDna = dna.discriminatedUnion("key", [
  dna.object({ key: dna.literal("a").optional(), a: dna.literal(true) }),
  dna.object({ key: dna.literal("b").nullable(), b: dna.literal(true) }),
]);

const multipleDiscriminatorsZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("free"), min_cents: z.null() }),
  z.object({ type: z.literal("fiat-price"), min_cents: z.null() }),
]);
const multipleDiscriminatorsDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("free"), min_cents: dna.null() }),
  dna.object({ type: dna.literal("fiat-price"), min_cents: dna.null() }),
]);

const singleElementZod = z.discriminatedUnion("a", [
  z.object({ a: z.literal("discKey"), b: z.enum(["apple", "banana"]), c: z.object({ id: z.string() }) }),
]);
const singleElementDna = dna.discriminatedUnion("a", [
  dna.object({ a: dna.literal("discKey"), b: dna.enum(["apple", "banana"]), c: dna.object({ id: dna.string() }) }),
]);

const BaseErrorZod = z.object({ status: z.literal("failed"), message: z.string() });
const BaseErrorDna = dna.object({ status: dna.literal("failed"), message: dna.string() });

const nestedDiscUnionsZod = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.discriminatedUnion("code", [
    BaseErrorZod.extend({ code: z.literal(400) }),
    BaseErrorZod.extend({ code: z.literal(401) }),
    BaseErrorZod.extend({ code: z.literal(500) }),
  ]),
]);
const nestedDiscUnionsDna = dna.discriminatedUnion("status", [
  dna.object({ status: dna.literal("success"), data: dna.string() }),
  dna.discriminatedUnion("code", [
    BaseErrorDna.extend({ code: dna.literal(400) }),
    BaseErrorDna.extend({ code: dna.literal(401) }),
    BaseErrorDna.extend({ code: dna.literal(500) }),
  ]),
]);

const readonlyDiscZod = z.discriminatedUnion("type", [
  z.object({ type: z.literal("a").readonly(), a: z.string() }),
  z.object({ type: z.literal("b"), b: z.number() }),
]);
const readonlyDiscDna = dna.discriminatedUnion("type", [
  dna.object({ type: dna.literal("a").readonly(), a: dna.string() }),
  dna.object({ type: dna.literal("b"), b: dna.number() }),
]);

const omittableDiscZod = z.discriminatedUnion("k", [
  z.object({ k: z.exactOptional(z.literal("a")), x: z.string() }),
  z.object({ k: z.literal("b"), y: z.number() }),
]);
const omittableDiscDna = dna.discriminatedUnion("k", [
  dna.object({ k: dna.literal("a").exactOptional(), x: dna.string() }),
  dna.object({ k: dna.literal("b"), y: dna.number() }),
]);

const asyncValidZod = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("a"),
    a: z.string().refine(async () => true).transform(async (val) => Number(val)),
  }),
  z.object({ type: z.literal("b"), b: z.string() }),
]);
const asyncValidDna = dna.discriminatedUnion("type", [
  dna.object({
    type: dna.literal("a"),
    a: dna.string().refine(async () => true).transform(async (val: string) => Number(val)),
  }),
  dna.object({ type: dna.literal("b"), b: dna.string() }),
]);

export const discriminatedUnionsTests = [
  {
    description: "valid parse - object",
    zodSchema: stringDiscriminatorZod,
    dnaSchema: stringDiscriminatorDna,
    tests: [
      { description: "valid type a", data: { type: "a", a: "abc" }, valid: true },
    ],
  },
  {
    description: "valid - optional discriminator (object)",
    zodSchema: optionalDiscriminatorZod,
    dnaSchema: optionalDiscriminatorDna,
    tests: [
      { description: "valid with type a", data: { type: "a", a: "abc" }, valid: true },
      { description: "valid without type", data: { a: "abc" }, valid: true },
    ],
  },
  {
    description: "valid - discriminator value of various primitive types",
    zodSchema: variousPrimitivesZod,
    dnaSchema: variousPrimitivesDna,
    tests: [
      { description: "valid string 1", data: { type: "1", val: "val" }, valid: true },
      { description: "valid number 1", data: { type: 1, val: "val" }, valid: true },
      { description: "valid bigint 1", data: { type: BigInt(1), val: "val" }, valid: true },
      { description: "valid string true", data: { type: "true", val: "val" }, valid: true },
      { description: "valid boolean true", data: { type: true, val: "val" }, valid: true },
      { description: "valid string null", data: { type: "null", val: "val" }, valid: true },
      { description: "valid null", data: { type: null, val: "val" }, valid: true },
      { description: "valid string undefined", data: { type: "undefined", val: "val" }, valid: true },
      { description: "valid undefined", data: { type: undefined, val: "val" }, valid: true },
    ],
  },
  {
    description: "invalid discriminator value",
    zodSchema: stringDiscriminatorZod,
    dnaSchema: stringDiscriminatorDna,
    tests: [
      { description: "invalid type c", data: { type: "c", a: "abc" }, valid: false },
      { description: "invalid missing type", data: { a: "abc" }, valid: false },
      { description: "invalid wrong value for b", data: { type: "b", a: "abc" }, valid: false },
    ],
  },
  {
    description: "valid parse - type b",
    zodSchema: stringDiscriminatorZod,
    dnaSchema: stringDiscriminatorDna,
    tests: [
      { description: "valid type b", data: { type: "b", b: "xyz" }, valid: true },
    ],
  },
  {
    description: "invalid - null",
    zodSchema: invalidNullZod,
    dnaSchema: invalidNullDna,
    tests: [
      { description: "invalid null input", data: null, valid: false },
    ],
  },
  {
    description: "valid discriminator value, invalid data",
    zodSchema: validDiscInvalidDataZod,
    dnaSchema: validDiscInvalidDataDna,
    tests: [
      { description: "invalid missing required field a", data: { type: "a", b: "abc" }, valid: false },
    ],
  },
  {
    description: "literals with .default or .pipe",
    zodSchema: literalsDefaultPipeZod,
    dnaSchema: literalsDefaultPipeDna,
    tests: [
      { description: "valid type foo", data: { type: "foo", a: "foo" }, valid: true },
    ],
  },
  {
    description: "enum and nativeEnum",
    zodSchema: enumNativeEnumZod,
    dnaSchema: enumNativeEnumDna,
    tests: [
      { description: "valid literal a", data: { key: "a" }, valid: true },
      { description: "valid enum b", data: { key: "b" }, valid: true },
      { description: "valid enum c", data: { key: "c" }, valid: true },
      { description: "valid nativeEnum d (0)", data: { key: 0 }, valid: true },
      { description: "valid nativeEnum e", data: { key: "e" }, valid: true },
    ],
  },
  {
    description: "branded",
    zodSchema: brandedZod,
    dnaSchema: brandedDna,
    tests: [
      { description: "valid key a", data: { key: "a" }, valid: true },
      { description: "valid key b", data: { key: "b" }, valid: true },
      { description: "invalid key c", data: { key: "c" }, valid: false },
    ],
  },
  {
    description: "optional and nullable",
    zodSchema: optionalNullableZod,
    dnaSchema: optionalNullableDna,
    tests: [
      { description: "valid key a with a", data: { key: "a", a: true }, valid: true },
      { description: "valid key undefined with a", data: { key: undefined, a: true }, valid: true },
      { description: "valid key b with b", data: { key: "b", b: true }, valid: true },
      { description: "valid key null with b", data: { key: null, b: true }, valid: true },
      { description: "invalid key null with a", data: { key: null, a: true }, valid: false },
      { description: "invalid key b with a", data: { key: "b", a: true }, valid: false },
    ],
  },
  {
    description: "multiple discriminators",
    zodSchema: multipleDiscriminatorsZod,
    dnaSchema: multipleDiscriminatorsDna,
    tests: [
      { description: "valid fiat-price", data: { min_cents: null, type: "fiat-price", name: "Standard" }, valid: true },
      { description: "invalid wrong type", data: { min_cents: null, type: "not real", name: "Standard" }, valid: false },
    ],
  },
  {
    description: "single element union",
    zodSchema: singleElementZod,
    dnaSchema: singleElementDna,
    tests: [
      { description: "invalid missing required field in c", data: { a: "discKey", b: "apple", c: {} }, valid: false },
    ],
  },
  {
    description: "nested discriminated unions",
    zodSchema: nestedDiscUnionsZod,
    dnaSchema: nestedDiscUnionsDna,
    tests: [
      { description: "valid success", data: { status: "success", data: "hello" }, valid: true },
      { description: "valid failed 400", data: { status: "failed", code: 400, message: "bad request" }, valid: true },
      { description: "valid failed 401", data: { status: "failed", code: 401, message: "unauthorized" }, valid: true },
      { description: "valid failed 500", data: { status: "failed", code: 500, message: "internal server error" }, valid: true },
    ],
  },
  {
    description: "readonly literal discriminator",
    zodSchema: readonlyDiscZod,
    dnaSchema: readonlyDiscDna,
    tests: [
      { description: "valid type a", data: { type: "a", a: "hello" }, valid: true },
      { description: "valid type b", data: { type: "b", b: 42 }, valid: true },
      { description: "invalid type c", data: { type: "c", a: "hello" }, valid: false },
    ],
  },
  {
    description: "Object.prototype discriminator name - constructor",
    zodSchema: z.discriminatedUnion("constructor", [
      z.object({ constructor: z.literal("a"), value: z.string() }),
      z.object({ constructor: z.literal("b"), value: z.number() }),
    ]),
    dnaSchema: dna.discriminatedUnion("constructor", [
      dna.object({ constructor: dna.literal("a"), value: dna.string() }),
      dna.object({ constructor: dna.literal("b"), value: dna.number() }),
    ]),
    tests: [
      { description: "valid constructor a", data: Object.fromEntries([["constructor", "a"], ["value", "ok"]]), valid: true },
    ],
  },
  {
    description: "Object.prototype discriminator name - toString",
    zodSchema: z.discriminatedUnion("toString", [
      z.object({ toString: z.literal("a"), value: z.string() }),
      z.object({ toString: z.literal("b"), value: z.number() }),
    ]),
    dnaSchema: dna.discriminatedUnion("toString", [
      dna.object({ toString: dna.literal("a"), value: dna.string() }),
      dna.object({ toString: dna.literal("b"), value: dna.number() }),
    ]),
    tests: [
      { description: "valid toString a", data: Object.fromEntries([["toString", "a"], ["value", "ok"]]), valid: true },
    ],
  },
  {
    description: "Object.prototype discriminator name - hasOwnProperty",
    zodSchema: z.discriminatedUnion("hasOwnProperty", [
      z.object({ hasOwnProperty: z.literal("a"), value: z.string() }),
      z.object({ hasOwnProperty: z.literal("b"), value: z.number() }),
    ]),
    dnaSchema: dna.discriminatedUnion("hasOwnProperty", [
      dna.object({ hasOwnProperty: dna.literal("a"), value: dna.string() }),
      dna.object({ hasOwnProperty: dna.literal("b"), value: dna.number() }),
    ]),
    tests: [
      { description: "valid hasOwnProperty a", data: Object.fromEntries([["hasOwnProperty", "a"], ["value", "ok"]]), valid: true },
    ],
  },
  {
    description: "Object.prototype discriminator name - valueOf",
    zodSchema: z.discriminatedUnion("valueOf", [
      z.object({ valueOf: z.literal("a"), value: z.string() }),
      z.object({ valueOf: z.literal("b"), value: z.number() }),
    ]),
    dnaSchema: dna.discriminatedUnion("valueOf", [
      dna.object({ valueOf: dna.literal("a"), value: dna.string() }),
      dna.object({ valueOf: dna.literal("b"), value: dna.number() }),
    ]),
    tests: [
      { description: "valid valueOf a", data: Object.fromEntries([["valueOf", "a"], ["value", "ok"]]), valid: true },
    ],
  },
  {
    description: "omittable discriminator",
    zodSchema: omittableDiscZod,
    dnaSchema: omittableDiscDna,
    tests: [
      { description: "valid absent key routes to first option", data: { x: "s" }, valid: true },
      { description: "valid key b routes to second option", data: { k: "b", y: 1 }, valid: true },
    ],
  },
  {
    description: "async - valid",
    zodSchema: asyncValidZod,
    dnaSchema: asyncValidDna,
    tests: [
      { description: "valid async transform", data: { type: "a", a: "1" }, valid: true },
    ],
  },
  {
    description: "async - invalid",
    zodSchema: asyncValidZod,
    dnaSchema: asyncValidDna,
    tests: [
      { description: "invalid wrong type for a", data: { type: "a", a: 1 }, valid: false },
    ],
  },
];
