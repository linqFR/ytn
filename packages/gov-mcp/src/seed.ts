/**
 * Scope discovery utilities for the governance database.
 *
 * Only 'workspace' is an invariant — it is referenced by FK defaults
 * and CHECK constraints on every table. All other scopes are declared
 * by the agent via the 'create_scope' MCP tool.
 *
 * The discoverScopes() and generateSeedSQL() utilities are provided for
 * agents that wish to discover and declare scopes programmatically.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT_SCOPE_ID } from "./definitions/constants.js";

/** A discovered scope from the monorepo. */
interface IDiscoveredScope {
  id: string;
  label: string;
  description: string;
  parent: string | null;
  sort_order: number;
}

/**
 * Discover scopes from the monorepo's 'packages/' directory.
 * Each subdirectory with a 'package.json' becomes a scope.
 * The scope ID is derived from the package name (e.g. '@ytrynot/dna' -> 'dna').
 *
 * @param monorepoRoot - Absolute path to the monorepo root (containing 'packages/').
 * @returns Array of discovered scopes, including the invariant 'workspace' at sort_order 0.
 */
export function discoverScopes(monorepoRoot: string): IDiscoveredScope[] {
  const scopes: IDiscoveredScope[] = [
    {
      id: ROOT_SCOPE_ID,
      label: "Workspace",
      description: "Entire workspace scope",
      parent: null,
      sort_order: 0,
    },
  ];

  const packagesDir = resolve(monorepoRoot, "packages");
  if (!existsSync(packagesDir)) return scopes;

  const entries = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  let sortOrder = 1;
  for (const dirName of entries) {
    const pkgJsonPath = join(packagesDir, dirName, "package.json");
    if (!existsSync(pkgJsonPath)) continue;
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
        name?: string;
        description?: string;
      };
      // Derive scope ID from package name: @ytrynot/dna → dna
      const scopeId = pkgJson.name
        ? pkgJson.name.replace(/^@[^/]+\//, "")
        : dirName;
      scopes.push({
        id: scopeId,
        label: pkgJson.name ?? dirName,
        description: pkgJson.description ?? `Package ${scopeId}`,
        parent: ROOT_SCOPE_ID,
        sort_order: sortOrder++,
      });
    } catch {
      // Skip unparseable package.json
    }
  }

  return scopes;
}

/**
 * Generate the seed SQL for discovered scopes.
 * Uses 'INSERT OR IGNORE' so re-running on an existing DB is safe.
 *
 * @param scopes - Array of scopes to seed (from discoverScopes).
 * @returns SQL string with INSERT OR IGNORE statements.
 */
export function generateSeedSQL(scopes: IDiscoveredScope[]): string {
  const now = "datetime('now')";
  const values = scopes
    .map(
      (s) =>
        `  ('${s.id.replace(/'/g, "''")}', '${s.label.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}', ${s.parent === null ? "NULL" : `'${s.parent}'`}, ${s.sort_order}, ${now}, ${now})`,
    )
    .join(",\n");

  return `-- Seed scopes (generated programmatically from monorepo layout)
-- Only 'workspace' is invariant. Other scopes discovered from packages/*/package.json.
-- Re-running is safe (INSERT OR IGNORE). Add more scopes via the create_scope MCP tool.
INSERT OR IGNORE INTO scopes (id, label, description, parent, sort_order, created_at, updated_at)
VALUES
${values};`;
}

/**
 * Resolve the monorepo root from the current module location.
 * This file is at 'packages/gov-mcp/src/seed.ts', so the monorepo root is 3 levels up.
 */
export function resolveMonorepoRoot(): string {
  // import.meta.dirname is available in Node 26 (ESM)
  return resolve(import.meta.dirname, "..", "..", "..");
}
