/**
 * @ytn/dna - DNA-based schema builder with Zod-like syntax
 *
 * Main exports:
 * - dna: Schema factory 
 * - Types: DNA bytecode type definitions
 * - Constructor registry: For registering constructors used in instanceof validation
 */

import * as dna from "./dna-namespace.js";
import { registerExternal } from "./toJs/registry.js";

registerExternal("dna", dna);

export { dna };