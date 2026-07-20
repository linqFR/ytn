import { z } from "zod";
import { dna } from "../../src/index.js";

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

// Recursive Category type
const CategoryZod: z.ZodType<Category> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategoryZod),
  })
);
const CategoryDna: DnaType<Category, Category> = dna.lazy(() =>
  dna.object({
    name: dna.string(),
    subcategories: dna.array(CategoryDna),
  })
);

type LinkedList = null | { value: number; next: LinkedList };

// Recursive LinkedList type
const LinkedListZod: z.ZodType<LinkedList> = z.lazy(() =>
  z.union([
    z.null(),
    z.object({
      value: z.number(),
      next: LinkedListZod,
    }),
  ])
);
const LinkedListDna: DnaType<LinkedList, LinkedList> = dna.lazy(() =>
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
const AlazyZod: z.ZodType<AOut> = z.lazy(() =>
  z.object({
    val: z.number(),
    b: BlazyZod,
  })
);
const BlazyZod: z.ZodType<BOut> = z.lazy(() =>
  z.object({
    val: z.number(),
    a: AlazyZod.optional(),
  })
);
const AlazyDna: ReturnType<typeof dna.lazy> = dna.lazy(() =>
  dna.object({
    val: dna.number(),
    b: BlazyDna,
  })
);
const BlazyDna: ReturnType<typeof dna.lazy> = dna.lazy(() =>
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
const complicatedCategoryZod: z.ZodType<ComplicatedCategory> = z.object({
  name: z.string(),
  age: z.optional(z.number()),
  get nullself(): z.ZodType<ComplicatedCategory | null> {
    return complicatedCategoryZod.nullable();
  },
  get optself(): z.ZodType<ComplicatedCategory | undefined> {
    return complicatedCategoryZod.optional();
  },
  get self(): z.ZodType<ComplicatedCategory> {
    return complicatedCategoryZod;
  },
  get subcategories(): z.ZodType<ComplicatedCategory[]> {
    return z.array(complicatedCategoryZod);
  },
  nested: z.object({
    get sub(): z.ZodType<ComplicatedCategory> {
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
];

