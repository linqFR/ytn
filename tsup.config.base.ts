import { defineConfig, type Options } from "tsup";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import zodAot from "zod-aot/esbuild";

/**
 * @constant commonConfig
 * @description Common build configuration for all YTN packages.
 * Targets Modern ESM with full source maps and clean outputs.
 * Default policy is "Minimalist": no code splitting to avoid chunk-XYZ.js clutter.
 */
export const commonConfig: Options = {
  format: ["esm"],
  dts: { resolve: false },
  splitting: false, // Default: No splitting for cleaner, self-contained files
  sourcemap: true,
  clean: true,
  target: "esnext",
  outDir: "dist",
  external: ["acorn", "acorn-walk", "zod"],
  /**
   * @ytn/shared is a PRIVATE internal toolbox.
   * It is never published to npm and MUST always be inlined into public packages
   * to ensure they remain standalone and zero-dependency for internal logic.
   */
  noExternal: ["@ytn/shared"],
  treeshake: true,
  esbuildPlugins: [
    zodAot({
      autoDiscover: true,
      verbose: true,
      exclude: ["test", "sandbox"],
      zodCompat: true,
    }),
  ],
};

/**
 * @constant minConfig
 * @description Configuration for minified production builds.
 * Typically used for the primary library entry point.
 */
export const minConfig: Options = {
  ...commonConfig,
  minify: true,
  sourcemap: true,
  clean: false, // Must be false to preserve standard builds
  dts: false,
};

/**
 * @function createDualEntries
 * @description Generates entries with a `.min` identifier.
 * Used internally to trigger a separate minified build pass.
 */
export function createDualEntries(entries: Record<string, string>) {
  const minifiedEntries: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    minifiedEntries[`${key}.min`] = value;
  }
  return minifiedEntries;
}

/**
 * @function buildConfig
 * @description The primary orchestration helper for YTN package builds.
 *
 * To achieve a "Premium & Minimalist" output, this helper implements an **Isolation Mode**:
 * 1. It calculates every entry point defined in `package.json` (exports & bin).
 * 2. It generates an independent build configuration for **EACH** entry point.
 * 3. By processing entries separately, we prevent `tsup` from creating shared `chunk-XYZ.js` files.
 * 4. This isolation also allows the DTS bundler to perfectly merge internal types into a
 *    single `.d.ts` file per export, without orphan side-effect imports or common type chunks.
 *
 * @param {string} cwd - The workspace directory of the package (process.cwd()).
 * @param {Object} [options] - Configuration overrides.
 * @param {Record<string, Options>} [options.overrides] - Specific tsup options per entry point name.
 * @param {Options} [options.base] - Override the commonConfig defaults.
 * @param {string[]} [options.external] - Libraries to exclude from bundling.
 * @param {boolean} [options.min] - Toggle automatic .min.js generation for 'index'. Default: true.
 */
export function buildConfig(
  cwd: string,
  options: {
    overrides?: Record<string, Options>;
    base?: Options;
    external?: string[];
    /** @default true */
    min?: boolean;
  } = {},
) {
  const { overrides = {}, base = commonConfig, external, min = true } = options;
  const { entries, dts } = getEntriesFromPackage(cwd);
  const configs: Options[] = [];

  // Phase: Isolation Pass
  // Each entry point is built as a standalone unit to ensure zero-chunking
  // and perfect type bundling.
  for (const [name, entryPath] of Object.entries(entries)) {
    const isPublic = dts.entry.includes(entryPath);
    const entryOptions: Options = {
      ...base,
      ...(external ? { external } : {}),
      ...overrides[name],
      entry: { [name]: entryPath },
      // Resolve types into a single file only for public exports
      dts: isPublic,
      tsconfig: join(cwd, "tsconfig.json"),
      // Only clean on the very first pass
      clean: configs.length === 0,
    };

    configs.push(entryOptions);

    // Phase: Minification Pass (Restricted to index.ts for minimalism)
    if (min && name === "index" && isPublic) {
      configs.push({
        ...minConfig,
        entry: { "index.min": entryPath },
        dts: false,
        clean: false,
      });
    }
  }

  return defineConfig(configs);
}

/**
 * @function getEntriesFromPackage
 * @description Introspective scanner that maps `package.json` definitions to source files.
 *
 * Logic:
 * - Scans `exports`: Every file defined here is a public API entry point and requires `.d.ts`.
 * - Scans `bin`: Binaries are private executables and do not generate type definitions.
 * - Validation: Strictly enforces that every defined export/bin has a matching file in `src/`.
 *
 * @param {string} cwd - The package directory.
 * @returns {Object} An object containing the entry map and targeting for DTS generation.
 */
export function getEntriesFromPackage(cwd: string) {
  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const exports = pkg.exports || {};
  const bins = pkg.bin || {};
  const entries: Record<string, string> = {};
  const publicKeys = new Set<string>();

  // Process Public Exports
  for (const [key] of Object.entries(exports)) {
    if (key === "./min") continue;
    const entryName = key === "." ? "index" : key.replace("./", "");
    const tsFile = `${entryName}.ts`;
    const srcPath = join(cwd, "src", tsFile);
    if (!existsSync(srcPath)) {
      throw new Error(
        `[tsup-config] Critical Error: Export "${key}" defined in package.json is missing its source: ${srcPath}`,
      );
    }
    entries[entryName] = `src/${tsFile}`;
    publicKeys.add(entryName);
  }

  // Process Private Binaries
  for (const [binName, distPath] of Object.entries(bins)) {
    const fileName = (distPath as string)
      .split("/")
      .pop()
      ?.replace(".js", ".ts");
    if (fileName) {
      const srcPath = join(cwd, "src", fileName);
      if (!existsSync(srcPath)) {
        throw new Error(
          `[tsup-config] Critical Error: Binary "${binName}" defined in package.json is missing its source: ${srcPath}`,
        );
      }
      const entryName = fileName.replace(".ts", "");
      entries[entryName] = `src/${fileName}`;
    }
  }

  return {
    entries,
    dts: {
      resolve: false, // Default for internal mapping, overridden in buildConfig
      entry: Array.from(publicKeys).map((k) => entries[k]),
    },
    tsconfig: join(cwd, "tsconfig.json"),
  };
}
