import { describe, expect, it } from "vitest";
import { pico, type tsContract } from "../src/editor.js";
import { createContract } from "../src/editor.js";
import { execute } from "../src/index.js";

describe("README CLI Example", () => {
  it("should parse and validate the deployment command correctly", () => {
    // 1. Define the Contract
    const contract: tsContract = {
      name: "ytn-cli",
      description: "YTN CLI tool",
      cli: {
        positionals: ["env"],
        flags: {
          verbose: {
            short: "v",
            type: "boolean",
            desc: "Enable detailed logging",
          },
        },
      },
      targets: {
        deploy: {
          env: pico.string(),
          verbose: "boolean",
        },
      },
    };
    // 2. Encapsulated Parsing & Validation (following README Step 4)
    const processed = createContract(contract);
    const result = execute(processed, ["prod", "--verbose"]);

    // Assertions
    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("deploy");
      expect(data.env).toBe("prod");
      expect(data.verbose).toBe(true);
    }
  });

  it("should handle the short flag -v correctly", () => {
    const contract: tsContract = {
      name: "ytn-cli",
      description: "YTN CLI tool",
      cli: {
        positionals: ["env"],
        flags: {
          verbose: {
            short: "v",
            type: "boolean",
            desc: "Enable detailed logging",
          },
        },
      },
      targets: {
        deploy: {
          env: pico.string(),
          verbose: "boolean",
        },
      },
    };
    const processed = createContract(contract);
    const result = execute(processed, ["dev", "-v"]);

    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("deploy");
      expect(data.env).toBe("dev");
      expect(data.verbose).toBe(true);
    }
  });
});
