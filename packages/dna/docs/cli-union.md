# CLI Union (`dna.cliUnion`)

`cliUnion` is a DNA schema primitive for multi-key CLI routing. It unions multiple object schemas (branches) that share discriminator keys, and compiles them into a Maranget decision tree for efficient dispatch.

Unlike `discriminatedUnion` (single-key, OpenAPI-compatible), `cliUnion` is CLI-specific: it auto-detects discriminators, infers positionals vs flags, emits the `"cli"` opcode, and can generate a `node:util.parseArgs` config from the schema.

## Architecture

### Pipeline

```
Command line tokens
       │
       ▼
┌─────────────────┐
│  util.parseArgs │  ← lexical tokenizer (config from toParseArgsConfig)
└─────────────────┘
       │
       ▼  { values, positionals }
┌─────────────────┐
│  @ytrynot/cli   │  ← flatten positionals[index] → key, flags → key
└─────────────────┘
       │
       ▼  flat looseObject
┌─────────────────┐
│  DnaCliUnion    │  ← routing + validation + branch mutation
└─────────────────┘
       │
       ▼  { success, data } | { success, errors }
```

**Responsibility boundaries:**

- **`util.parseArgs`**: tokenizes `process.argv` into `{ values, positionals }`. DNA provides the config via `toParseArgsConfig()`.
- **`@ytrynot/cli`** (planned): flattens `{ values, positionals }` into a single plain object. Maps positional indices to declared names, maps flag names to target keys.
- **`DnaCliUnion`**: receives the flat object, routes via decision tree, validates the selected branch, applies branch mutations (`.extend()`, `.default()`, `.transform()`, etc.).

### DNA format

```javascript
["cli", [discriminators], [discriminKeys], [refs]]
```

- `discriminators`: array of routing key names (e.g. `["cmd", "mode"]`)
- `discriminKeys`: 2D array — `discriminKeys[branchIndex][keyIndex]` contains the finite values for that branch/key. Singletons are flattened to primitives, multi-values are arrays.
- `refs`: `refs[0]` is the pre-validation object (type + required keys check), `refs[1..N]` are the branch sub-schemas.

The decision tree is **not** stored in DNA — it is computed at codegen time from the clause matrix. This keeps DNA compact.

### Codegen: Maranget decision tree

The `cli` opcode handler builds a nested `switch`/`if` tree from the clause matrix. See [Maranget decision tree codegen](technical.md#maranget-decision-tree-codegen-cli-opcode) in the technical reference for the full algorithm, column selection heuristic, and codegen rules.

### Maranget decision tree

The routing code is generated at codegen time from a **clause matrix** — a 2D grid where rows are branches and columns are discriminator keys. Each cell contains the finite value set accepted by that branch for that key.

The algorithm is a simplified adaptation of Luc Maranget's pattern-matching compilation (*"Compiling Pattern Matching to Good Decision Trees"*, ML'08, 2008):

```
emitTree(rows, remainingCols):
  1. If rows is empty → emit fail
  2. col = chooseColumn(rows, remainingCols)   // fewest distinct values that splits
  3. If col == -1 → emit branch validation (leaf)
  4. Group rows by value on column col
  5. If key is optional: emit if(key === undefined) { subtree } first
     If key is required: emit switch(key) { case v: subtree; ... default: fail }
  6. Recurse for each group
```

The tree is computed at codegen time, not stored in DNA. This keeps the DNA compact (`["cli", discriminators, discriminKeys, refs]`) while the generated JavaScript contains the full nested `switch`/`if` tree.

