---
name: ytn-dna-perf
description: Lessons and guardrails for analyzing DNA-generated validator/parser performance
subagent: true
allowed-tools:
  - read
  - grep
  - exec
  - skill
---

# DNA / schvalid generated-code performance analysis

When inspecting JavaScript produced by `@ytn/dna/toJs`, treat every static metric as a question, not a conclusion. The heuristics measure patterns; the actual cost and correctness depend on DNA semantics.

## 1. `Object.keys(...)` / `passed` sets

`Object.keys(passed).length` and `Object.keys(evaluated)` are usually required by `additionalProperties`, `patternProperties`, `unevaluatedProperties` or `unevaluatedItems` to track which keys have already been consumed. Do not propose replacing them with a simple counter unless the tracking semantics are preserved or the schema is proven independent of `unevaluated*`.

## 2. `Object.hasOwn(v, "prop")` vs direct property access

Direct `v["prop"]` is faster but changes semantics:

- It does **not** distinguish own properties from inherited ones.
- It changes behavior for optional properties and for object shapes that may carry extra inherited keys.
- Correctness for arbitrary property names (including escaped / non-ASCII names in JSON Schema) must be preserved.

`Object.hasOwn(v, "prop")` is unnecessarily costly only when the key is a known literal, the property is declared in the schema, and the property is **not** intentionally `undefined` (i.e. presence is enough). It remains required to distinguish "absent" from "present but `undefined`". Never propose swapping `Object.hasOwn` for direct access without making it a codegen option or proving the input is a plain object and the keys are safe own properties.

## 3. Parser output is mutable and reconstructed by design

`Object.assign(Object.create(null), v)` and object rewrites exist because the DNA parser contract builds a fresh, isolated output object. `parseFast` / `combineFast` is the only path that is allowed to return the input reference. Do not propose removing reconstruction in the normal parser unless the user explicitly asks for a "fast" or "in-place" mode.

## 4. `L####` reference functions

Every DNA `ref` becomes a `L####` function. The `.visit` Map is for cycle detection. To inline a ref, first prove at compile time that the reference graph is acyclic by analyzing `refList` and the `ref` edges in the DNA tuple. Without that analysis, inlining is unsafe and can stack overflow on circular schemas.

## 5. Regex literals and `STEP.OUT_CONST`

Regex literals for `pattern`, `format`, `patternProperties` and `template` should be emitted through `STEP.OUT_CONST` so they are compiled once inside the **outer closure** and referenced by name in the body (`rx0.test(...)`). Do not confuse `STEP.CONST` (inside the validation function, re-created per call) with `STEP.OUT_CONST` (in the outer closure, created once per compilation).

What is currently in place:

- `pattern` and `format` in `dna-js-json.ts > string()` are hoisted to `STEP.OUT_CONST`.
- `patternProperties` in `dna-js-json.ts > object()` is hoisted to `STEP.OUT_CONST` via the `regexConstants` pool.
- Template literal regex in `dna-js-builder.ts` was already in `STEP.OUT_CONST`.

Important caveats:

- The `format` regex must use the `formatPattern` source, not the `pattern` source. A `string().format()` and `string().pattern()` can both be present on the same opcode.
- Regex with `g` or `y` flags are stateful (`lastIndex` is mutable). Do not hoist those into a shared closure unless you can guarantee `lastIndex` is reset or unused. The current hoisted regexes use `.test()` without `g`/`y`, so they are safe.
- For very large patterns, the source string is still in the compiled function, but the `RegExp` object is no longer re-created on each validation call.

## 6. Duplicated `Array.isArray` / `typeof` guards

Repeated type guards appear mainly in:

- `unevaluatedItems` / `items` with nested arrays
- `allOf` / `anyOf` / `oneOf` branches
- `dependentSchemas`

"Caching" a type guard (e.g. `const isArr = Array.isArray(v);`) only makes sense when the **exact same variable** is tested multiple times in the same scope. Generated variable names differ (`v`, `ob2pp0`, `val0`, etc.), so a simple global count is misleading. Each guard often belongs to a distinct applicator or branch; merging them can break `unevaluated*` tracking or change branch semantics. Verify the DNA-to-JS flow before proposing to cache or merge guards.

There is an open `PERF-M1` in `packages/dna/src/toJs/todo.ts` to investigate `parentCtx.typeChecked` propagation across `allOf` / `anyOf` / `oneOf` branches. Do not implement it without a targeted test and benchmark.

## 7. Static analysis is only a heuristic

A generated function with many `Object.keys`, `Object.assign` or `Object.hasOwn` calls is not necessarily the bottleneck. Always:

- Read the actual compiler source in `packages/dna/src/toJs/` (`dna-to-js.ts`, `dna-js-json.ts`, `dna-js-builder.ts`, `utils.ts`).
- Run `npm.cmd test -w @ytn/dna` and `npm.cmd test -w @ytn/schvalid` after any codegen change.
- Run `npm.cmd run perf -w @ytn/schvalid` for the official perf suite.
- Measure with real benchmarks in `packages/schvalid/perf/` before claiming a runtime improvement.

## 8. The official `schvalid` perf suite

`npm run perf -w @ytn/schvalid` runs two benchmarks:

1. `full-comparative-benchmark.ts` — 15 000 compilation samples plus 1 200 000 validation calls, comparing DNA / Schvalid / AJV / Zod. The fixed test schema (object with string, number, `email` format, array, boolean) **does not** use `pattern` or `patternProperties`, so a regex hoisting win will not appear in these numbers unless the schema is changed or a dedicated regex bench is added.
2. `bundle-performance.ts` — 300 000 validations of the full bundle vs the minified bundle. Treat differences below 5 % as noise; min vs full has been observed to be ~2-3 % slower on one run while still passing.

A micro-benchmark proving a local cost does not prove a global win. The official suite is the minimal bar for claiming a global improvement.

## 9. Output formatting

Never use `JSON.stringify(obj, null, 2)`. Use `console.dir(obj, { depth: null })` or `console.log(JSON.stringify(obj))` for logs and reports.

## 10. Vocabulary: "alerts" are static heuristics

Reported numbers from a generated-code analyzer are **not** "alertes de performance". They are heuristics statiques — pattern counts. Before turning a heuristic into a recommendation, validate it with a micro-benchmark, verify semantic equivalence, and check that the pattern is frequent enough to justify a codegen change.

## 11. Micro-benchmark discipline

- Report per-call cost in nanoseconds with correct unit conversion (`mean * 1_000_000` when the raw mean is in milliseconds per call).
- Warm up the function before sampling.
- Test on mixed inputs (valid/invalid, arrays/objects) so the benchmark is not monomorphic.
- A micro-benchmark proves a local cost; it does not prove a global win in the full validator/parser pipeline.

## 12. Avoid rewrite-sweep studies for marginal gains

Proposals to rewrite every generated function through source-to-source transformation, equivalence checking and frequency mapping are disproportionate for the likely gains. Prefer targeted, compiler-level changes (e.g. moving a regex from `STEP.CONST` to `STEP.OUT_CONST`) over large generic rewrite frameworks.

## 13. The `todo.ts` file is intentionally `.ts`

`packages/dna/src/toJs/todo.ts` is a `.ts` file with `export {};` so it is picked up by the user's `todo` VS Code extension (which uses ripgrep). Do not rename it to `.md` unless the user explicitly changes that workflow.
