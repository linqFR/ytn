import { describe, expect, it } from "vitest";
import { createContract, type tsContract, pico } from "../src/editor.js";

describe("CLI Help Verification", () => {
  it("should provide help support manually via cli definition", () => {
    const contract: tsContract = {
      name: "test-cli",
      description: "A CLI to test help",
      cli: {
        flags: {
          version: {
            short: "v",
            type: "boolean",
            desc: "show version",
          },
          help: {
            short: "h",
            type: "boolean",
            desc: "Show help information",
          },
        },
      },
      targets: {
        main: {
          version: pico.boolean(),
        },
        help: {
          help: pico.literal(true),
        },
      },
    };

    const processed = createContract(contract);
    expect(processed.router).toBeDefined();
  });
});
