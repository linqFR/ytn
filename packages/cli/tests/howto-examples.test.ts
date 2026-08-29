import { describe, it, expect } from "vitest";
import { dna } from "@ytrynot/dna";
import {
  createContract,
  execute,
  executeContract,
  cliFactory,
  compile,
  buildHelp,
} from "../src/index.js";
import type { ts } from "../src/index.js";
import { branchWithoutCmd } from "./fixtures.js";

/**
 * Validates every example from docs/how-to-define-a-cli-contract.md.
 * If an example in the doc is wrong, this test fails.
 *
 * When updating the doc, update this test accordingly.
 */

describe("how-to-define-a-cli-contract.md — example validation", () => {

  // ============================================================
  // Recipe 1 — Single subcommand
  // ============================================================
  describe("Recipe 1 — Single subcommand", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute },
    });

    it("should route build and return {cmd: 'build'}", () => {
      const result = execute(processed, ["build"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.cmd).toBe("build");
      }
    });
  });

  // ============================================================
  // Recipe 2 — Multiple subcommands
  // ============================================================
  describe("Recipe 2 — Multiple subcommands", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
    }).meta({ description: "Build the project" });

    const deployRoute = dna.object({
      cmd: dna.literal("deploy"),
      target: dna.string().optional().meta({ description: "Deployment target" }),
    }).meta({ description: "Deploy the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, deploy: deployRoute },
    });

    it("should route build", () => {
      const result = execute(processed, ["build"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("build");
    });

    it("should route deploy", () => {
      const result = execute(processed, ["deploy"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("deploy");
    });

    it("should reject unknown command", () => {
      const result = execute(processed, ["unknown"]);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // Recipe 3 — Subcommand + positional variadic
  // ============================================================
  describe("Recipe 3 — Positional variadic (build a.ts b.ts c.ts)", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string()).optional()
        .meta({ description: "Files to build" }),
      output: dna.string().optional()
        .meta({ description: "Output directory" }),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute },
      cli: { positionals: ["cmd", "files"] },
    });

    it("should collect files as positional variadic", () => {
      const result = execute(processed, ["build", "a.ts", "b.ts", "c.ts"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toEqual(["a.ts", "b.ts", "c.ts"]);
      }
    });

    it("should accept 0 files (optional variadic)", () => {
      const result = execute(processed, ["build"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.files === undefined ||
          (Array.isArray(result.payload.files) && result.payload.files.length === 0)
        ).toBe(true);
      }
    });

    it("should stop collecting files at a flag", () => {
      const result = execute(processed, ["build", "a.ts", "b.ts", "--output", "dist"]);
      if (result.success) {
        expect(result.payload.files).toEqual(["a.ts", "b.ts"]);
        expect(result.payload.output).toBe("dist");
      }
    });

  });

  // ============================================================
  // Recipe 4 — Subcommand + flag multiple
  // ============================================================
  describe("Recipe 4 — Flag multiple (--files a --files b)", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string())
        .meta({ description: "Files to build" }),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute },
    });

    it("should collect files via repeated --files flag", () => {
      const result = execute(processed, ["build", "--files", "a.ts", "--files", "b.ts"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toEqual(["a.ts", "b.ts"]);
      }
    });
  });

  // ============================================================
  // Recipe 5 — --help / -h / --version / -v
  // ============================================================
  describe("Recipe 5 — --help / -h / --version / -v", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
    }).meta({ description: "Build the project" });

    const helpRoute = dna.looseObject({
      cmd: dna.literal("help"),
    }).catchall(dna.unknown()).meta({
      cli: { flag: true, short: "h" },
      description: "Show help",
    });

    const versionRoute = dna.looseObject({
      cmd: dna.literal("version"),
    }).catchall(dna.unknown()).meta({
      cli: { flag: true, short: "v" },
      description: "Show version",
    });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, help: helpRoute, version: versionRoute },
    });

    it("should route --help to help", () => {
      const result = execute(processed, ["--help"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route -h to help", () => {
      const result = execute(processed, ["-h"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("help");
    });

    it("should route --version to version", () => {
      const result = execute(processed, ["--version"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });

    it("should route -v to version", () => {
      const result = execute(processed, ["-v"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("version");
    });
  });

  // ============================================================
  // Recipe 6 — Short alias on field (-o for --output)
  // ============================================================
  describe("Recipe 6 — Short alias on field", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      output: dna.string().optional()
        .meta({
          cli: { short: "o" },
          description: "Output directory",
        }),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute },
    });

    it("should accept --output dist/", () => {
      const result = execute(processed, ["build", "--output", "dist/"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.output).toBe("dist/");
    });

    it("should accept -o dist/", () => {
      const result = execute(processed, ["build", "-o", "dist/"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.output).toBe("dist/");
    });
  });

  // ============================================================
  // Recipe 7 — Boolean flags
  // ============================================================
  describe("Recipe 7 — Boolean flags", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      watch: dna.boolean().optional()
        .meta({ description: "Watch for changes" }),
    }).meta({ description: "Build the project" });

    const deployRoute = dna.object({
      cmd: dna.literal("deploy"),
      dryRun: dna.boolean().optional()
        .meta({ description: "Dry run" }),
    }).meta({ description: "Deploy the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, deploy: deployRoute },
    });

    it("should set watch=true with --watch", () => {
      const result = execute(processed, ["build", "--watch"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.watch).toBe(true);
    });

    it("should set watch=undefined without --watch", () => {
      const result = execute(processed, ["build"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.watch).toBeUndefined();
    });

    it("should set dryRun=true with --dryRun", () => {
      const result = execute(processed, ["deploy", "--dryRun"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.dryRun).toBe(true);
    });
  });

  // ============================================================
  // Recipe 8 — Coercion
  // ============================================================
  describe("Recipe 8 — Coercion (--port 3000 → number)", () => {
    const deployRoute = dna.object({
      cmd: dna.literal("deploy"),
      port: dna.coerce.number().optional()
        .meta({ description: "Port number" }),
    }).meta({ description: "Deploy the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { deploy: deployRoute },
    });

    it("should coerce '3000' to number 3000", () => {
      const result = execute(processed, ["deploy", "--port", "3000"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.port).toBe(3000);
    });

    it("should reject non-coercible 'abc'", () => {
      const result = execute(processed, ["deploy", "--port", "abc"]);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // Recipe 9 — Hidden routes
  // ============================================================
  describe("Recipe 9 — Hidden routes", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
    }).meta({ description: "Build the project" });

    const internalRoute = dna.object({
      cmd: dna.literal("internal-cmd"),
    }).meta({
      cli: { hidden: "all" },
      description: "Internal command",
    });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, "internal-cmd": internalRoute },
    });

    it("should route to internal-cmd", () => {
      const result = execute(processed, ["internal-cmd"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.route).toBe("internal-cmd");
    });

    it("should hide internal-cmd from general help", () => {
      const help = buildHelp(processed);
      expect(help).not.toContain("internal-cmd");
    });

    it("should show internal-cmd when explicitly requested", () => {
      const help = buildHelp(processed, "internal-cmd");
      expect(help).toContain("internal-cmd");
    });
  });

  // ============================================================
  // Recipe 10 — Loose routes with catchall
  // ============================================================
  describe("Recipe 10 — Loose routes with catchall", () => {
    const helpRoute = dna.looseObject({
      cmd: dna.literal("help"),
      topic: dna.string().optional(),
    }).catchall(dna.unknown()).meta({
      cli: { flag: true, short: "h" },
      description: "Show help",
    });

    const buildRoute = dna.object({
      cmd: dna.literal("build"),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, help: helpRoute },
      cli: { positionals: ["cmd", "topic"] },
    });

    it("should accept --help build and set topic=build", () => {
      const result = execute(processed, ["--help", "build"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("help");
        expect(result.payload.topic).toBe("build");
      }
    });
  });

  // ============================================================
  // Recipe 11 — Full CLI with handlers + formatter
  // ============================================================
  describe("Recipe 11 — Full CLI (handlers + formatter)", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string()).optional()
        .meta({ description: "Files to build" }),
    }).meta({ description: "Build the project" });

    const helpRoute = dna.looseObject({
      cmd: dna.literal("help"),
    }).catchall(dna.unknown()).meta({
      cli: { flag: true, short: "h" },
      description: "Show help",
    });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute, help: helpRoute },
      cli: { positionals: ["cmd", "files"] },
    });

    const handlers: ts.Handlers = {
      build: (payload) => ({
        success: true,
        data: `Built ${(payload.files as string[] | undefined)?.length ?? 0} files`,
      }),
      help: () => ({
        success: true,
        data: "Usage: mycli <command> [options]",
      }),
    };

    const formatter: ts.FormatterFn = (result) => {
      if (result.success) return { exit: 0, message: String(result.data ?? "") };
      return { exit: 1, message: `Error: ${result.error}` };
    };

    const executable = executeContract(processed, handlers);
    const formatted = cliFactory(executable, formatter);

    it("should format build handler result as {exit: 0, message}", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["build", "a.ts"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exit).toBe(0);
        expect(result.data.message).toContain("Built");
        expect(result.data.message).toContain("1 files");
      }
    });

    it("should format help handler result", async () => {
      const result = await formatted.pipeline.safeParseAsync(
        ["--help"],
        formatted.externals,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exit).toBe(0);
        expect(result.data.message).toBe("Usage: mycli <command> [options]");
      }
    });
  });

  // ============================================================
  // Recipe 12 — AOT compilation
  // ============================================================
  describe("Recipe 12 — AOT compilation", () => {
    const buildRoute = dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string()).optional()
        .meta({ description: "Files to build" }),
    }).meta({ description: "Build the project" });

    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      routes: { build: buildRoute },
      cli: { positionals: ["cmd", "files"] },
    });

    it("should compile and produce same result as execute", () => {
      const parser = compile(processed);
      const result = parser(["build", "a.ts"]);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.route).toBe("build");
        expect(result.payload.files).toEqual(["a.ts"]);
      }
    });

    it("should be synchronous (not return a Promise)", () => {
      const parser = compile(processed);
      const result = parser(["build", "a.ts"]);
      expect(result).not.toBeInstanceOf(Promise);
    });
  });

  // ============================================================
  // Pitfall 1 — Optional positional not declared
  // ============================================================
  describe("Pitfall 1 — Optional positional not declared", () => {
    const route = dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string()).optional(),
    });

    it("without cli.positionals: files is undefined (treated as flag)", () => {
      const processed = createContract({
        name: "mycli", description: "...", routes: { build: route },
      });
      const result = execute(processed, ["build", "a.ts"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.files).toBeUndefined();
    });

    it("with cli.positionals: files is [a.ts]", () => {
      const processed = createContract({
        name: "mycli", description: "...", routes: { build: route },
        cli: { positionals: ["cmd", "files"] },
      });
      const result = execute(processed, ["build", "a.ts"]);
      expect(result.success).toBe(true);
      if (result.success) expect(result.payload.files).toEqual(["a.ts"]);
    });
  });

  // ============================================================
  // Pitfall 2 — Missing cmd field
  // ============================================================
  describe("Pitfall 2 — Missing cmd field", () => {
    it("should throw when cmd field is missing", () => {
      expect(() =>
        createContract({ name: "mycli", description: "...", routes: { build: branchWithoutCmd } })
      ).toThrow();
    });
  });

  // ============================================================
  // Pitfall 3 — flag: true on a field
  // ============================================================
  describe("Pitfall 3 — flag: true on a field", () => {
    it("should throw when flag: true is on a field", () => {
      const route = dna.object({
        cmd: dna.literal("build"),
        output: dna.string().optional().meta({ cli: { flag: true } }),
      });
      expect(() =>
        createContract({ name: "mycli", description: "...", routes: { build: route } })
      ).toThrow();
    });
  });
});
