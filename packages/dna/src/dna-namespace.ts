/**
 * DNA Namespace - Type definitions for declaration merging
 * Allows dna.tsDnaString, dna.infer<typeof schema> to work
 */

import type { DnaType } from "./builder/dna-interfaces.js";
import type { $Input, $InputHead, $Output } from "./types/helpers.types.js";



// Re-export everything from api (this creates the dna namespace)
export * from "../src/builder/api-primitives.js";
export * from "../src/builder/api-enhanced.js"

// Utility exports
export * as util from "./builder/util.js"

// Type exports
// export type * from "./types/api-builder.types.js";
// export type * as ts from "./types/api-builder.types.js";
export type { tsDna, tsDnaOpcode as tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";
export type { DnaFunctionOptions as tsDnaFunctionOptions } from "./types/api-builder.types.js";



export type output<S> = $Output<S>;
export type infer<S> = $Output<S>;

export type inputLocal<S> = $Input<S>;
export type input<S> = $InputHead<S>;

// Constructor registry for instanceof validation
export {
  registerExternal as registerConstructor,
  getExternal as getConstructor,
} from "./toJs/registry.js";

