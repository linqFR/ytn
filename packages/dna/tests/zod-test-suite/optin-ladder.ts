import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod optin-ladder runtime tests
const objDefaultZod = z.object({ a: z.string().default("D") });
const objDefaultDna = dna.object({ a: dna.string().default("D") });

const objPrefaultZod = z.object({ a: z.string().prefault("P") });
const objPrefaultDna = dna.object({ a: dna.string().prefault("P") });

const objOptionalZod = z.object({ a: z.string().optional() });
const objOptionalDna = dna.object({ a: dna.string().optional() });

const objCatchZod = z.object({ a: z.string().catch("C") });
const objCatchDna = dna.object({ a: dna.string().catch("C") });

const objRequiredZod = z.object({ a: z.string() });
const objRequiredDna = dna.object({ a: dna.string() });

const objExactOptionalZod = z.object({ a: z.string().exactOptional() });
const objExactOptionalDna = dna.object({ a: dna.string().exactOptional() });

// Absent middle rung schemas
const coerceExactOptionalZod = z.object({ a: z.coerce.string().exactOptional() });
const coerceExactOptionalDna = dna.object({ a: dna.coerce.string().exactOptional() });

const catchExactOptionalZod = z.object({ a: z.string().catch("C").exactOptional() });
const catchExactOptionalDna = dna.object({ a: dna.string().catch("C").exactOptional() });

const preprocessExactOptionalZod = z.object({ a: z.preprocess((v: any) => v ?? "X", z.string()).exactOptional() });
const preprocessExactOptionalDna = dna.object({ a: dna.preprocess((v: any) => v ?? "X", dna.string()).exactOptional() });

const defaultExactOptionalZod = z.object({ a: z.string().default("D").exactOptional() });
const defaultExactOptionalDna = dna.object({ a: dna.string().default("D").exactOptional() });

const prefaultExactOptionalZod = z.object({ a: z.string().prefault("P").exactOptional() });
const prefaultExactOptionalDna = dna.object({ a: dna.string().prefault("P").exactOptional() });

const unionMiddleRungZod = z.object({ a: z.union([z.coerce.string(), z.string().optional()]) });
const unionMiddleRungDna = dna.object({ a: dna.union([dna.coerce.string(), dna.string().optional()]) });

const coerceStringZod = z.object({ a: z.coerce.string() });
const coerceStringDna = dna.object({ a: dna.coerce.string() });

// Tuple schemas
const tupleDefaultZod = z.tuple([z.string().default("D")]);
const tupleDefaultDna = dna.tuple([dna.string().default("D")]);

const tuplePrefaultZod = z.tuple([z.string().prefault("P")]);
const tuplePrefaultDna = dna.tuple([dna.string().prefault("P")]);

const tupleOptionalZod = z.tuple([z.string().optional()]);
const tupleOptionalDna = dna.tuple([dna.string().optional()]);

const tupleRequiredZod = z.tuple([z.string()]);
const tupleRequiredDna = dna.tuple([dna.string()]);

const tupleTwoSlotsZod = z.tuple([z.string(), z.number().default(1)]);
const tupleTwoSlotsDna = dna.tuple([dna.string(), dna.number().default(1)]);

const tupleCoerceExactOptionalZod = z.tuple([z.string(), z.coerce.string().exactOptional()]);
const tupleCoerceExactOptionalDna = dna.tuple([dna.string(), dna.coerce.string().exactOptional()]);

const tupleCatchExactOptionalZod = z.tuple([z.string(), z.string().catch("C").exactOptional()]);
const tupleCatchExactOptionalDna = dna.tuple([dna.string(), dna.string().catch("C").exactOptional()]);

const tupleDefaultExactOptionalZod = z.tuple([z.string(), z.string().default("D").exactOptional()]);
const tupleDefaultExactOptionalDna = dna.tuple([dna.string(), dna.string().default("D").exactOptional()]);

// Clobber invariant schemas
const preprocessOptionalZod = z.preprocess((v: any) => v ?? "X", z.string()).optional();
const preprocessOptionalDna = dna.preprocess((v: any) => v ?? "X", dna.string()).optional();

const catchOptionalZod = z.string().catch("X").optional();
const catchOptionalDna = dna.string().catch("X").optional();

const catchTransformOptionalZod = z.string().catch("X").transform((s: string) => `${s}!`).optional();
const catchTransformOptionalDna = dna.string().catch("X").transform((s: string) => `${s}!`).optional();

const transformOptionalZod = z.transform(() => "T").optional();
const transformOptionalDna = dna.transform(() => "T").optional();

const unionPreprocessOptionalZod = z.union([z.preprocess((v: any) => v ?? "X", z.string()), z.number()]).optional();
const unionPreprocessOptionalDna = dna.union([dna.preprocess((v: any) => v ?? "X", dna.string()), dna.number()]).optional();

