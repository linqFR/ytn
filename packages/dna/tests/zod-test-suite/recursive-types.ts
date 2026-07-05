import * as z from "zod";
import { dna } from "../../src/index.js";

// Category with optional/nullable
const CategoryZod = z.object({
  name: z.string(),
  get subcategories() {
    return z.array(CategoryZod).optional().nullable();
  },
});
const CategoryDna = dna.object({
  name: dna.string(),
  get subcategories() {
    return dna.array(CategoryDna).optional().nullable();
  },
});

// LinkedList with nullable
const LLZod = z.object({
  value: z.number(),
  get next() {
    return LLZod.nullable();
  },
});
const LLDna = dna.object({
  value: dna.number(),
  get next() {
    return LLDna.nullable();
  },
});

// Mutual recursion A and B
const AlazyZod = z.object({
  val: z.number(),
  get b() {
    return BlazyZod;
  },
});
const BlazyZod = z.object({
  val: z.number(),
  get a() {
    return AlazyZod.optional();
  },
});
const AlazyDna = dna.object({
  val: dna.number(),
  get b() {
    return BlazyDna;
  },
});
const BlazyDna = dna.object({
  val: dna.number(),
  get a() {
    return AlazyDna.optional();
  },
});

// Node with optional array
const NodeZod = z.object({
  id: z.string(),
  name: z.string(),
  get children() {
    return z.array(NodeZod).optional();
  },
});
const NodeDna = dna.object({
  id: dna.string(),
  name: dna.string(),
  get children() {
    return dna.array(NodeDna).optional();
  },
});

// Category with pick/omit
const CategoryPickOmitZod = z.strictObject({
  name: z.string(),
  get subcategories() {
    return z.array(CategoryPickOmitZod);
  },
});
const CategoryPickOmitDna = dna.strictObject({
  name: dna.string(),
  get subcategories() {
    return dna.array(CategoryPickOmitDna);
  },
});

// Deferred self-recursion
const FeatureZod = z.object({
  title: z.string(),
  get features() {
    return z.optional(z.array(FeatureZod));
  },
});
const FeatureDna = dna.object({
  title: dna.string(),
  get features() {
    return dna.optional(dna.array(FeatureDna));
  },
});

// Deferred mutual recursion (Slot, Block, Page)
const SlotZod = z.object({
  slotCode: z.string(),
  get blocks() {
    return z.array(BlockZod);
  },
});
const BlockZod = z.object({
  blockCode: z.string(),
  get slots() {
    return z.array(SlotZod).optional();
  },
});
const SlotDna = dna.object({
  slotCode: dna.string(),
  get blocks() {
    return dna.array(BlockDna);
  },
});
const BlockDna = dna.object({
  blockCode: dna.string(),
  get slots() {
    return dna.array(SlotDna).optional();
  },
});

// Mutual recursion with meta
const AMetaZod = z
  .object({
    name: z.string(),
    get b() {
      return BMetaZod;
    },
  })
  .readonly()
  .meta({ id: "A" })
  .optional();
const BMetaZod = z
  .object({
    name: z.string(),
    get a() {
      return AMetaZod;
    },
  })
  .readonly()
  .meta({ id: "B" });
const AMetaDna = dna
  .object({
    name: dna.string(),
    get b() {
      return BMetaDna;
    },
  })
  .readonly()
  .meta({ id: "A" })
  .optional();
const BMetaDna = dna
  .object({
    name: dna.string(),
    get a() {
      return AMetaDna;
    },
  })
  .readonly()
  .meta({ id: "B" });

// Recursive with check
const CategoryCheckZod = z
  .object({
    id: z.string(),
    name: z.string(),
    get subcategories() {
      return z.array(CategoryCheckZod).optional();
    },
  })
  .check((ctx) => {
    if (ctx.value.subcategories) {
      const siblingIds = new Set<string>();
      ctx.value.subcategories.forEach((sub, index) => {
        if (siblingIds.has(sub.id)) {
          ctx.issues.push({
            code: "custom",
            message: `Duplicate sibling ID found: ${sub.id}`,
            path: ["subcategories", index, "id"],
            input: ctx.value,
          });
        }
        siblingIds.add(sub.id);
      });
    }
  });
const CategoryCheckDna = dna
  .object({
    id: dna.string(),
    name: dna.string(),
    get subcategories() {
      return dna.array(CategoryCheckDna).optional();
    },
  })
  .check((ctx) => {
    if (ctx.value.subcategories) {
      const siblingIds = new Set<string>();
      ctx.value.subcategories.forEach((sub, index) => {
        if (siblingIds.has(sub.id)) {
          ctx.issues.push({
            code: "custom",
            message: `Duplicate sibling ID found: ${sub.id}`,
            path: ["subcategories", index, "id"],
            input: ctx.value,
          });
        }
        siblingIds.add(sub.id);
      });
    }
  });

