import { describe, expect, it } from "vitest";
import { pico, ContractSchema } from "../src/editor.js";

describe("CliContractSchema", () => {
  it("should validate a correct hybrid contract (with positional and flag)", () => {
    const contract = {
      name: "test-app",
      description: "A test application",
      cli: {
        positionals: ["input-file"],
        flags: {
          verbose: {
            short: "v",
            type: "boolean",
            desc: "Enable verbose logging",
          },
        },
      },
      targets: {
        run: {
          inputFile: pico.filepath(),
          verbose: pico.boolean(),
        },
      },
    };

    const result = ContractSchema.safeParse(contract);
    if (!result.success) {
      // console.error(JSON.stringify(result.error.issues, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it("should fail if name or description is missing", () => {
    const invalid = {
      cli: { positionals: ["test"] },
      targets: { test: { test: pico.string() } },
    };
    const result = ContractSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should fail if a target uses a field not defined in cli", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        positionals: ["known-field"],
      },
      targets: {
        run: {
          unknownField: pico.string(),
        },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        'Field "unknownField" in target "run" is not defined in cli.',
      );
    }
  });

  it("should fail if cli keys are not kebab-case", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        flags: {
          not_kebab_case: { type: "boolean", short: "n" },
        },
      },
      targets: {
        default: { notKebabCase: pico.boolean() },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
  });

  it("should fail if target keys are not camelCase", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        flags: {
          "my-flag": { type: "boolean", short: "m" },
        },
      },
      targets: {
        "not-camel-case": { myFlag: pico.boolean() },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
  });

  it("should support .desc() alias on pico schemas", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        positionals: ["field"],
      },
      targets: {
        run: {
          field: pico.string().desc("This is a description"),
        },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it("should support literal values with pico.literal()", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        flags: { mode: { type: "string", short: "m" } },
      },
      targets: {
        prod: {
          mode: pico.literal("production"),
        },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it("should support enums with pico.enum()", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        flags: { color: { type: "string", short: "c" } },
      },
      targets: {
        ui: {
          color: pico.enum("red", "green", "blue"),
        },
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
  });

  it("should inherit description from .desc() or from cli definition", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        flags: {
          "flag-a": {
            type: "boolean",
            desc: "Description from CLI",
            short: "a",
          },
          "flag-b": { type: "boolean", short: "b" },
        },
      },
      targets: {
        run: {
          flagA: pico.boolean(),
          flagB: pico.boolean().desc("Description from .desc()"),
        },
      },
    };

    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;
      const runTarget = data.targets.run;
      // Inherited from cli.flags["flag-a"]
      expect(runTarget.fields["flag-a"]).toBe("Description from CLI");
      // Inherited from .desc() on flag-b
      expect(runTarget.fields["flag-b"]).toBe("Description from .desc()");
    }
  });

  it("should fail if a target is totally empty (handled via cli check)", () => {
    const contract = {
      name: "test",
      description: "test",
      cli: {
        positionals: [],
        flags: {},
      },
      targets: {
        any: {},
      },
    };
    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(
        "must define at least one positional or one flag",
      );
    }
  });

  it("should generate correct discriminants and bitGroups", () => {
    const contract = {
      name: "multi-command",
      description: "Test for discriminants and grouping",
      cli: {
        positionals: ["command", "path"],
        flags: {
          verbose: { type: "boolean", short: "v" },
          force: { type: "boolean", short: "f" },
          help: { type: "boolean", short: "h" },
        },
      },
      targets: {
        copyTarget: {
          command: pico.literal("cp"),
          path: pico.filepath(),
          verbose: pico.boolean(),
        },
        moveTarget: {
          command: pico.literal("mv"),
          path: pico.filepath(),
          verbose: pico.boolean(),
        },
        deleteTarget: {
          command: pico.literal("rm"),
          path: pico.filepath(),
          force: pico.boolean(),
        },
        helpTarget: {
          help: pico.literal(true),
        },
      },
    };

    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;

      // console.log("======================= helpTARGET problem ==========================")

      // // Debug display
      // console.log(
      //   "Discriminants:",
      //   JSON.stringify(data.routing.discriminants, null, 2),
      // );

      const bitGroups = new Map<string, string[]>();
      Object.entries(data.targets).forEach(([name, target]) => {
        const code = (target as any).targetCode.toString();
        if (!bitGroups.has(code)) bitGroups.set(code, []);
        bitGroups.get(code)!.push(name);
      });

      // console.log(
      //   "BitGroups:",
      //   Array.from(bitGroups.entries()).map(([k, v]) => ({
      //     code: k,
      //     targets: v,
      //   })),
      // );

      // Discriminant verification
      expect(data.routing.discriminants.command).toContain("cp");
      expect(data.routing.discriminants.command).toContain("mv");
      expect(data.routing.discriminants.command).toContain("rm");

      // Bit-based grouping verification via targets
      expect(
        Array.from(bitGroups.values()).some(
          (g) => g.includes("copyTarget") && g.includes("moveTarget"),
        ),
      ).toBe(true);
      expect(
        Array.from(bitGroups.values()).some(
          (g) => g.includes("deleteTarget") && !g.includes("copyTarget"),
        ),
      ).toBe(true);

      // Signature format: mask:values...
      expect(data.routing.router[`7:cp:`]).toBe("copyTarget");
      expect(data.routing.router[`16::true`]).toBe("helpTarget");
      expect((data.targets.copyTarget as any).targetCode.toString()).toBe("7");
      expect((data.targets.deleteTarget as any).targetCode.toString()).toBe(
        "11",
      );
      expect((data.targets.helpTarget as any).targetCode.toString()).toBe("16");

      // Bit check
      expect(data.routing.def.help).toBeDefined();
    }
  });

  it("should allow finding possible targets from a dynamic bitset", () => {
    const contract = {
      name: "resolver-test",
      description: "Test for dynamic bitset resolution",
      cli: {
        positionals: ["command"],
        flags: {
          v: { type: "boolean", short: "v" },
          f: { type: "boolean", short: "f" },
        },
      },
      targets: {
        one: { command: pico.literal("1"), v: pico.boolean() },
        two: { command: pico.literal("2"), v: pico.boolean() },
        three: { command: pico.literal("3"), f: pico.boolean() },
      },
    };

    const result = ContractSchema.safeParse(contract);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as any;

      // Simulation: user provided "command" (positional) and "v" (flag)
      const providedArgs = ["command", "v"];
      let dynamicBitset = 0;
      providedArgs.forEach((arg) => {
        const bit = data.routing.def[arg];
        if (bit) dynamicBitset |= bit;
      });

      // Resolution via targets
      const possibleTargets = Object.entries(data.targets)
        .filter(([_, t]: any) => t.targetCode === dynamicBitset)
        .map(([name]) => name);

      expect(possibleTargets).toContain("one");
      expect(possibleTargets).toContain("two");

      // DIRECT resolution via router (O(1))
      // Signature = mask:literals...
      const signature = `3:1`;
      const finalTarget = data.routing.router[signature];
      expect(finalTarget).toBe("one");

      // console.log(
      //   `Resolved targets for bitset ${dynamicBitset.toString()}:`,
      //   possibleTargets,
      // );
      // console.log(
      //   `Final O(1) resolution for signature "${signature}":`,
      //   finalTarget,
      // );
    }
  });
});
