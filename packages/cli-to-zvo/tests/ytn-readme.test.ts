import { describe, expect, it } from "vitest";
import { cliToZod, pico, type tsContract } from "../src/index.js";
import { parseCli } from "../src/core/cli-parser.js";

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
            intercept: true
          },
        },
      },
      targets: {
        deploy: {
          env: pico.string(),
          verbose: pico.boolean(),
        },
      },
    };
    // 2. Encapsulated Parsing & Validation
    const processed = cliToZod(contract);
    const { parsingArgs, parseArgsResultParser, zvoSchema } = processed;
    const res = parseCli(["prod", "--verbose"], parsingArgs, parseArgsResultParser, zvoSchema);
    if (!res.success) throw res.error;
    const result = res.data;



    // Assertions
    expect(result.route).toBe("deploy");
    if (result.route === "deploy") {
      expect(result.data.env).toBe("prod");
      expect(result.data.verbose).toBe(true);
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
            intercept: true
          },
        },
      },
      targets: {
        deploy: {
          env: pico.string(),
          verbose: pico.boolean(),
        },
      },
    };
    const processed = cliToZod(contract);
    const { parsingArgs, parseArgsResultParser, zvoSchema } = processed;
    const res = parseCli(["dev", "-v"], parsingArgs, parseArgsResultParser, zvoSchema);
    if (!res.success) throw res.error;
    const result = res.data;



    expect(result.route).toBe("deploy");
    if (result.route === "deploy") {
      expect(result.data.env).toBe("dev");
      expect(result.data.verbose).toBe(true);
    }
  });
});
