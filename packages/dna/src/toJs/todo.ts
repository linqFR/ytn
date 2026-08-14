/**
 * @ytrynot/dna toJS compiler — active performance / correctness backlog
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

// RESOLVED — 2026-08-14: [PERF-H1] Replace `Object.keys(passedIdx).length` with a counter
//   Benchmark: counter-with-guard is always slower (guard cost > gain).
//   `for...in` count is 35% faster for ≤18 keys but 1.7x slower for ≥20 (V8
//   fast→slow properties transition at ~18-20 keyed stores).
//   `Object.keys().length` is the best universal choice.

// TODO: [PERF-H1b] Pre-declare known property keys in `passedIdx` object literal
//   LOCATION: dna-js-json.ts > object() — `passedIdx` initialization
//   PROBLEM:  `passedIdx = {}` + keyed assignment (`passedIdx[key]=1`) triggers V8's
//             `TooManyFastProperties()` at ~18-20 keyed stores, transitioning to
//             dictionary mode. `Object.keys().length` then slows down ~17x.
//   FIX:      When the schema's declared properties are known at codegen time and
//             there are no dynamic props (`!hasDynamicProps`), initialize `passedIdx`
//             as an object literal with all declared keys pre-set to 0:
//             `passedIdx = { name: 0, age: 0, email: 0, ... }`
//             Subsequent keyed writes become modifications (not additions) → no
//             HiddenClass transition → stays in fast mode.
//   BENCHMARK: 1.8x faster `Object.keys().length` on 19-key object (210ms vs 385ms,
//              5M iters, Node v26.5.1). `Object.keys()` on fast-mode object also
//              beats `for...in` count (210ms vs 256ms).
//   CAVEATS:  Only applicable when `!hasDynamicProps` (no additionalProperties,
//             no patternProperties) — dynamic keys from input can still push past
//             the soft limit. The `0` initial value allows `if(passedIdx[key])`
//             membership checks without a separate sentinel.
//   REF:      .devin/skills/ytn-dna-perf/v8-fast-properties.md

// TODO: [PERF-H2] Skip `.visit` Map memoization for acyclic $refs
//   LOCATION: dna-to-js.ts > END_REF/STR_REF
//   PROBLEM:  Every `L####` function allocates a `new Map()` and runs has/set/set on
//             every call, even for schemas that are not circular.
//   FIX:      Build the ref dependency graph at compile time (Tarjan/DFS over refList).
//             Emit the `.visit` prelude only for refs proven to participate in a cycle.
//   CAVEATS:  Correctness-critical. Default to the safe memoized path when cyclicity
//             cannot be proven. Add circular-schema regression tests.
//   STATUS:   2026-08-14 — Kept as TODO. Two findings:
//             1. Acyclic refs are rare — refs exist primarily for recursion. The
//                common case is cyclic, where the Map is needed.
//             2. The Map cannot be replaced by a plain-object hashmap: the key is
//                the input value `v`, which can be `null`, `undefined`, `false`,
//                `0`, `""`, an object, or an array. Plain objects coerce keys to
//                strings (collision risk) and cannot use objects as keys. `Map`
//                uses `===` identity, which is required here.
//             Next step: benchmark the Map overhead on a real acyclic-ref schema
//             before investing in the Tarjan implementation.

// ============================================================================
// MEDIUM PRIORITY — to investigate, not to implement blindly
// ============================================================================

// RESOLVED — 2026-08-14: [PERF-M1] Propagate `parentCtx.typeChecked` across allOf/anyOf/oneOf branches
//   Already done: all three combinators create `childCtx` via `{ ...parentCtx, ... }`,
//   which propagates `typeChecked` into every branch. Each branch then skips the
//   redundant type guard (lines 72, 187, 415, 491, 533 in dna-js-json.ts check
//   `parentCtx.typeChecked === <type>` and emit an empty test when it matches).
//   The `testedProp` mechanism (§15 in ytn-dna-perf SKILL.md) extends this further
//   for `discriminatedUnion`/`cliUnion` — propagating both the tested key AND the
//   pre-bound value variable into each branch.

// ============================================================================
// LOW PRIORITY
// ============================================================================

// RESOLVED — 2026-08-14: [PERF-L1] Optional compilation cache for repeated DNA inputs
//   Already covered at the schema level: `DnaType._validate()` and `_safeParse()`
//   use a `WeakMap<ctx | this, fn>` cache (dna-interfaces.ts lines 864-870, 918-924).
//   The key is `ctx ?? this` — externals map if provided, otherwise the schema
//   instance itself. `toDna()` is also cached on `_core`.
//   The compilation-level functions `validator(dna)` / `parser(dna)` (used by
//   schvalid) do not cache, but schvalid compiles once per schema in practice.
//   A compilation-level cache would need a serialized key (JSON.stringify) —
//   fragile and costly — or WeakMap, which doesn't work for arrays (two DNA
//   seqs with identical content have different identities). Not worth the
//   complexity for the marginal case.

export {};
