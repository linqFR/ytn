/**
 * @ytrynot/dna - DNA-based schema builder with Zod-like syntax
 *
 * Main exports:
 * - dna: Schema factory
 * - Types: DNA bytecode type definitions
 * - Constructor registry: For registering constructors used in instanceof validation
 * - validatorBuilder / parserBuilder: Low-level compilation with externals injection
 */

import * as dna from "./dna-namespace.js";
import { registerExternal } from "@ytrynot/dna/core";

registerExternal("dna", dna);

export * from "./dna-namespace.js";
export { dna };
export { validatorBuilder, parserBuilder } from "@ytrynot/dna/core";
export default dna;
