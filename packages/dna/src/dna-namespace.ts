/**
 * DNA Namespace - Type definitions for declaration merging
 * Allows dna.tsDnaString, dna.infer<typeof schema> to work
 */

import type { tsDnaType } from "./shared/base.types.js";



// Re-export everything from api (this creates the dna namespace)
export * from "../src/builder/api-primitives.js";
export * from "../src/builder/api-enhanced.js"

// Utility exports
export * as util from "./builder/util.js"

// Type exports
export type * from "./types/api-builder.types.js";
export type * as ts from "./types/api-builder.types.js";
export type { tsDna, tsDnaOpcode as tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";

// Type inference helper
export type infer<T> = T extends { _output: infer O } ? O : T extends tsDnaType<infer V, any> ? V : never;

// Constructor registry for instanceof validation
export {
  registerConstructor,
  getConstructor,
} from "./toJs/jshelpers.js";

