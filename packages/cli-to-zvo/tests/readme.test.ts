import { describe, expect, it } from "vitest";
import { execute, isResponseOk, isResponseErr } from "../src/index.js";
import { createContract, pico, type tsContract } from "../src/editor.js";

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
    const contractObj = createContract(contract);
    const result = execute(contractObj, args);

    // Verify result (OSafeResult from execute)
    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("dl");
      expect(data.url).toBe("https://youtube.com/watch?v=123");
      expect(data.quality).toBe(1080);
      expect(data.verbose).toBe(true);
    } else {
      throw new Error("Invalid response type");
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
    const contractObj = createContract(contract);
    const result = execute(contractObj, ["prod", "-v"]);

    // Verify result
    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("deploy");
      expect(data.env).toBe("prod");
      expect(data.verbose).toBe(true);
    } else {
      throw new Error(`Parsing failed: ${JSON.stringify(result.error.issues)}`);
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

    const contractObj = createContract(contract);
    const result = execute(contractObj, ["init", "-p", "data.txt"]);

    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("setup");
      expect(data.command).toBe("init");
      expect(data.path).toBe("data.txt");
    } else {
      throw new Error(`Parsing failed: ${JSON.stringify(result.error.issues)}`);
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
    const contractObj = createContract(contract);
    const result = execute(contractObj, ["25", "test@example.com", "a,b,c,d,e"]);

    expect(result.success).toBe(true);
    if (result.success) {
      const { route, data } = result.data;
      expect(route).toBe("setup");
      expect(data.age).toBe(25);
      expect(data.email).toBe("test@example.com");
      expect(data.tags).toEqual(["a", "b", "c", "d", "e"]);
    } else {
      throw new Error(`Parsing failed: ${JSON.stringify(result.error.issues)}`);
    }

    // 2. Failure check (min age)
    const failResult = execute(contractObj, ["10", "test@example.com", "a,b,c"]);
    expect(failResult.success).toBe(false);
    if (!failResult.success) {
      expect(failResult.error).toBeDefined();
    }
  });
});
