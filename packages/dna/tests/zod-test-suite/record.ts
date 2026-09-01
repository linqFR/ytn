import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const booleanRecordZod = z.record(z.string(), z.boolean());
const booleanRecordDna = dna.record(dna.string(), dna.boolean());

const recordWithEnumKeysZod = z.record(z.enum(["Tuna", "Salmon"]), z.string());
const recordWithEnumKeysDna = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string());

const recordWithLiteralKeyZod = z.record(z.literal(["Tuna", "Salmon", 21]), z.string());
const recordWithLiteralKeyDna = dna.record(dna.literal(["Tuna", "Salmon", 21]), dna.string());

const recordKeyRefineZod = z.record(
  z.literal(["a", "b"]).refine((k) => k === "a", { message: "only 'a' is allowed" }),
  z.string()
);
const recordKeyRefineDna = dna.record(
  dna.literal(["a", "b"]).refine((k) => k === "a", { message: "only 'a' is allowed" }),
  dna.string()
);

const pipeExhaustivenessZod = z.record(z.enum(["Tuna", "Salmon"]).pipe(z.any()), z.string());
const pipeExhaustivenessDna = dna.record(dna.enum(["Tuna", "Salmon"]).pipe(dna.any()), dna.string());

const keyTransformSingleZod = z.record(
  z.literal("a").transform(() => "b" as const),
  z.string()
);
const keyTransformSingleDna = dna.record(
  dna.literal("a").transform(() => "b" as const),
  dna.string()
);

const keyTransformMultiZod = z.record(
  z.literal(["a", "b"]).transform((k) => k.toUpperCase()),
  z.number()
);
const keyTransformMultiDna = dna.record(
  dna.literal(["a", "b"]).transform((k) => k.toUpperCase()),
  dna.number()
);

const keyTransformEnumZod = z.record(
  z.enum(["a", "b"]).transform((k) => k.toUpperCase()),
  z.number()
);
const keyTransformEnumDna = dna.record(
  dna.enum(["a", "b"]).transform((k) => k.toUpperCase()),
  dna.number()
);

const looseRecordZod = z.looseRecord(z.string().regex(/^S_/), z.string());
const looseRecordDna = dna.looseRecord(dna.string().regex(/^S_/), dna.string());

const recordWithLiteralUnionKeysZod = z.record(
  z.union([z.literal("Tuna"), z.literal("Salmon"), z.literal(21)]),
  z.string()
);
const recordWithLiteralUnionKeysDna = dna.record(
  dna.union([dna.literal("Tuna"), dna.literal("Salmon"), dna.literal(21)]),
  dna.string()
);

enum Enum {
  Tuna = 0,
  Salmon = "Shark",
}

const recordWithTypescriptEnumZod = z.record(z.enum(Enum), z.string());
const recordWithTypescriptEnumDna = dna.record(dna.enum([Enum.Tuna, Enum.Salmon]), dna.string());

const partialRecordZod = z.partialRecord(z.enum(["id", "name", "email"]), z.string());
const partialRecordDna = dna.partialRecord(dna.enum(["id", "name", "email"]), dna.string());

const numericKeyRecordZod = z.record(z.number(), z.number());
const numericKeyRecordDna = dna.record(dna.number(), dna.number());

const anyValueRecordZod = z.record(z.string(), z.any());
const anyValueRecordDna = dna.record(dna.string(), dna.any());

const undefinedValueRecordZod = z.record(z.string(), z.undefined());
const undefinedValueRecordDna = dna.record(dna.string(), dna.undefined());

// optional-in value type schemas
const defaultedValueRecordZod = z.record(z.enum(["Tuna", "Salmon"]), z.string().default("unknown"));
const defaultedValueRecordDna = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string().default("unknown"));

const prefaultedValueRecordZod = z.record(z.enum(["Tuna", "Salmon"]), z.string().prefault("unknown"));
const prefaultedValueRecordDna = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string().prefault("unknown"));

const optionalValueRecordZod = z.record(z.enum(["Tuna", "Salmon"]), z.string().optional());
const optionalValueRecordDna = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string().optional());

const caughtValueRecordZod = z.record(z.enum(["Tuna", "Salmon"]), z.string().catch("unknown"));
const caughtValueRecordDna = dna.record(dna.enum(["Tuna", "Salmon"]), dna.string().catch("unknown"));

