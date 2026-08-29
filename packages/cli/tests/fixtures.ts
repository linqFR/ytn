import { dna } from "@ytrynot/dna";

/**
 * Shared test fixtures — routes and contract used across all test files.
 *
 * Route IDs come from the record key in `routes`, no longer from
 * `.meta().cli.routeId`. `\x00ID` is injected by `apply` in `createContract()`.
 */

// --- Routes ---

export const buildBranch = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional().meta({ description: "Files to build" }),
  output: dna.string().optional().meta({ description: "Output directory" }),
}).meta({ description: "Build the project" });

export const deployBranch = dna.object({
  cmd: dna.literal("deploy"),
  target: dna.string().optional().meta({ description: "Deployment target" }),
  port: dna.coerce.number().optional().meta({ description: "Port number" }),
}).meta({ description: "Deploy the project" });

export const helpBranch = dna.looseObject({
  cmd: dna.literal("help"),
  files: dna.array(dna.string()).optional(),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "h" }, description: "Show help" });

export const versionBranch = dna.looseObject({
  cmd: dna.literal("version"),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "v" }, description: "Show version" });

// --- Contract config (named routes record) ---

export const routes = {
  build: buildBranch,
  deploy: deployBranch,
  help: helpBranch,
  version: versionBranch,
} as const;

// --- Minimal contract (no interceptor) ---

export const minimalRoutes = {
  build: dna.object({
    cmd: dna.literal("build"),
    files: dna.array(dna.string()).optional(),
  }),
} as const;

// --- Branch without cmd (for validation error tests) ---

export const branchWithoutCmd = dna.object({
  value: dna.string().optional(),
});
