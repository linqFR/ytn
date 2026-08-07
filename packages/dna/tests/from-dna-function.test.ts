import { describe, it, expect } from "vitest";
import { dna } from "../src/index.js";
import { fromDna } from "../src/fromDna/index.js";
import { registerExternal } from "../src/toJs/registry.js";

describe("fromDna: dna.function reconstruction", () => {
  describe("basic roundtrip + implement", () => {
    it("reconstructs a simple function and .implement() works", () => {
      const original = dna.function()
        .input([dna.string(), dna.number()])
        .output(dna.boolean());

      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;

      // DNA roundtrips identically
      expect(rebuilt.toDna()).toEqual(adn);

      // implement and use
      const impl = rebuilt.implement((s, n) => s.length > n);
      expect(impl("hello", 3)).toBe(true);
      expect(impl("hi", 5)).toBe(false);
    });

    it("validates input types at runtime via .implement()", () => {
      const original = dna.function()
        .input([dna.string(), dna.number()])
        .output(dna.boolean());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s, n) => s.length > n);

      // Wrong input type: number instead of string
      expect(() => {
        // @ts-ignore - intentionally wrong type
        impl(123, 3);
      }).toThrow(/String is required/);
    });

    it("validates output type at runtime via .implement()", () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      // Return a number instead of the expected string
      const impl = rebuilt.implement((s) => s.length as unknown as string);

      expect(() => {
        impl("hello");
      }).toThrow(/String is required/);
    });

    it("validates too few arguments via .implement()", () => {
      const original = dna.function()
        .input([dna.string(), dna.number()])
        .output(dna.boolean());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s, n) => s.length > n);

      // @ts-ignore - intentionally wrong arity
      expect(() => impl("hello")).toThrow(/at least 2 items/);
    });
  });

  describe("basic roundtrip + implementAsync", () => {
    it("reconstructs and .implementAsync() works", async () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s.toUpperCase());

      expect(await impl("hello")).toBe("HELLO");
    });

    it("validates input via .implementAsync()", async () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s.toUpperCase());

      await expect(
        // @ts-ignore - intentionally wrong type
        impl(123)
      ).rejects.toThrow(/String is required/);
    });

    it("validates output via .implementAsync()", async () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s.length as unknown as string);

      await expect(impl("hello")).rejects.toThrow(/String is required/);
    });
  });

  describe("with rest args", () => {
    it("reconstructs a function with rest args", () => {
      const original = dna.function()
        .input([dna.string()], dna.number())
        .output(dna.boolean());

      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;
      expect(rebuilt.toDna()).toEqual(adn);

      const impl = rebuilt.implement((s, ...nums) => nums.reduce((a, b) => a + b, 0) > s.length);
      expect(impl("hi", 1, 2, 3)).toBe(true);
      expect(impl("hello", 1)).toBe(false);
    });
  });

  describe("with no input / no output", () => {
    it("reconstructs a function with no input", () => {
      const original = dna.function().output(dna.string());
      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;
      expect(rebuilt.toDna()).toEqual(adn);

      const impl = rebuilt.implement(() => "no args");
      expect(impl()).toBe("no args");
    });

    it("reconstructs a function with no output (defaults to unknown)", () => {
      const original = dna.function().input([dna.string()]);
      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;
      expect(rebuilt.toDna()).toEqual(adn);
    });
  });

  describe("with externals (registered)", () => {
    it("DNA roundtrip preserves externals metadata in input transform", () => {
      const upperHelper = (v: string) => v.toUpperCase();
      registerExternal("upperHelper", upperHelper);

      const original = dna.function()
        .input([dna.string().transform((s) => upperHelper(s), [upperHelper])])
        .output(dna.string());

      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;
      // The DNA (including externals meta) roundtrips identically
      expect(rebuilt.toDna()).toEqual(adn);
    });

    it("DNA roundtrip preserves externals metadata in output transform", () => {
      const lowerHelper = (v: string) => v.toLowerCase();
      registerExternal("lowerHelper", lowerHelper);

      const original = dna.function()
        .input([dna.string()])
        .output(dna.string().transform((s) => lowerHelper(s), [lowerHelper]));

      const adn = original.toDna();
      const rebuilt = fromDna(adn) as ReturnType<typeof dna.function>;
      expect(rebuilt.toDna()).toEqual(adn);
    });

    it(".implement() works with registered externals in input transform", () => {
      const upperHelper = (v: string) => v.toUpperCase();
      registerExternal("upperHelper", upperHelper);

      const original = dna.function()
        .input([dna.string().transform((s) => upperHelper(s), [upperHelper])])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s + "!");
      // The transform uppercases the input before the function sees it
      expect(impl("hello")).toBe("HELLO!");
    });

    it(".implement() works with registered externals in output transform", () => {
      const lowerHelper = (v: string) => v.toLowerCase();
      registerExternal("lowerHelper", lowerHelper);

      const original = dna.function()
        .input([dna.string()])
        .output(dna.string().transform((s) => lowerHelper(s), [lowerHelper]));

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s.toUpperCase());
      // The function returns UPPER, but the output transform lowercases it
      expect(impl("hello")).toBe("hello");
    });

    it(".implement() accepts explicit externals (not registered)", () => {
      const prefixHelper = (v: string) => "pre:" + v;
      // NOT registered via registerExternal

      const original = dna.function()
        .input([dna.string().transform((s) => prefixHelper(s), [prefixHelper])])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      // Pass externals explicitly to .implement()
      const impl = rebuilt.implement((s) => s + "!", { prefixHelper });
      expect(impl("hello")).toBe("pre:hello!");
    });

    it(".implementAsync() works with registered externals", async () => {
      const upperHelper = (v: string) => v.toUpperCase();
      registerExternal("upperHelper", upperHelper);

      const original = dna.function()
        .input([dna.string().transform((s) => upperHelper(s), [upperHelper])])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s + "!");
      expect(await impl("hello")).toBe("HELLO!");
    });

    it(".implementAsync() accepts explicit externals (not registered)", async () => {
      const suffixHelper = (v: string) => v + ":suf";
      // NOT registered

      const original = dna.function()
        .input([dna.string()])
        .output(dna.string().transform((s) => suffixHelper(s), [suffixHelper]));

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s.toUpperCase(), { suffixHelper });
      expect(await impl("hello")).toBe("HELLO:suf");
    });

    it(".implement() exposes requiredExternals on the returned function", () => {
      const upperHelper = (v: string) => v.toUpperCase();
      const lowerHelper = (v: string) => v.toLowerCase();
      registerExternal("upperHelper", upperHelper);
      registerExternal("lowerHelper", lowerHelper);

      const original = dna.function()
        .input([dna.string().transform((s) => upperHelper(s), [upperHelper])])
        .output(dna.string().transform((s) => lowerHelper(s), [lowerHelper]));

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s + "!");

      expect(impl.requiredExternals).toContain("upperHelper");
      expect(impl.requiredExternals).toContain("lowerHelper");
    });

    it(".implement() requiredExternals is empty when no externals are used", () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.number());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s.length);

      expect(impl.requiredExternals).toEqual([]);
    });

    it(".implementAsync() exposes requiredExternals on the returned function", async () => {
      const upperHelper = (v: string) => v.toUpperCase();
      registerExternal("upperHelper", upperHelper);

      const original = dna.function()
        .input([dna.string().transform((s) => upperHelper(s), [upperHelper])])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s + "!");

      expect(impl.requiredExternals).toContain("upperHelper");
    });
  });

  describe("nested in objects", () => {
    it("reconstructs a function nested in an object schema", () => {
      const original = dna.object({
        name: dna.string(),
        method: dna.function()
          .input([dna.string()])
          .output(dna.number()),
      });

      const adn = original.toDna();
      const rebuilt = fromDna(adn) as any;
      expect(rebuilt.toDna()).toEqual(adn);
    });
  });

  describe("DNA structure", () => {
    it("emits opcode 'function' with [inputDnaId, outputDnaId]", () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.number());

      const adn = original.toDna();
      const fnNode = adn[0] as any[];
      expect(fnNode[0]).toBe("function");
      expect(Array.isArray(fnNode[1])).toBe(true);
      expect(fnNode[1]).toHaveLength(2);
      // Index 0 = input schema ID, Index 1 = output schema ID
      const inputNode = adn[fnNode[1][0]] as any[];
      expect(inputNode[0]).toBe("a"); // tuple
      const outputNode = adn[fnNode[1][1]] as any[];
      expect(outputNode[0]).toBe("n"); // number
    });
  });

  describe("error cases", () => {
    it("throws on unknown opcode in fromDna", () => {
      const badDna = [["unknownOpcode", {}], []] as any;
      expect(() => fromDna(badDna)).toThrow(/opcode not implemented: unknownOpcode/);
    });

    it("throws when input validation fails with custom refine", () => {
      const original = dna.function()
        .input([dna.string().refine((s) => s.startsWith("A"), { error: "Must start with A" })])
        .output(dna.boolean());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s.length > 0);

      expect(() => impl("hello")).toThrow(/Must start with A/);
      expect(impl("Apple")).toBe(true);
    });

    it("throws when output validation fails with enum", () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.enum(["red", "green", "blue"]));

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s as unknown as "red" | "green" | "blue");

      expect(() => impl("hello")).toThrow();
      expect(impl("red")).toBe("red");
    });

    it("throws when input is wrong type in nested object function", () => {
      const original = dna.function()
        .input([dna.object({ name: dna.string(), age: dna.number() })])
        .output(dna.string());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((obj) => obj.name);

      // Missing age
      expect(() => impl({ name: "Alice" })).toThrow();
      // Wrong type for age
      expect(() => impl({ name: "Alice", age: "old" })).toThrow();
      // Valid
      expect(impl({ name: "Alice", age: 30 })).toBe("Alice");
    });

    it("throws when too many arguments (no rest)", () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.boolean());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implement((s) => s.length > 0);

      // Extra args are rejected because items=false (no rest)
      expect(() => impl("hello", "extra")).toThrow(/Additional items not allowed/);
    });

    it("throws on async output validation via implementAsync", async () => {
      const original = dna.function()
        .input([dna.string()])
        .output(dna.number());

      const rebuilt = fromDna(original.toDna()) as ReturnType<typeof dna.function>;
      const impl = rebuilt.implementAsync(async (s) => s as unknown as number);

      await expect(impl("hello")).rejects.toThrow(/number is required/);
    });
  });
});
