import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const TestZod = z.object({
  f1: z.number(),
  f2: z.string().optional(),
  f3: z.string().nullable(),
  f4: z.array(z.object({ t: z.union([z.string(), z.boolean()]) })),
});

const TestDna = dna.object({
  f1: dna.number(),
  f2: dna.string().optional(),
  f3: dna.string().nullable(),
  f4: dna.array(dna.object({ t: dna.union([dna.string(), dna.boolean()]) })),
});

const nonstrictZod = z.object({ points: z.number() });
const nonstrictDna = dna.object({ points: dna.number() });

const optionalKeyZod = z.object({ a: z.string().optional() });
const optionalKeyDna = dna.object({ a: dna.string().optional() });

const emptyObjectZod = z.object({});
const emptyObjectDna = dna.object({});

const passthroughZod = z.object({ points: z.number() }).passthrough();
const passthroughDna = dna.object({ points: dna.number() }).passthrough();

const strictZod = z.object({ points: z.number() }).strict();
const strictDna = dna.object({ points: dna.number() }).strict();

const catchallZod = z.object({ name: z.string() }).catchall(z.number());
const catchallDna = dna.object({ name: dna.string() }).catchall(dna.number());

const strictObjectZod = z.strictObject({ name: z.string() });
const strictObjectDna = dna.strictObject({ name: dna.string() });

const looseObjectZod = z.looseObject({ name: z.string() });
const looseObjectDna = dna.looseObject({ name: dna.string() });

const unknownkeysOverrideZod = z.object({ points: z.number() }).strict().passthrough().strip().passthrough();
const unknownkeysOverrideDna = dna.object({ points: dna.number() }).strict().passthrough().strip().passthrough();

const catchallOverridesStrictZod = z.object({ first: z.string().optional() }).strict().catchall(z.number());
const catchallOverridesStrictDna = dna.object({ first: dna.string().optional() }).strict().catchall(dna.number());

const catchallOverridesStrict2Zod = z.object({ first: z.string() }).strict().catchall(z.number());
const catchallOverridesStrict2Dna = dna.object({ first: dna.string() }).strict().catchall(dna.number());

const nonexistentKeysZod = z.union([z.object({ a: z.string() }), z.object({ b: z.number() })]);
const nonexistentKeysDna = dna.union([dna.object({ a: dna.string() }), dna.object({ b: dna.number() })]);

const objectWithRefineZod = z.object({ a: z.string().default("foo"), b: z.number() }).refine(() => true);
const objectWithRefineDna = dna.object({ a: dna.string().default("foo"), b: dna.number() }).refine(() => true);

const dateObjectZod = z.object({ a: z.date() });
const dateObjectDna = dna.object({ a: dna.date() });

const dateObjectRefineZod = z.object({ a: z.date() }).refine(() => true);
const dateObjectRefineDna = dna.object({ a: dna.date() }).refine(() => true);

const constructorKeyZod = z.object({ name: z.string() }).strict();
const constructorKeyDna = dna.object({ name: dna.string() }).strict();

const mergePreservesRefineZod = z.object({ name: z.string() }).merge(
  z.object({ age: z.number() }).refine((data) => data.age >= 18, { message: "Must be 18+" }),
);
const mergePreservesRefineDna = dna.object({ name: dna.string() }).merge(
  dna.object({ age: dna.number() }).refine((data: { age: number }) => data.age >= 18, { message: "Must be 18+" }),
);

const personToExtendZod = z.object({ firstName: z.string(), lastName: z.string() });
const personToExtendDna = dna.object({ firstName: dna.string(), lastName: dna.string() });

const extendNewKeyZod = personToExtendZod.extend({ nickName: z.string() });
const extendNewKeyDna = personToExtendDna.extend({ nickName: dna.string() });

const extendOverrideKeyZod = personToExtendZod.extend({ lastName: z.number() });
const extendOverrideKeyDna = personToExtendDna.extend({ lastName: dna.number() });

const safeExtendOverrideZod = personToExtendZod.safeExtend({ lastName: z.string().min(3) });
const safeExtendOverrideDna = personToExtendDna.safeExtend({ lastName: dna.string().min(3) });

const safeExtendRefineZod = z.object({ name: z.string().min(1) }).safeExtend({ name: z.string().min(2) });
const safeExtendRefineDna = dna.object({ name: dna.string().min(1) }).safeExtend({ name: dna.string().min(2) });

