import { Options } from "tsup";
/**
 * Base configuration for YTN packages.
 * Focuses on Pure ESM, Zero Noise, and JSDoc preservation.
 */
export declare const commonConfig: Options;
/**
 * Configuration for minified production builds.
 */
export declare const minConfig: Options;
/**
 * Helper to generate the dual-export entries (normal + .min.js)
 */
export declare function createDualEntries(entries: Record<string, string>): Record<string, string>;
/**
 * Scans package.json exports and bins to automatically determine tsup entry points.
 *
 * Returns both the 'entries' map and a 'dts' configuration object that
 * intelligently excludes binaries from type definition generation.
 */
export declare function getEntriesFromPackage(cwd: string): {
    entries: Record<string, string>;
    /**
     * Build dts ONLY for entries that are in 'exports' (public API).
     * This avoids emitting empty .d.ts for binaries.
     */
    dts: {
        entry: string[];
        resolve: boolean;
        tsconfig: string;
    };
};
