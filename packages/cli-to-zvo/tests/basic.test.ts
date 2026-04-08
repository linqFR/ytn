import { describe, expect, it } from "vitest";
// import { cliToZod, ContractSchema, pico, tsContract } from "../src/index.js";

import { ContractSchema, createContract, pico, type tsContract } from "../src/editor.js";
import { compileZvoTestGate } from "./zvo-gate.test.js";
// import { createContract } from "../src/editor/contract-create.js";

describe("cli-to-zvo basic verification", () => {
  it("should process a basic contract", () => {
    const contract: tsContract = {
      name: "test",
      description: "test description",
      cli: {
        flags: {
          flag: {
            short: "f",
            desc: "a flag",
            type: "boolean",
          },
        },
      },
      targets: {
        run: {
          flag: pico.boolean(),
        },
      },
    };

    const processed = ContractSchema.parse(contract);
    const testSchema = compileZvoTestGate(processed);
    const tools = createContract(contract);
    expect(testSchema).toBeDefined();
    expect(tools.router).toBeDefined();

    const data = { flag: true };
    const result = testSchema.parse(data);

    // Local check
    expect(result.route).toBe("run");
    expect(result.data.flag).toBe(true);

    // Global check (robust after spread)
    const spread = { ...result };
    expect(spread.route).toBe("run");
  });
});
