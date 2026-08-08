import { defineConfig, type Options, type Format } from "tsup";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const outExtension = ({ format }: { format: Format }) => ({
  js: format === "esm" ? ".js" : ".cjs",
  dts: ".d.ts",
});

/**
 * Common build configuration for all YTN packages.
 * Targets modern ESM with source maps and inlined @ytn/shared.
 */
export const commonConfig: Options = {
  outDir: "dist",
  format: ["esm"],
  sourcemap: true,
  target: "esnext",
  outExtension,
  dts: { resolve: ["@ytn/shared"], compilerOptions: { ignoreDeprecations: "6.0" } },
  bundle: true,
  splitting: false,
  treeshake: true,
  external: ["acorn", "acorn-walk", "zod", "@ytn/dna"],
  noExternal: ["@ytn/shared"],
  platform: "node",
};

/**
 * Configuration for minified production builds.
 */
export const minConfig: Options = {
  ...commonConfig,
  minify: true,
  dts: false,
  clean: false,
};

/**
 * Build configuration orchestration for YTN packages.
 *
 * @param cwd - Package directory (process.cwd()).
 * @param options - Optional overrides per entry, base config, extra externals and min toggle.
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
  const { entries, publicKeys } = getEntriesFromPackage(cwd);
  const configs: Options[] = [];
  let isFirst = true;

  for (const [name, entryPath] of Object.entries(entries)) {
    const isPublic = publicKeys.has(name);
    const baseExternal = base.external;
    const finalExternal = external
      ? [
          ...(Array.isArray(baseExternal) ? baseExternal : []),
          ...external,
        ]
      : baseExternal;

    configs.push({
      ...base,
      ...overrides[name],
      external: finalExternal,
      entry: { [name]: entryPath },
      dts: isPublic ? base.dts : false,
      tsconfig: join(cwd, "tsconfig.json"),
      clean: isFirst,
    });

    if (min && isPublic) {
      const minExternal = minConfig.external;
      const finalMinExternal = external
        ? [
            ...(Array.isArray(minExternal) ? minExternal : []),
            ...external,
          ]
        : minExternal;

      configs.push({
        ...minConfig,
        ...overrides[name],
        external: finalMinExternal,
        entry: { [`${name}.min`]: entryPath },
        dts: false,
        clean: false,
      });
    }

    isFirst = false;
  }

  return defineConfig(configs);
}

/**
 * Scan package.json exports (and bins) to derive source entries for tsup.
 */
export function getEntriesFromPackage(cwd: string) {
  const pkgPath = resolve(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const exports = pkg.exports || {};
  const bins = pkg.bin || {};
  const entries: Record<string, string> = {};
  const publicKeys = new Set<string>();

  for (const [key] of Object.entries(exports)) {
    if (key.endsWith("/min")) continue;
    if (key === "./package.json") continue;
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

  return { entries, publicKeys };
}
