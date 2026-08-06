/**
 * @ytn/dna toJS compiler — active performance / correctness backlog
 *
 * Cleaned on 2026-08-05. Old items marked FIXED or superseded by the
 * builder/WrapperImpl refactor were removed; the previous version is in git
 * history if any detail needs to be recovered.
 *
 * Rule for new entries: include exact location, measurable impact, and the
 * test command(s) needed before merging.
 */

// ============================================================================
// FIXED — 2026-08-05: Sentinel collision in `array` handler
// ============================================================================
// BUG:    `itemsIndex` defaulted to `0` as the "no items declared" sentinel,
//         but DNA index `0` is a valid items target (e.g. a recursive `$ref`
//         pointing back to the root node). The truthiness checks
//         `&& itemsIndex` (validate mode) and `&& itemsIndex !== 0` (parser
//         mode) both treated index 0 as "absent", so the items-loop body was
//         emitted empty — invalid items inside a recursive array were silently
//         accepted.
// FIX:    Switched the sentinel to `-1` (the project's standard
//         absent-constraint sentinel) and changed the guards to
//         `itemsIndex >= 0` in both validate and parser modes.
// TESTS:  packages/schvalid/tests/schemas/regression-failles.test.ts
//         (recursive $ref as array items — sentinel fix).

// ============================================================================
// HIGH PRIORITY — hot path, measurable allocation / GC pressure
// ============================================================================

// TODO: [PERF-H1] Replace `Object.keys(passedIdx).length` with a counter when safe
//   LOCATION: dna-js-json.ts > object() — additionalProperties post-loop length check
//   PROBLEM:  `Object.keys(passedIdx).length` allocates an array per validation call
//             just to count marked keys.
//   FIX:      Keep `passedIdx` for membership, add `passedCount` and increment it when
//             marking a new key. Use `passedCount<oLen` instead of `Object.keys(...).length<oLen`.
//   CAVEATS:  `passedIdx` is also required as a set by `unevaluatedProperties` /
//             `unevaluatedItems`. Apply the counter only in code paths that do not
//             rely on the full `Object.keys` result for unevaluated propagation.

// TODO: [PERF-H2] Skip `.visit` Map memoization for acyclic $refs
//   LOCATION: dna-to-js.ts > END_REF/STR_REF
//   PROBLEM:  Every `L####` function allocates a `new Map()` and runs has/set/set on
//             every call, even for schemas that are not circular.
//   FIX:      Build the ref dependency graph at compile time (Tarjan/DFS over refList).
//             Emit the `.visit` prelude only for refs proven to participate in a cycle.
//   CAVEATS:  Correctness-critical. Default to the safe memoized path when cyclicity
//             cannot be proven. Add circular-schema regression tests.

// ============================================================================
// MEDIUM PRIORITY — to investigate, not to implement blindly
// ============================================================================

// TODO: [PERF-M1] Propagate `parentCtx.typeChecked` across allOf/anyOf/oneOf branches
//   LOCATION: dna-js-json.ts > allOf() @ 1725-1730, anyOf() @ 1639, oneOf()
//   PROBLEM:  Parser-mode children get a fresh `childCtx` without `parentCtx.typeChecked`,
//             so each branch re-emits the full `Array.isArray` / `typeof` guard.
//   FIX:      Either (a) emit one upstream type guard before the combinator when all
//             branches agree on the input type, or (b) propagate `typeChecked` into the
//             children while preserving per-branch error paths.
//   CAVEATS:  `allOf` can mix disparate types. An upstream guard is only safe when the
//             type is uniform across branches. Requires measuring real schemas first.

// ============================================================================
// LOW PRIORITY
// ============================================================================

// TODO: [PERF-L1] Optional compilation cache for repeated DNA inputs
//   LOCATION: dna-to-js.ts > validator()/parser()
//   PROBLEM:  `validator(dna)` / `parser(dna)` call `new Function()` every time.
//             The same schema compiled repeatedly wastes compile-time work.
//   FIX:      Optional cache keyed by DNA identity (WeakMap or a serialized key).
//   CAVEATS:  Adds memory. Make it opt-in to avoid surprising retention.

export {};
