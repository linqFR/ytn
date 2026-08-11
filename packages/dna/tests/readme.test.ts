import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import { fromDna } from "../src/fromDna/index.js";
import { validator, parser, toJS } from "../src/toJs/dna-to-js.js";
import { validatorBuilder, parserBuilder } from "../src/toJs/dna-to-js.js";

// ============================================================
// README examples regression tests
// Verifies that every code snippet in README.md actually works
// ============================================================

describe("README: Decision Tree — schema methods", () => {
  const schema = dna.object({
    name: dna.string().min(2),
    age: dna.number().min(0),
  });

  it(".validate() returns boolean", () => {
    const isValid: boolean = schema.validate({ name: "John", age: 30 });
    expect(isValid).toBe(true);
    expect(schema.validate({ name: "Jo", age: -1 })).toBe(false);
  });

  it(".safeParse() returns structured result", () => {
    const result = schema.safeParse({ name: "Jo", age: -1 });
    expect(result.success).toBe(false);

    const ok = schema.safeParse({ name: "John", age: 30 });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toEqual({ name: "John", age: 30 });
    }
  });

  it(".parse() throws on invalid", () => {
    const data = schema.parse({ name: "John", age: 30 });
    expect(data).toEqual({ name: "John", age: 30 });

    expect(() => schema.parse({ name: "Jo", age: -1 })).toThrow();
  });

  it(".safeParseAsync() / .spa() work", async () => {
    const asyncResult = await schema.safeParseAsync({ name: "John", age: 30 });
    expect(asyncResult.success).toBe(true);

    const aliasResult = await schema.spa({ name: "John", age: 30 });
    expect(aliasResult.success).toBe(true);
  });

  it(".parseAsync() works", async () => {
    const asyncData = await schema.parseAsync({ name: "John", age: 30 });
    expect(asyncData).toEqual({ name: "John", age: 30 });
  });
});

// ============================================================
// Serialization Level 1: Schema ↔ DNA bytecode
// ============================================================

