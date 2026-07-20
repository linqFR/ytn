import { defineConfig, type Options } from "tsup";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import zodAot from "zod-aot/esbuild";

/**
 * @constant commonConfig
 * @description Common build configuration for all YTN packages.
 * Targets Modern ESM with full source maps and clean outputs.
 */
export const commonConfig: Options = {
  format: ["esm"],
  dts: { resolve: false },
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "esnext",
  outDir: "dist",
  external: ["acorn", "acorn-walk", "zod"],
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
  dts: false,
  clean: false, // Must be false to preserve standard builds
};

/**
 * @function buildConfig
 * @description The primary orchestration helper for YTN package builds.
 *
 * @param {string} cwd - The workspace directory of the package (process.cwd()).
 * @param {Object} [options] - Configuration overrides.
 * @param {Record<string, Options>} [options.overrides] - Specific tsup options per entry point name.
 * @param {Options} [options.base] - Override the commonConfig defaults.
 * @param {string[]} [options.external] - Libraries to exclude from bundling.
 * @param {boolean} [options.min] - Toggle automatic .min.js generation for public entries. Default: true.
 */
export function buildConfig(
  cwd: string,
  options: {
    overrides?: Record<string, Options>;
    base?: Options;
    external?: string[];
    min?: boolean;
  } = {},
) {
  const { overrides = {}, base = commonConfig, external, min = true } = options;
  const { entries, dts } = getEntriesFromPackage(cwd);
  const configs: Options[] = [];

  for (const [name, entryPath] of Object.entries(entries)) {
    const isPublic = dts.entry.includes(entryPath);
    const entryOptions: Options = {
      ...base,
      ...(external ? { external } : {}),
      ...overrides[name],
      entry: { [name]: entryPath },
      dts: isPublic,
      tsconfig: join(cwd, "tsconfig.json"),
      clean: configs.length === 0,
    };

    configs.push(entryOptions);

    if (min && isPublic) {
      configs.push({
        ...minConfig,
        entry: { [`${name}.min`]: entryPath },
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
 * @returns {Object} An object containing the entry map.
 */
export function getEntriesFromPackage(cwd: string) {
  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const exports = pkg.exports || {};
  const bins = pkg.bin || {};
  const entries: Record<string, string> = {};
  const publicKeys = new Set<string>();

  for (const [key] of Object.entries(exports)) {
    // if (key === "./min" || key.endsWith("/min")) continue;
    if (key.endsWith("/min")) continue;
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
      resolve: false,
      entry: Array.from(publicKeys).map((k) => entries[k]),
    },
    tsconfig: join(cwd, "tsconfig.json"),
  };
}
