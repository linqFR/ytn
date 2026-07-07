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
export type * from "./types/api-builder.types.js";
export type * as ts from "./types/api-builder.types.js";
export type { tsDna, tsDnaOpcode as tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";

// Type inference helper
// export type output<T> = T extends { _output: infer O } ? O : never;
// export type inputLocal<T> = T extends { _input: infer I } ? I : never;
// export type input<T> = T extends { _head: infer H }
//   ? unknown extends H
//     ? inputLocal<T>
//     : input<H>
//   : inputLocal<T>;
// export type infer<T> = output<T>;

export type output<S> = $Output<S>;
export type infer<S> = $Output<S>;

export type inputLocal<S> = $Input<S>;
export type input<S> = $InputHead<S>;

// Constructor registry for instanceof validation
export {
  registerConstructor,
  getConstructor,
} from "./toJs/jshelpers.js";