describe("README: Serialization Level 1 — toDna / fromDna", () => {
  const schema = dna.object({
    name: dna.string().min(2),
    age: dna.number().min(0),
  });

  it("toDna() returns JSON-serializable array", () => {
    const bytecode = schema.toDna();
    expect(Array.isArray(bytecode)).toBe(true);

    // JSON round-trip
    const json = JSON.stringify(bytecode);
    const restored = JSON.parse(json);
    expect(Array.isArray(restored)).toBe(true);
  });

  it("fromDna() rebuilds a working schema (untyped)", () => {
    const bytecode = schema.toDna();
    const json = JSON.stringify(bytecode);
    const restored = JSON.parse(json);

    const rebuilt = fromDna(restored);
    const result = rebuilt.safeParse({ name: "John", age: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "John", age: 30 });
    }
  });

  it("fromDna<typeof schema>() — does type inference work?", () => {
    const bytecode = schema.toDna();

    // The README claims this gives full type inference.
    // fromDna returns S at the type level, but at runtime it's always
    // DnaSomeType<any, any>. The type parameter is an assertion, not inference.
    const typed = fromDna<typeof schema>(bytecode);

    // Runtime: should work
    const result = typed.safeParse({ name: "John", age: 30 });
    expect(result.success).toBe(true);

    // Type-level: typeof schema is DnaObject<{ name: DnaString, age: DnaNumber }>
    // fromDna<typeof schema> asserts the return is the same type.
    // This is a type assertion, not real inference — but it compiles.
  });

  it("fromDna with explicit class type argument", () => {
    const strSchema = dna.string().min(2);
    const bytecode = strSchema.toDna();

    const rebuilt = fromDna<dna.DnaString>(bytecode);
    const result = rebuilt.safeParse("hello");
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Serialization Level 2: Compile to standalone JS function
// ============================================================

describe("README: Serialization Level 2 — runtime compilation vs full serialization", () => {
  const schema = dna.object({
    name: dna.string().min(2),
    age: dna.number().min(0),
  });
  const bytecode = schema.toDna();
  const input = { name: "John", age: 30 };
  const invalid = { name: "Jo", age: -1 };

  // 2a: Runtime compilation — validatorBuilder/parserBuilder
  // Externals injected into closure at compile time. Not portable.
  it("validatorBuilder() — runtime compilation for builder DNA", () => {
    const validate = validatorBuilder(bytecode);
    expect(validate(input)).toBe(true);
    expect(validate(invalid)).toBe(false);
  });

  it("parserBuilder() — runtime compilation for builder DNA", () => {
    const parse = parserBuilder(bytecode);
    const result = parse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
    expect(parse(invalid).success).toBe(false);
  });

  // validator()/parser() — canonical DNA only (no builder opcodes, no externals)
  // Works for simple builder schemas because basic opcodes overlap, but
  // builder-specific opcodes (o, a, or, and, etc.) are NOT in basicHandlers.
  it("validator() — canonical DNA shortcut (no externals)", () => {
    const validate = validator(bytecode);
    expect(typeof validate(input)).toBe("boolean");
  });

  // 2b: Full serialization — toJS() returns portable source code
  // Only this form is portable (no @ytrynot/dna needed on consumer side)
  it("toJS() — full serialization, portable source code", () => {
    const result = toJS(false, true)(bytecode) as { code: string[]; requiredExternals: string[] };
    expect(Array.isArray(result.code)).toBe(true);
    expect(result.code.length).toBeGreaterThan(0);

    // Consumer side: re-evaluate without @ytrynot/dna
    const fn = new Function(...result.code)({});
    const parsed = fn(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual(input);
    }
  });

  it("runtime-compiled function is NOT portable (externals in closure)", () => {
    const validate = validatorBuilder(bytecode);
    const source = validate.toString();
    // The function source is self-contained for simple schemas (no externals),
    // but for schemas WITH externals, the values are in the closure, not the source.
    // toString() would lose them. Only toJS() output is portable.
    expect(source).not.toContain("@ytrynot");
  });

  it("toJS() output IS portable (source + requiredExternals list)", () => {
    const result = toJS(true, true)(bytecode) as { code: string[]; requiredExternals: string[] };
    const source = result.code.join("\n");
    expect(source).not.toContain("@ytrynot");
    expect(source).not.toContain("require");
    expect(source).not.toContain("import");
    expect(Array.isArray(result.requiredExternals)).toBe(true);
  });
});

// ============================================================
// fromDna with dna.function — the example from recipes.md
// ============================================================

describe("README/recipes: fromDna with dna.function", () => {
  it("rebuilds a function schema and .implement() works", () => {
    const fnSchema = dna.function().input([dna.string()]).output(dna.number());
    const rebuiltFn = fromDna<ReturnType<typeof dna.function>>(fnSchema.toDna());
    const impl = rebuiltFn.implement((s: string) => s.length);
    expect(impl("hello")).toBe(5);
  });

  it("function schema with options object form", () => {
    const funcSchema = dna.function({
      input: [dna.string()] as const,
      output: dna.number(),
    });
    const strlen = funcSchema.implement((s: string) => s.length);
    expect(strlen("hello")).toBe(5);
    expect(() => strlen(123 as any)).toThrow();
  });
});

// ============================================================
// toJSONSchema
// ============================================================

describe("README: toJSONSchema()", () => {
  it("exports to JSON Schema", () => {
    const schema = dna.object({
      name: dna.string().min(2),
      age: dna.number().min(0),
    });
    const jsonSchema = schema.toJSONSchema();
    expect(typeof jsonSchema).toBe("object");
    expect(jsonSchema).not.toBeNull();
  });
});

// ============================================================
// Recipes: object modes
// ============================================================

describe("recipes: object modes", () => {
  it("standard strips unknown keys", () => {
    const standard = dna.object({ name: dna.string() });
    const result = standard.safeParse({ name: "John", extra: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "John" });
    }
  });

  it("strict rejects unknown keys", () => {
    const strict = dna.strictObject({ name: dna.string() });
    const result = strict.safeParse({ name: "John", extra: 1 });
    expect(result.success).toBe(false);
  });

  it("loose passes unknown keys through", () => {
    const loose = dna.looseObject({ name: dna.string() });
    const result = loose.safeParse({ name: "John", extra: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "John", extra: 1 });
    }
  });
});

// ============================================================
// Recipes: discriminated union
// ============================================================

describe("recipes: discriminated union", () => {
  const schema = dna.discriminatedUnion("type", [
    dna.object({ type: dna.literal("a"), a: dna.string() }),
    dna.object({ type: dna.literal("b"), b: dna.number() }),
  ]);

  it("valid inputs", () => {
    expect(schema.parse({ type: "a", a: "hello" })).toEqual({ type: "a", a: "hello" });
    expect(schema.parse({ type: "b", b: 42 })).toEqual({ type: "b", b: 42 });
  });

  it("invalid input", () => {
    expect(() => schema.parse({ type: "a", b: 42 })).toThrow();
  });
});

// ============================================================
// Recipes: recursion via dna.lazy()
// ============================================================

describe("recipes: recursion via dna.lazy()", () => {
  it("recursive Category schema", () => {
    type Category = { name: string; subcategories: Category[] };
    const CategorySchema: ReturnType<typeof dna.lazy<Category>> = dna.lazy(() =>
      dna.object({
        name: dna.string(),
        subcategories: dna.array(CategorySchema),
      })
    );

    const result = CategorySchema.parse({
      name: "root",
      subcategories: [{ name: "child", subcategories: [] }],
    });
    expect(result.name).toBe("root");
    expect(result.subcategories[0].name).toBe("child");
  });
});

// ============================================================
// Recipes: template literals
// ============================================================

describe("recipes: template literals", () => {
  it("templateLiteral — validate-only, output unchanged", () => {
    const validateUrl = dna.templateLiteral([
      "https://",
      dna.string(),
      ".",
      dna.enum(["com", "net"]),
    ]);
    const result = validateUrl.parse("https://example.com");
    expect(result).toBe("https://example.com");
  });

  it("templateLiteralMutate — inner transformations applied", () => {
    const normalizeUser = dna.templateLiteralMutate([
      "user:",
      dna.string().min(3).toUpperCase(),
    ]);
    const result = normalizeUser.parse("user:john");
    expect(result).toBe("user:JOHN");
  });
});

// ============================================================
// Recipes: coercion
// ============================================================

describe("recipes: coercion", () => {
  it("coerce.string", () => {
    expect(dna.coerce.string().parse(123)).toBe("123");
  });
  it("coerce.number", () => {
    expect(dna.coerce.number().parse("123")).toBe(123);
  });
  it("coerce.boolean", () => {
    expect(dna.coerce.boolean().parse("true")).toBe(true);
  });
});

// ============================================================
// Recipes: default, prefault, catch
// ============================================================

describe("recipes: default / prefault / catch", () => {
  it(".default() on undefined", () => {
    expect(dna.string().default("fallback").parse(undefined)).toBe("fallback");
  });

  it(".catch() on invalid", () => {
    expect(dna.string().catch("fallback").parse(123)).toBe("fallback");
  });
});

// ============================================================
// Recipes: brand
// ============================================================

describe("recipes: brand", () => {
  it(".brand() is type-level only", () => {
    const schema = dna.object({ name: dna.string() }).brand<"MyBrand">();
    const result = schema.parse({ name: "John" });
    expect(result).toEqual({ name: "John" });
  });
});
