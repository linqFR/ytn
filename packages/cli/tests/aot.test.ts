import { describe, it, expect } from "vitest";
import { toJS } from "@ytrynot/dna/toJs";
import { parseArgs as nodeParseArgs } from "node:util";
import { createContract } from "../src/contract.js";
import { compile } from "../src/compile.js";
import { execute } from "../src/factory.js";
import {
  buildBranch,
  deployBranch,
  helpBranch,
  versionBranch,
  targets,
  fallbacks,
} from "./fixtures.js";

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets,
  fallbacks,
  cli: { positionals: ["cmd", "files"] },
});

const cli = (argv: string[]) => execute(processed, argv);

describe("AOT compilation", () => {
  describe("toJS output shape", () => {
    // CAST: toJS return type is generic — narrowed once here to verify the output shape
    const compiled = toJS(false, true)(processed.pipeline.toDna()) as {
      code: string[];
      requiredExternals: string[];
    };

    it("should return code as a 2-element array (externals present)", () => {
      expect(compiled.code.length).toBe(2);
    });

    it("should have code[0] as externals signature containing parseArgs (1 external)", () => {
      expect(compiled.code[0]).toMatch(/^\{.+\}$/);
      expect(compiled.code[0]).toContain("parseArgs");
    });

    it("should have code[1] as function body starting with 'return function'", () => {
      expect(compiled.code[1]).toContain("return function");
    });

    it("should list only parseArgs as requiredExternal (1 external, no routeKey — DEC-0027 new architecture)", () => {
      expect(compiled.requiredExternals).toHaveLength(1);
      expect(compiled.requiredExternals).toContain("parseArgs");
      expect(compiled.requiredExternals).not.toContain("parseArgsConfig");
      expect(compiled.requiredExternals).not.toContain("positionalMeta");
      expect(compiled.requiredExternals).not.toContain("flagMap");
      expect(compiled.requiredExternals).not.toContain("routeKey");
    });
  });

  describe("compile() — generated parser", () => {
    const parser = compile(processed);

    it("should produce same results as safeParse for build", () => {
      const argv = ["build", "a.ts", "b.ts", "--output", "dist/"];
      const aotResult = parser(argv);
      const safeParseResult = cli(argv);

      expect(aotResult.success).toBe(safeParseResult.success);
      if (aotResult.success && safeParseResult.success) {
        expect(aotResult.route).toBe(safeParseResult.route);
        expect(aotResult.payload.files).toEqual(safeParseResult.payload.files);
        expect(aotResult.payload.output).toEqual(safeParseResult.payload.output);
      }
    });

    it("should produce same results as safeParse for --help", () => {
      const argv = ["--help"];
      const aotResult = parser(argv);
      const safeParseResult = cli(argv);

      expect(aotResult.success).toBe(safeParseResult.success);
      if (aotResult.success && safeParseResult.success) {
        expect(aotResult.route).toBe(safeParseResult.route);
        expect(aotResult.route).toBe("help");
      }
    });

    it("should produce same results as safeParse for deploy with coercion", () => {
      const argv = ["deploy", "--target", "prod", "--port", "3000"];
      const aotResult = parser(argv);
      const safeParseResult = cli(argv);

      expect(aotResult.success).toBe(safeParseResult.success);
      if (aotResult.success && safeParseResult.success) {
        expect(aotResult.route).toBe(safeParseResult.route);
        expect(aotResult.payload.port).toBe(3000);
        expect(aotResult.payload.port).toEqual(safeParseResult.payload.port);
      }
    });

    it("should produce same results as safeParse for unknown command", () => {
      const argv = ["unknown"];
      const aotResult = parser(argv);
      const safeParseResult = cli(argv);

      expect(aotResult.success).toBe(false);
      expect(safeParseResult.success).toBe(false);
    });

    it("should produce same results as safeParse for build --help", () => {
      const argv = ["build", "--help"];
      const aotResult = parser(argv);
      const safeParseResult = cli(argv);

      expect(aotResult.success).toBe(safeParseResult.success);
      if (aotResult.success && safeParseResult.success) {
        expect(aotResult.route).toBe("help");
        expect(aotResult.payload.files).toEqual(["build"]);
      }
    });
  });

  describe("serialization", () => {
    // CAST: toJS return type is generic — narrowed once to access code/requiredExternals
    const compiled = toJS(false, true)(processed.pipeline.toDna()) as {
      code: string[];
      requiredExternals: string[];
    };

    it("should produce JSON-serializable artifact", () => {
      const artifact = {
        code: compiled.code,
        requiredExternals: compiled.requiredExternals,
        externalsSpec: {
          flagMap: { type: "object", value: processed.flagMap },
          parseArgs: { type: "external", source: "node:util" },
          parseArgsConfig: { type: "object", value: processed.parseArgsConfig },
          positionalMeta: { type: "array", value: processed.positionalMeta },
        },
      };
      const serialized = JSON.stringify(artifact);
      expect(() => JSON.parse(serialized)).not.toThrow();

      const restored = JSON.parse(serialized);
      expect(restored.code).toEqual(compiled.code);
      expect(restored.requiredExternals).toEqual(compiled.requiredExternals);
    });

    it("should re-instantiate from serialized artifact", () => {
      const artifact = {
        code: compiled.code,
        externalsSpec: {
          flagMap: { value: processed.flagMap },
          parseArgs: { source: "node:util" },
          parseArgsConfig: { value: processed.parseArgsConfig },
          positionalMeta: { value: processed.positionalMeta },
        },
      };
      const serialized = JSON.stringify(artifact);
      const restored = JSON.parse(serialized);

      const hostExternals: Record<string, unknown> = {};
      for (const [name, spec] of Object.entries(restored.externalsSpec)) {
        // CAST: spec is unknown from JSON.parse — narrowed to the value/source shape
        const s = spec as { value?: unknown; source?: string };
        if (s.source) {
          hostExternals[name] = nodeParseArgs;
        } else {
          hostExternals[name] = s.value;
        }
      }

      // CAST: new Function is the standard DNA AOT pattern (see dna-to-js.ts:321)
      const restoredParser = (new Function(restored.code[0], restored.code[1]) as
        (e: Record<string, unknown>) => (v: unknown) => { success: boolean; data?: unknown }
      )(hostExternals);

      const result = restoredParser(["build", "a.ts"]);
      expect(result.success).toBe(true);
      if (result.success) {
        // CAST: result.data is unknown from new Function — narrowed to { route, payload }
        const data = result.data as { route: string; payload: Record<string, unknown> };
        expect(data.route).toBe("build");
        expect(data.payload.files).toEqual(["a.ts"]);
      }
    });
  });
});
