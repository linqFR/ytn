/**
 * DNA Core — runtime class definitions and shared registry.
 *
 * This module is the single source of truth for DNA schema classes (`DnaType`,
 * `DnaObject`, `DnaString`, ...), the constructor registry, the instance
 * factory (`initDna`), the compiler (`toJS`), and error types. All other entry
 * points (`@ytrynot/dna`, `@ytrynot/dna/introspect`, `@ytrynot/dna/toJs`) import
 * from here so that `instanceof` checks share a single class identity, the
 * registry Map is a true singleton across bundles, and no internal module is
 * duplicated across bundles.
 *
 * Mirrors the `zod/v4/core` pattern: the main package re-exports the public API
 * but delegates class identity to this core module.
 */

// Re-export all runtime classes and helpers from dna-interfaces
export * from "./builder/dna-interfaces.js";

// Instance factory and core state classes (used by api-primitives, api-enhanced, fromDna)
export { initDna, BaseCore, bindMethods, MapSetCore, DNA_BINDABLE_METHODS } from "./builder/dna-core.js";

// Compiler entry points (used by index.ts and toJs.ts entry points)
export { toJS, validator, parser, validatorBuilder, parserBuilder } from "./toJs/dna-to-js.js";
export type { tsToJSResult, tsCompiledParts } from "./toJs/dna-to-js.js";

// Error types (DnaError is a class — instanceof must be consistent across bundles)
export { DnaError, dnaErrorSource } from "./shared/error.types.js";

// Error codes (used by api-primitives, transitively in core via error.types)
export { DnaIssueCodes } from "./shared/error-codes.js";

// Re-export the registry so every bundle shares the same Map
export { registerExternal, getExternal, getRegisteredExternals } from "./toJs/registry.js";
