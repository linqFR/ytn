import { describe, it, expect } from "vitest";
import { dna } from "@ytrynot/dna";
import { createContract } from "../src/contract.js";
import type { IProcessedContract } from "../src/types/contract.types.js";
import {
  buildBranch,
  deployBranch,
  helpBranch,
  versionBranch,
  targets,
  fallbacks,
  branchWithoutRouteId,
  minimalTargets,
} from "./fixtures.js";

describe("createContract", () => {
  describe("full contract (flagMap + fallbacks)", () => {
    const processed = createContract({
      name: "mycli",
      description: "A demo CLI",
      targets,
      fallbacks,
      cli: { positionals: ["cmd", "files"] },
    });

    it("should return an IProcessedContract with all fields", () => {
      expect(processed.name).toBe("mycli");
      expect(processed.description).toBe("A demo CLI");
      expect(processed.pipeline).toBeDefined();
      expect(processed.cliUnion).toBeDefined();
      expect(processed.routes).toBeDefined();
      expect(processed.parseArgsConfig).toBeDefined();
      expect(processed.positionalMeta).toBeDefined();
      expect(processed.externals).toBeDefined();
    });

    it("should have a single discriminator 'cmd'", () => {
      expect(processed.cliUnion.discriminators).toEqual(["cmd"]);
    });

    it("should detect positionals ['cmd', 'files']", () => {
      expect(processed.cliUnion.positionals).toEqual(["cmd", "files"]);
    });

    it("should compute positionalMeta with variadic detection", () => {
      expect(processed.positionalMeta).toEqual([
        { name: "cmd", variadic: false },
        { name: "files", variadic: true },
      ]);
    });

    it("should include flagMap in processed (built from .meta().cli.flag)", () => {
      expect(processed.flagMap).toBeDefined();
      expect(processed.flagMap.help).toBe("help");
      expect(processed.flagMap.version).toBe("version");
    });

    it("should have only parseArgs as external (1 external, no routeKey) — DEC-0027 new architecture", () => {
      expect(processed.externals.parseArgs).toBeDefined();
      expect(processed.externals.parseArgsConfig).toBeUndefined();
      expect(processed.externals.positionalMeta).toBeUndefined();
      expect(processed.externals.flagMap).toBeUndefined();
      expect(processed.externals.routeKey).toBeUndefined();
    });

    it("should include all branches (targets + fallbacks)", () => {
      expect(processed.routes.length).toBe(4); // build, deploy, help, version
    });

    it("should filter \\x00ID from parseArgsConfig options", () => {
      expect(processed.parseArgsConfig.options["\x00ID"]).toBeUndefined();
    });
  });

  describe("minimal contract (no flagMap, no fallbacks)", () => {
    const processed = createContract({
      name: "minimal",
      description: "Minimal CLI",
      targets: minimalTargets,
    });

    it("should have empty flagMap when no flags declared", () => {
      expect(processed.flagMap).toBeDefined();
      expect(Object.keys(processed.flagMap).length).toBe(0);
    });

    it("should have only parseArgs as external (1 external) — DEC-0027 new architecture", () => {
      expect(processed.externals.parseArgs).toBeDefined();
      expect(processed.externals.parseArgsConfig).toBeUndefined();
      expect(processed.externals.positionalMeta).toBeUndefined();
      expect(processed.externals.flagMap).toBeUndefined();
      expect(processed.externals.routeKey).toBeUndefined();
    });
  });

  describe("routeId validation", () => {
    it("should throw when a target branch lacks routeId in .meta().cli", () => {
      expect(() =>
        createContract({
          name: "test",
          description: "test",
          // CAST: branchWithoutRouteId is a single DnaObject, spread into a tuple type for the test
        targets: [branchWithoutRouteId] as unknown as readonly [typeof branchWithoutRouteId, ...typeof branchWithoutRouteId[]],
        }),
      ).toThrow(/routeId/);
    });
  });

  describe("strict mode", () => {
    it("should pass strict option to toParseArgsConfig", () => {
      const processed = createContract({
        name: "strict-cli",
        description: "Strict CLI",
        targets: minimalTargets,
        cli: { strict: true },
      });
      // toParseArgsConfig with strict:true should reject unknown flags
      // This is verified at execute time — here we just check the config is built
      expect(processed.parseArgsConfig).toBeDefined();
    });
  });
});