const preprocessInObjectZod = z.object({ a: z.preprocess((v: any) => v ?? "X", z.string()) });
const preprocessInObjectDna = dna.object({ a: dna.preprocess((v: any) => v ?? "X", dna.string()) });

// Top rung survives wrappers
const defaultOptionalZod = z.string().default("D").optional();
const defaultOptionalDna = dna.string().default("D").optional();

const defaultDoubleOptionalZod = z.string().default("D").optional().optional();
const defaultDoubleOptionalDna = dna.string().default("D").optional().optional();

const defaultNullableOptionalZod = z.string().default("D").nullable().optional();
const defaultNullableOptionalDna = dna.string().default("D").nullable().optional();

const defaultReadonlyOptionalZod = z.string().default("D").readonly().optional();
const defaultReadonlyOptionalDna = dna.string().default("D").readonly().optional();

const defaultCatchOptionalZod = z.string().default("D").catch("C").optional();
const defaultCatchOptionalDna = dna.string().default("D").catch("C").optional();

const defaultPipeOptionalZod = z.string().default("D").pipe(z.string()).optional();
const defaultPipeOptionalDna = dna.string().default("D").pipe(dna.string()).optional();

const unionDefaultOptionalZod = z.union([z.string().default("D"), z.number()]).optional();
const unionDefaultOptionalDna = dna.union([dna.string().default("D"), dna.number()]).optional();

const lazyDefaultOptionalZod = z.lazy(() => z.string().default("D")).optional();
const lazyDefaultOptionalDna = dna.lazy(() => dna.string().default("D")).optional();

// Record and catchall paths
const recordDefaultZod = z.record(z.string(), z.string().default("D"));
const recordDefaultDna = dna.record(dna.string(), dna.string().default("D"));

const catchallDefaultZod = z.object({}).catchall(z.string().default("D"));
const catchallDefaultDna = dna.object({}).catchall(dna.string().default("D"));

