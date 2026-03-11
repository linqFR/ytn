import { Options } from 'tsup';

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
