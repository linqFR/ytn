import { defineConfig, type UserConfig } from "tsdown";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Common build configuration for all YTN packages.
 * Targets modern ESM with source maps and inlined @ytn/shared.
 */
export const commonConfig: UserConfig = {
  outDir: "dist",
  format: "esm",
  sourcemap: true,
  target: "esnext",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  treeshake: true,
  dts: true,
  deps: {
    neverBundle: ["acorn", "acorn-walk", "zod"],
    alwaysBundle: ["@ytn/shared"],
  },
};

/**
 * Configuration for minified production builds.
 */
export const minConfig: UserConfig = {
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
    overrides?: Record<string, UserConfig>;
    base?: UserConfig;
    external?: string[];
    min?: boolean;
  } = {},
) {
  const { overrides = {}, base = commonConfig, external, min = true } = options;
  const { entries, publicKeys } = getEntriesFromPackage(cwd);
  const configs: UserConfig[] = [];
  let isFirst = true;

  for (const [name, entryPath] of Object.entries(entries)) {
    const isPublic = publicKeys.has(name);
    const baseNever = base.deps?.neverBundle;
    const deps = external
      ? {
          ...base.deps,
          neverBundle:
            baseNever === true
              ? baseNever
              : [...(Array.isArray(baseNever) ? baseNever : []), ...external],
        }
      : base.deps;

    configs.push({
      ...base,
      ...overrides[name],
      deps,
      entry: { [name]: entryPath },
      dts: isPublic
        ? typeof base.dts === "object" && base.dts !== null
          ? { ...base.dts }
          : base.dts
        : false,
      tsconfig: join(cwd, "tsconfig.json"),
      clean: isFirst,
    });

    if (min && isPublic) {
      const minNever = minConfig.deps?.neverBundle;
      const minDeps = external
        ? {
            ...minConfig.deps,
            neverBundle:
              minNever === true
                ? minNever
                : [...(Array.isArray(minNever) ? minNever : []), ...external],
          }
        : minConfig.deps;

      configs.push({
        ...minConfig,
        ...overrides[name],
        deps: minDeps,
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
 * Scan package.json exports (and bins) to derive source entries for tsdown.
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
    const entryName = key === "." ? "index" : key.replace("./", "");
    const tsFile = `${entryName}.ts`;
    const srcPath = join(cwd, "src", tsFile);
    if (!existsSync(srcPath)) {
      throw new Error(
        `[tsdown-config] Critical Error: Export "${key}" defined in package.json is missing its source: ${srcPath}`,
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
          `[tsdown-config] Critical Error: Binary "${binName}" defined in package.json is missing its source: ${srcPath}`,
        );
      }
      const entryName = fileName.replace(".ts", "");
      entries[entryName] = `src/${fileName}`;
    }
  }

  return { entries, publicKeys };
}