const preprocessedValueRecordZod = z.record(
  z.enum(["Tuna", "Salmon"]),
  z.preprocess((v) => v, z.string())
);
const preprocessedValueRecordDna = dna.record(
  dna.enum(["Tuna", "Salmon"]),
  dna.preprocess((v) => v, dna.string())
);

// typescript enum exhaustiveness - extra key and missing key
const tsEnumExtraKeyZod = z.record(z.enum(Enum), z.string());
const tsEnumExtraKeyDna = dna.record(dna.enum([Enum.Tuna, Enum.Salmon]), dna.string());

// key and value getters
const keyValueTypeRecordZod = z.record(z.string(), z.number());
const keyValueTypeRecordDna = dna.record(dna.string(), dna.number());

// prototype pollution
const protoPollutionRecordZod = z.record(z.string(), z.object({ a: z.string() }));
const protoPollutionRecordDna = dna.record(dna.string(), dna.object({ a: dna.string() }));

// key schema cannot normalize into __proto__
const protoKeyToLowerZod = z.record(z.string().toLowerCase(), z.object({ a: z.string() }));
const protoKeyToLowerDna = dna.record(dna.string().toLowerCase(), dna.object({ a: dna.string() }));

const protoKeyTrimZod = z.record(z.string().trim(), z.object({ a: z.string() }));
const protoKeyTrimDna = dna.record(dna.string().trim(), dna.object({ a: dna.string() }));

const protoKeyTransformZod = z.record(
  z.string().transform((s) => s.slice(2)),
  z.object({ a: z.string() })
);
const protoKeyTransformDna = dna.record(
  dna.string().transform((s) => s.slice(2)),
  dna.object({ a: dna.string() })
);

// async parsing - valid
const asyncRecordValidZod = z
  .record(
    z.string(),
    z
      .string()
      .optional()
      .refine(async () => true)
  )
  .refine(async () => true);
const asyncRecordValidDna = dna
  .record(
    dna.string(),
    dna
      .string()
      .optional()
      .refine(async () => true)
  )
  .refine(async () => true);

// async parsing - invalid
const asyncRecordInvalidZod = z
  .record(
    z.string(),
    z
      .string()
      .optional()
      .refine(async () => false)
  )
  .refine(async () => false);
const asyncRecordInvalidDna = dna
  .record(
    dna.string(),
    dna
      .string()
      .optional()
      .refine(async () => false)
  )
  .refine(async () => false);

// partialRecord with z.literal([key, ...])
const partialRecordLiteralZod = z.partialRecord(z.literal(["id", "name", "email"]), z.string());
const partialRecordLiteralDna = dna.partialRecord(dna.literal(["id", "name", "email"]), dna.string());

// partialRecord with numeric literal keys
const partialRecordNumericZod = z.partialRecord(z.literal([1, 2, 3]), z.string());
const partialRecordNumericDna = dna.partialRecord(dna.literal([1, 2, 3]), dna.string());

// partialRecord with union of string and numeric literal keys
const partialRecordUnionZod = z.partialRecord(
  z.union([z.literal(["a", "b", "c"]), z.literal([1, 2, 3])]),
  z.string()
);
const partialRecordUnionDna = dna.partialRecord(
  dna.union([dna.literal(["a", "b", "c"]), dna.literal([1, 2, 3])]),
  dna.string()
);

// looseRecord with closed key schema
const looseRecordEnumAnyZod = z.looseRecord(z.enum(["foo", "bar"]), z.any());
const looseRecordEnumAnyDna = dna.looseRecord(dna.enum(["foo", "bar"]), dna.any());

const looseRecordLiteralAnyZod = z.looseRecord(z.literal(["foo", "bar"]), z.any());
const looseRecordLiteralAnyDna = dna.looseRecord(dna.literal(["foo", "bar"]), dna.any());

const looseRecordEnumStringZod = z.looseRecord(z.enum(["foo", "bar"]), z.string());
const looseRecordEnumStringDna = dna.looseRecord(dna.enum(["foo", "bar"]), dna.string());

// record with closed key schema rejects unrecognized keys
const recordClosedKeyZod = z.record(z.enum(["foo", "bar"]), z.any());
const recordClosedKeyDna = dna.record(dna.enum(["foo", "bar"]), dna.any());

