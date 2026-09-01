import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const basicCatchZod = z.string().catch("default");
const basicCatchDna = dna.string().catch("default");

const catchWithTransformZod = z
  .string()
  .transform((val) => val.toUpperCase())
  .catch("default");
const catchWithTransformDna = dna
  .string()
  .transform((val) => val.toUpperCase())
  .catch("default");

const catchOnExistingOptionalZod = z.string().optional().catch("asdf");
const catchOnExistingOptionalDna = dna.string().optional().catch("asdf");

const optionalOnCatchZod = z.string().catch("asdf").optional();
const optionalOnCatchDna = dna.string().catch("asdf").optional();

const removeCatchZod = z.string().catch("asdf").unwrap();
const removeCatchDna = dna.string().catch("asdf").unwrap();

const nestedCatchZod = z
  .object({ inner: z.string().catch("asdf") })
  .catch({ inner: "asdf" });
const nestedCatchDna = dna
  .object({ inner: dna.string().catch("asdf") })
  .catch({ inner: "asdf" });

const chainedCatchZod = z.string().catch("inner").catch("outer");
const chainedCatchDna = dna.string().catch("inner").catch("outer");

enum Fruits {
  apple = "apple",
  orange = "orange",
}
const nativeEnumCatchZod = z.object({
  fruit: z.nativeEnum(Fruits).catch(Fruits.apple),
});
const nativeEnumCatchDna = dna.object({
  fruit: dna.enum(["apple", "orange"]).catch("apple"),
});

const enumCatchZod = z.object({
  fruit: z.enum(["apple", "orange"]).catch("apple"),
});
const enumCatchDna = dna.object({
  fruit: dna.enum(["apple", "orange"]).catch("apple"),
});

const catchErrorZod = z.object({
  age: z.number(),
  name: z.string().catch("John Doe"),
});
const catchErrorDna = dna.object({
  age: dna.number(),
  name: dna.string().catch("John Doe"),
});

const ctxInputCatchZod = z.string().catch((ctx) => String(ctx.input));
const ctxInputCatchDna = dna.string().catch((ctx) => String(ctx.input));

const directionAwareCatchZod = z.string().catch("fallback");
const directionAwareCatchDna = dna.string().catch("fallback");

const optionalClobbersCatchTransformZod = z
  .string()
  .catch("X")
  .transform((s) => s + "!")
  .optional();
const optionalClobbersCatchTransformDna = dna
  .string()
  .catch("X")
  .transform((s) => s + "!")
  .optional();

const optionalClobbersCatchPipeZod = z
  .string()
  .catch("X")
  .pipe(z.string())
  .optional();
const optionalClobbersCatchPipeDna = dna
  .string()
  .catch("X")
  .pipe(dna.string())
  .optional();

const optionalClobbersCatchDoubleTransformZod = z
  .string()
  .catch("X")
  .transform((s) => s + "!")
  .transform((s) => s.toLowerCase())
  .optional();
const optionalClobbersCatchDoubleTransformDna = dna
  .string()
  .catch("X")
  .transform((s) => s + "!")
  .transform((s) => s.toLowerCase())
  .optional();

const optionalClobbersCatchObjectZod = z.object({
  a: z
    .string()
    .catch("X")
    .transform((s) => s + "!")
    .optional(),
});
const optionalClobbersCatchObjectDna = dna.object({
  a: dna
    .string()
    .catch("X")
    .transform((s) => s + "!")
    .optional(),
});

const optionalClobbersCatchValidValuesZod = z
  .string()
  .catch("X")
  .transform((s) => s + "!");
const optionalClobbersCatchValidValuesDna = dna
  .string()
  .catch("X")
  .transform((s) => s + "!");

