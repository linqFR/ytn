import { describe, it, expect } from "vitest";
import { cliToZod, createParseArgsObject } from "../src/index.js";
import { parseArgs } from "node:util";

describe("CLI Help Verification", () => {
  it("should provide native help support automatically", () => {
    const contract = {
      name: "test-cli",
      description: "A CLI to test native help",
      def: {
        // No manual help declaration
      },
      targets: {
        Main: {
          description: "Main command",
        },
      },
    };

    const { help } = cliToZod(contract as any);

    // 1. Verify Help Object Structure
    expect(help.name).toBe("test-cli");

    // Verify help flag is present in arguments automatically
    const helpArg = help.arguments.find((a) =>
      a.usages?.some((u) => u.includes("--help")),
    );
    expect(helpArg).toBeDefined();
    expect(helpArg?.description).toBe("Show help information");
  });

  it("should force native help definition despite user attempt to override", () => {
    const contract = {
      name: "app",
      description: "app description",
      def: {
        help: {
          type: "boolean",
          description: "custom help desc",
          flags: { long: "help", short: "p" },
        },
      },
      targets: {
        Main: { description: "main" },
      },
    };

    const { help } = cliToZod(contract as any);
    
    // Check that our override in 'def' is IGNORED because NATIVE forces the definition
    const arg = help.arguments.find((a) =>
      a.usages?.some((u) => u.includes("--help")),
    );
    
    // Native wins (NATIVE is last in the spread)
    expect(arg?.description).toBe("Show help information");
    expect(arg?.usages).toContain("--help");
    expect(arg?.usages).toContain("-h"); // Native has -h, not -p
    expect(arg?.usages).not.toContain("-p");
  });
});
