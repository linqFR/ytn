import { dna } from "@ytrynot/dna";
import type { DnaObject } from "@ytrynot/dna";

/**
 * Shared test fixtures — routes and contract used across all test files.
 *
 * DEC-0027: No `_branchId` field — routeId is declared in `.meta().cli`
 * and injected as `\x00ID` by `apply` in `createContract()`.
 */

// --- Routes ---

export const buildBranch = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional().meta({ description: "Files to build" }),
  output: dna.string().optional().meta({ description: "Output directory" }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

export const deployBranch = dna.object({
  cmd: dna.literal("deploy"),
  target: dna.string().optional().meta({ description: "Deployment target" }),
  port: dna.coerce.number().optional().meta({ description: "Port number" }),
}).meta({ cli: { routeId: "deploy" }, description: "Deploy the project" });

export const helpBranch = dna.looseObject({
  cmd: dna.literal("help"),
  files: dna.array(dna.string()).optional(),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "h", routeId: "help" }, description: "Show help" });

export const versionBranch = dna.looseObject({
  cmd: dna.literal("version"),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "v", routeId: "version" }, description: "Show version" });

// --- Contract config ---

export const targets = [buildBranch, deployBranch] as const;
export const fallbacks = [helpBranch, versionBranch] as const;

// --- Minimal contract (no interceptor, no fallbacks) ---

export const minimalTargets = [
  dna.object({
    cmd: dna.literal("build"),
    files: dna.array(dna.string()).optional(),
  }).meta({ cli: { routeId: "build" } }),
] as const;

// --- Branch without routeId (for validation error tests) ---

export const branchWithoutRouteId = dna.object({
  cmd: dna.literal("test"),
  value: dna.string().optional(),
});