export const catchTests = [
  {
    description: "basic catch",
    zodSchema: basicCatchZod,
    dnaSchema: basicCatchDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined uses catch", data: undefined, valid: true },
      { description: "valid number uses catch", data: 123, valid: true },
      { description: "valid boolean uses catch", data: true, valid: true },
      { description: "valid array uses catch", data: [], valid: true },
      { description: "valid map uses catch", data: new Map(), valid: true },
      { description: "valid set uses catch", data: new Set(), valid: true },
      { description: "valid object uses catch", data: {}, valid: true },
    ],
  },
  {
    description: "catch with transform",
    zodSchema: catchWithTransformZod,
    dnaSchema: catchWithTransformDna,
    tests: [
      { description: "valid undefined uses catch", data: undefined, valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
  {
    description: "catch on existing optional",
    zodSchema: catchOnExistingOptionalZod,
    dnaSchema: catchOnExistingOptionalDna,
    tests: [
      { description: "valid undefined", data: undefined, valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
  {
    description: "optional on catch",
    zodSchema: optionalOnCatchZod,
    dnaSchema: optionalOnCatchDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
    ],
  },
  {
    description: "catch replace wrong types",
    zodSchema: basicCatchZod,
    dnaSchema: basicCatchDna,
    tests: [
      { description: "valid boolean uses catch", data: true, valid: true },
      { description: "valid number uses catch", data: 15, valid: true },
      { description: "valid array uses catch", data: [], valid: true },
      { description: "valid map uses catch", data: new Map(), valid: true },
      { description: "valid set uses catch", data: new Set(), valid: true },
      { description: "valid object uses catch", data: {}, valid: true },
    ],
  },
  {
    description: "removeCatch",
    zodSchema: removeCatchZod,
    dnaSchema: removeCatchDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "invalid number", data: 123, valid: false },
    ],
  },
  {
    description: "nested",
    zodSchema: nestedCatchZod,
    dnaSchema: nestedCatchDna,
    tests: [
      { description: "valid undefined uses outer catch", data: undefined, valid: true },
      { description: "valid empty object uses inner catch", data: {}, valid: true },
      { description: "valid inner undefined uses inner catch", data: { inner: undefined }, valid: true },
    ],
  },
  {
    description: "chained catch",
    zodSchema: chainedCatchZod,
    dnaSchema: chainedCatchDna,
    tests: [
      { description: "valid undefined uses inner catch", data: undefined, valid: true },
      { description: "valid number uses inner catch", data: 5, valid: true },
    ],
  },
  {
    description: "native enum",
    zodSchema: nativeEnumCatchZod,
    dnaSchema: nativeEnumCatchDna,
    tests: [
      { description: "valid empty object uses catch", data: {}, valid: true },
      { description: "valid invalid fruit uses catch", data: { fruit: 15 }, valid: true },
    ],
  },
  {
    description: "enum",
    zodSchema: enumCatchZod,
    dnaSchema: enumCatchDna,
    tests: [
      { description: "valid empty object uses catch", data: {}, valid: true },
      { description: "valid boolean fruit uses catch", data: { fruit: true }, valid: true },
      { description: "valid number fruit uses catch", data: { fruit: 15 }, valid: true },
    ],
  },
  {
    description: "catch error",
    zodSchema: catchErrorZod,
    dnaSchema: catchErrorDna,
    tests: [
      { description: "invalid null age with null name", data: { age: null, name: null }, valid: false },
    ],
  },
  {
    description: "ctx.input",
    zodSchema: ctxInputCatchZod,
    dnaSchema: ctxInputCatchDna,
    tests: [
      { description: "valid number uses catch with ctx.input", data: 123, valid: true },
    ],
  },
  {
    description: "direction-aware catch",
    zodSchema: directionAwareCatchZod,
    dnaSchema: directionAwareCatchDna,
    tests: [
      { description: "valid number uses catch (forward)", data: 123, valid: true },
      { description: "valid string (forward)", data: "world", valid: true },
    ],
  },
  {
    description: "optional clobbers catch through pipe boundaries (transform + optional)",
    zodSchema: optionalClobbersCatchTransformZod,
    dnaSchema: optionalClobbersCatchTransformDna,
    tests: [
      { description: "valid undefined clobbers catch", data: undefined, valid: true },
    ],
  },
  {
    description: "optional clobbers catch through pipe boundaries (pipe + optional)",
    zodSchema: optionalClobbersCatchPipeZod,
    dnaSchema: optionalClobbersCatchPipeDna,
    tests: [
      { description: "valid undefined clobbers catch", data: undefined, valid: true },
    ],
  },
  {
    description: "optional clobbers catch through pipe boundaries (double transform + optional)",
    zodSchema: optionalClobbersCatchDoubleTransformZod,
    dnaSchema: optionalClobbersCatchDoubleTransformDna,
    tests: [
      { description: "valid undefined clobbers catch", data: undefined, valid: true },
    ],
  },
  {
    description: "optional clobbers catch through pipe boundaries (in object)",
    zodSchema: optionalClobbersCatchObjectZod,
    dnaSchema: optionalClobbersCatchObjectDna,
    tests: [
      { description: "valid empty object", data: {}, valid: true },
    ],
  },
  {
    description: "optional clobbers catch through pipe boundaries (valid values)",
    zodSchema: optionalClobbersCatchValidValuesZod,
    dnaSchema: optionalClobbersCatchValidValuesDna,
    tests: [
      { description: "valid string transforms", data: "hi", valid: true },
      { description: "valid number uses catch then transforms", data: 123, valid: true },
    ],
  },
];
