import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const basicDefaultZod = z.string().default("default");
const basicDefaultDna = dna.string().default("default");

const defaultWithOptionalZod = z.string().optional().default("default");
const defaultWithOptionalDna = dna.string().optional().default("default");

const defaultWithTransformZod = z
  .string()
  .transform((val) => val.toUpperCase())
  .default("default");
const defaultWithTransformDna = dna
  .string()
  .transform((val) => val.toUpperCase())
  .default("default");

const defaultOnExistingOptionalZod = z.string().optional().default("asdf");
const defaultOnExistingOptionalDna = dna.string().optional().default("asdf");

const optionalOnDefaultZod = z.string().default("asdf").optional();
const optionalOnDefaultDna = dna.string().default("asdf").optional();

const stringWithRemovedDefaultZod = z.string().default("asdf").removeDefault();
const stringWithRemovedDefaultDna = dna.string().default("asdf").removeDefault();

const applyDefaultAtOutputZod = z
  .string()
  .transform((_) => (Math.random() > 0 ? undefined : _))
  .default("asdf");
const applyDefaultAtOutputDna = dna
  .string()
  .transform((_) => (Math.random() > 0 ? undefined : _))
  .default("asdf");

const nestedDefaultZod = z.object({ inner: z.string().default("asdf") }).default({
  inner: "qwer",
});
const nestedDefaultDna = dna.object({ inner: dna.string().default("asdf") }).default({
  inner: "qwer",
});

const chainedDefaultsZod = z.string().default("inner").default("outer");
const chainedDefaultsDna = dna.string().default("inner").default("outer");

const objectOptionalityZod = z.object({
  hi: z.string().default("hi"),
});
const objectOptionalityDna = dna.object({
  hi: dna.string().default("hi"),
});

const nestedPrefaultDefaultZod = z.object({
  a: z
    .string()
    .default("a")
    .refine((val) => val.startsWith("a")),
  b: z
    .string()
    .refine((val) => val.startsWith("b"))
    .default("b"),
  c: z
    .string()
    .prefault("c")
    .refine((val) => val.startsWith("c")),
  d: z
    .string()
    .refine((val) => val.startsWith("d"))
    .prefault("d"),
});
const nestedPrefaultDefaultDna = dna.object({
  a: dna
    .string()
    .default("a")
    .refine((val) => val.startsWith("a")),
  b: dna
    .string()
    .refine((val) => val.startsWith("b"))
    .default("b"),
  c: dna
    .string()
    .prefault("c")
    .refine((val) => val.startsWith("c")),
  d: dna
    .string()
    .refine((val) => val.startsWith("d"))
    .prefault("d"),
});

const failingDefaultZod = z.object({
  a: z
    .string()
    .default("z")
    .refine((val) => val.startsWith("a")),
  b: z
    .string()
    .refine((val) => val.startsWith("b"))
    .default("z"),
  c: z
    .string()
    .prefault("z")
    .refine((val) => val.startsWith("c")),
  d: z
    .string()
    .refine((val) => val.startsWith("d"))
    .prefault("z"),
});
const failingDefaultDna = dna.object({
  a: dna
    .string()
    .default("z")
    .refine((val) => val.startsWith("a")),
  b: dna
    .string()
    .refine((val) => val.startsWith("b"))
    .default("z"),
  c: dna
    .string()
    .prefault("z")
    .refine((val) => val.startsWith("c")),
  d: dna
    .string()
    .refine((val) => val.startsWith("d"))
    .prefault("z"),
});

const partialNoClobberZod = z
  .object({
    a: z.string().default("defaultA"),
    b: z.string().default("defaultB"),
    c: z.string().default("defaultC"),
  })
  .partial();
const partialNoClobberDna = dna
  .object({
    a: dna.string().default("defaultA"),
    b: dna.string().default("defaultB"),
    c: dna.string().default("defaultC"),
  })
  .partial();

const defaultedObjectCloneZod = z
  .object({ a: z.string() })
  .default({ a: "x" });
const defaultedObjectCloneDna = dna
  .object({ a: dna.string() })
  .default({ a: "x" });

const defaultedArrayCloneZod = z.array(z.string()).default(["x"]);
const defaultedArrayCloneDna = dna.array(dna.string()).default(["x"]);

const defaultedMapCloneZod = z
  .map(z.string(), z.number())
  .default(new Map([["a", 1]]));
const defaultedMapCloneDna = dna
  .map(dna.string(), dna.number())
  .default(new Map([["a", 1]]));

const defaultedSetCloneZod = z.set(z.string()).default(new Set(["x"]));
const defaultedSetCloneDna = dna.set(dna.string()).default(new Set(["x"]));

const directionAwareDefaultZod = z.string().default("hello");
const directionAwareDefaultDna = dna.string().default("hello");

const defaultFactoryOnceZod = z.object({
  a: z.string().default(() => "d"),
});
const defaultFactoryOnceDna = dna.object({
  a: dna.string().default(() => "d"),
});

const prefaultFactoryOnceZod = z.object({
  a: z.string().prefault(() => "d"),
});
const prefaultFactoryOnceDna = dna.object({
  a: dna.string().prefault(() => "d"),
});

