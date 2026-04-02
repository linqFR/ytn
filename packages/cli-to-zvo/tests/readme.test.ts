import { describe, expect, it } from "vitest";
import { cliToZVO, type tsContract, pico } from "../src/index.js";

describe("README Examples Verification", () => {
  it("Package Quick Start Example (ytn/dl)", () => {
    // 1. Define the Contract (from packages/cli-to-zvo/README.md)
    const contract: tsContract = {
      name: "ytn",
      description: "YouTube Downloader",
      cli: {
        positionals: ["url"],
        flags: {
          quality: {
            short: "q",
            type: "string",
            desc: "Video quality (144-2160)",
          },
          verbose: {
            short: "v",
            type: "boolean",
            desc: "Enable logging",
          },
        },
      },
      targets: {
        dl: {
          url: "url", // Simple String DSL
          quality: pico.number().optional(), // pico API (for complex logic)
          verbose: "boolean", // Simple String DSL
        },
      },
    };

    // 2. Parse and Validate
    const args = ["https://youtube.com/watch?v=123", "-q", "1080", "-v"];
    const result = cliToZVO(contract, args);

    // Verify result
    expect(result.route).toBe("dl");
    expect(result.error).toBeUndefined();
    if (result.route === "dl" && !result.error) {
      expect(result.data.url).toBe("https://youtube.com/watch?v=123");
      expect(result.data.quality).toBe(1080);
      expect(result.data.verbose).toBe(true);
    }
  });

  it("Root Quick Preview Example (ytn-cli/deploy)", () => {
    // 1. Define the Contract (from root README.md)
    const contract: tsContract = {
      name: "ytn-cli",
      description: "Deployment Tool",
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
          env: pico.string(), // pico
          verbose: "boolean", // DSL
        },
      },
    };

    // 2. One-line Parsing & Zod-Validation
    const result = cliToZVO(contract, ["prod", "-v"]);

    // Verify result
    expect(result.route).toBe("deploy");
    expect(result.error).toBeUndefined();
    if (result.route === "deploy" && !result.error) {
      expect(result.data.env).toBe("prod");
      expect(result.data.verbose).toBe(true);
    }
  });

  it("Routing & Literals Example (from Defining a Contract)", () => {
    const contract: tsContract = {
      name: "test",
      description: "test",
      cli: {
        positionals: ["command"],
        flags: {
          path: { short: "p", type: "string", desc: "path" },
        },
      },
      targets: {
        setup: {
          command: pico.literal("init"),
          path: "filepath",
        },
      },
    };

    const result = cliToZVO(contract, ["init", "-p", "data.txt"]);

    expect(result.route).toBe("setup");
    expect(result.error).toBeUndefined();
    if (result.route === "setup" && !result.error) {
      expect(result.data.command).toBe("init");
      expect(result.data.path).toBe("data.txt");
    }
  });

  it("Zod Native Modifiers Example", () => {
    const contract: tsContract = {
      name: "modifiers-test",
      description: "testing zod modifiers",
      cli: {
        positionals: ["age", "email", "tags"],
      },
      targets: {
        setup: {
          age: pico.number().min(18).max(99),
          email: pico.email().optional(),
          tags: pico.stringList().min(5),
        },
      },
    };

    // 1. Validating chainability and types
    const result = cliToZVO(contract, ["25", "test@example.com", "a,b,c,d,e"]);

    expect(result.route).toBe("setup");
    expect(result.error).toBeUndefined();
    if (result.route === "setup" && !result.error) {
      expect(result.data.age).toBe(25);
      expect(result.data.email).toBe("test@example.com");
      expect(result.data.tags).toEqual(["a", "b", "c", "d", "e"]);
    }

    // 2. Failure check (min age)
    const failResult = cliToZVO(contract, ["10", "test@example.com", "a,b,c"]);
    expect(failResult.error).toBeDefined();
    // In current implementation, validation error returns "error" as route
    expect(failResult.route).toBe("error");
  });
});
