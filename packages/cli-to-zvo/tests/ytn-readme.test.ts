import { describe, expect, it } from "vitest";
import { RoutedResult } from "../src/cli-contract-schema_old.js";
import { cliToZVO } from "../src/index.js";

describe("README CLI Example", () => {
  it("should parse and validate the deployment command correctly", () => {
    // 1. Define the Contract
    const contract = {
      name: "ytn-cli",
      description: "YTN CLI tool",
      def: {
        verbose: {
          type: "boolean",
          flags: { long: "verbose", short: "v" },
          description: "Enable detailed logging",
        },
        env: { type: "string", description: "Target environment (dev/prod)" },
      },
      targets: {
        Deploy: {
          description: "Trigger a deployment",
          positionals: ["env"],
          flags: { verbose: { optional: true } },
        },
      },
    };
    // 2. Encapsulated Parsing & Validation
    const result = cliToZVO(contract, ["prod", "--verbose"]) as RoutedResult;

    // Assertions
    expect(result.isRoute("Deploy")).toBe(true);
    if (result.isRoute("Deploy")) {
      expect(result.env).toBe("prod");
      expect(result.verbose).toBe(true);
    }
  });

  it("should handle the short flag -v correctly", () => {
    const contract = {
      name: "ytn-cli",
      description: "YTN CLI tool",
      def: {
        verbose: {
          type: "boolean",
          flags: { long: "verbose", short: "v" },
          description: "Enable detailed logging",
        },
        env: { type: "string", description: "Target environment" },
      },
      targets: {
        Deploy: {
          description: "Deploy target",
          positionals: ["env"],
          flags: { verbose: { optional: true } },
        },
      },
    };
    const result = cliToZVO(contract, ["dev", "-v"]) as RoutedResult;

    expect(result.isRoute("Deploy")).toBe(true);
    if (result.isRoute("Deploy")) {
      expect(result.env).toBe("dev");
      expect(result.verbose).toBe(true);
    }
  });
});
