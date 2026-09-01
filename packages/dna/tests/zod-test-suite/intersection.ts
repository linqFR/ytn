import { z } from "zod";
import { dna } from "../../src/index.js";

// Reusable schemas matching Zod official tests
const AZod = z.object({ a: z.string() });
const ADna = dna.object({ a: dna.string() });

const BZod = z.object({ b: z.string() });
const BDna = dna.object({ b: dna.string() });

const CZod = z.intersection(AZod, BZod);
const CDna = dna.intersection(ADna, BDna);

const ALooseZod = z.looseObject({ a: z.string() });
const ALooseDna = dna.looseObject({ a: dna.string() });

const CLooseZod = z.intersection(ALooseZod, BZod);
const CLooseDna = dna.intersection(ALooseDna, BDna);

const AStrictZod = z.strictObject({ a: z.string() });
const AStrictDna = dna.strictObject({ a: dna.string() });

const BStrictZod = z.strictObject({ b: z.string() });
const BStrictDna = dna.strictObject({ b: dna.string() });

const CStrictStripZod = z.intersection(AStrictZod, BZod);
const CStrictStripDna = dna.intersection(AStrictDna, BDna);

const CStrictStrictZod = z.intersection(AStrictZod, BStrictZod);
const CStrictStrictDna = dna.intersection(AStrictDna, BStrictDna);

const AnimalZod = z.object({
  properties: z.object({
    is_animal: z.boolean(),
  }),
});
const AnimalDna = dna.object({
  properties: dna.object({
    is_animal: dna.boolean(),
  }),
});

const CatZod = z.intersection(
  z.object({
    properties: z.object({
      jumped: z.boolean(),
    }),
  }),
  AnimalZod
);
const CatDna = dna.intersection(
  dna.object({
    properties: dna.object({
      jumped: dna.boolean(),
    }),
  }),
  AnimalDna
);