const nullPrototypeZod = z.object({ a: z.string() });
const nullPrototypeDna = dna.object({ a: dna.string() });

const preserveKeyOrderZod = z.object({ a: z.string().optional(), b: z.string() });
const preserveKeyOrderDna = dna.object({ a: dna.string().optional(), b: dna.string() });

const emptyShapeZod = z.object({});
const emptyShapeDna = dna.object({});

const protoLooseZod = z.looseObject({ name: z.string() });
const protoLooseDna = dna.looseObject({ name: dna.string() });

const protoPassthroughZod = z.object({ name: z.string() }).passthrough();
const protoPassthroughDna = dna.object({ name: dna.string() }).passthrough();

const protoCatchallUnknownZod = z.object({ name: z.string() }).catchall(z.unknown());
const protoCatchallUnknownDna = dna.object({ name: dna.string() }).catchall(dna.unknown());

const protoStrictZod = z.object({ name: z.string() }).strict();
const protoStrictDna = dna.object({ name: dna.string() }).strict();

const inheritedPropZod = z.object({ value: z.string() });
const inheritedPropDna = dna.object({ value: dna.string() });

const SYM = Symbol("sym");
const symbolKeyZod = z.object({ name: z.string(), [SYM]: z.number() });
const symbolKeyDna = dna.object({ name: dna.string(), [SYM]: dna.number() });

const symbolKeyOptionalZod = z.object({ [SYM]: z.number().optional() });
const symbolKeyOptionalDna = dna.object({ [SYM]: dna.number().optional() });

const symbolKeyDefaultZod = z.object({ [SYM]: z.number().default(7) });
const symbolKeyDefaultDna = dna.object({ [SYM]: dna.number().default(7) });

const symbolKeyStrictZod = z.strictObject({ [SYM]: z.number() });
const symbolKeyStrictDna = dna.strictObject({ [SYM]: dna.number() });

const symbolKeyLooseZod = z.looseObject({ [SYM]: z.number() });
const symbolKeyLooseDna = dna.looseObject({ [SYM]: dna.number() });

// Data for special tests
const protoInputData = JSON.parse('{"__proto__":{"isAdmin":true},"name":"alice"}');
const nullProtoData = Object.create(null);
nullProtoData.a = "foo";
const inheritedData = Object.create({ value: "inherited" });
const testDate = new Date(1637353595983);

