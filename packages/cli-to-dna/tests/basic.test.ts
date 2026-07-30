import { describe, expect, it } from "vitest";
import { createContract, execute, pico } from "../src/index.js";
import type { IContract } from "../src/contract.js";

type Result = { success: boolean; data?: unknown; errors?: unknown[] };

describe("cli-to-dna basic verification", () => {
  it("should process a basic contract", () => {
    const contract: IContract = {
      name: "test",
      description: "test description",
      cli: {
        positionals: ["cmd"],
        flags: {
          flag: { short: "f", type: "boolean" },
        },
      },
      targets: {
        run: {
          cmd: pico.literal("run"),
          flag: pico.boolean(),
        },
      },
    };

    const processed = createContract(contract);
    expect(processed.validator).toBeDefined();
    expect(processed.parsingArgs).toBeDefined();

    const result = execute(processed, ["run", "--flag"]) as Result;
    expect(result.success).toBe(true);
    expect(result).toMatchObject({
      data: {
        cmd: "run",
        flag: true,
      },
    });
  });
});
