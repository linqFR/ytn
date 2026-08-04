/**
 * Zod v4 equivalent of the DNA recursive schemas, for comparison.
 *
 * This file is not part of the DNA design; it shows the same patterns
 * expressed with `zod` so we can compare the shape of the public API.
 */

import { z } from "zod";


// ---------------------------------------------------------------------------
// Category = { name: string; subcategories: Category[] }
// ---------------------------------------------------------------------------

type Category = { name: string; subcategories: Category[] };

const CategoryZod: z.ZodLazy<z.ZodType<Category>> = z.lazy(() =>
  z.object({
    name: z.string(),
    subcategories: z.array(CategoryZod),
  })
);

// ---------------------------------------------------------------------------
// LinkedList = null | { value: number; next: LinkedList }
// ---------------------------------------------------------------------------

type LinkedList = null | { value: number; next: LinkedList };

const LinkedListZod: z.ZodLazy<z.ZodType<LinkedList>> = z.lazy(() =>
  z.union([
    z.null(),
    z.object({
      value: z.number(),
      next: LinkedListZod,
    }),
  ])
);

// ---------------------------------------------------------------------------
// Type assertions (mirrors hybrid-poc-inspect.ts)
// ---------------------------------------------------------------------------

type Expect<T extends true> = T;
type ExpectSame<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

const _categoryCheck: Expect<ExpectSame<z.infer<typeof CategoryZod>, Category>> = true;
const _linkedListCheck: Expect<ExpectSame<z.infer<typeof LinkedListZod>, LinkedList>> = true;

// ---------------------------------------------------------------------------
// Runtime comparison
// ---------------------------------------------------------------------------

export function showZodComparison() {
  console.log("\n=== Zod CategoryZod ===");
  console.dir(CategoryZod, { depth: 2 });

  console.log("\n=== Zod LinkedListZod ===");
  console.dir(LinkedListZod, { depth: 2 });
}

showZodComparison();
