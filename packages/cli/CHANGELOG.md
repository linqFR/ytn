# @ytrynot/cli

## 0.1.3

### Patch Changes

- Updated dependencies [1e7de18]
- Updated dependencies [75cc021]
- Updated dependencies [8505d77]
  - @ytrynot/dna@0.11.0

## 0.1.2

### Patch Changes

- Updated dependencies [75cc021]
- Updated dependencies [8505d77]
  - @ytrynot/dna@0.10.0

## 0.1.1

### Patch Changes

- Updated dependencies [c6d294e]
  - @ytrynot/dna@0.9.0

## 0.1.0

### Minor Changes

- d0ad289: Migrate to named-route API
  
  - **Breaking**: `IContract.targets` (tuple) and `IContract.fallbacks` replaced by `IContract.routes` (Record<string, DnaObject>). Route IDs are derived from record keys.
  - **Breaking**: `ICliMeta.routeId` removed — route IDs come from the `routes` record key.
  - `createContract()` now builds a clean `cliUnion` (no `\x00ID`) for `toParseArgsConfig`, then injects `\x00ID` via `DnaObject.apply()` for routing.
  - `toParseArgsConfig` is now standalone (from `@ytrynot/dna/introspect`), not a method on `DnaCliUnion`.
  - Positionals override goes into `toParseArgsConfig({ positionals })`, not `dna.cliUnion({ positionals })`.
  - `positionalMeta` computed from effective positionals (override or detected) with `positionals: []` config for `multiple` detection.
  - `help.ts` uses `processed.parseArgsConfig` instead of `cliUnion.toParseArgsConfig()`.
  - `help.ts` iterates `Object.values(processed.routes)` instead of `processed.routes` (array).

### Patch Changes

- 02d6bda: Adapt to DNA introspect API for parseArgs config
  
  - `createContract` and help generation use `introspect.toParseArgsConfig(schema, { positionals })` from `@ytrynot/dna/introspect` instead of the schema method.
- Updated dependencies [f80a8cd]
  - @ytrynot/dna@0.8.2

## 0.0.6

### Patch Changes

- 71b6383: Adapt to DNA introspect API for parseArgs config
  
  - `createContract` and help generation use `introspect.toParseArgsConfig(schema, { positionals })` from `@ytrynot/dna/introspect` instead of the schema method.
- Updated dependencies [62d8bd3]
- Updated dependencies [d7f6cbf]
- Updated dependencies [4bfff90]
  - @ytrynot/dna@0.8.1

## 0.0.5

### Patch Changes

- Updated dependencies [4d5aa05]
- Updated dependencies [c06294f]
- Updated dependencies [af05353]
  - @ytrynot/dna@0.8.0

## 0.0.4

### Patch Changes

- f34b108: WIP
- 8be32ee: @ytrynot/shared: reorganize shared/types into thematic files
  
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
- Updated dependencies [8be32ee]
- Updated dependencies [8be32ee]
  - @ytrynot/dna@0.7.5

## 0.0.3

### Patch Changes

- e897dff: Bump engines to Node >=26.0.0 across all packages. CI workflows updated to Node 26.
- Updated dependencies [e897dff]
  - @ytrynot/dna@0.7.4

## 0.0.2

### Patch Changes

- 67c6009: Documentation restructure and public API cleanup
  
  - Restructure docs per Diátaxis: README as Quick Start, new `docs/api-reference.md` (Reference), new `docs/architecture.md` (Explanation)
  - Add Requirements, Installation, Layers, and Public API sections to README
  - Add npm/CI/license badges to README
  - Add copyright year to License section
  - Update tagline and Overview to highlight standalone output (no DNA runtime dependency)
  - Document all public exports (previously undocumented: `formatCliError`, `IHandlers`, `RouteHandler`, `FormatterFn`, `OHandlerResultLoose`, `IContractOptions`, `ICliOptions`)
  - Fix factual errors: 228 tests (was 197), `files is []` not `undefined` for 0 positionals, `verified on Node ≥25` (was v26), add `dna.coerce.string()` to coercion list
  - Remove `(planned)` from Help in AGENTS.md (already implemented)
  - Remove `ROUTE_ID_KEY` and `CompiledParser` from public exports (internal only)
  - Add link back to README/api-reference/architecture from how-to guide
- Updated dependencies [ac6ddf2]
- Updated dependencies [ac6ddf2]
  - @ytrynot/dna@0.7.3
