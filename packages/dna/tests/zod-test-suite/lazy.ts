import { z } from "zod";
import { dna } from "../../src/index.js";
import type { DnaLazy} from "../../src/builder/dna-interfaces.js";

// Reusable schemas matching Zod official tests
const objectZod = z.object({
  a: z.lazy(() => z.string()),
  b: z.lazy(() => z.string().optional()),
  c: z.lazy(() => z.string().default("default")),
});
const objectDna = dna.object({
  a: dna.lazy(() => dna.string()),
  b: dna.lazy(() => dna.string().optional()),
  c: dna.lazy(() => dna.string().default("default")),
});

const schemaGetterZod = z.lazy(() => z.string());
const schemaGetterDna = dna.lazy(() => dna.string());

const lazyProxyZod = z.lazy(() => z.string())._zod.innerType.min(6);
const lazyProxyDna = dna.lazy(() => dna.string()).innerType.min(6);

type Category = { name: string; subcategories: Category[] };

type zodLazy<TS> = z.ZodLazy<z.ZodType<TS, any>>

// Recursive Category type
const CategoryZod: zodLazy<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategoryZod),
  })
);
const CategoryDna: DnaLazy<Category> = dna.lazy(() =>
  dna.object({
    name: dna.string(),
    subcategories: dna.array(CategoryDna),
  })
);

type LinkedList = null | { value: number; next: LinkedList };

// Recursive LinkedList type
const LinkedListZod: zodLazy<LinkedList> = z.lazy(() =>
  z.union([
    z.null(),
    z.object({
      value: z.number(),
      next: LinkedListZod,
    }),
  ])
);
const LinkedListDna: DnaLazy<LinkedList> = dna.lazy(() =>
  dna.union([
    dna.null(),
    dna.object({
      value: dna.number(),
      next: LinkedListDna,
    }),
  ])
);

type AOut = { val: number; b: BOut };
type BOut = { val: number; a?: AOut };

// Mutual recursion A and B
const AlazyZod: zodLazy<AOut> = z.lazy(() =>
  z.object({
    val: z.number(),
    b: BlazyZod,
  })
);
const BlazyZod: zodLazy<BOut> = z.lazy(() =>
  z.object({
    val: z.number(),
    a: AlazyZod.optional(),
  })
);
const AlazyDna: DnaLazy<AOut> = dna.lazy(() =>
  dna.object({
    val: dna.number(),
    b: BlazyDna,
  })
);
const BlazyDna: DnaLazy<BOut> = dna.lazy(() =>
  dna.object({
    val: dna.number(),
    a: AlazyDna.optional(),
  })
);

type ComplicatedCategory = {
  name: string;
  age?: number;
  nullself: ComplicatedCategory | null;
  optself?: ComplicatedCategory;
  self: ComplicatedCategory;
  subcategories: ComplicatedCategory[];
  nested: { sub: ComplicatedCategory };
};

// Complicated self-recursion with getters
const complicatedCategoryZod = z.object({
  name: z.string(),
  age: z.optional(z.number()),
  get nullself() {
    return complicatedCategoryZod.nullable();
  },
  get optself() {
    return complicatedCategoryZod.optional();
  },
  get self() {
    return complicatedCategoryZod;
  },
  get subcategories() {
    return z.array(complicatedCategoryZod);
  },
  nested: z.object({
    get sub() {
      return complicatedCategoryZod;
    },
  }),
});
const complicatedCategoryDna = dna.object({
  name: dna.string(),
  age: dna.optional(dna.number()),
  get nullself() {
    return complicatedCategoryDna.nullable();
  },
  get optself() {
    return complicatedCategoryDna.optional();
  },
  get self() {
    return complicatedCategoryDna;
  },
  get subcategories(){
    return dna.array(complicatedCategoryDna);
  },
  nested: dna.object({
    get sub() {
      return complicatedCategoryDna;
    },
  }),
});

// Cycle-broken internal schemas (runtime parse portion)
const cycleLazyRefZod: any = z.lazy(() => cycleRecZod);
const cycleRecZod: any = z.union([z.string().optional(), cycleLazyRefZod]);

const cycleLazyRefDna: DnaLazy = dna.lazy(() => cycleRecDna);
const cycleRecDna = dna.union([dna.string().optional(), cycleLazyRefDna]);

export const lazyTests = [
  {
    description: "opt passthrough",
    zodSchema: objectZod,
    dnaSchema: objectDna,
    tests: [
      { description: "valid with a and b undefined", data: { a: "hello", b: undefined }, valid: true },
      { description: "valid with a only", data: { a: "hello" }, valid: true },
    ],
  },
  {
    description: "schema getter",
    zodSchema: schemaGetterZod,
    dnaSchema: schemaGetterDna,
    tests: [
      { description: "valid string", data: "asdf", valid: true },
    ],
  },
  {
    description: "lazy proxy",
    zodSchema: lazyProxyZod,
    dnaSchema: lazyProxyDna,
    tests: [
      { description: "valid length 6", data: "123456", valid: true },
      { description: "invalid length 5", data: "12345", valid: false },
    ],
  },
  {
    description: "recursion with z.lazy (Category)",
    zodSchema: CategoryZod,
    dnaSchema: CategoryDna,
    tests: [
      { description: "valid nested", data: { name: "I", subcategories: [{ name: "A", subcategories: [{ name: "1", subcategories: [] }] }] }, valid: true },
    ],
  },
  {
    description: "recursive union with z.lazy (LinkedList)",
    zodSchema: LinkedListZod,
    dnaSchema: LinkedListDna,
    tests: [
      {
        description: "valid linked list",
        data: {
          value: 1,
          next: {
            value: 2,
            next: {
              value: 3,
              next: {
                value: 4,
                next: null,
              },
            },
          },
        },
        valid: true,
      },
      {
        description: "valid single node",
        data: {
          value: 1,
          next: null,
        },
        valid: true,
      },
    ],
  },
  {
    description: "mutual recursion with lazy (A)",
    zodSchema: AlazyZod,
    dnaSchema: AlazyDna,
    tests: [
      {
        description: "valid mutual recursion",
        data: {
          val: 1,
          b: {
            val: 5,
            a: {
              val: 3,
              b: {
                val: 4,
                a: {
                  val: 2,
                  b: {
                    val: 1,
                  },
                },
              },
            },
          },
        },
        valid: true,
      },
      {
        description: "valid simple B",
        data: {
          val: 1,
          b: {
            val: 5,
          },
        },
        valid: true,
      },
      {
        description: "invalid wrong type",
        data: { val: "asdf" },
        valid: false,
      },
    ],
  },
  {
    description: "complicated self-recursion with getters",
    zodSchema: complicatedCategoryZod,
    dnaSchema: complicatedCategoryDna,
    tests: [
      {
        description: "valid simple",
        data: {
          name: "test",
          subcategories: [],
        },
        valid: true,
      },
      {
        description: "valid with nested",
        data: {
          name: "test",
          subcategories: [
            {
              name: "sub",
              subcategories: [],
            },
          ],
        },
        valid: true,
      },
    ],
  },
  {
    description: "a cycle-broken internal is not memoized (runtime parse)",
    zodSchema: z.object({ x: cycleRecZod, y: cycleLazyRefZod }),
    dnaSchema: dna.object({ x: cycleRecDna, y: cycleLazyRefDna }),
    tests: [
      { description: "valid parse with x only", data: { x: "a" }, valid: true },
    ],
  },
];

