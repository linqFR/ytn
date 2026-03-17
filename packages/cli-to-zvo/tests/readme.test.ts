import { parseArgs, type ParseArgsConfig } from "node:util";
import { describe, expect, it } from "vitest";
import {
  CliContractSchema,
  cliToZod,
  createParseArgsObject,
} from "../src/index.js";

describe("README Examples Verification", () => {
  // Example from section 1, 2, 3, 4
  it("Complete Workflow Example", () => {
    // 1. Define the CLI Contract
    const contract: CliContractSchema = {
      name: "my-tool",
      description: "A great command-line tool",
      def: {
        input_file: {
          type: "filepath",
          description: "Path to the source file",
          arg_name: "path",
        },
        verbose: {
          type: "boolean",
          description: "Enable verbose mode",
          flags: { long: "verbose", short: "v" },
        },
      },
      targets: {
        Analyze: {
          description: "Analyzes the specified file",
          positionals: ["input_file"],
          flags: {
            verbose: { optional: true },
          },
        },
      },
    };

    // 2. Generate Parser and Schemas
    const { parsingArgs, xorSchema, help } = cliToZod(contract);
    expect(parsingArgs).toBeDefined();
    expect(xorSchema).toBeDefined();
    expect(help.name).toBe("my-tool");

    // 3. Parse Raw Arguments (Simulated)
    const mockArgv = ["data.txt", "--verbose"];

    const parseConfig: ParseArgsConfig = {
      args: mockArgv,
      options: parsingArgs.options as ParseArgsConfig["options"],
      allowPositionals: true,
    };
    const rawArgs = parseArgs(parseConfig);

    const mappedArgs = createParseArgsObject(parsingArgs).parse(rawArgs);
    expect(mappedArgs["input_file"]).toBe("data.txt");
    expect(mappedArgs["verbose"]).toBe(true);

    // 4. Validate and Route
    const result = xorSchema.parse(mappedArgs) as any;

    expect(result.isRoute("Analyze")).toBe(true);
    expect(result.route).toBe("Analyze");
    expect(result.input_file).toBe("data.txt");
    expect(result.verbose).toBe(true);
  });

  it("Routing Management Example", () => {
    const contract: CliContractSchema = {
      name: "test",
      description: "test",
      def: {
        cmd: { type: "string", description: "cmd" },
      },
      targets: {
        Analyze: {
          description: "desc",
          positionals: ["cmd"],
        },
      },
    };

    const { xorSchema, router } = cliToZod(contract);
    const data = { cmd: "some-command" };
    const result = xorSchema.parse(data) as any;

    // 1. Local check
    expect(result.isRoute("Analyze")).toBe(true);

    // 2. Global check (robust, works even after {...result})
    const spread = { ...result };
    // Global check still works
    expect(router.isRoute(spread, "Analyze")).toBe(true);
  });
});
