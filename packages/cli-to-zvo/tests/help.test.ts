import { describe, expect, it } from "vitest";
import { cliToZod, type tsContract, pico } from "../src/index.js";

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

    const processed = cliToZod(contract);
    expect(processed.router).toBeDefined();
  });
});