See [Maranget decision tree codegen](technical.md#maranget-decision-tree-codegen-cli-opcode) in the technical reference for the full algorithm, column selection heuristic, and codegen rules.

### Routing complexity

The decision tree is O(log N) — each level eliminates half the candidates. A flat if-chain is O(N). The benchmark (`sandbox/bench-ifchain-vs-maranget.ts`) confirms the scaling:

| N branches | if-chain (ns/op) | Maranget tree (ns/op) | Speedup |
|---|---|---|---|
| 3  | 9.78  | 9.23  | 1.06x (noise) |
| 10 | 14.13 | 11.45 | 1.23x |
| 25 | 21.36 | 13.67 | 1.56x |
| 50 | 31.98 | 14.01 | 2.28x |

The if-chain grows linearly with N; the tree stays nearly flat. For N ≤ 3, no measurable difference. For N ≥ 10, the tree is clearly faster. Values are environment-specific; treat as trends, not portable absolutes.

## Usage

### Basic

```typescript
import { dna } from "@ytrynot/dna";

const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
  }),
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("prod"),
  }),
  dna.object({
    cmd: dna.literal("deploy"),
  }),
]);

const r = cli.safeParse({ cmd: "build", mode: "dev" });
// { success: true, data: { cmd: "build", mode: "dev" } }

const r2 = cli.safeParse({ cmd: "unknown" });
// { success: false, errors: [...] }
```

### Auto-detection

`cliUnion` auto-detects:

- **Discriminators**: keys where `finiteValueSet` is non-undefined for all branches (literals, enums, booleans, null, undefined).
- **Positionals**: non-boolean, required discriminator keys, sorted by `1/distinctValues` (fewest values first = most likely subcommand).

```typescript
const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("prod") }),
  dna.object({ cmd: dna.literal("deploy") }),
]);

cli.discriminators; // ["cmd", "mode"]
cli.positionals;    // ["cmd", "mode"] (cmd first: 2 values, mode: 2 values, tie → declaration order)
cli.flags;          // [] (no non-positional keys)
```

### Explicit discriminators and positionals

```typescript
const cli = dna.cliUnion(
  [
    dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
    dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
  ],
  { discriminators: ["cmd"], positionals: ["cmd"] }
);
```

### Optional discriminators

Optional keys can route on `undefined` (absence) and/or on a finite value:

```typescript
const cli = dna.cliUnion([
  // Branch 0: verbose present and true
  dna.object({
    cmd: dna.literal("build"),
    verbose: dna.literal(true).optional(),
  }),
  // Branch 1: verbose absent (undefined)
  dna.object({
    cmd: dna.literal("build"),
    verbose: dna.literal(undefined).optional(),
  }),
]);

cli.safeParse({ cmd: "build", verbose: true });    // → branch 0
cli.safeParse({ cmd: "build" });                    // → branch 1 (verbose absent)
```

### Branch mutations (`.extend()`, `.default()`, `.transform()`)

Each branch is a full DNA schema. Mutations are preserved after routing:

```typescript
const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
  }).extend({
    branchId: dna.string().optional().default("build-dev"),
  }),
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("prod"),
  }).extend({
    branchId: dna.string().optional().default("build-prod"),
  }),
]);

cli.safeParse({ cmd: "build", mode: "dev" });
// { success: true, data: { cmd: "build", mode: "dev", branchId: "build-dev" } }
```

`DnaPipe` branches (`.transform()`) are also supported — the builder unwraps to the underlying `DnaObject` for discriminator detection, then emits the full pipe as the branch DNA.

### `toParseArgsConfig()`

> **Architectural note**: `toParseArgsConfig()` is a convenience method on the schema class, similar to `toJSONSchema()`. It performs a schema→config transformation at definition time, not at runtime. It does NOT import `node:util`, does NOT call `parseArgs`, and does NOT execute any CLI runtime logic. The runtime CLI pipeline (parseArgs execution, flattening `{ values, positionals }`, help generation, error formatting) remains the responsibility of `@ytrynot/cli`.

Generates a `node:util.parseArgs` config from the schema:

```typescript
const cli = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.literal("dev"),
    env: dna.literal("local"),
    verbose: dna.literal(true).optional(),
    output: dna.string().optional(),
  }),
  // ... more branches
]);

const config = cli.toParseArgsConfig();
// {
//   allowPositionals: true,
//   strict: false,
//   options: {
//     verbose: { type: 'boolean', multiple: false, short: 'v' },
//     output:  { type: 'string',  multiple: false, short: 'o' },
//   }
// }

import { parseArgs } from "node:util";
const { values, positionals } = parseArgs({ ...config, args: process.argv.slice(2) });
```

**Short aliases**: auto-generated from the first letter of each flag, skipping if already taken. Explicit overrides via `toParseArgsConfig({ shorts: { verbose: "V" } })`.

**Defaults are NOT injected** — DNA owns defaulting via `DnaDefault` wrappers in the branch schemas. `parseArgs` is a pure lexical tokenizer.

**Multiple**: `DnaArray` wrappers → `multiple: true` in the config.

**Type inference**:

| Leaf schema | `parseArgs` type |
|---|---|
| `DnaBoolean` | `"boolean"` |
| `DnaLiteral(true)` / `DnaLiteral(false)` | `"boolean"` |
| `DnaArray(DnaBoolean)` | `"boolean"`, `multiple: true` |
| everything else | `"string"` |

### Generated code portability

Generated parser and validator functions are self-contained when `requiredExternals` is empty:

```typescript
import { toJS } from "@ytrynot/dna";

const dnaSeq = cli.toDna();
const { code, requiredExternals } = toJS(false, true)(dnaSeq);

// requiredExternals: [] — no closure dependencies
// Use new Function(...code) to spread the parts correctly
const parseFn = new Function(...code)();

// Portable: rehydrate from the full parts array
const rehydrated = new Function(...code)();
rehydrated({ cmd: "build", mode: "dev" }); // works independently
```

> **Note on `toString()` rehydration**: `fn.toString()` only returns the inner function body — `STEP.OUT_CONST` entries (regexes, `_hop`, ref functions) in the outer closure are lost. For full portability, rehydrate from `new Function(...code)` using the original parts array, not from `fn.toString()`.

## API reference

### `dna.cliUnion(branches, config?)`

Creates a `DnaCliUnion` schema.

**Parameters:**
- `branches`: array of `DnaObject` (or `DnaPipe`/wrapped) schemas
- `config.discriminators`: explicit discriminator keys (auto-detected if omitted)
- `config.positionals`: explicit positional keys (auto-detected if omitted)

### `DnaCliUnion` getters

| Getter | Returns | Description |
|---|---|---|
| `.options` | `S` | Branch schemas (Zod v4 parity: `.options`) |
| `.discriminators` | `string[]` | Routing key names |
| `.positionals` | `string[]` | Positional key names (ordered) |
| `.flags` | `string[]` | Non-positional keys across all branches |

### `DnaCliUnion` methods

| Method | Returns | Description |
|---|---|---|
| `.toParseArgsConfig(opts?)` | `ParseArgsConfig` | Generates `node:util.parseArgs` config |
| `.safeParse(input)` | `{ success, data } \| { success, errors }` | Parse + transform |
| `.validate(input)` | `boolean` | Fast boolean validation |
| `.toDna()` | `tsDnaSeq` | Emits DNA bytecode |

### `DnaCliUnion` static methods

| Method | Description |
|---|---|
| `.detectDiscriminators(schemas)` | Auto-detects discriminator keys |
| `.detectPositionals(schemas, discriminators)` | Auto-detects positional keys |
| `.unwrapToDnaObject(schema)` | Unwraps `DnaPipe`/wrapper to `DnaObject` |

## Discriminator rules

- **Required keys** route on finite defined primitive values. A required key is never `undefined`.
- **Optional keys** can route on `undefined` (absence) and/or on a finite value.
- All branches must declare all discriminator keys (required or optional).
- `finiteValueSet` must include valid finite primitive values, including `undefined` where supported.

## Relationship with `discriminatedUnion`

| | `discriminatedUnion` | `cliUnion` |
|---|---|---|
| Discriminator keys | 1 | N |
| OpenAPI/JSON Schema | yes | no |
| Opcode | `discriminator` | `cli` |
| Codegen | `switch` on single key | Maranget decision tree |
| Positional detection | no | yes |
| `toParseArgsConfig` | no | yes |
| Branch mutations | full (`.extend()`, `.transform()`, etc.) | full (`.extend()`, `.transform()`, etc.) |

`cliUnion` is independent from `discriminatedUnion`. They serve different use cases: `discriminatedUnion` for OpenAPI-compatible single-key routing, `cliUnion` for CLI multi-key routing with branch mutations.

## Typing model

### Type parameters

```typescript
export function cliUnion<const S extends readonly DnaSomeType[]>(
  schemas: S,
  config?: ICliUnionConfig,
  meta?: string | tsDnaMeta
): DnaCliUnion<S>
```

- **`S`** (const type parameter): inferred as a **readonly tuple** of branch schema types. The `const` modifier on the type parameter preserves tuple order and length at the call site.
- **`ICliUnionConfig`**: `{ positionals?: string[]; discriminators?: string[] }` — minimal, runtime-only config. No `shorts` or `strict` (these are `parseArgs`-level concerns, see [ADMIN decision 2026-08-15](#toparseargsconfig)).

### `_output` and `_input`

```typescript
class DnaCliUnion<S extends readonly DnaSomeType[] = readonly DnaSomeType[]>
  extends DnaTypeWithWrappers<any, any> {
  declare readonly _output: $Output<S[number]>;
  declare readonly _input: $Input<S[number]>;
}
```

`_output` is the **union of branch outputs** (`$Output<S[number]>`), and `_input` is the **union of branch inputs** (`$Input<S[number]>`). `$Output<S>` extracts `_output` via `S extends { _output: infer O } ? O : unknown`.

### Deferred pattern

`DnaCliUnion` follows the same [deferred pattern](technical.md#deferred-outputinput-and-recursive-type-inference) as `DnaDiscriminatedUnion` and `DnaObject`:

1. **Parent uses `any, any`**: `extends DnaTypeWithWrappers<any, any>` — the parent's `readonly declare _output: T` resolves to `any` and does not force eager resolution.
2. **Re-declare via `declare readonly`**: `_output` and `_input` are re-declared with `declare readonly _output: $Output<S[number]>` / `declare readonly _input: $Input<S[number]>`. `declare` fields are erased at runtime and deferred until explicitly queried (e.g. `dna.infer<typeof cli>`).
3. **No `out` variance on `S`**: `S` is invariant but never variance-checked (only used in `declare` fields), consistent with `DnaObject`'s `T`.

### `.options` getter — justified cast

```typescript
get options(): S {
  // CAST: _core.seed.schemas is DnaSomeType[] (erased at runtime);
  // S is the static tuple type and TS cannot verify the array-to-tuple correspondence
  return this._core.seed.schemas as unknown as S;
}
```

The `as unknown as S` cast is justified and documented with a `// CAST:` comment on its own line (per repo rules). `_core.seed.schemas` is typed `DnaSomeType[]` (runtime-erased array), while `S` is the static tuple type — TypeScript cannot verify the array-to-tuple correspondence. This is the same pattern as `DnaUnion.options`.

### `dna.infer<typeof cli>`

```typescript
import { dna } from "@ytrynot/dna";

const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
]);

type Routed = dna.infer<typeof cli>;
// { cmd: "build"; mode: "dev" } | { cmd: "deploy"; mode: "prod" }
```

`dna.infer<S>` is an alias for `$Output<S>`, which extracts `_output` from the schema. For `DnaCliUnion<S>`, this resolves to `$Output<S[number]>` — the union of branch outputs.

### Wrappers on `cliUnion`

The `.optional()`, `.nullable()`, `.nullish()`, `.default()`, `.transform()`, `.catch()` wrappers are all available on the `cliUnion` schema (inherited from `DnaTypeWithWrappers`). They are applied **after** routing and branch validation.

```typescript
const optCli = cli.optional();
// DnaOptional<DnaCliUnion<S>>
// _output = $Output<S[number]> | undefined
```

### Type erosion when widened

When a `DnaCliUnion<S>` is widened to `DnaCliUnion<readonly DnaSomeType[]>` (e.g. stored in a generic container), `_output` erodes to `unknown`:

```typescript
const erased: DnaCliUnion<readonly DnaSomeType[]> = cli;
type Out = typeof erased["_output"]; // unknown
```

This is because `$Output<DnaSomeType>` = `unknown` (the default branch of the conditional type). The `@ytrynot/cli` package stores the `cliUnion` as `DnaCliUnion<readonly DnaSomeType[]>` in `IProcessedContract.cliUnion` (see `packages/cli/src/types/contract.types.ts`), so the typed output is only available at the construction site, not after storage in the contract.

### Edge case: empty branch array

```typescript
const empty = dna.cliUnion([] as const);
type Out = typeof empty["_output"]; // never
```

`S = readonly []` → `S[number] = never` → `$Output<never>` distributes over `never` and yields `never` (distributive conditional types over `never` produce `never`, not the `false` branch `unknown`). This is **consistent with `DnaUnion<S>`** which uses the same `$Output<S[number]>` pattern. Semantically defensible: an empty union cannot produce any valid value. Documented here because it is counter-intuitive (`unknown` would have been a safer default to avoid silent `never` propagation in pipelines).

### `toParseArgsConfig()` return type

```typescript
toParseArgsConfig(opts?: { strict?: boolean }): {
  allowPositionals: true;
  strict: boolean;
  options: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }>;
}
```

The return type is a **concrete type**, not generic over `S`. This is deliberate: the `options` keys are determined at runtime by introspecting the branches (unwrapping `_DnaWrapper`/`DnaPipe`, extracting leaf types), and are not inferrable from the static tuple `S`. Inferring `options` from `S` would require mapping each branch, unwrapping wrappers at the type level, and extracting leaf types — extremely complex for marginal gain. The current typing is the right trade-off.

### Comparison with `DnaUnion` and `DnaDiscriminatedUnion`

| | `DnaUnion<S>` | `DnaDiscriminatedUnion<K, S>` | `DnaCliUnion<S>` |
|---|---|---|---|
| Constraint on `S` | `tsDnaTupleSchemaRO` | `tsDnaDiscriminatedUnionObjects<K>` | `readonly DnaSomeType[]` |
| `_output` | `$Output<S[number]>` | `$Output<S[number]>` | `$Output<S[number]>` |
| `extends` | `DnaCombinator<...>` (typed) | `DnaTypeWithWrappers<any, any>` | `DnaTypeWithWrappers<any, any>` |
| Empty array `_output` | `never` | n/a (requires ≥1 branch with key `K`) | `never` |

**Note on the `S` constraint**: `DnaUnion` uses `tsDnaTupleSchemaRO` (which is `readonly [DnaType, ...DnaType[]] | readonly []`), while `DnaCliUnion` uses the looser `readonly DnaSomeType[]`. The looser constraint means a non-`const` `DnaSomeType[]` array is accepted — in that case `S[number]` resolves to `DnaSomeType` and `_output` erodes to `unknown`. The `const` modifier on the type parameter ensures tuple inference at the call site, so in practice the output is correctly typed when using `dna.cliUnion([...])` directly.

## Object modes in branches

Each branch is a `DnaObject` and inherits its object mode (`standard`, `strict`, or `loose`). The mode controls how unknown properties are handled **after** routing. There are two ways to set the mode: at construction time via the top-level factory, or by chaining a mode method on an existing object schema.

| Mode | Factory | Method | Unknown properties | Behavior |
|---|---|---|---|---|
| `standard` (default) | `dna.object({...})` | `.standard()` (alias: `.strip()`) | Stripped from output | Only declared keys appear in `data` |
| `strict` | `dna.strictObject({...})` | `.strict()` | Rejected — `safeParse` fails | `additionalProperties: false` |
| `loose` | `dna.looseObject({...})` | `.loose()` (alias: `.passthrough()`, deprecated) | Kept in output | `additionalProperties: true` |

```typescript
// Factory form
const cli = dna.cliUnion([
  dna.strictObject({ cmd: dna.literal("build") }),
  dna.looseObject({ cmd: dna.literal("deploy") }),
]);

// Method form (equivalent)
const cli2 = dna.cliUnion([
  dna.object({ cmd: dna.literal("build") }).strict(),
  dna.object({ cmd: dna.literal("deploy") }).loose(),
]);

cli.safeParse({ cmd: "build", extra: "x" });
// { success: false, errors: [{ message: "Unrecognized key: ...", ... }] }

cli.safeParse({ cmd: "deploy", extra: "x" });
// { success: true, data: { cmd: "deploy", extra: "x" } }
```

Mixed modes are supported: each branch applies its own mode independently after routing. The routing tree itself only reads the declared discriminator keys; it does not inspect unknown properties.

> **Warning — getter-throws on `strict`/`loose` inputs.** In parser mode, `strict` and `loose` objects use `Object.assign(Object.create(null), v)` to copy the input before checking/keeping unknowns. This triggers **all** own enumerable getters on the input, including getters on non-declared keys. If a getter throws, `safeParse` crashes with an uncaught exception instead of returning `{ success: false, errors }`. `standard` objects are not affected (they use `keepOnly`, which only reads declared keys). This is a known limitation shared with Zod v4's `.passthrough()` / `.strict()` on getter-throws inputs — see [Limitations](#limitations) below.

## Limitations

### By-design constraints

These limitations are inherent to the routing model and cannot be lifted without changing the architecture:

1. **Discriminator keys must have a finite primitive value set.** Only `literal`, `enum`, `boolean`, `null`, and `undefined` produce a finite `finiteValueSet`. `string`, `number`, `record`, `array`, `object`, `lazy`, `allOf`, `oneOf`, and `enumTypeDeep` (deep-equality enums) cannot be discriminators. Construction throws at `toDna()` time if a configured discriminator key has no finite value set in every branch.

2. **`enumTypeDeep` cannot be a discriminator.** Deep-equality enum values (objects/arrays) cannot be represented as JavaScript `switch`/`case` labels — `switch` uses `===` reference equality, not deep equality. Use `literal` or `enum` (primitive values) for routing keys.

3. **`allOf` / `oneOf` cannot be discriminators.** These combinators do not produce a finite value set. A key wrapped in `allOf`/`oneOf` cannot route.

4. **`DnaLazy` branches are supported, but `DnaLazy` discriminator keys are not.** `finiteValueSet` returns `undefined` for lazy schemas (Zod does not enforce exhaustiveness on lazy schemas). A lazy branch can be routed **to**, but a lazy key cannot be a routing key.

5. **All branches must declare all discriminator keys.** A branch missing a configured discriminator key throws at `toDna()` time. Optional discriminator keys (declared with `.optional()`) satisfy this requirement.

6. **DNA `.default()` on a routing key does not help routing.** The default is applied **inside the branch** (after routing), not before. If the key is absent, routing fails before the default is injected. To default a routing key before routing, use `parseArgs` `options[name].default` or a pre-routing transform owned by `@ytrynot/cli`. See [`.default()` on routing keys](#default-on-routing-keys) below.

7. **No JSON Schema / OpenAPI equivalent.** The `cli` opcode is DNA-specific. `toJSONSchema()` does not emit a `cliUnion`; it is only produced by the builder's `dna.cliUnion()`.

### `.default()` on routing keys

A `.default()` on a routing key is applied **inside the branch** (after routing), not before. Its role is to give the branch a canonical name in the parsed output — when the branch is reached via another routing key and the routing key is absent, `.default()` injects the branch's canonical value.

```typescript
const cli = dna.cliUnion([
  // cmd has a default, but routing reads v["cmd"] BEFORE the default is applied.
  // If cmd is absent, routing fails — the default cannot save it.
  dna.object({ cmd: dna.literal("build").default("build"), mode: dna.literal("dev") }),
  dna.object({ cmd: dna.literal("deploy"), mode: dna.literal("prod") }),
]);

cli.safeParse({});              // { success: false } — cmd absent, routing fails
cli.safeParse({ cmd: "build", mode: "dev" });  // { success: true } — cmd present, routes
```

To default a routing key **before** routing, inject the default at the `parseArgs` layer or in a pre-routing transform:

```typescript
// parseArgs default — injected before the flat object reaches cliUnion
const config = cli.toParseArgsConfig();
config.options.cmd = { type: "string", default: "build" };
```

### Edge cases

- **0 discriminators (auto-detection finds nothing):** if no key has a finite value set in all branches, `discriminators` is empty. The decision tree has no columns to split on and validates the **first branch** directly (first-match-wins). This is not a crash, but the result may be surprising — all inputs that match the first branch's shape are accepted, and inputs that don't are rejected with the first branch's errors.

- **Overlapping branches (same discriminator values in multiple branches):** not rejected at construction. The decision tree groups them together and **first-match-wins** (declaration order). The second branch is unreachable for those values.

- **Single branch:** `cliUnion` with one branch is valid. It behaves like a single object schema with a routing tree of depth 0 (the branch is always selected).

- **Wrappers on `cliUnion` itself:** `.optional()`, `.nullable()`, `.nullish()`, `.default()`, `.transform()`, `.catch()` are all supported on the `cliUnion` schema, applied after routing and branch validation. `undefined`/`null` inputs skip routing entirely and are handled by the wrapper.

- **Nested `cliUnion`:** a branch property can itself be a `cliUnion`. The outer routing tree selects the branch, then the inner `cliUnion` routes its own input. Both routing trees are independent.

## Warnings

### `parseArgs` boolean flags are presence-based

Node's `util.parseArgs` treats `type: "boolean"` options as **presence flags**: `--verbose` → `true`, absence → the key is **absent from `values`** (not `false`). `--verbose=false` in non-strict mode gives the **string** `"false"` (not boolean `false`); in strict mode it throws `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.

```typescript
const cli = dna.cliUnion([
  dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
  dna.object({ cmd: dna.literal("deploy") }),
]);
const config = cli.toParseArgsConfig();

const parsed = parseArgs({ ...config, args: ["build"] });
// parsed.values.verbose === undefined (absent, not false)

const parsed2 = parseArgs({ ...config, args: ["build", "--verbose"] });
// parsed2.values.verbose === true
```

If a branch requires `verbose: false` (literal), the flag must be **absent** from `values` and the flattening step must explicitly set `verbose: false` — `parseArgs` will not do this automatically.

### `parseArgs` non-strict mode treats unknown flags as boolean

In non-strict mode (`strict: false`, the default from `toParseArgsConfig()`), unknown flags are treated as boolean (`--unknown` → `values.unknown = true`) and their "value" goes to `positionals`. In strict mode (`strict: true`), unknown flags throw `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.

### `parseArgs` does not coerce types

`parseArgs` returns strings for `type: "string"` options and positionals, and booleans for `type: "boolean"` options. It does **not** coerce to `number`, even if the schema declares `dna.number()`. Coercion must happen in the pre-routing transform or in the branch schema (via `.transform()` or `.pipe()`).

### Positionals out of bounds

If fewer positionals are provided than declared, the flattening step produces `undefined` for the missing indices. If the missing positional is a **required** discriminator key, routing fails. If it is an **optional** discriminator key, routing proceeds on `undefined`.

If **more** positionals are provided than declared, the extra positionals are retained by `parseArgs` but ignored by `cliUnion` (in `standard` mode) — they are not in the declared `keepOnly` list. In `loose` mode, they would only appear in the output if the flattening step explicitly maps them to a key.

### Getter-throws on `strict`/`loose` inputs

In parser mode, `strict` and `loose` branches use `Object.assign(Object.create(null), v)` to copy the input. This triggers all own enumerable getters. If a getter on a non-declared key throws, `safeParse` crashes with an uncaught exception. `standard` branches are not affected (they use `keepOnly`, which only reads declared keys).

This is a known limitation shared with Zod v4's `.passthrough()` / `.strict()` on getter-throws inputs. Avoid passing objects with throwing getters to `strict`/`loose` schemas.

## See also

- [Maranget decision tree codegen](technical.md#maranget-decision-tree-codegen-cli-opcode) — algorithm, heuristics, codegen rules
- [`cli` opcode handler](opcode-patterns.md#cli-opcode-handler--maranget-decision-tree-stepsarray-variant) — StepsArray pattern variant
- [CLI union DNA format](../../../sandbox/cli-branches-union-dna-format.md) — design doc with benchmarks
- [Performance skill](../../.devin/skills/ytn-dna-perf/SKILL.md) — DNA-generated validator/parser performance findings