export const recursiveTypesTests = [
  {
    description: "self-recursion with lazy (category tree)",
    zodSchema: CategoryZod,
    dnaSchema: CategoryDna,
    tests: [
      {
        description: "valid nested category",
        data: {
          name: "I",
          subcategories: [
            {
              name: "A",
              subcategories: [
                {
                  name: "1",
                  subcategories: [
                    {
                      name: "a",
                      subcategories: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
        valid: true,
      },
      {
        description: "valid simple category",
        data: {
          name: "I",
          subcategories: null,
        },
        valid: true,
      },
      {
        description: "valid without subcategories",
        data: {
          name: "I",
        },
        valid: true,
      },
    ],
  },
  {
    description: "recursion with union (linked list)",
    zodSchema: LLZod,
    dnaSchema: LLDna,
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
    description: "mutual recursion (A and B)",
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
    ],
  },
  {
    description: "recursive with optional array",
    zodSchema: NodeZod,
    dnaSchema: NodeDna,
    tests: [
      {
        description: "valid with children",
        data: {
          id: "1",
          name: "Root",
          children: [
            {
              id: "2",
              name: "Child 1",
              children: [
                {
                  id: "3",
                  name: "Grandchild",
                },
              ],
            },
          ],
        },
        valid: true,
      },
      {
        description: "valid without children",
        data: {
          id: "1",
          name: "Root",
        },
        valid: true,
      },
    ],
  },
  {
    description: "recursive with discriminated union",
    zodSchema: z.object({
      type: z.literal("special").meta({ description: "Type" }),
      config: z.object({
        title: z.string().meta({ description: "Title" }),
        get elements() {
          return z.array(
            z.discriminatedUnion("type", [
              z.object({
                type: z.literal("a"),
                name: z.string(),
              }),
              z.object({
                type: z.literal("b"),
                name: z.string(),
              }),
              z.object({
                type: z.literal("c"),
                name: z.string(),
              }),
            ])
          ).meta({
            id: "SpecialElements",
            title: "SpecialElements",
            description: "Array of elements",
          });
        },
      }),
    }),
    dnaSchema: dna.object({
      type: dna.literal("special").meta({ description: "Type" }),
      config: dna.object({
        title: dna.string().meta({ description: "Title" }),
        get elements() {
          return dna.array(
            dna.discriminatedUnion("type", [
              dna.object({
                type: dna.literal("a"),
                name: dna.string(),
              }),
              dna.object({
                type: dna.literal("b"),
                name: dna.string(),
              }),
              dna.object({
                type: dna.literal("c"),
                name: dna.string(),
              }),
            ])
          ).meta({
            id: "SpecialElements",
            title: "SpecialElements",
            description: "Array of elements",
          });
        },
      }),
    }),
    tests: [
      {
        description: "valid with elements",
        data: {
          type: "special",
          config: {
            title: "Special",
            elements: [
              { type: "a", name: "John" },
              { type: "b", name: "Jane" },
              { type: "c", name: "Jim" },
            ],
          },
        },
        valid: true,
      },
      {
        description: "valid empty elements",
        data: {
          type: "special",
          config: {
            title: "Special",
            elements: [],
          },
        },
        valid: true,
      },
    ],
  },
  {
    description: "pick and omit with getter",
    zodSchema: CategoryPickOmitZod,
    dnaSchema: CategoryPickOmitDna,
    tests: [
      {
        description: "valid picked",
        data: { name: "test" },
        valid: true,
      },
    ],
  },
  {
    description: "deferred self-recursion",
    zodSchema: FeatureZod,
    dnaSchema: FeatureDna,
    tests: [
      {
        description: "valid simple",
        data: { title: "test" },
        valid: true,
      },
      {
        description: "valid with features",
        data: {
          title: "test",
          features: [{ title: "sub" }],
        },
        valid: true,
      },
    ],
  },
  {
    description: "deferred mutual recursion (Slot)",
    zodSchema: SlotZod,
    dnaSchema: SlotDna,
    tests: [
      {
        description: "valid simple",
        data: {
          slotCode: "slot1",
          blocks: [],
        },
        valid: true,
      },
      {
        description: "valid with blocks",
        data: {
          slotCode: "slot1",
          blocks: [
            {
              blockCode: "block1",
              slots: [],
            },
          ],
        },
        valid: true,
      },
    ],
  },
  {
    description: "mutual recursion with meta (A)",
    zodSchema: AMetaZod,
    dnaSchema: AMetaDna,
    tests: [
      {
        description: "valid with B",
        data: {
          name: "test",
          b: {
            name: "test2",
          },
        },
        valid: true,
      },
      {
        description: "valid undefined",
        data: undefined,
        valid: true,
      },
    ],
  },
  {
    description: "recursive with check",
    zodSchema: CategoryCheckZod,
    dnaSchema: CategoryCheckDna,
    tests: [
      {
        description: "valid unique IDs",
        data: {
          id: "electronics",
          name: "Electronics",
          subcategories: [
            {
              id: "computers",
              name: "Computers",
              subcategories: [
                { id: "laptops", name: "Laptops" },
                { id: "desktops", name: "Desktops" },
              ],
            },
            {
              id: "phones",
              name: "Phones",
            },
          ],
        },
        valid: true,
      },
      {
        description: "invalid duplicate IDs",
        data: {
          id: "electronics",
          name: "Electronics",
          subcategories: [
            { id: "computers", name: "Computers" },
            { id: "phones", name: "Phones" },
            { id: "computers", name: "Computers Again" },
          ],
        },
        valid: false,
      },
    ],
  },
];
