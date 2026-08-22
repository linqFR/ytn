#!/usr/bin/env node
/**
 * check-versions.mjs — Compare installed @ytrynot/* packages with latest npm versions.
 *
 * Usage:
 *   node skills/ytn/scripts/check-versions.mjs          # from project root
 *   node scripts/check-versions.mjs                       # from skill root
 *
 * Exit codes:
 *   0 — all packages up to date (or not installed)
 *   1 — one or more packages are outdated
 *   2 — network error (could not fetch npm registry)
 */

const PACKAGES = [
  "@ytrynot/dna",
  "@ytrynot/schvalid",
  "@ytrynot/qb",
  "@ytrynot/cli",
];

const REGISTRY = "https://registry.npmjs.org";

/**
 * Read installed version from node_modules/<pkg>/package.json.
 * @param {string} pkg
 * @param {string} projectRoot
 * @returns {Promise<string|null>}
 */
async function getInstalledVersion(pkg, projectRoot) {
  const { join } = await import("node:path");
  const { readFile } = await import("node:fs/promises");
  const pkgPath = join(projectRoot, "node_modules", pkg, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf-8");
    const json = JSON.parse(raw);
    return json.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch latest version from npm registry.
 * @param {string} pkg
 * @returns {Promise<string|null>}
 */
async function getLatestVersion(pkg) {
  const url = `${REGISTRY}/${pkg}/latest`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Compare two semver-like version strings.
 * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

async function main() {
  const { existsSync } = await import("node:fs");
  const { resolve, dirname, join } = await import("node:path");

  // Find project root
  let projectRoot = process.cwd();
  if (!existsSync(join(projectRoot, "node_modules"))) {
    // Try from script location
    const scriptDir = dirname(resolve(process.argv[1] ?? ""));
    let dir = scriptDir;
    for (let i = 0; i < 10; i++) {
      if (existsSync(join(dir, "node_modules"))) {
        projectRoot = dir;
        break;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  console.log("ytn — version check\n");
  console.log(`Project root: ${projectRoot}\n`);

  let hasOutdated = false;
  let hasNetworkError = false;

  const rows = [];

  for (const pkg of PACKAGES) {
    const installed = await getInstalledVersion(pkg, projectRoot);
    const latest = await getLatestVersion(pkg);

    if (latest === null) {
      hasNetworkError = true;
      rows.push({ pkg, installed: installed ?? "—", latest: "network error", status: "error" });
      continue;
    }

    if (installed === null) {
      rows.push({ pkg, installed: "not installed", latest, status: "missing" });
      continue;
    }

    const cmp = compareVersions(installed, latest);
    if (cmp < 0) {
      hasOutdated = true;
      rows.push({ pkg, installed, latest, status: "outdated" });
    } else {
      rows.push({ pkg, installed, latest, status: "ok" });
    }
  }

  // Print table
  const pkgWidth = Math.max(...rows.map((r) => r.pkg.length), 8) + 2;
  const instWidth = Math.max(...rows.map((r) => r.installed.length), 15) + 2;
  const latestWidth = Math.max(...rows.map((r) => r.latest.length), 7) + 2;

  const header = `${"Package".padEnd(pkgWidth)}${"Installed".padEnd(instWidth)}${"Latest".padEnd(latestWidth)}Status`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (const r of rows) {
    const statusLabel =
      r.status === "ok" ? "up to date" :
      r.status === "outdated" ? "OUTDATED" :
      r.status === "missing" ? "not installed" :
      "network error";
    const line = `${r.pkg.padEnd(pkgWidth)}${r.installed.padEnd(instWidth)}${r.latest.padEnd(latestWidth)}${statusLabel}`;
    console.log(line);
  }

  console.log("");

  if (hasOutdated) {
    console.log("Update with:");
    console.log("  npm install @ytrynot/dna@latest @ytrynot/schvalid@latest @ytrynot/qb@latest @ytrynot/cli@latest");
    console.log("");
    console.log("Then update the skill:");
    console.log("  npx skills update ytn");
  }

  if (hasNetworkError) {
    console.log("\nCould not reach npm registry. Check your network connection.");
    process.exit(2);
  }

  process.exit(hasOutdated ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