export const objectTests = [
  {
    description: "unknown throw",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      { description: "invalid unknown", data: 35, valid: false },
    ],
  },
  {
    description: "correct parsing - with all fields",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      {
        description: "valid complete object",
        data: {
          f1: 12,
          f2: "string",
          f3: "string",
          f4: [{ t: "string" }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "correct parsing - with null",
    zodSchema: TestZod,
    dnaSchema: TestDna,
    tests: [
      {
        description: "valid with null",
        data: {
          f1: 12,
          f3: null,
          f4: [{ t: false }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "nonstrict by default",
    zodSchema: nonstrictZod,
    dnaSchema: nonstrictDna,
    tests: [
      {
        description: "valid with unknown property",
        data: { points: 2314, unknown: "asdf" },
        valid: true,
      },
    ],
  },
  {
    description: "parse optional keys",
    zodSchema: optionalKeyZod,
    dnaSchema: optionalKeyDna,
    tests: [
      { description: "valid with a", data: { a: "asdf" }, valid: true },
    ],
  },
  {
    description: "empty object",
    zodSchema: emptyObjectZod,
    dnaSchema: emptyObjectDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid with properties (stripped)", data: { name: "asdf" }, valid: true },
      { description: "invalid null", data: null, valid: false },
      { description: "invalid string", data: "asdf", valid: false },
    ],
  },
  {
    description: "strip by default",
    zodSchema: nonstrictZod,
    dnaSchema: nonstrictDna,
    tests: [
      { description: "valid with unknown (stripped)", data: { points: 2314, unknown: "asdf" }, valid: true },
    ],
  },
  {
    description: "passthrough unknown",
    zodSchema: passthroughZod,
    dnaSchema: passthroughDna,
    tests: [
      { description: "valid with unknown (preserved)", data: { points: 2314, unknown: "asdf" }, valid: true },
    ],
  },
  {
    description: "strict",
    zodSchema: strictZod,
    dnaSchema: strictDna,
    tests: [
      { description: "invalid with unknown", data: { points: 2314, unknown: "asdf" }, valid: false },
    ],
  },
  {
    description: "catchall parsing",
    zodSchema: catchallZod,
    dnaSchema: catchallDna,
    tests: [
      { description: "valid with extra number", data: { name: "Foo", validExtraKey: 61 }, valid: true },
      { description: "invalid with extra string", data: { name: "Foo", validExtraKey: 61, invalid: "asdf" }, valid: false },
    ],
  },
  {
    description: "strictObject",
    zodSchema: strictObjectZod,
    dnaSchema: strictObjectDna,
    tests: [
      { description: "valid", data: { name: "asdf" }, valid: true },
      { description: "invalid with unexpected", data: { name: "asdf", unexpected: 13 }, valid: false },
    ],
  },
  {
    description: "looseObject",
    zodSchema: looseObjectZod,
    dnaSchema: looseObjectDna,
    tests: [
      { description: "valid", data: { name: "asdf" }, valid: true },
      { description: "valid with unknown", data: { name: "asdf", unknown: 13 }, valid: true },
    ],
  },
  {
    description: "unknownkeys override",
    zodSchema: unknownkeysOverrideZod,
    dnaSchema: unknownkeysOverrideDna,
    tests: [
      { description: "valid passthrough after overrides", data: { points: 2314, unknown: "asdf" }, valid: true },
    ],
  },
  {
    description: "catchall overrides strict (optional first)",
    zodSchema: catchallOverridesStrictZod,
    dnaSchema: catchallOverridesStrictDna,
    tests: [
      { description: "valid extra numeric key", data: { asdf: 1234 }, valid: true },
      { description: "valid with first and extra", data: { first: "asdf", asdf: 1234 }, valid: true },
    ],
  },
  {
    description: "catchall overrides strict (required first)",
    zodSchema: catchallOverridesStrict2Zod,
    dnaSchema: catchallOverridesStrict2Dna,
    tests: [
      { description: "valid with first and extra", data: { first: "asdf", asdf: 1234 }, valid: true },
    ],
  },
  {
    description: "nonexistent keys",
    zodSchema: nonexistentKeysZod,
    dnaSchema: nonexistentKeysDna,
    tests: [
      { description: "valid with a key", data: { a: "A" }, valid: true },
    ],
  },
  {
    description: "object with refine",
    zodSchema: objectWithRefineZod,
    dnaSchema: objectWithRefineDna,
    tests: [
      { description: "valid with default applied", data: { b: 5 }, valid: true },
    ],
  },
  {
    description: "intersection of object with date",
    zodSchema: z.intersection(dateObjectZod, dateObjectZod),
    dnaSchema: dna.intersection(dateObjectDna, dateObjectDna),
    tests: [
      { description: "valid date object", data: { a: testDate }, valid: true },
    ],
  },
  {
    description: "intersection of object with refine with date",
    zodSchema: z.intersection(dateObjectRefineZod, dateObjectRefineZod),
    dnaSchema: dna.intersection(dateObjectRefineDna, dateObjectRefineDna),
    tests: [
      { description: "valid date object with refine", data: { a: testDate }, valid: true },
    ],
  },
  {
    description: "constructor key",
    zodSchema: constructorKeyZod,
    dnaSchema: constructorKeyDna,
    tests: [
      { description: "invalid constructor as unknown key", data: { name: "bob dylan", constructor: 61 }, valid: false },
    ],
  },
  {
    description: "merge() preserves refinements on the second schema",
    zodSchema: mergePreservesRefineZod,
    dnaSchema: mergePreservesRefineDna,
    tests: [
      { description: "valid adult", data: { name: "n", age: 21 }, valid: true },
      { description: "invalid minor", data: { name: "n", age: 12 }, valid: false },
    ],
  },
  {
    description: "extend() should return schema with new key",
    zodSchema: extendNewKeyZod,
    dnaSchema: extendNewKeyDna,
    tests: [
      { description: "valid extended", data: { firstName: "f", nickName: "n", lastName: "l" }, valid: true },
    ],
  },
  {
    description: "extend() should have power to override existing key",
    zodSchema: extendOverrideKeyZod,
    dnaSchema: extendOverrideKeyDna,
    tests: [
      { description: "valid overridden key", data: { firstName: "f", lastName: 42 }, valid: true },
    ],
  },
  {
    description: "safeExtend() should have power to override existing key",
    zodSchema: safeExtendOverrideZod,
    dnaSchema: safeExtendOverrideDna,
    tests: [
      { description: "valid min length", data: { firstName: "f", lastName: "abc" }, valid: true },
      { description: "invalid too short", data: { firstName: "f", lastName: "ab" }, valid: false },
    ],
  },
  {
    description: "safeExtend() maintains refinements",
    zodSchema: safeExtendRefineZod,
    dnaSchema: safeExtendRefineDna,
    tests: [
      { description: "invalid empty name", data: { name: "" }, valid: false },
      { description: "valid two char name", data: { name: "ab" }, valid: true },
    ],
  },
  {
    description: "null prototype",
    zodSchema: nullPrototypeZod,
    dnaSchema: nullPrototypeDna,
    tests: [
      { description: "valid null prototype object", data: nullProtoData, valid: true },
    ],
  },
  {
    description: "preserve key order",
    zodSchema: preserveKeyOrderZod,
    dnaSchema: preserveKeyOrderDna,
    tests: [
      { description: "valid with both keys", data: { a: "asdf", b: "qwer" }, valid: true },
    ],
  },
  {
    description: "empty shape",
    zodSchema: emptyShapeZod,
    dnaSchema: emptyShapeDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
      { description: "invalid array", data: [], valid: false },
    ],
  },
  {
    description: "__proto__ in catchall paths - looseObject drops __proto__",
    zodSchema: protoLooseZod,
    dnaSchema: protoLooseDna,
    tests: [
      { description: "valid with __proto__ stripped", data: protoInputData, valid: true },
    ],
  },
  {
    description: "__proto__ in catchall paths - passthrough drops __proto__",
    zodSchema: protoPassthroughZod,
    dnaSchema: protoPassthroughDna,
    tests: [
      { description: "valid with __proto__ stripped", data: protoInputData, valid: true },
    ],
  },
  {
    description: "__proto__ in catchall paths - catchall(unknown) drops __proto__",
    zodSchema: protoCatchallUnknownZod,
    dnaSchema: protoCatchallUnknownDna,
    tests: [
      { description: "valid with __proto__ stripped", data: protoInputData, valid: true },
    ],
  },
  {
    description: "__proto__ in catchall paths - strict rejects __proto__",
    zodSchema: protoStrictZod,
    dnaSchema: protoStrictDna,
    tests: [
      { description: "invalid with __proto__ as unrecognized key", data: protoInputData, valid: false },
    ],
  },
  {
    description: "object parsing reads inherited properties",
    zodSchema: inheritedPropZod,
    dnaSchema: inheritedPropDna,
    tests: [
      { description: "valid inherited property", data: inheritedData, valid: true },
    ],
  },
  {
    description: "symbol keys - parses and validates a declared symbol key",
    zodSchema: symbolKeyZod,
    dnaSchema: symbolKeyDna,
    tests: [
      { description: "valid with symbol key", data: { name: "alice", [SYM]: 42 }, valid: true },
      { description: "invalid symbol value type", data: { name: "alice", [SYM]: "nope" }, valid: false },
      { description: "invalid missing symbol key", data: { name: "alice" }, valid: false },
    ],
  },
  {
    description: "symbol keys - honours optionality on a symbol key",
    zodSchema: symbolKeyOptionalZod,
    dnaSchema: symbolKeyOptionalDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
    ],
  },
  {
    description: "symbol keys - honours defaults on a symbol key",
    zodSchema: symbolKeyDefaultZod,
    dnaSchema: symbolKeyDefaultDna,
    tests: [
      { description: "valid with default applied", data: {}, valid: true },
    ],
  },
  {
    description: "symbol keys - declared symbol key survives strict",
    zodSchema: symbolKeyStrictZod,
    dnaSchema: symbolKeyStrictDna,
    tests: [
      { description: "valid with symbol key", data: { [SYM]: 1 }, valid: true },
      { description: "invalid with extra key", data: { [SYM]: 1, extra: 1 }, valid: false },
    ],
  },
  {
    description: "symbol keys - declared symbol key survives loose",
    zodSchema: symbolKeyLooseZod,
    dnaSchema: symbolKeyLooseDna,
    tests: [
      { description: "valid with extra key", data: { [SYM]: 1, extra: "e" }, valid: true },
    ],
  },
];
