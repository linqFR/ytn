import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const testTupleZod = z.tuple([z.string(), z.number()]);
const testTupleDna = dna.tuple([dna.string(), dna.number()]);

const asyncTupleZod = z
  .tuple([z.string().refine(async () => true), z.number().refine(async () => true)])
  .refine(async () => true);
const asyncTupleDna = dna
  .tuple([dna.string().refine(async () => true), dna.number().refine(async () => true)])
  .refine(async () => true);

// Tuple with rest (Zod v4 supports .rest(), DNA supports both 2nd arg and .rest() method)
const restTupleZod = z.tuple([z.string()]).rest(z.number());
const restTupleDna = dna.tuple([dna.string()]).rest(dna.number());

// Tuple with min/max/length constraints (DNA advantage — Zod v4 tuples don't have these)
const minTupleDna = dna.tuple([dna.string()]).rest(dna.number()).min(3);
const maxTupleDna = dna.tuple([dna.string()]).rest(dna.number()).max(3);
const lengthTupleDna = dna.tuple([dna.string()]).rest(dna.number()).length(3);

export const tupleTests = [
  {
    description: "successful validation",
    zodSchema: testTupleZod,
    dnaSchema: testTupleDna,
    tests: [
      { description: "valid tuple", data: ["asdf", 1234], valid: true },
      { description: "invalid wrong type at index 1", data: ["asdf", "asdf"], valid: false },
      { description: "invalid too many items", data: ["asdf", 1234, true], valid: false },
      { description: "invalid not array", data: {}, valid: false },
    ],
  },
  {
    description: "async validation",
    zodSchema: asyncTupleZod,
    dnaSchema: asyncTupleDna,
    tests: [
      { description: "valid tuple", data: ["asdf", 1234], valid: true },
      { description: "invalid wrong type at index 1", data: ["asdf", "asdf"], valid: false },
      { description: "invalid too many items", data: ["asdf", 1234, true], valid: false },
    ],
  },
  {
    description: "tuple with rest",
    zodSchema: restTupleZod,
    dnaSchema: restTupleDna,
    tests: [
      { description: "valid prefix only", data: ["a"], valid: true },
      { description: "valid prefix + rest items", data: ["a", 1, 2, 3], valid: true },
      { description: "invalid rest item type", data: ["a", "b"], valid: false },
      { description: "invalid empty array", data: [], valid: false },
    ],
  },
  {
    description: "tuple with rest + min constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: minTupleDna,
    tests: [
      { description: "valid: 3 items (prefix + 2 rest)", data: ["a", 1, 2], valid: true },
      { description: "valid: 4 items (prefix + 3 rest)", data: ["a", 1, 2, 3], valid: true },
      { description: "invalid: only 2 items (below min)", data: ["a", 1], valid: false },
      { description: "invalid: only prefix (below min)", data: ["a"], valid: false },
    ],
  },
  {
    description: "tuple with rest + max constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: maxTupleDna,
    tests: [
      { description: "valid: prefix only", data: ["a"], valid: true },
      { description: "valid: 3 items (at max)", data: ["a", 1, 2], valid: true },
      { description: "invalid: 4 items (above max)", data: ["a", 1, 2, 3], valid: false },
    ],
  },
  {
    description: "tuple with rest + length constraint (DNA advantage)",
    zodSchema: null,
    dnaSchema: lengthTupleDna,
    tests: [
      { description: "valid: exactly 3 items", data: ["a", 1, 2], valid: true },
      { description: "invalid: 2 items", data: ["a", 1], valid: false },
      { description: "invalid: 4 items", data: ["a", 1, 2, 3], valid: false },
    ],
  },
  {
    description: "tuple with optional elements",
    zodSchema: z.tuple([z.string(), z.number().optional(), z.string().optional()]).rest(z.boolean()),
    dnaSchema: dna.tuple([dna.string(), dna.number().optional(), dna.string().optional()]).rest(dna.boolean()),
    tests: [
      { description: "valid prefix only", data: ["asdf"], valid: true },
      { description: "valid prefix + number", data: ["asdf", 1234], valid: true },
      { description: "valid prefix + number + string", data: ["asdf", 1234, "asdf"], valid: true },
      { description: "valid prefix + rest items", data: ["asdf", 1234, "asdf", true, false, true], valid: true },
      { description: "invalid wrong type at index 1", data: ["asdf", "asdf"], valid: false },
      { description: "invalid wrong rest type", data: ["asdf", 1234, "asdf", "asdf"], valid: false },
      { description: "invalid wrong rest type at end", data: ["asdf", 1234, "asdf", true, false, "asdf"], valid: false },
    ],
  },
  {
    description: "tuple with optional elements followed by required",
    zodSchema: z.tuple([z.string(), z.number().optional(), z.string()]).rest(z.boolean()),
    dnaSchema: dna.tuple([dna.string(), dna.number().optional(), dna.string()]).rest(dna.boolean()),
    tests: [
      { description: "valid all required elements", data: ["asdf", 1234, "asdf"], valid: true },
      { description: "valid with rest items", data: ["asdf", 1234, "asdf", true, false, true], valid: true },
      { description: "invalid missing required string", data: ["asdf"], valid: false },
      { description: "invalid missing required string after optional", data: ["asdf", 1234], valid: false },
      { description: "invalid wrong rest type", data: ["asdf", 1234, "asdf", "asdf"], valid: false },
      { description: "invalid wrong rest type at end", data: ["asdf", 1234, "asdf", true, false, "asdf"], valid: false },
    ],
  },
  {
    description: "tuple with all optional elements",
    zodSchema: z.tuple([z.string().optional(), z.number().optional(), z.boolean().optional()]),
    dnaSchema: dna.tuple([dna.string().optional(), dna.number().optional(), dna.boolean().optional()]),
    tests: [
      { description: "valid empty array", data: [], valid: true },
      { description: "valid partial - one element", data: ["hello"], valid: true },
      { description: "valid partial - two elements", data: ["hello", 42], valid: true },
      { description: "valid full array", data: ["hello", 42, true], valid: true },
      { description: "invalid too long", data: ["hello", 42, true, "extra"], valid: false },
    ],
  },
  {
    description: "tuple fills defaults for missing trailing elements",
    zodSchema: z.tuple([z.string(), z.string().default("bravo")]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("bravo")]),
    tests: [
      { description: "valid both elements", data: ["alpha", "charlie"], valid: true },
      { description: "valid missing trailing default", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple fills multiple trailing defaults",
    zodSchema: z.tuple([z.string(), z.number().default(42), z.boolean().default(true)]),
    dnaSchema: dna.tuple([dna.string(), dna.number().default(42), dna.boolean().default(true)]),
    tests: [
      { description: "valid only first", data: ["hello"], valid: true },
      { description: "valid first two", data: ["hello", 100], valid: true },
      { description: "valid all three", data: ["hello", 100, false], valid: true },
    ],
  },
  {
    description: "tuple fills prefault for missing trailing element",
    zodSchema: z.tuple([z.string(), z.string().prefault("delta")]),
    dnaSchema: dna.tuple([dna.string(), dna.string().prefault("delta")]),
    tests: [
      { description: "valid missing trailing prefault", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple fills default wrapped in nullable for missing trailing element",
    zodSchema: z.tuple([z.string(), z.string().default("x").nullable()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("x").nullable()]),
    tests: [
      { description: "valid missing trailing nullable default", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple fills default wrapped in readonly for missing trailing element",
    zodSchema: z.tuple([z.string(), z.string().default("x").readonly()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("x").readonly()]),
    tests: [
      { description: "valid missing trailing readonly default", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple fills default wrapped in catch for missing trailing element",
    zodSchema: z.tuple([z.string(), z.string().default("x").catch("y")]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("x").catch("y")]),
    tests: [
      { description: "valid missing trailing catch default", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple fills default wrapped in pipe for missing trailing element",
    zodSchema: z.tuple([z.string(), z.string().default("x").pipe(z.string())]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("x").pipe(dna.string())]),
    tests: [
      { description: "valid missing trailing pipe default", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple keeps length-1 array for missing .optional() elements",
    zodSchema: z.tuple([z.string(), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().optional()]),
    tests: [
      { description: "valid single element (optional omitted)", data: ["alpha"], valid: true },
      { description: "valid two elements", data: ["alpha", "beta"], valid: true },
      { description: "valid explicit undefined preserved", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple with z.undefined() requires explicit undefined",
    zodSchema: z.tuple([z.string(), z.undefined()]),
    dnaSchema: dna.tuple([dna.string(), dna.undefined()]),
    tests: [
      { description: "invalid missing required undefined slot", data: ["alpha"], valid: false },
      { description: "valid explicit undefined", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple with optional().nullable() trims missing trailing",
    zodSchema: z.tuple([z.string(), z.string().optional().nullable()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().optional().nullable()]),
    tests: [
      { description: "valid single element (optional nullable omitted)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple with multiple trailing optionals trims",
    zodSchema: z.tuple([z.string(), z.string().optional(), z.string().optional(), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().optional(), dna.string().optional(), dna.string().optional()]),
    tests: [
      { description: "valid single element", data: ["alpha"], valid: true },
      { description: "valid two elements", data: ["alpha", "beta"], valid: true },
      { description: "valid explicit undefined preserved", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple trailing optionals after default are trimmed",
    zodSchema: z.tuple([z.string(), z.string().default("d"), z.string().optional(), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("d"), dna.string().optional(), dna.string().optional()]),
    tests: [
      { description: "valid single element (default fills, optionals trimmed)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple result is dense when optional precedes a default",
    zodSchema: z.tuple([z.string(), z.string().optional(), z.string().default("z")]),
    dnaSchema: dna.tuple([dna.string(), dna.string().optional(), dna.string().default("z")]),
    tests: [
      { description: "valid single element (optional=undefined, default fills)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple trailing optional after default is dropped",
    zodSchema: z.tuple([z.string(), z.string().default("d"), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().default("d"), dna.string().optional()]),
    tests: [
      { description: "valid single element (default fills, optional dropped)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple interleaved optional/default — all slots dense",
    zodSchema: z.tuple([
      z.string(),
      z.string().optional(),
      z.string().default("d"),
      z.string().optional(),
      z.string().default("e"),
    ]),
    dnaSchema: dna.tuple([
      dna.string(),
      dna.string().optional(),
      dna.string().default("d"),
      dna.string().optional(),
      dna.string().default("e"),
    ]),
    tests: [
      { description: "valid single element (interleaved defaults fill)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple truncates absent optional rejections only when output tail is optional",
    zodSchema: z.tuple([
      z.string(),
      z.string().optional().refine((s) => s !== undefined, "must not be undefined"),
      z.string().default("d"),
    ]),
    dnaSchema: dna.tuple([
      dna.string(),
      dna.string().optional().refine((s) => s !== undefined, "must not be undefined"),
      dna.string().default("d"),
    ]),
    tests: [
      { description: "invalid absent optional before required default output", data: ["alpha"], valid: false },
    ],
  },
  {
    description: "tuple optional before rejected slot cannot hide later required",
    zodSchema: z.tuple([
      z.string(),
      z.string().optional(),
      z.string().optional().refine((s) => s !== undefined, "must not be undefined"),
      z.string().default("d"),
    ]),
    dnaSchema: dna.tuple([
      dna.string(),
      dna.string().optional(),
      dna.string().optional().refine((s) => s !== undefined, "must not be undefined"),
      dna.string().default("d"),
    ]),
    tests: [
      { description: "invalid optional before rejected required", data: ["alpha"], valid: false },
    ],
  },
  {
    description: "tuple no trailing default — truncate applies for rejected optional",
    zodSchema: z.tuple([
      z.string(),
      z.string().optional().refine((s) => s !== undefined, "must not be undefined"),
    ]),
    dnaSchema: dna.tuple([
      dna.string(),
      dna.string().optional().refine((s) => s !== undefined, "must not be undefined"),
    ]),
    tests: [
      { description: "valid absent optional truncated (no trailing default)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple rejects absent exact optional before defaulted output",
    zodSchema: z.tuple([z.string(), z.string().exactOptional(), z.string().default("fallback")]),
    dnaSchema: dna.tuple([dna.string(), dna.string().exactOptional(), dna.string().default("fallback")]),
    tests: [
      { description: "invalid missing exact optional before default", data: ["alpha"], valid: false },
      { description: "valid exact optional provided", data: ["alpha", "bravo"], valid: true },
      { description: "invalid explicit undefined for exact optional", data: ["alpha", undefined], valid: false },
    ],
  },
  {
    description: "tuple exact optional with no later required — truncates cleanly",
    zodSchema: z.tuple([z.string(), z.string().exactOptional(), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().exactOptional(), dna.string().optional()]),
    tests: [
      { description: "valid single element (exact optional truncated)", data: ["alpha"], valid: true },
    ],
  },
  {
    description: "tuple preserves explicit undefined inside input for or-undefined",
    zodSchema: z.tuple([z.string(), z.string().or(z.undefined())]),
    dnaSchema: dna.tuple([dna.string(), dna.string().or(dna.undefined())]),
    tests: [
      { description: "valid explicit undefined preserved", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple preserves explicit undefined inside input for optional",
    zodSchema: z.tuple([z.string(), z.string().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().optional()]),
    tests: [
      { description: "valid explicit undefined preserved", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple preserves explicit undefined inside input for z.undefined()",
    zodSchema: z.tuple([z.string(), z.undefined()]),
    dnaSchema: dna.tuple([dna.string(), dna.undefined()]),
    tests: [
      { description: "valid explicit undefined preserved", data: ["alpha", undefined], valid: true },
    ],
  },
  {
    description: "tuple preserves mid-tuple explicit undefined",
    zodSchema: z.tuple([z.string(), z.string().or(z.undefined()), z.string()]),
    dnaSchema: dna.tuple([dna.string(), dna.string().or(dna.undefined()), dna.string()]),
    tests: [
      { description: "valid mid-tuple undefined surrounded by defined", data: ["alpha", undefined, "gamma"], valid: true },
    ],
  },
  {
    description: "tuple does NOT break when a required slot fails past input length",
    zodSchema: z.tuple([z.string(), z.string()]),
    dnaSchema: dna.tuple([dna.string(), dna.string()]),
    tests: [
      { description: "invalid too short (required slot missing)", data: ["alpha"], valid: false },
    ],
  },
  {
    description: "sparse array input",
    zodSchema: z.tuple([z.string(), z.number()]),
    dnaSchema: dna.tuple([dna.string(), dna.number()]),
    tests: [
      { description: "invalid sparse array", data: new Array(2), valid: false },
    ],
  },
  {
    description: "under-length tuple emits too_small with optStart minimum",
    zodSchema: z.tuple([z.string(), z.string()]),
    dnaSchema: dna.tuple([dna.string(), dna.string()]),
    tests: [
      { description: "invalid one element (all required)", data: ["a"], valid: false },
      { description: "invalid empty array (all required)", data: [], valid: false },
    ],
  },
  {
    description: "under-length tuple with trailing optional emits too_small",
    zodSchema: z.tuple([z.string(), z.number().optional()]),
    dnaSchema: dna.tuple([dna.string(), dna.number().optional()]),
    tests: [
      { description: "invalid empty array (trailing optional)", data: [], valid: false },
    ],
  },
  {
    description: "under-length tuple with interior optional emits too_small",
    zodSchema: z.tuple([z.string(), z.number().optional(), z.string()]),
    dnaSchema: dna.tuple([dna.string(), dna.number().optional(), dna.string()]),
    tests: [
      { description: "invalid two elements (interior optional, missing required)", data: ["a", 1], valid: false },
    ],
  },
  {
    description: "too_big tuple still surfaces element-wise type errors",
    zodSchema: z.tuple([z.string(), z.number()]),
    dnaSchema: dna.tuple([dna.string(), dna.number()]),
    tests: [
      { description: "invalid too big with wrong types", data: [1, "x", "extra"], valid: false },
    ],
  },
  {
    description: "partial",
    zodSchema: z.tuple([z.string(), z.number(), z.boolean()]).partial(),
    dnaSchema: dna.tuple([dna.string().optional(), dna.number().optional(), dna.boolean().optional()]),
    tests: [
      { description: "valid empty array", data: [], valid: true },
      { description: "valid one element", data: ["a"], valid: true },
      { description: "valid all elements", data: ["a", 1, true], valid: true },
      { description: "invalid wrong type at index 1", data: ["a", "b"], valid: false },
      { description: "invalid too many items", data: ["a", 1, true, 4], valid: false },
    ],
  },
  {
    description: "partial leaves rest alone",
    zodSchema: z.tuple([z.string()], z.number()).partial(),
    dnaSchema: dna.tuple([dna.string().optional()]).rest(dna.number()),
    tests: [
      { description: "valid empty array", data: [], valid: true },
      { description: "valid with rest items", data: ["a", 1, 2], valid: true },
      { description: "invalid undefined in rest (not optional)", data: ["a", undefined], valid: false },
    ],
  },
];
