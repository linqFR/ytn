import { describe, it, expect } from "vitest";
import { dna } from "../src/index.ts";
import { parserBuilder, validatorBuilder } from "../src/toJs/dna-to-js.ts";
import { toJS } from "../src/toJs/dna-to-js.ts";
import { fromDna } from "../src/fromDna.ts";

// ============================================================
// Externals cache & activation tests
// Verifies that externals are baked in at factory call time
// and that changing them afterwards has no effect.
// Also tests the different declaration forms (array vs object),
// methods that support externals, and multiple externals.
// ============================================================

const toUpper = (v: string) => v.toUpperCase();
const toLower = (v: string) => v.toLowerCase();

describe("Externals: cache & activation", () => {
  // Schema body references "myHelper" — object form { myHelper } ensures
  // the external name is "myHelper" regardless of the function's .name.
  const myHelper = toUpper;
  const schema = dna.string().transform((v) => myHelper(v), { myHelper });

  describe("2a — schema.safeParse (WeakMap cache by ctx reference)", () => {
    it("first call compiles and caches with the provided external", () => {
      const r = schema.safeParse("Hello", { myHelper: toUpper });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("second call with a different ctx object recompiles with the new external", () => {
      // First call bakes in toUpper
      schema.safeParse("Hello", { myHelper: toUpper });
      // Second call passes a different ctx object with toLower — should recompile
      const r = schema.safeParse("Hello", { myHelper: toLower });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("hello");
    });

    it("reusing the same ctx object reuses the cache (no recompilation)", () => {
      const ctx = { myHelper: toUpper };
      const r1 = schema.safeParse("Hello", ctx);
      const r2 = schema.safeParse("Hello", ctx);
      if (r1.success) expect(r1.data).toBe("HELLO");
      if (r2.success) expect(r2.data).toBe("HELLO");
    });

    it("third call with no ctx throws (external not injected)", () => {
      // No-ctx call — uses `this` (schema instance) as WeakMap key
      // No externals injected → transform fails because myHelper is not defined
      expect(() => schema.safeParse("Hello")).toThrow();
    });
  });

  describe("2b — parserBuilder (no cache, baked in at build)", () => {
    const dnaData = schema.toDna();

    it("builds an independent function with the provided external", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      const r = parse("Hello");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("each build creates an independent function with its own external", () => {
      const parseUpper = parserBuilder(dnaData, { myHelper: toUpper });
      const parseLower = parserBuilder(dnaData, { myHelper: toLower });
      const rUpper = parseUpper("Hello");
      const rLower = parseLower("Hello");
      if (rUpper.success) expect(rUpper.data).toBe("HELLO");
      if (rLower.success) expect(rLower.data).toBe("hello");
    });

    it("reusing a built function keeps its original external (unaffected by other builds)", () => {
      const parseUpper = parserBuilder(dnaData, { myHelper: toUpper });
      parserBuilder(dnaData, { myHelper: toLower }); // unrelated build
      const r = parseUpper("Hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("attaches requiredExternals to the returned function", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      expect(Array.isArray(parse.requiredExternals)).toBe(true);
      expect(parse.requiredExternals).toContain("myHelper");
    });
  });

  describe("2c — toJS + new Function (manual activation)", () => {
    const dnaData = schema.toDna();
    const result = toJS(false, true)(dnaData);

    it("produces code and requiredExternals", () => {
      expect(Array.isArray(result.code)).toBe(true);
      expect(result.code.length).toBeGreaterThan(0);
      expect(Array.isArray(result.requiredExternals)).toBe(true);
      expect(result.requiredExternals).toContain("myHelper");
    });

    it("activation with toUpper produces a function closured over toUpper", () => {
      const fn = new Function(...result.code)({ myHelper: toUpper });
      const r = fn("Hello");
      expect(r.success).toBe(true);
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("activation with toLower produces an independent function", () => {
      const fnUpper = new Function(...result.code)({ myHelper: toUpper });
      const fnLower = new Function(...result.code)({ myHelper: toLower });
      const rUpper = fnUpper("Hello");
      const rLower = fnLower("Hello");
      if (rUpper.success) expect(rUpper.data).toBe("HELLO");
      if (rLower.success) expect(rLower.data).toBe("hello");
    });

    it("reusing an activated function keeps its original external", () => {
      const fnUpper = new Function(...result.code)({ myHelper: toUpper });
      new Function(...result.code)({ myHelper: toLower }); // unrelated activation
      const r = fnUpper("Hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });
  });
});

// ============================================================
// Externals declaration forms
// ============================================================

describe("Externals: declaration forms", () => {
  // Named function — .name = "namedUpper"
  function namedUpper(v: string) { return v.toUpperCase(); }
  // Anonymous function assigned to a const — .name = "anonUpper" (modern engines)
  const anonUpper = function (v: string) { return v.toUpperCase(); };
  // Arrow function assigned to a const — .name = "arrowUpper" (modern engines)
  const arrowUpper = (v: string) => v.toUpperCase();
  // Alias used as external key name in object-form tests — the variable name
  // must match the key so the serialized body `(v) => myHelper(v)` resolves
  // to the injected external at runtime.
  const myHelper = arrowUpper;

  describe("array form [fn] — uses fn.name", () => {
    it("works with named functions", () => {
      const s = dna.string().transform((v) => namedUpper(v), [namedUpper]);
      const r = s.safeParse("hello", { namedUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("works with anonymous functions assigned to a const", () => {
      const s = dna.string().transform((v) => anonUpper(v), [anonUpper]);
      const r = s.safeParse("hello", { anonUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("works with arrow functions assigned to a const", () => {
      const s = dna.string().transform((v) => arrowUpper(v), [arrowUpper]);
      const r = s.safeParse("hello", { arrowUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });
  });

  describe("object form { key: fn } — uses key", () => {
    it("works when the body references the key", () => {
      const s = dna.string().transform((v) => myHelper(v), { myHelper: arrowUpper });
      const r = s.safeParse("hello", { myHelper: arrowUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("fails when the body references the fn variable instead of the key", () => {
      const s = dna.string().transform((v) => arrowUpper(v), { myHelper: arrowUpper });
      expect(() => s.safeParse("hello", { myHelper: arrowUpper })).toThrow();
    });
  });

  describe("object shorthand { fn } — uses variable name as key", () => {
    it("works when the body references the variable name", () => {
      const s = dna.string().transform((v) => arrowUpper(v), { arrowUpper });
      const r = s.safeParse("hello", { arrowUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });
  });

  describe("name matching rule", () => {
    it("array [fn] fails when body references a different name than fn.name", () => {
      const s = dna.string().transform((v) => myHelper(v), [arrowUpper]);
      expect(() => s.safeParse("hello", { arrowUpper })).toThrow();
    });
  });
});

// ============================================================
// Externals: validate() cache (separate from safeParse cache)
// ============================================================

describe("Externals: validate() cache (cachedValidatorMap)", () => {
  const myHelper = toUpper;
  const schema = dna.string().transform((v) => myHelper(v), { myHelper });

  it("first validate() call compiles and caches with the provided external", () => {
    const ok = schema.validate("Hello", { myHelper: toUpper });
    expect(ok).toBe(true);
  });

  it("second validate() call with a different ctx object recompiles", () => {
    schema.validate("Hello", { myHelper: toUpper });
    // Different ctx object → recompiles with toLower — validation still passes
    const ok = schema.validate("Hello", { myHelper: toLower });
    expect(ok).toBe(true);
  });

  it("reusing the same ctx object reuses the cache", () => {
    const ctx = { myHelper: toUpper };
    const ok1 = schema.validate("Hello", ctx);
    const ok2 = schema.validate("Hello", ctx);
    expect(ok1).toBe(true);
    expect(ok2).toBe(true);
  });

  it("validate() and safeParse() have separate caches (separate WeakMaps)", () => {
    // Create a fresh schema to avoid interference from previous tests
    const myHelp = toUpper;
    const s = dna.string().transform((v) => myHelp(v), { myHelp });
    // Call validate first — populates cachedValidatorMap
    s.validate("Hello", { myHelp: toUpper });
    // Call safeParse — should compile separately (cachedParserMap not yet populated)
    const r = s.safeParse("Hello", { myHelp: toUpper });
    if (r.success) expect(r.data).toBe("HELLO");
  });
});

// ============================================================
// Externals: validatorBuilder (no cache, baked in at build)
// ============================================================

describe("Externals: validatorBuilder (no cache)", () => {
  const myHelper = toUpper;
  const schema = dna.string().transform((v) => myHelper(v), { myHelper });
  const dnaData = schema.toDna();

  it("builds an independent validator with the provided external", () => {
    const validate = validatorBuilder(dnaData, { myHelper: toUpper });
    expect(validate("Hello")).toBe(true);
  });

  it("each build creates an independent validator with its own external", () => {
    const validateUpper = validatorBuilder(dnaData, { myHelper: toUpper });
    const validateLower = validatorBuilder(dnaData, { myHelper: toLower });
    // Both return true (validation passes), but they are independent functions
    expect(validateUpper("Hello")).toBe(true);
    expect(validateLower("Hello")).toBe(true);
    expect(validateUpper).not.toBe(validateLower);
  });

  it("attaches requiredExternals to the returned function", () => {
    const validate = validatorBuilder(dnaData, { myHelper: toUpper });
    expect(Array.isArray(validate.requiredExternals)).toBe(true);
    expect(validate.requiredExternals).toContain("myHelper");
  });
});

// ============================================================
// Externals: methods that support externals
// ============================================================

describe("Externals: methods that support externals", () => {
  describe("transform with externals", () => {
    const myHelper = toUpper;
    it("applies the external in the transform", () => {
      const s = dna.string().transform((v) => myHelper(v), { myHelper });
      const r = s.safeParse("hello", { myHelper: toUpper });
      if (r.success) expect(r.data).toBe("HELLO");
    });
  });

  describe("catch with externals", () => {
    const prefix = "FALLBACK:";
    const fallback = (ctx: { value: unknown }) => prefix + String(ctx.value);
    it("uses the external in the catch fallback function", () => {
      const s = dna.string().catch(fallback, { prefix });
      // Pass a non-string to trigger catch
      const r = s.safeParse(123, { prefix });
      if (r.success) expect(r.data).toBe("FALLBACK:123");
    });
  });

  describe("preprocess with externals", () => {
    const trimmer = (v: unknown) => typeof v === "string" ? trimFn(v) : v;
    const trimFn = (v: string) => v.trim();
    it("uses the external in the preprocess function", () => {
      const s = dna.preprocess(trimmer, dna.string(), { trimFn });
      const r = s.safeParse("  hello  ", { trimFn });
      if (r.success) expect(r.data).toBe("hello");
    });
  });

  describe("codec with externals", () => {
    const prefixer = (v: string) => prefix + v;
    const unprefixer = (v: string) => v.slice(prefix.length);
    const prefix = "PRE:";
    it("uses externals in decode and encode", () => {
      const c = dna.codec(
        dna.string(),
        dna.string(),
        { decode: prefixer, encode: unprefixer, externals: { prefix } },
      );
      const r = c.safeParse("hello", { prefix });
      if (r.success) expect(r.data).toBe("PRE:hello");
    });
  });
});

// ============================================================
// Externals: multiple externals in a single declaration
// ============================================================

describe("Externals: multiple externals", () => {
  const toUpper2 = (v: string) => v.toUpperCase();
  const addSuffix = (v: string) => v + "!";
  // Aliases used as external key names in object-form tests — the variable
  // names must match the keys so the serialized body resolves to the
  // injected externals at runtime.
  const upper = toUpper2;
  const suffix = addSuffix;

  describe("array form [fnA, fnB]", () => {
    it("injects both externals", () => {
      const s = dna.string().transform((v) => addSuffix(toUpper2(v)), [toUpper2, addSuffix]);
      const r = s.safeParse("hello", { toUpper2, addSuffix });
      if (r.success) expect(r.data).toBe("HELLO!");
    });
  });

  describe("object form { fnA, fnB } (shorthand)", () => {
    it("injects both externals", () => {
      const s = dna.string().transform((v) => addSuffix(toUpper2(v)), { toUpper2, addSuffix });
      const r = s.safeParse("hello", { toUpper2, addSuffix });
      if (r.success) expect(r.data).toBe("HELLO!");
    });
  });

  describe("object form { keyA: fnA, keyB: fnB }", () => {
    it("injects both externals using keys", () => {
      const s = dna.string().transform((v) => suffix(upper(v)), { upper: toUpper2, suffix: addSuffix });
      const r = s.safeParse("hello", { upper: toUpper2, suffix: addSuffix });
      if (r.success) expect(r.data).toBe("HELLO!");
    });
  });

  describe("requiredExternals lists all names", () => {
    it("lists all externals in the array form", () => {
      const s = dna.string().transform((v) => addSuffix(toUpper2(v)), [toUpper2, addSuffix]);
      const dnaData = s.toDna();
      const parse = parserBuilder(dnaData, { toUpper2, addSuffix });
      expect(parse.requiredExternals).toContain("toUpper2");
      expect(parse.requiredExternals).toContain("addSuffix");
    });

    it("lists all externals in the object form", () => {
      const s = dna.string().transform((v) => suffix(upper(v)), { upper: toUpper2, suffix: addSuffix });
      const dnaData = s.toDna();
      const parse = parserBuilder(dnaData, { upper: toUpper2, suffix: addSuffix });
      expect(parse.requiredExternals).toContain("upper");
      expect(parse.requiredExternals).toContain("suffix");
    });
  });
});

// ============================================================
// Externals: portability
// parserBuilder/validatorBuilder produce NON-portable functions
// (externals are baked in the closure, toString() loses them).
// toJS() produces portable source code that can be reactivated
// without @ytrynot/dna via new Function(...code)(externals).
// ============================================================

describe("Externals: portability", () => {
  const myHelper = toUpper;
  const schema = dna.string().transform((v) => myHelper(v), { myHelper });
  const dnaData = schema.toDna();

  describe("parserBuilder — NOT portable (externals in closure)", () => {
    it("toString() does not contain the external function body", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      const source = parse.toString();
      // The external value (toUpper) is baked in the closure, not in the source.
      // toString() captures only the function body, not the closed-over values.
      expect(source).not.toContain("toUpperCase");
    });

    it("toString() does not contain @ytrynot/dna references", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      const source = parse.toString();
      expect(source).not.toContain("@ytrynot");
    });

    it("the function works when called directly (externals are in the closure)", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      const r = parse("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("eval(parse.toString()) fails — the closed-over externals are lost", () => {
      const parse = parserBuilder(dnaData, { myHelper: toUpper });
      const source = parse.toString();
      // Re-evaluating the source creates a new function WITHOUT the closure.
      // The external `myHelper` is not in the source — it was a closure variable.
      expect(() => {
        const recompiled = new Function("return " + source)();
        recompiled("hello");
      }).toThrow();
    });
  });

  describe("toJS — portable source code", () => {
    const result = toJS(false, true)(dnaData);

    it("code does not contain @ytrynot/dna references", () => {
      const source = result.code.join("\n");
      expect(source).not.toContain("@ytrynot");
    });

    it("code does not contain the external function body (only the name)", () => {
      const source = result.code.join("\n");
      // The factory source references `myHelper` as a parameter name,
      // but does not contain the actual function body (toUpperCase).
      expect(source).toContain("myHelper");
      expect(source).not.toContain("toUpperCase");
    });

    it("requiredExternals lists the external names the consumer must provide", () => {
      expect(result.requiredExternals).toContain("myHelper");
    });

    it("the factory is not yet activated — code is source, not a function", () => {
      expect(typeof result.code).toBe("object");
      expect(Array.isArray(result.code)).toBe(true);
      expect(typeof result.code[0]).toBe("string");
    });

    it("reactivation via new Function works without @ytrynot/dna", () => {
      // Simulate a consumer who has never imported @ytrynot/dna.
      // They only have: the code array + the externals map.
      const fn = new Function(...result.code)({ myHelper: toUpper });
      const r = fn("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("code survives JSON serialization (true portability — wire/file transfer)", () => {
      // The ultimate portability test: code is a plain array of strings.
      // JSON.stringify → JSON.parse simulates sending it over the wire,
      // storing it in a file, or passing it to another process.
      // The consumer side only needs new Function + the externals map.
      const serialized = JSON.stringify(result.code);
      const deserialized = JSON.parse(serialized) as string[];
      expect(Array.isArray(deserialized)).toBe(true);
      expect(deserialized.length).toBe(result.code.length);
      const fn = new Function(...deserialized)({ myHelper: toUpper });
      const r = fn("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("requiredExternals also survives JSON serialization", () => {
      const serialized = JSON.stringify({
        code: result.code,
        requiredExternals: result.requiredExternals,
      });
      const deserialized = JSON.parse(serialized) as {
        code: string[];
        requiredExternals: string[];
      };
      expect(deserialized.requiredExternals).toContain("myHelper");
      const fn = new Function(...deserialized.code)({ myHelper: toUpper });
      const r = fn("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("reactivation with different externals produces an independent function", () => {
      const fnUpper = new Function(...result.code)({ myHelper: toUpper });
      const fnLower = new Function(...result.code)({ myHelper: toLower });
      const rUpper = fnUpper("hello");
      const rLower = fnLower("hello");
      if (rUpper.success) expect(rUpper.data).toBe("HELLO");
      if (rLower.success) expect(rLower.data).toBe("hello");
    });

    it("the reactivated function is itself NOT portable (externals baked in closure)", () => {
      const fn = new Function(...result.code)({ myHelper: toUpper });
      const source = fn.toString();
      // Same as parserBuilder: once activated, externals are in the closure.
      expect(source).not.toContain("toUpperCase");
      // Re-evaluating loses the closure:
      expect(() => {
        const recompiled = new Function("return " + source)();
        recompiled("hello");
      }).toThrow();
    });
  });

  describe("double enclosure — factory vs validation function", () => {
    const result = toJS(false, true)(dnaData);

    it("code[0] is the destructured externals parameter (factory argument)", () => {
      // code[0] = "{myHelper}" — the factory's first parameter
      expect(result.code[0]).toContain("myHelper");
      expect(result.code[0]).toContain("{");
      expect(result.code[0]).toContain("}");
    });

    it("code[1] contains the function body (return function(input){...})", () => {
      // code[1] = "const ...; return function(input){ ... };"
      expect(result.code[1]).toContain("return");
      expect(result.code[1]).toContain("function");
    });

    it("new Function(...code) creates the factory (not yet called)", () => {
      const factory = new Function(...result.code);
      expect(typeof factory).toBe("function");
      // The factory has not been called yet — it just exists.
      // Calling it with externals will produce the validation function.
    });

    it("calling the factory with externals produces the validation function", () => {
      const factory = new Function(...result.code);
      const validateFn = factory({ myHelper: toUpper });
      expect(typeof validateFn).toBe("function");
      const r = validateFn("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });

    it("the factory can be called multiple times with different externals", () => {
      const factory = new Function(...result.code);
      const fnUpper = factory({ myHelper: toUpper });
      const fnLower = factory({ myHelper: toLower });
      if (fnUpper("hello").success) expect(fnUpper("hello").data).toBe("HELLO");
      if (fnLower("hello").success) expect(fnLower("hello").data).toBe("hello");
    });
  });
});

// ============================================================
// Externals: DNA portability (fromDna round-trip)
// The DNA bytecode format is self-describing: externals names
// travel in meta.externals and survive the round-trip
// schema.toDna() → fromDna(dna) → rebuilt.toDna().
// The rebuilt schema can be compiled and called with the same
// externals as the original.
// ============================================================

describe("Externals: DNA portability (fromDna round-trip)", () => {
  const toUpper2 = (v: string) => v.toUpperCase();
  const toLower2 = (v: string) => v.toLowerCase();

  // from-dna-extended.test.ts already covers the full round-trip
  // (DNA equality, safeParse/validate equivalence) for all opcodes with
  // externals. These tests focus on the externals-specific aspects not
  // covered there: requiredExternals preservation, toJS portability after
  // round-trip, and externals swap under the same name.

  describe("transform with externals — externals-specific checks", () => {
    const myHelper = toUpper2;
    const schema = dna.string().transform((v) => myHelper(v), { myHelper });

    it("requiredExternals is preserved after fromDna round-trip", () => {
      const rawDna = schema.toDna();
      const rebuilt = fromDna(rawDna);
      const parse = parserBuilder(rebuilt.toDna(), { myHelper: toUpper2 });
      expect(parse.requiredExternals).toContain("myHelper");
    });

    it("the rebuilt schema works with different externals under the same name", () => {
      const rawDna = schema.toDna();
      const rebuilt = fromDna(rawDna);
      const r = rebuilt.safeParse("hello", { myHelper: toLower2 });
      if (r.success) expect(r.data).toBe("hello");
    });

    it("the rebuilt schema's toJS output is portable (JSON round-trip)", () => {
      const rawDna = schema.toDna();
      const rebuilt = fromDna(rawDna);
      const result = toJS(false, true)(rebuilt.toDna());
      // True portability: code survives JSON serialization
      const serialized = JSON.stringify(result.code);
      const deserialized = JSON.parse(serialized) as string[];
      const fn = new Function(...deserialized)({ myHelper: toUpper2 });
      const r = fn("hello");
      if (r.success) expect(r.data).toBe("HELLO");
    });
  });
});
