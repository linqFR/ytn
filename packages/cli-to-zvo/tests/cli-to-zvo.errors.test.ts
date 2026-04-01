import { describe, it, expect } from "vitest";
import { Contract, pico } from "../src/index.js";

describe("🧪 CLI-to-ZVO: Robustness and Error Testing", () => {
  describe("Step 1: Contract Definition Errors (Compile/Setup)", () => {
    it("must reject a contract if a target uses a field not defined in the CLI", () => {
      let error: any;
      try {
        Contract.create({
          name: "broken-cli",
          description: "Test CLI",
          cli: { flags: { "valid-flag": { type: "string" } } },
          targets: { myRoute: { ghostField: pico.string() } },
        } as any);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Error with the Contract");
      expect(error.cause.toString()).toContain("is not defined in cli");
    });

    it("must reject an empty target", () => {
      let error: any;
      try {
        Contract.create({
          name: "broken-cli",
          description: "Test CLI",
          cli: { flags: { verbose: { type: "boolean" } } },
          targets: { emptyRoute: {} },
        } as any);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Error with the Contract");
      expect(error.cause.toString()).toContain(
        "A target must have at least one defined field",
      );
    });

    it("must reject a contract without flags or positionals", () => {
      let error: any;
      try {
        Contract.create({
          name: "broken-cli",
          description: "Test CLI",
          cli: { flags: {}, positionals: [] },
          targets: { route: { toto: pico.string() } },
        } as any);
      } catch (e) {
        error = e;
      }
      expect(error).toBeDefined();
      expect(error.message).toBe("Error with the Contract");
      expect(error.cause.toString()).toContain(
        "contract.cli must define at least one positional or one flag",
      );
    });
  });

  describe("Step 2: Parsing and Routing Errors (Runtime CLI)", () => {
    const validContract = Contract.create({
      name: "test-cli",
      description: "A valid contract",
      cli: {
        positionals: ["action"],
        flags: {
          age: { type: "string", short: "a" },
          verbose: { type: "boolean", short: "v" },
          config: { type: "string", short: "c" },
        },
      },
      targets: {
        runAction: {
          action: pico.literal("run"),
          age: pico.number().min(18, "Too young!"),
          verbose: pico.boolean().optional(),
        },
        loadConfig: {
          action: pico.literal("load"),
          config: pico.json(),
        },
      },
    });

    it("must fail if an unknown flag is passed (unrecognized_keys)", () => {
      const res = validContract.parseCli([
        "run",
        "--age",
        "20",
        "--unknown-flag",
      ]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain("unrecognized_keys");
      }
    });

    it("must fail if there are too many positional arguments (too_big)", () => {
      const res = validContract.parseCli([
        "run",
        "extraPositional",
        "--age",
        "20",
      ]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain("too_big");
      }
    });

    it("must fail if no route matches (No Discriminant / Fallback fail)", () => {
      const res = validContract.parseCli(["jump"]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain("invalid_union");
      }
    });

    it("must fail if strict Zod validation is not respected (e.g., min)", () => {
      const res = validContract.parseCli(["run", "--age", "15"]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain("Too young!");
      }
    });

    it("must fail if an uncoercible value is passed to a number", () => {
      const res = validContract.parseCli(["run", "--age", "twenty-years"]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues).toLowerCase()).toContain(
          'received":"nan',
        );
      }
    });

    it("must fail (Codec Error) if an invalid JSON is passed to pico.json()", () => {
      const res = validContract.parseCli([
        "load",
        "--config",
        "{ badJson: true }",
      ]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain(
          "Invalid JSON format",
        );
      }
    });
  });

  describe("Step 3: List Tests and Restrictive Transformations", () => {
    const listContract = Contract.create({
      name: "list-cli",
      description: "Test list parsing",
      cli: {
        flags: { tags: { type: "string" } },
      },
      targets: {
        main: {
          tags: pico.stringList().min(2, "At least 2 tags are required"),
        },
      },
    });

    it("must fail if the CSV/List parser does not satisfy the Zod constraint (min length)", () => {
      const res = listContract.parseCli(["--tags", "tag1"]);
      expect(res).toMatchObject({ success: false });
      if (!res.success) {
        expect(JSON.stringify(res.error.issues)).toContain(
          "At least 2 tags are required",
        );
      }
    });
  });

  it("must accept a contract with exactly the maximum allowed 31 arguments", () => {
    // Generate exactly 31 flags
    const maxFlags: Record<string, any> = {};
    for (let i = 1; i <= 31; i++) {
      maxFlags[`flag${i}`] = { type: "boolean" };
    }

    let error: any;
    try {
      Contract.create({
        name: "max-capacity-cli",
        description: "Testing the absolute limit of the bitwise engine",
        cli: { flags: maxFlags },
        targets: {
          // Target requires the very last allowed flag
          maxRoute: { flag31: pico.boolean() },
        },
      });
    } catch (e) {
      error = e;
    }

    // The engine should successfully compile a 31-argument contract
    expect(error).toBeUndefined();
  });

  it("must reject a contract that exceeds the 31 arguments limit (Bitwise Overflow Prevention)", () => {
    // Generate 32 flags (1 too many for a 32-bit signed integer bitmask)
    const overflowFlags: Record<string, any> = {};
    for (let i = 1; i <= 32; i++) {
      overflowFlags[`flag${i}`] = { type: "boolean" };
    }

    let error: any;
    try {
      Contract.create({
        name: "overflow-cli",
        description: "Testing the overflow prevention",
        cli: { flags: overflowFlags },
        targets: {
          overflowRoute: { flag32: pico.boolean() },
        },
      });
    } catch (e) {
      error = e;
    }

    // The compiler must aggressively reject the contract before generating corrupted bitmasks
    expect(error).toBeDefined();
    expect(error.message).toBe("Error with the Contract");

    // Ensure the error message explicitly mentions the 32-bit limit
    // (This relies on the .refine() rule added to contractCliSchema)
    expect(error.cause.toString()).toContain("maximum of 31 total arguments");
  });
});
