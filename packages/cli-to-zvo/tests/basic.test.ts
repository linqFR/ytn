import { describe, expect, it } from "vitest";
import { cliToZod, ContractSchema, pico, tsContract } from "../src/index.js";

import { ZvoTestGate } from "./zvo-gate.test.js";

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
    const testGate = new ZvoTestGate(processed);
    const tools = cliToZod(contract);
    expect(testGate.testSchema).toBeDefined();
    expect(tools.router).toBeDefined();

    const data = { flag: true };
    const result = testGate.testSchema.parse(data);

    // Local check
    expect(result.route).toBe("run");
    expect(result.data.flag).toBe(true);

    // Global check (robust after spread)
    const spread = { ...result };
    expect(spread.route).toBe("run");
  });
});
