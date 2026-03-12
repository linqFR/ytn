import { Options } from 'tsup';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';


/**
 * Base configuration for YTN packages.
 * Focuses on Pure ESM, Zero Noise, and JSDoc preservation.
 */
export const commonConfig: Options = {
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  target: 'esnext',
  outDir: 'dist',
  treeshake: false, // Preserves code exactly as written
};

/**
 * Configuration for minified production builds.
 */
export const minConfig: Options = {
  ...commonConfig,
  minify: true,
  sourcemap: true,
  clean: false,
  dts: false,
};

/**
 * Helper to generate the dual-export entries (normal + .min.js)
 */
export function createDualEntries(entries: Record<string, string>) {
  const minifiedEntries: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    minifiedEntries[`${key}.min`] = value;
  }
  return minifiedEntries;
}

/**
 * Scans package.json exports to automatically determine tsup entry points.
 * Maps "." to "src/index.ts" and "./subpath" to "src/subpath.ts" if they exist.
 */
export function getEntriesFromExports(cwd: string) {
  const pkgPath = resolve(cwd, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const exports = pkg.exports || {};
  const entries: Record<string, string> = {};

  for (const [key] of Object.entries(exports)) {
    if (key === './min') continue;

    const entryName = key === '.' ? 'index' : key.replace('./', '');
    const tsFile = `${entryName}.ts`;
    const srcPath = join(cwd, 'src', tsFile);

    if (existsSync(srcPath)) {
      entries[entryName] = `src/${tsFile}`;
    }
  }
  return entries;
}