export const defaultTests = [
  {
    description: "basic defaults",
    zodSchema: basicDefaultZod,
    dnaSchema: basicDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default with optional",
    zodSchema: defaultWithOptionalZod,
    dnaSchema: defaultWithOptionalDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default with transform",
    zodSchema: defaultWithTransformZod,
    dnaSchema: defaultWithTransformDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "default on existing optional",
    zodSchema: defaultOnExistingOptionalZod,
    dnaSchema: defaultOnExistingOptionalDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "optional on default",
    zodSchema: optionalOnDefaultZod,
    dnaSchema: optionalOnDefaultDna,
    tests: [
      { description: "valid undefined uses default", data: undefined, valid: true },
    ],
  },
  {
    description: "removeDefault",
    zodSchema: stringWithRemovedDefaultZod,
    dnaSchema: stringWithRemovedDefaultDna,
    tests: [
      { description: "valid string", data: "hello", valid: true },
    ],
  },
  {
    description: "apply default at output",
    zodSchema: applyDefaultAtOutputZod,
    dnaSchema: applyDefaultAtOutputDna,
    tests: [
      { description: "valid string", data: "", valid: true },
    ],
  },
  {
    description: "nested",
    zodSchema: nestedDefaultZod,
    dnaSchema: nestedDefaultDna,
    tests: [
      { description: "valid undefined uses outer default", data: undefined, valid: true },
      { description: "valid empty object uses inner default", data: {}, valid: true },
      { description: "valid inner undefined uses inner default", data: { inner: undefined }, valid: true },
    ],
  },
  {
    description: "chained defaults",
    zodSchema: chainedDefaultsZod,
    dnaSchema: chainedDefaultsDna,
    tests: [
      { description: "valid undefined uses outer default", data: undefined, valid: true },
    ],
  },
  {
    description: "object optionality",
    zodSchema: objectOptionalityZod,
    dnaSchema: objectOptionalityDna,
    tests: [
      { description: "valid empty object uses default", data: {}, valid: true },
    ],
  },
  {
    description: "nested prefault/default",
    zodSchema: nestedPrefaultDefaultZod,
    dnaSchema: nestedPrefaultDefaultDna,
    tests: [
      { description: "valid all provided", data: { a: "a1", b: "b1", c: "c1", d: "d1" }, valid: true },
      { description: "invalid all fail refine", data: { a: "f", b: "f", c: "f", d: "f" }, valid: false },
      { description: "valid empty object uses defaults", data: {}, valid: true },
      { description: "valid all undefined uses defaults", data: { a: undefined, b: undefined, c: undefined, d: undefined }, valid: true },
    ],
  },
  {
    description: "failing default",
    zodSchema: failingDefaultZod,
    dnaSchema: failingDefaultDna,
    tests: [
      { description: "invalid all undefined with failing defaults", data: { a: undefined, b: undefined, c: undefined, d: undefined }, valid: false },
    ],
  },
  {
    description: "partial should not clobber defaults",
    zodSchema: partialNoClobberZod,
    dnaSchema: partialNoClobberDna,
    tests: [
      { description: "valid empty object uses defaults", data: {}, valid: true },
    ],
  },
  {
    description: "defaulted object schema returns shallow clone",
    zodSchema: defaultedObjectCloneZod,
    dnaSchema: defaultedObjectCloneDna,
    tests: [
      { description: "valid undefined returns clone", data: undefined, valid: true },
    ],
  },
  {
    description: "defaulted array schema returns shallow clone",
    zodSchema: defaultedArrayCloneZod,
    dnaSchema: defaultedArrayCloneDna,
    tests: [
      { description: "valid undefined returns clone", data: undefined, valid: true },
    ],
  },
  {
    description: "defaulted Map schema returns shallow clone",
    zodSchema: defaultedMapCloneZod,
    dnaSchema: defaultedMapCloneDna,
    tests: [
      { description: "valid undefined returns clone", data: undefined, valid: true },
    ],
  },
  {
    description: "defaulted Set schema returns shallow clone",
    zodSchema: defaultedSetCloneZod,
    dnaSchema: defaultedSetCloneDna,
    tests: [
      { description: "valid undefined returns clone", data: undefined, valid: true },
    ],
  },
  {
    description: "direction-aware defaults",
    zodSchema: directionAwareDefaultZod,
    dnaSchema: directionAwareDefaultDna,
    tests: [
      { description: "valid undefined uses default (forward)", data: undefined, valid: true },
      { description: "valid string (forward)", data: "hello", valid: true },
    ],
  },
  {
    description: "default factory runs once per parse inside a container",
    zodSchema: defaultFactoryOnceZod,
    dnaSchema: defaultFactoryOnceDna,
    tests: [
      { description: "valid empty object triggers factory", data: {}, valid: true },
      { description: "valid given value skips factory", data: { a: "given" }, valid: true },
    ],
  },
  {
    description: "prefault factory runs once per parse inside a container",
    zodSchema: prefaultFactoryOnceZod,
    dnaSchema: prefaultFactoryOnceDna,
    tests: [
      { description: "valid empty object triggers factory", data: {}, valid: true },
    ],
  },
];
