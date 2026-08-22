import { expectTypeOf, test } from "vitest";
import { dna } from "../src/index.js";

// =============================================================================
// Type regression: dna.output / dna.input / dna.infer must match the internal
// indexed access types _output / _input on varied schemas.
//
// dna.output<S> is defined as $Output<S> and dna.infer<S> is an alias of it.
// dna.input<S> is defined as $Input<S>.
// These public surfaces must stay aligned with the class-level _output / _input
// properties so that refactors of the internal generics do not silently break
// the public inference API.
// =============================================================================

// --- Primitives ---
test("string — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  expectTypeOf<dna.infer<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
});

test("number — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.number();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  expectTypeOf<dna.infer<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
});

test("date — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.date();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Optional / Nullable / Nullish ---
test("optional string — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().optional();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

test("nullable number — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.number().nullable();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

test("nullish boolean — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.boolean().nullish();
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Default / Prefault ---
test("default string (direct) — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().default("hello");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

test("default string (getter) — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().default(() => "hello");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

test("prefault string (direct) — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().prefault("hello");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

test("prefault string (getter) — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().prefault(() => "hello");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Object ---
test("object — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.object({ name: dna.string(), age: dna.number() });
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  expectTypeOf<dna.infer<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
});

// --- Array ---
test("array — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.array(dna.string());
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Enum ---
test("enum — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.enum(["a", "b", "c"]);
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Literal ---
test("literal — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.literal("hello");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Union ---
test("union — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.union([dna.string(), dna.number()]);
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Transform (input ≠ output) ---
test("transform — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().transform((v) => v.length);
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  // Verify that input and output differ (transform changes the type)
  expectTypeOf<dna.output<typeof s>>().not.toEqualTypeOf<dna.input<typeof s>>();
});

// --- Codec (input ≠ output) ---
test("codec — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.codec(dna.string(), dna.number(), {
    decode: (str) => Number.parseFloat(str),
    encode: (num) => num.toString(),
  });
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  // Verify that input and output differ
  expectTypeOf<dna.output<typeof s>>().not.toEqualTypeOf<dna.input<typeof s>>();
});

// --- Catch ---
test("catch — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.string().catch("fallback");
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
});

// --- Nested: object with optional + default fields ---
test("nested object with optional + default — dna.output equals _output, dna.input equals _input", () => {
  const s = dna.object({
    name: dna.string(),
    age: dna.number().optional(),
    role: dna.string().default("user"),
  });
  expectTypeOf<dna.output<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
  expectTypeOf<dna.input<typeof s>>().toEqualTypeOf<(typeof s)["_input"]>();
  expectTypeOf<dna.infer<typeof s>>().toEqualTypeOf<(typeof s)["_output"]>();
});

// --- dna.infer is an alias of dna.output ---
test("dna.infer is an alias of dna.output on varied schemas", () => {
  const s1 = dna.string();
  const s2 = dna.object({ x: dna.number() });
  const s3 = dna.string().transform((v) => v.length);
  const s4 = dna.string().default("hello");
  const s5 = dna.array(dna.boolean());

  expectTypeOf<dna.infer<typeof s1>>().toEqualTypeOf<dna.output<typeof s1>>();
  expectTypeOf<dna.infer<typeof s2>>().toEqualTypeOf<dna.output<typeof s2>>();
  expectTypeOf<dna.infer<typeof s3>>().toEqualTypeOf<dna.output<typeof s3>>();
  expectTypeOf<dna.infer<typeof s4>>().toEqualTypeOf<dna.output<typeof s4>>();
  expectTypeOf<dna.infer<typeof s5>>().toEqualTypeOf<dna.output<typeof s5>>();
});