export const recordTests = [
  {
    description: "type inference - boolean record",
    zodSchema: booleanRecordZod,
    dnaSchema: booleanRecordDna,
    tests: [
      { description: "valid record", data: { a: true, b: false }, valid: true },
      { description: "valid empty record", data: {}, valid: true },
      { description: "valid numeric string key", data: { k1: true, 1234: false }, valid: true },
      { description: "invalid wrong value type", data: { asdf: 1234 }, valid: false },
      { description: "invalid non-object string", data: "asdf", valid: false },
    ],
  },
  {
    description: "enum exhaustiveness",
    zodSchema: recordWithEnumKeysZod,
    dnaSchema: recordWithEnumKeysDna,
    tests: [
      { description: "valid all enum keys", data: { Tuna: "asdf", Salmon: "asdf" }, valid: true },
      { description: "invalid missing enum key", data: { Tuna: "asdf" }, valid: false },
      { description: "invalid extra key", data: { Tuna: "asdf", Salmon: "asdf", Trout: "asdf" }, valid: false },
    ],
  },
  {
    description: "typescript enum exhaustiveness",
    zodSchema: recordWithTypescriptEnumZod,
    dnaSchema: recordWithTypescriptEnumDna,
    tests: [
      { description: "valid all enum keys", data: { [Enum.Tuna]: "a", [Enum.Salmon]: "b" }, valid: true },
    ],
  },
  {
    description: "literal exhaustiveness",
    zodSchema: recordWithLiteralKeyZod,
    dnaSchema: recordWithLiteralKeyDna,
    tests: [
      { description: "valid all literal keys", data: { Tuna: "asdf", Salmon: "asdf", 21: "asdf" }, valid: true },
      { description: "invalid missing literal keys", data: { Tuna: "asdf" }, valid: false },
      { description: "invalid unrecognized key", data: { Tuna: "asdf", Salmon: "asdf", 21: "asdf", Trout: "asdf" }, valid: false },
    ],
  },
  {
    description: "union exhaustiveness",
    zodSchema: recordWithLiteralUnionKeysZod,
    dnaSchema: recordWithLiteralUnionKeysDna,
    tests: [
      { description: "valid all literal keys", data: { Tuna: "asdf", Salmon: "asdf", 21: "asdf" }, valid: true },
      { description: "invalid missing literal key", data: { Tuna: "asdf" }, valid: false },
      { description: "invalid unrecognized key", data: { Tuna: "asdf", Salmon: "asdf", 21: "asdf", Trout: "asdf" }, valid: false },
    ],
  },
  {
    description: "surfaces key schema refinement failures as invalid_key",
    zodSchema: recordKeyRefineZod,
    dnaSchema: recordKeyRefineDna,
    tests: [
      { description: "invalid key refinement failure", data: { a: "ok", b: "nope" }, valid: false },
    ],
  },
  {
    description: "pipe exhaustiveness",
    zodSchema: pipeExhaustivenessZod,
    dnaSchema: pipeExhaustivenessDna,
    tests: [
      { description: "valid all enum keys", data: { Tuna: "asdf", Salmon: "asdf" }, valid: true },
      { description: "invalid missing enum key", data: { Tuna: "asdf" }, valid: false },
      { description: "invalid unrecognized key", data: { Tuna: "asdf", Salmon: "asdf", Trout: "asdf" }, valid: false },
    ],
  },
  {
    description: "applies transforms on the key schema - single",
    zodSchema: keyTransformSingleZod,
    dnaSchema: keyTransformSingleDna,
    tests: [
      { description: "valid transform key", data: { a: "John" }, valid: true },
    ],
  },
  {
    description: "applies transforms on the key schema - multi",
    zodSchema: keyTransformMultiZod,
    dnaSchema: keyTransformMultiDna,
    tests: [
      { description: "valid transform keys", data: { a: 1, b: 2 }, valid: true },
      { description: "invalid missing key", data: { a: 1 }, valid: false },
    ],
  },
  {
    description: "applies transforms on the key schema - enum",
    zodSchema: keyTransformEnumZod,
    dnaSchema: keyTransformEnumDna,
    tests: [
      { description: "valid transform enum keys", data: { a: 1, b: 2 }, valid: true },
    ],
  },
  {
    description: "looseRecord passes through non-matching keys",
    zodSchema: looseRecordZod,
    dnaSchema: looseRecordDna,
    tests: [
      { description: "valid matching pattern", data: { S_name: "John" }, valid: true },
      { description: "valid matching pattern with extra key", data: { S_name: "John", other: "value" }, valid: true },
      { description: "valid non-matching key only", data: { other: "value" }, valid: true },
      { description: "invalid wrong value type for matching key", data: { S_name: 123 }, valid: false },
    ],
  },
  {
    description: "partialRecord - non-exhaustive",
    zodSchema: partialRecordZod,
    dnaSchema: partialRecordDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid single key", data: { id: "123" }, valid: true },
      { description: "valid other single key", data: { email: "john@example.com" }, valid: true },
      { description: "invalid unrecognized key", data: { foo: "bar" }, valid: false },
    ],
  },
  {
    description: "numeric string keys",
    zodSchema: numericKeyRecordZod,
    dnaSchema: numericKeyRecordDna,
    tests: [
      { description: "valid integer keys", data: { 1: 100, 2: 200 }, valid: true },
      { description: "valid float/negative string keys", data: { "1.5": 100, "-3": 200 }, valid: true },
      { description: "invalid non-numeric key", data: { abc: 100 }, valid: false },
    ],
  },
  {
    description: "don't remove undefined values (any value)",
    zodSchema: anyValueRecordZod,
    dnaSchema: anyValueRecordDna,
    tests: [
      { description: "valid with undefined value", data: { foo: undefined }, valid: true },
    ],
  },
  {
    description: "allow undefined values",
    zodSchema: undefinedValueRecordZod,
    dnaSchema: undefinedValueRecordDna,
    tests: [
      { description: "valid undefined value", data: { _test: undefined }, valid: true },
    ],
  },
  {
    description: "optional-in value type - default",
    zodSchema: defaultedValueRecordZod,
    dnaSchema: defaultedValueRecordDna,
    tests: [
      { description: "valid partial with default fill", data: { Tuna: "asdf" }, valid: true },
    ],
  },
  {
    description: "optional-in value type - prefault",
    zodSchema: prefaultedValueRecordZod,
    dnaSchema: prefaultedValueRecordDna,
    tests: [
      { description: "valid partial with prefault fill", data: { Tuna: "asdf" }, valid: true },
    ],
  },
  {
    description: "optional-in value type - optional",
    zodSchema: optionalValueRecordZod,
    dnaSchema: optionalValueRecordDna,
    tests: [
      { description: "valid partial with optional", data: { Tuna: "asdf" }, valid: true },
    ],
  },
  {
    description: "optional-in value type - catch",
    zodSchema: caughtValueRecordZod,
    dnaSchema: caughtValueRecordDna,
    tests: [
      { description: "valid all keys", data: { Tuna: "asdf", Salmon: "asdf" }, valid: true },
      { description: "invalid missing key (catch does not make key optional)", data: { Tuna: "asdf" }, valid: false },
    ],
  },
  {
    description: "optional-in value type - preprocess",
    zodSchema: preprocessedValueRecordZod,
    dnaSchema: preprocessedValueRecordDna,
    tests: [
      { description: "valid all keys", data: { Tuna: "asdf", Salmon: "asdf" }, valid: true },
      { description: "invalid missing key (preprocess does not make key optional)", data: { Tuna: "asdf" }, valid: false },
    ],
  },
  {
    description: "typescript enum exhaustiveness - extra key and missing key",
    zodSchema: tsEnumExtraKeyZod,
    dnaSchema: tsEnumExtraKeyDna,
    tests: [
      { description: "invalid extra key", data: { [Enum.Tuna]: "asdf", [Enum.Salmon]: "asdf", Trout: "asdf" }, valid: false },
      { description: "invalid missing Salmon key", data: { [Enum.Tuna]: "asdf" }, valid: false },
      { description: "invalid missing Tuna key", data: { [Enum.Salmon]: "asdf" }, valid: false },
    ],
  },
  {
    description: "key and value getters",
    zodSchema: keyValueTypeRecordZod,
    dnaSchema: keyValueTypeRecordDna,
    tests: [
      { description: "valid record", data: { a: 1, b: 2 }, valid: true },
    ],
  },
  {
    description: "is not vulnerable to prototype pollution",
    zodSchema: protoPollutionRecordZod,
    dnaSchema: protoPollutionRecordDna,
    tests: [
      { description: "valid with __proto__ key (not polluted)", data: JSON.parse('{ "__proto__": { "a": "evil" }, "b": { "a": "good" } }'), valid: true },
    ],
  },
  {
    description: "key schema cannot normalize an input key into __proto__ - toLowerCase",
    zodSchema: protoKeyToLowerZod,
    dnaSchema: protoKeyToLowerDna,
    tests: [
      { description: "valid __PROTO__ normalized to __proto__ (skipped)", data: JSON.parse(JSON.stringify({ __PROTO__: { a: "evil" } })), valid: true },
    ],
  },
  {
    description: "key schema cannot normalize an input key into __proto__ - trim",
    zodSchema: protoKeyTrimZod,
    dnaSchema: protoKeyTrimDna,
    tests: [
      { description: "valid ' __proto__ ' trimmed to __proto__ (skipped)", data: JSON.parse(JSON.stringify({ " __proto__ ": { a: "evil" } })), valid: true },
    ],
  },
  {
    description: "key schema cannot normalize an input key into __proto__ - transform slice",
    zodSchema: protoKeyTransformZod,
    dnaSchema: protoKeyTransformDna,
    tests: [
      { description: "valid 'x:__proto__' sliced to __proto__ (skipped)", data: JSON.parse(JSON.stringify({ "x:__proto__": { a: "evil" } })), valid: true },
    ],
  },
  {
    description: "async parsing - valid",
    zodSchema: asyncRecordValidZod,
    dnaSchema: asyncRecordValidDna,
    tests: [
      { description: "valid async record", data: { foo: "bar", baz: "qux" }, valid: true },
    ],
  },
  {
    description: "async parsing - invalid",
    zodSchema: asyncRecordInvalidZod,
    dnaSchema: asyncRecordInvalidDna,
    tests: [
      { description: "invalid async record (refine fails)", data: { foo: "bar", baz: "qux" }, valid: false },
    ],
  },
  {
    description: "partialRecord with z.literal([key, ...])",
    zodSchema: partialRecordLiteralZod,
    dnaSchema: partialRecordLiteralDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid single key", data: { id: "1" }, valid: true },
      { description: "valid multiple keys", data: { name: "n", email: "e@example.com" }, valid: true },
      { description: "invalid unrecognized key", data: { foo: "bar" }, valid: false },
    ],
  },
  {
    description: "partialRecord with numeric literal keys",
    zodSchema: partialRecordNumericZod,
    dnaSchema: partialRecordNumericDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid single numeric key", data: { 1: "one" }, valid: true },
      { description: "valid multiple numeric keys", data: { 2: "two", 3: "three" }, valid: true },
      { description: "invalid unrecognized numeric key", data: { 4: "four" }, valid: false },
    ],
  },
  {
    description: "partialRecord with union of string and numeric literal keys",
    zodSchema: partialRecordUnionZod,
    dnaSchema: partialRecordUnionDna,
    tests: [
      { description: "valid empty", data: {}, valid: true },
      { description: "valid mixed keys", data: { a: "1", 2: "4" }, valid: true },
      { description: "valid all keys", data: { a: "a", b: "b", 1: "1", 2: "2" }, valid: true },
      { description: "invalid unrecognized string key", data: { d: "d" }, valid: false },
      { description: "invalid unrecognized numeric key", data: { 4: "4" }, valid: false },
    ],
  },
  {
    description: "looseRecord with closed key schema (enum) passes through unrecognized keys",
    zodSchema: looseRecordEnumAnyZod,
    dnaSchema: looseRecordEnumAnyDna,
    tests: [
      { description: "valid with unrecognized key", data: { foo: 123, bar: {}, baz: null }, valid: true },
    ],
  },
  {
    description: "looseRecord with closed key schema (literal) passes through unrecognized keys",
    zodSchema: looseRecordLiteralAnyZod,
    dnaSchema: looseRecordLiteralAnyDna,
    tests: [
      { description: "valid with unrecognized key", data: { foo: 123, bar: {}, baz: null }, valid: true },
    ],
  },
  {
    description: "looseRecord with closed key schema (enum, string values) passes through unrecognized keys",
    zodSchema: looseRecordEnumStringZod,
    dnaSchema: looseRecordEnumStringDna,
    tests: [
      { description: "valid with unrecognized key passing through", data: { foo: "ok", bar: "ok", baz: 123 }, valid: true },
      { description: "invalid wrong value type for recognized key", data: { foo: 123 }, valid: false },
    ],
  },
  {
    description: "record with closed key schema still rejects unrecognized keys",
    zodSchema: recordClosedKeyZod,
    dnaSchema: recordClosedKeyDna,
    tests: [
      { description: "invalid unrecognized key", data: { foo: 123, bar: {}, baz: null }, valid: false },
    ],
  },
];
