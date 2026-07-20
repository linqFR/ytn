/**
 * DNA to JavaScript Code Generator
 *
 * Re-exports main DNA→JS code generation functions
 */

// Export only main public API functions
export { toJS, validator, parser} from "./toJs/dna-to-js.js";
export type { tsDnaParserFn, tsDnaValidatorFn } from "./shared/runtime.types.js";
export type { tsDna, tsDnaOpcode, tsDnaSeq } from "./types/core.types.js";
