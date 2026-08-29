import { describe, it, expect } from "vitest";
import { createContract } from "../src/contract.js";
import { compile } from "../src/compile.js";
import { execute } from "../src/factory.js";
import { buildHelp } from "../src/help.js";
import { formatCliError } from "../src/error.js";
import {
  routes
} from "./fixtures.js";

/**
 * End-to-end integration tests — full pipeline from contract definition
 * to handler dispatch, covering all the cases from the POC sandbox.
 */

describe("end-to-end integration", () => {
  const processed = createContract({
    name: "mycli",
    description: "A demo CLI built with @ytrynot/cli",
    routes,
    cli: { positionals: ["cmd", "files"] },
  });

  const cli = (argv: string[]) => execute(processed, argv);

  describe("full flow: createContract → cliFactory → verify", () => {
    const cases: Array<[string, string[], string, Record<string, unknown>]> = [
      ["cli --help", ["--help"], "help", {}],
      ["cli -h", ["-h"], "help", {}],
      ["cli build --help", ["build", "--help"], "help", { files: ["build"] }],
      ["cli deploy --help", ["deploy", "--help"], "help", { files: ["deploy"] }],
      ["cli help", ["help"], "help", {}],
      ["cli help build", ["help", "build"], "help", { files: ["build"] }],
      ["cli build a.ts b.ts --output dist/", ["build", "a.ts", "b.ts", "--output", "dist/"], "build", { files: ["a.ts", "b.ts"], output: "dist/" }],
      ["cli deploy --target prod --port 3000", ["deploy", "--target", "prod", "--port", "3000"], "deploy", { target: "prod", port: 3000 }],
      ["cli --version", ["--version"], "version", {}],
      ["cli -v", ["-v"], "version", {}],
      ["cli version", ["version"], "version", {}],
      ["cli build --version", ["build", "--version"], "version", {}],
    ];

    for (const [label, argv, expectedRoute, expectedData] of cases) {
      it(`should route "${label}" → route=${expectedRoute}`, () => {
        const result = cli(argv);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.route).toBe(expectedRoute);
          for (const [key, value] of Object.entries(expectedData)) {
            expect(result.payload[key]).toEqual(value);
          }
        }
      });
    }
  });

  describe("AOT matches safeParse", () => {
    const parser = compile(processed);

    const cases: Array<[string, string[]]> = [
      ["--help", ["--help"]],
      ["build --help", ["build", "--help"]],
      ["build a.ts b.ts --output dist/", ["build", "a.ts", "b.ts", "--output", "dist/"]],
      ["deploy --target prod --port 3000", ["deploy", "--target", "prod", "--port", "3000"]],
      ["--version", ["--version"]],
      ["unknown", ["unknown"]],
      ["empty", []],
    ];

    for (const [label, argv] of cases) {
      it(`AOT and safeParse should match for "${label}"`, () => {
        const aotResult = parser(argv);
        const safeParseResult = cli(argv);

        expect(aotResult.success).toBe(safeParseResult.success);
        if (aotResult.success && safeParseResult.success) {
          expect(aotResult.route).toBe(safeParseResult.route);
        }
      });
    }
  });

  describe("help + error + cliFactory combined", () => {
    it("should generate general help, format errors, and dispatch handlers", () => {
      // 1. General help
      const generalHelp = buildHelp(processed);
      expect(generalHelp).toContain("Usage: mycli");
      expect(generalHelp).toContain("Build the project");
      expect(generalHelp).toContain("Deploy the project");

      // 2. Command-specific help
      const buildHelpText = buildHelp(processed, "build");
      expect(buildHelpText).toContain("Build the project");
      expect(buildHelpText).not.toContain("Deploy the project");

      // 3. Error formatting
      const errorResult = cli(["unknown"]);
      expect(errorResult.success).toBe(false);
      if (!errorResult.success) {
        const formatted = formatCliError(errorResult.errors);
        expect(formatted).toContain("Error:");
      }

      // 4. Successful execution
      const buildResult = cli(["build", "a.ts"]);
      expect(buildResult.success).toBe(true);
      if (buildResult.success) {
        expect(buildResult.route).toBe("build");
        expect(buildResult.payload.files).toEqual(["a.ts"]);
      }
    });
  });
});
