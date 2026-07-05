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
];