export const optinLadderTests = [
  {
    description: "key-level admissibility - default",
    zodSchema: objDefaultZod,
    dnaSchema: objDefaultDna,
    tests: [
      { description: "empty object gets default", data: {}, valid: true },
    ],
  },
  {
    description: "key-level admissibility - prefault",
    zodSchema: objPrefaultZod,
    dnaSchema: objPrefaultDna,
    tests: [
      { description: "empty object gets prefault", data: {}, valid: true },
    ],
  },
  {
    description: "key-level admissibility - optional",
    zodSchema: objOptionalZod,
    dnaSchema: objOptionalDna,
    tests: [
      { description: "empty object is valid", data: {}, valid: true },
    ],
  },
  {
    description: "key-level admissibility - catch",
    zodSchema: objCatchZod,
    dnaSchema: objCatchDna,
    tests: [
      { description: "empty object gets catch value", data: {}, valid: true },
    ],
  },
  {
    description: "key-level admissibility - required rejects",
    zodSchema: objRequiredZod,
    dnaSchema: objRequiredDna,
    tests: [
      { description: "empty object is invalid", data: {}, valid: false },
    ],
  },
  {
    description: "exactOptional keeps its distinct meaning",
    zodSchema: objExactOptionalZod,
    dnaSchema: objExactOptionalDna,
    tests: [
      { description: "empty object is valid (absent key)", data: {}, valid: true },
      { description: "explicit undefined is invalid", data: { a: undefined }, valid: false },
    ],
  },
  {
    description: "absent middle rung - coerce exactOptional",
    zodSchema: coerceExactOptionalZod,
    dnaSchema: coerceExactOptionalDna,
    tests: [
      { description: "empty object stays empty", data: {}, valid: true },
    ],
  },
  {
    description: "absent middle rung - catch exactOptional",
    zodSchema: catchExactOptionalZod,
    dnaSchema: catchExactOptionalDna,
    tests: [
      { description: "empty object stays empty", data: {}, valid: true },
    ],
  },
  {
    description: "absent middle rung - preprocess exactOptional",
    zodSchema: preprocessExactOptionalZod,
    dnaSchema: preprocessExactOptionalDna,
    tests: [
      { description: "empty object stays empty", data: {}, valid: true },
    ],
  },
  {
    description: "absent middle rung - default exactOptional substitutes",
    zodSchema: defaultExactOptionalZod,
    dnaSchema: defaultExactOptionalDna,
    tests: [
      { description: "empty object gets default", data: {}, valid: true },
    ],
  },
  {
    description: "absent middle rung - prefault exactOptional substitutes",
    zodSchema: prefaultExactOptionalZod,
    dnaSchema: prefaultExactOptionalDna,
    tests: [
      { description: "empty object gets prefault", data: {}, valid: true },
    ],
  },
  {
    description: "absent middle rung - union middle rung",
    zodSchema: unionMiddleRungZod,
    dnaSchema: unionMiddleRungDna,
    tests: [
      { description: "empty object stays empty", data: {}, valid: true },
    ],
  },
  {
    description: "coerce string with undefined input",
    zodSchema: coerceStringZod,
    dnaSchema: coerceStringDna,
    tests: [
      { description: "undefined coerced to string", data: { a: undefined }, valid: true },
    ],
  },
  {
    description: "tuple minimum length - default",
    zodSchema: tupleDefaultZod,
    dnaSchema: tupleDefaultDna,
    tests: [
      { description: "empty array gets default", data: [], valid: true },
    ],
  },
  {
    description: "tuple minimum length - prefault",
    zodSchema: tuplePrefaultZod,
    dnaSchema: tuplePrefaultDna,
    tests: [
      { description: "empty array gets prefault", data: [], valid: true },
    ],
  },
  {
    description: "tuple minimum length - optional",
    zodSchema: tupleOptionalZod,
    dnaSchema: tupleOptionalDna,
    tests: [
      { description: "empty array is valid", data: [], valid: true },
    ],
  },
  {
    description: "tuple minimum length - required rejects",
    zodSchema: tupleRequiredZod,
    dnaSchema: tupleRequiredDna,
    tests: [
      { description: "empty array is invalid", data: [], valid: false },
    ],
  },
  {
    description: "tuple two slots with default",
    zodSchema: tupleTwoSlotsZod,
    dnaSchema: tupleTwoSlotsDna,
    tests: [
      { description: "single element gets default for second", data: ["x"], valid: true },
    ],
  },
  {
    description: "tuple absent slot - coerce exactOptional truncates",
    zodSchema: tupleCoerceExactOptionalZod,
    dnaSchema: tupleCoerceExactOptionalDna,
    tests: [
      { description: "single element truncates tail", data: ["x"], valid: true },
    ],
  },
  {
    description: "tuple absent slot - catch exactOptional truncates",
    zodSchema: tupleCatchExactOptionalZod,
    dnaSchema: tupleCatchExactOptionalDna,
    tests: [
      { description: "single element truncates tail", data: ["x"], valid: true },
    ],
  },
  {
    description: "tuple absent slot - default exactOptional fills",
    zodSchema: tupleDefaultExactOptionalZod,
    dnaSchema: tupleDefaultExactOptionalDna,
    tests: [
      { description: "single element fills default", data: ["x"], valid: true },
    ],
  },
  {
    description: "clobber invariant - preprocess optional on undefined",
    zodSchema: preprocessOptionalZod,
    dnaSchema: preprocessOptionalDna,
    tests: [
      { description: "undefined stays undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "clobber invariant - catch optional on undefined",
    zodSchema: catchOptionalZod,
    dnaSchema: catchOptionalDna,
    tests: [
      { description: "undefined stays undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "clobber invariant - catch transform optional on undefined",
    zodSchema: catchTransformOptionalZod,
    dnaSchema: catchTransformOptionalDna,
    tests: [
      { description: "undefined stays undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "clobber invariant - transform optional on undefined",
    zodSchema: transformOptionalZod,
    dnaSchema: transformOptionalDna,
    tests: [
      { description: "undefined stays undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "clobber invariant - union preprocess optional on undefined",
    zodSchema: unionPreprocessOptionalZod,
    dnaSchema: unionPreprocessOptionalDna,
    tests: [
      { description: "undefined stays undefined", data: undefined, valid: true },
    ],
  },
  {
    description: "clobber invariant - preprocess in object fills default",
    zodSchema: preprocessInObjectZod,
    dnaSchema: preprocessInObjectDna,
    tests: [
      { description: "empty object gets preprocess default", data: {}, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default optional",
    zodSchema: defaultOptionalZod,
    dnaSchema: defaultOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default double optional",
    zodSchema: defaultDoubleOptionalZod,
    dnaSchema: defaultDoubleOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default nullable optional",
    zodSchema: defaultNullableOptionalZod,
    dnaSchema: defaultNullableOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default readonly optional",
    zodSchema: defaultReadonlyOptionalZod,
    dnaSchema: defaultReadonlyOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default catch optional",
    zodSchema: defaultCatchOptionalZod,
    dnaSchema: defaultCatchOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - default pipe optional",
    zodSchema: defaultPipeOptionalZod,
    dnaSchema: defaultPipeOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - union default optional",
    zodSchema: unionDefaultOptionalZod,
    dnaSchema: unionDefaultOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "top rung survives wrappers - lazy default optional",
    zodSchema: lazyDefaultOptionalZod,
    dnaSchema: lazyDefaultOptionalDna,
    tests: [
      { description: "undefined gets default", data: undefined, valid: true },
    ],
  },
  {
    description: "record and catchall paths - record with default value",
    zodSchema: recordDefaultZod,
    dnaSchema: recordDefaultDna,
    tests: [
      { description: "undefined value gets default", data: { k: undefined }, valid: true },
    ],
  },
  {
    description: "record and catchall paths - catchall with default",
    zodSchema: catchallDefaultZod,
    dnaSchema: catchallDefaultDna,
    tests: [
      { description: "undefined value gets default", data: { x: undefined }, valid: true },
    ],
  },
];
