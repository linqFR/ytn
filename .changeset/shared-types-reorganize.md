---
"@ytrynot/dna": patch
"@ytrynot/cli": patch
---

@ytrynot/shared: reorganize shared/types into thematic files

- Split `modifiers.type.ts` into `structural.type.ts`, `predicates.type.ts`,
  `enum.type.ts`, `record.type.ts`
- Add `$FlattenDistributive<T>` (preserves each union member independently)
- Add `$FlattenCombinative<T>` and `$ToRecord<T>` as aliases of `$Flatten`
- Add `$MaybeAsync<T>` and `$InferReturnType<F>` to `async.type.ts`
- Rename `tsValidJSON` → `$isValidJSON` (predicate, not static type)
- Add `README.md` and `wiki.md` with comparison tables and usage examples
- Add `types.test.ts` with 43 `expectTypeOf` tests covering all helpers
- Update `shared/README.md` with missing namespaces (regex, cli, polyfill)
- Fix broken imports in `shared/js/set-ops.ts` and `packages/cli/src/preprocess.ts`

Impact: @ytrynot/dna and @ytrynot/cli import from @ytrynot/shared/types.
The import paths changed (modifiers.type.ts → structural.type.ts / record.type.ts).
