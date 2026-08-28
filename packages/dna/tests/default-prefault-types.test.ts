import { expectTypeOf, test } from "vitest";
import { z } from "zod";
import { dna } from "../src/index.js";
import { defaultValue } from "../src/introspect.js";

// =============================================================================
// Type regression: .default() and .prefault() accept getter functions
// Bug fixed: the runtime getter resolved functions but the type signatures
// rejected `() => T`. Overloads were added to match Zod v4's dual-typing.
// =============================================================================

test("default — direct value: dna.output is the value type (not function)", () => {
  const dnaSchema = dna.string().default("hello");
  const zodSchema = z.string().default("hello");

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.infer<typeof zodSchema>>().toEqualTypeOf<string>();

  // dna.output must NOT be a function type
  expectTypeOf<dna.output<typeof dnaSchema>>().not.toEqualTypeOf<() => string>();
});

test("default — getter function: dna.output is the resolved value type (not function)", () => {
  // This was a TYPE ERROR before the overload fix:
  //   Argument of type '() => string' is not assignable to parameter of type 'string'
  const dnaSchema = dna.string().default(() => "hello");
  const zodSchema = z.string().default(() => "hello");

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.infer<typeof zodSchema>>().toEqualTypeOf<string>();

  // dna.output must NOT be a function type — the getter is resolved, not stored as output
  expectTypeOf<dna.output<typeof dnaSchema>>().not.toEqualTypeOf<() => string>();
});

test("default — getter returning Date: dna.output is Date (not function)", () => {
  const dnaSchema = dna.date().default(() => new Date("2024-01-01"));
  const zodSchema = z.date().default(() => new Date("2024-01-01"));

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<Date>();
  expectTypeOf<z.infer<typeof zodSchema>>().toEqualTypeOf<Date>();
});

test("default — dna.input preserves undefined (direct value)", () => {
  const dnaSchema = dna.string().default("hello");
  expectTypeOf<dna.input<typeof dnaSchema>>().toEqualTypeOf<string | undefined>();
});

test("default — dna.input preserves undefined (getter function)", () => {
  const dnaSchema = dna.string().default(() => "hello");
  expectTypeOf<dna.input<typeof dnaSchema>>().toEqualTypeOf<string | undefined>();
});

test("prefault — direct value: dna.output is the value type", () => {
  const dnaSchema = dna.string().prefault("hello");

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<string>();
  expectTypeOf<dna.output<typeof dnaSchema>>().not.toEqualTypeOf<() => string>();
});

test("prefault — getter function: dna.output is the resolved value type (not function)", () => {
  // This was a TYPE ERROR before the overload fix
  const dnaSchema = dna.string().prefault(() => "hello");

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<string>();
  expectTypeOf<dna.output<typeof dnaSchema>>().not.toEqualTypeOf<() => string>();
});

test("prefault — getter returning Date: dna.output is Date (not function)", () => {
  const dnaSchema = dna.date().prefault(() => new Date("2024-01-01"));
  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<Date>();
});

test("introspect.defaultValue — return type is unknown (accepts any schema)", () => {
  const schema = dna.string().default("hello");
  const result = defaultValue(schema);
  expectTypeOf<typeof result>().toEqualTypeOf<unknown>();
});

test("default — object with getter default: dna.output is the object type", () => {
  const dnaSchema = dna.object({ x: dna.number() }).default(() => ({ x: 42 }));
  const zodSchema = z.object({ x: z.number() }).default(() => ({ x: 42 }));

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<{ x: number }>();
  expectTypeOf<z.infer<typeof zodSchema>>().toEqualTypeOf<{ x: number }>();
});

test("default — getter with optional inner: dna.output removes undefined", () => {
  const dnaSchema = dna.string().optional().default(() => "hello");
  const zodSchema = z.string().optional().default(() => "hello");

  expectTypeOf<dna.output<typeof dnaSchema>>().toEqualTypeOf<string>();
  expectTypeOf<z.infer<typeof zodSchema>>().toEqualTypeOf<string>();
});
