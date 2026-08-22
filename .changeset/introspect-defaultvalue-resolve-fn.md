---
"@ytrynot/dna": patch
---

`DnaDefault.defaultValue` / `DnaPrefault.prefaultValue` getters: resolve getter functions; `.default()` / `.prefault()` accept getter functions at the type level

- `DnaDefault.defaultValue` getter now calls the function and returns the resolved value when the default was provided as a getter (`dna.x().default(() => value)`), instead of returning the raw function.
- `DnaPrefault.prefaultValue` getter applies the same resolution for consistency.
- `.default()` and `.prefault()` method signatures now accept both direct values and getter functions (`() => T`), via dual overloads matching Zod v4's API. Previously, passing a getter function was a compile-time error even though the runtime supported it.
- `DnaDefault` and `DnaPrefault` BaseCore seed types now include `(() => T)` to reflect that the raw storage may hold a function.
- `DnaCatch.catchValue` is unchanged — catch recovery functions take a `ctx` argument and are intentionally not resolved at access time.
- `introspect.defaultValue()` now delegates to the schema's `defaultValue` getter instead of resolving separately.
- Aligns with Zod v4's `def.defaultValue` getter, which always returns the resolved value.
- The runtime parser/codegen is unaffected — it reads `seed.value` (raw storage) directly, not the getter.
- Type regression tests added: `default-prefault-types.test.ts` (11 tests) and `infer-surface-types.test.ts` (20 tests) verify `dna.output` / `dna.input` / `dna.infer` parity with `_output` / `_input` across primitives, wrappers, default/prefault, composites, transforms, codecs, and nested objects.
- Runtime regression tests added: `default-prefault-runtime.test.ts` (22 tests) verify getter resolution, static value passthrough, non-memoization, Zod v4 parity, codegen integrity (raw function preserved in `seed.value`), and `introspect.defaultValue()` delegation.
