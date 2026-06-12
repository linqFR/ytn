/**
 * DNA to JavaScript Code Generator
 *
 * Re-exports main DNA→JS code generation functions
 */

// Export only main public API functions
export { toJS, validator, parser} from "./toJs/dna-to-js.js";
export type { tsParserFn, tsValidatorFn } from "./types/dna.types.js";