export const intersectionTests = [
  {
    description: "object intersection",
    zodSchema: CZod,
    dnaSchema: CDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "foo" }, valid: true },
      { description: "invalid missing a", data: { a: "foo" }, valid: false },
    ],
  },
  {
    description: "object intersection: loose",
    zodSchema: CLooseZod,
    dnaSchema: CLooseDna,
    tests: [
      { description: "valid with extra property", data: { a: "foo", b: "foo", c: "extra" }, valid: true },
      { description: "invalid missing b", data: { a: "foo" }, valid: false },
    ],
  },
  {
    description: "object intersection: strict + strip",
    zodSchema: CStrictStripZod,
    dnaSchema: CStrictStripDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "bar" }, valid: true },
      { description: "valid with extra (stripped)", data: { a: "foo", b: "bar", c: "extra" }, valid: true },
    ],
  },
  {
    description: "object intersection: strict + strict",
    zodSchema: CStrictStrictZod,
    dnaSchema: CStrictStrictDna,
    tests: [
      { description: "valid both properties", data: { a: "foo", b: "bar" }, valid: true },
      { description: "invalid with extra property", data: { a: "foo", b: "bar", c: "extra" }, valid: false },
    ],
  },
  {
    description: "deep intersection",
    zodSchema: CatZod,
    dnaSchema: CatDna,
    tests: [
      { description: "valid nested properties", data: { properties: { is_animal: true, jumped: true } }, valid: true },
    ],
  },
  {
    description: "deep intersection of arrays",
    zodSchema: z.intersection(
      z.object({ posts: z.array(z.object({ post_id: z.number() })) }),
      z.object({ posts: z.array(z.object({ title: z.string() })) })
    ),
    dnaSchema: dna.intersection(
      dna.object({ posts: dna.array(dna.object({ post_id: dna.number() })) }),
      dna.object({ posts: dna.array(dna.object({ title: dna.string() })) })
    ),
    tests: [
      { description: "valid merged posts", data: { posts: [{ post_id: 1, title: "Novels" }, { post_id: 2, title: "Fairy tales" }] }, valid: true },
    ],
  },
  {
    description: "object intersection strips __proto__ from pass-through",
    zodSchema: z.intersection(z.object({ name: z.string() }), z.unknown()),
    dnaSchema: dna.intersection(dna.object({ name: dna.string() }), dna.unknown()),
    tests: [
      { description: "valid with __proto__ stripped", data: JSON.parse('{"__proto__":{"isAdmin":true},"name":"alice"}'), valid: true },
    ],
  },
  {
    description: "record key schema governs only its own keys",
    zodSchema: z.intersection(z.object({ name: z.string() }), z.record(z.string().regex(/^S_/), z.string())),
    dnaSchema: dna.intersection(dna.object({ name: dna.string() }), dna.record(dna.string().regex(/^S_/), dna.string())),
    tests: [
      { description: "valid with governed and ungoverned keys", data: { name: "a", S_a: "s" }, valid: true },
    ],
  },
  {
    description: "record key schema - governed key validated across intersection",
    zodSchema: z.intersection(z.object({ S_x: z.number() }), z.record(z.string().regex(/^S_/), z.string())),
    dnaSchema: dna.intersection(dna.object({ S_x: dna.number() }), dna.record(dna.string().regex(/^S_/), dna.string())),
    tests: [
      { description: "invalid - number not string", data: { S_x: 1 }, valid: false },
    ],
  },
  {
    description: "strict object + record - ungoverned key rejected",
    zodSchema: z.intersection(z.strictObject({ name: z.string() }), z.record(z.string().regex(/^S_/), z.string())),
    dnaSchema: dna.intersection(dna.strictObject({ name: dna.string() }), dna.record(dna.string().regex(/^S_/), dna.string())),
    tests: [
      { description: "valid with governed key", data: { name: "a", S_a: "s" }, valid: true },
      { description: "invalid with evil key", data: { name: "a", S_a: "s", evil: "q" }, valid: false },
    ],
  },
  {
    description: "standalone record rejects ungoverned key",
    zodSchema: z.record(z.string().regex(/^S_/), z.string()),
    dnaSchema: dna.record(dna.string().regex(/^S_/), dna.string()),
    tests: [
      { description: "invalid with bad key", data: { S_a: "s", bad: "x" }, valid: false },
    ],
  },
  {
    description: "partialRecord reports out-of-set key as unrecognized",
    zodSchema: z.partialRecord(z.enum(["a", "b"]), z.string()),
    dnaSchema: dna.partialRecord(dna.enum(["a", "b"]), dna.string()),
    tests: [
      { description: "invalid with out-of-set key", data: { a: "x", zzz: "q" }, valid: false },
    ],
  },
  {
    description: "intersection operands run refinements",
    zodSchema: z.intersection(
      z.strictObject({ x: z.string() }),
      z.strictObject({ a: z.string() }).superRefine((_data: any, ctx: any) => {
        ctx.addIssue({ code: "custom", message: "boom" });
      })
    ),
    dnaSchema: dna.intersection(
      dna.strictObject({ x: dna.string() }),
      dna.strictObject({ a: dna.string() }).superRefine((_data: any, ctx: any) => {
        ctx.addIssue({ code: "custom", message: "boom" });
      })
    ),
    tests: [
      { description: "invalid - superRefine adds issue", data: { x: "test", a: "hello" }, valid: false },
    ],
  },
  {
    description: "intersection operands run transforms",
    zodSchema: z.intersection(
      z.strictObject({ x: z.string() }).transform((v: any) => ({ ...v, x: v.x.toUpperCase() })),
      z.strictObject({ a: z.string() }).transform((v: any) => ({ ...v, seen: true }))
    ),
    dnaSchema: dna.intersection(
      dna.strictObject({ x: dna.string() }).transform((v: any) => ({ ...v, x: v.x.toUpperCase() })),
      dna.strictObject({ a: dna.string() }).transform((v: any) => ({ ...v, seen: true }))
    ),
    tests: [
      { description: "valid with transforms applied", data: { x: "test", a: "hello" }, valid: true },
    ],
  },
  {
    description: "intersection operands apply defaults through nested intersection",
    zodSchema: z.intersection(
      z.intersection(
        z.strictObject({ x: z.string().default("X default"), y: z.number() }),
        z.strictObject({ z: z.boolean() })
      ),
      z.strictObject({ a: z.string() })
    ),
    dnaSchema: dna.intersection(
      dna.intersection(
        dna.strictObject({ x: dna.string().default("X default"), y: dna.number() }),
        dna.strictObject({ z: dna.boolean() })
      ),
      dna.strictObject({ a: dna.string() })
    ),
    tests: [
      { description: "valid with default applied", data: { y: 34, z: true, a: "hello" }, valid: true },
    ],
  },
  {
    description: "record operand runs refinements inside intersection",
    zodSchema: z
      .record(z.enum(["p1", "p2"]), z.string())
      .superRefine((_data: any, ctx: any) => {
        ctx.addIssue({ code: "custom", message: "record refined" });
      })
      .and(z.strictObject({ name: z.string() })),
    dnaSchema: dna
      .record(dna.enum(["p1", "p2"]), dna.string())
      .superRefine((_data: any, ctx: any) => {
        ctx.addIssue({ code: "custom", message: "record refined" });
      })
      .and(dna.strictObject({ name: dna.string() })),
    tests: [
      { description: "invalid - record refined", data: { p1: "a", p2: "b", name: "n" }, valid: false },
    ],
  },
  {
    description: "strict object nested under operand keeps strictness",
    zodSchema: z.intersection(
      z.object({ inner: z.strictObject({ a: z.string() }) }),
      z.object({ other: z.string() })
    ),
    dnaSchema: dna.intersection(
      dna.object({ inner: dna.strictObject({ a: dna.string() }) }),
      dna.object({ other: dna.string() })
    ),
    tests: [
      { description: "valid without extra keys", data: { inner: { a: "x" }, other: "y" }, valid: true },
      { description: "invalid with extra key in strict inner", data: { inner: { a: "x", extra: 1 }, other: "y" }, valid: false },
    ],
  },
  {
    description: "strict object composes with refined object",
    zodSchema: z.object({ key1: z.boolean() }).strict().and(z.object({ key2: z.boolean() }).refine(({ key2 }: any) => key2, "key2 must be true")),
    dnaSchema: dna.object({ key1: dna.boolean() }).strict().and(dna.object({ key2: dna.boolean() }).refine(({ key2 }: any) => key2, "key2 must be true")),
    tests: [
      { description: "valid both true", data: { key1: true, key2: true }, valid: true },
      { description: "invalid key2 false", data: { key1: true, key2: false }, valid: false },
    ],
  },
];
