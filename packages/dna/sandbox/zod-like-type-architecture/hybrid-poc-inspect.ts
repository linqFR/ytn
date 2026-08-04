/**
 * Runtime and type-level inspection of the simplified architecture POC.
 *
 * This file is a scratch pad: it logs the runtime structure of a few schemas
 * and uses compile-time assertions to show the inferred output/input types.
 */

import {
  CategoryDna,
  LinkedListDna,
  dnaString,
  dnaNumber,
  dnaNull,
  dnaObject,
  dnaArray,
  dnaUnion,
  dnaLazy,
  type Category,
  type LinkedList,
  type $Output,
  type $Input,
} from "./hybrid-poc.js";
import { type $Expect, type $ExpectSame } from "./test-helpers.js";

// ---------------------------------------------------------------------------
// Type-level inferences (visible when hovering in the IDE)
// ---------------------------------------------------------------------------

type CategoryOut = $Output<typeof CategoryDna>;
type CategoryIn = $Input<typeof CategoryDna>;

type LinkedListOut = $Output<typeof LinkedListDna>;
type LinkedListIn = $Input<typeof LinkedListDna>;

type StringOut = $Output<ReturnType<typeof dnaString>>;
type NumberOut = $Output<ReturnType<typeof dnaNumber>>;

const CategoryName = CategoryDna.transform((v) => {
  const _vCheck: $Expect<$ExpectSame<typeof v, Category>> = true;
  return v.name;
});
type CategoryNameOut = $Output<typeof CategoryName>;

const NamedCategory = CategoryDna.refine((v) => {
  const _vCheck: $Expect<$ExpectSame<typeof v, Category>> = true;
  return v.name.length > 0;
});
type NamedCategoryOut = $Output<typeof NamedCategory>;

// These will error at compile time if the inference is wrong.
const _categoryOutCheck: $Expect<$ExpectSame<CategoryOut, Category>> = true;
const _categoryInCheck: $Expect<$ExpectSame<CategoryIn, Category>> = true;
const _linkedListOutCheck: $Expect<$ExpectSame<LinkedListOut, LinkedList>> = true;
const _linkedListInCheck: $Expect<$ExpectSame<LinkedListIn, LinkedList>> = true;
const _stringOutCheck: $Expect<$ExpectSame<StringOut, string>> = true;
const _numberOutCheck: $Expect<$ExpectSame<NumberOut, number>> = true;
const _categoryNameOutCheck: $Expect<$ExpectSame<CategoryNameOut, string>> = true;
const _namedCategoryOutCheck: $Expect<$ExpectSame<NamedCategoryOut, Category>> = true;

// ---------------------------------------------------------------------------
// Runtime inspection
// ---------------------------------------------------------------------------

function logSchema(name: string, schema: unknown) {
  console.log(`\n=== ${name} ===`);
  console.dir(schema, { depth: 2 });
}

export function showHybridPoc() {
  logSchema("CategoryDna", CategoryDna);

  logSchema("LinkedListDna", LinkedListDna);

  logSchema("dnaString()", dnaString());
  logSchema("dnaNumber()", dnaNumber());
  logSchema("dnaNull()", dnaNull());

  const Simple = dnaObject({
    name: dnaString(),
    age: dnaNumber().optional(),
    tags: dnaArray(dnaString()),
  });
  logSchema("simple dnaObject", Simple);

  const Union = dnaUnion([dnaString(), dnaNull()]);
  logSchema("simple dnaUnion", Union);

  type SimpleOut = $Output<typeof Simple>;
  type SimpleIn = $Input<typeof Simple>;
  const _simpleOutCheck: $Expect<
    $ExpectSame<SimpleOut, { name: string; age?: number | undefined; tags: string[] }>
  > = true;
  const _simpleInCheck: $Expect<
    $ExpectSame<SimpleIn, { name: string; age?: number | undefined; tags: string[] }>
  > = true;
}

// Run when this file is loaded as the entry point.
showHybridPoc();
