# Multi-key routing (`dna.marangetUnion`)

`dna.marangetUnion` is a DNA schema primitive that routes an input object to one
of several branches by inspecting **multiple keys** simultaneously. It compiles
the branches into a decision tree at codegen time, giving O(log N) routing
instead of the O(N) linear scan a plain union would require.

It is the engine behind `dna.cliUnion` (legacy alias) and powers multi-command
CLI routing in `@ytrynot/cli`.

> **Looking for the API reference?** See [cli-union.md](cli-union.md) for the
> full builder API, getters, `toParseArgsConfig`, typing model, and edge cases.
> **Looking for the internals?** See
> [technical-maranget.md](technical-maranget.md) for the clause matrix format,
> compilation rules, column selection heuristics, P2'-carrying, routing modes,
> wildcard encoding, F1 fix, and validation evidence.

## Table of contents

- [Why use `marangetUnion`](#why-use-marangetunion)
- [When to choose it over `discriminatedUnion`](#when-to-choose-it-over-discriminatedunion)
- [Basic usage](#basic-usage)
- [Catch-all branches](#catch-all-branches)
- [Routing modes](#routing-modes)
- [Branches routing on different keys](#branches-routing-on-different-keys)
- [Optional discriminator keys](#optional-discriminator-keys)
- [Command aliases (or-patterns)](#command-aliases-or-patterns)
- [What is NOT supported](#what-is-not-supported)

---

## Why use `marangetUnion`

A typical CLI needs to route on **more than one key** — `cmd` first, then `sub`
for sub-commands, then `mode` for environment, etc. A plain `discriminatedUnion`
handles only a single key. `marangetUnion` handles N keys:

```ts
const cli = dna.marangetUnion([
  dna.object({ cmd: dna.literal("build"),  mode: dna.literal("dev")  }),
  dna.object({ cmd: dna.literal("build"),  mode: dna.literal("prod") }),
  dna.object({ cmd: dna.literal("deploy") }),
]);
```

Three properties make it suited for CLI routing:

1. **Multi-key dispatch** — inspects `cmd`, `mode`, `sub`, etc. in a single
   tree, not one key at a time.
2. **Catch-all branches** — a branch with no discriminator values acts as a
   fallback (wildcard), reachable when no specific branch matches.
3. **Auto-detection** — discriminators, positionals, and flags are inferred
   from the branch shapes. No manual configuration needed for common cases.

The decision tree is compiled at **codegen time** (not at runtime): the
generated JavaScript contains a nested `switch`/`if` tree, not a loop over
branches. For 10+ branches this is consistently faster than a linear if-chain
(see [cli-union.md — Routing complexity](cli-union.md#routing-complexity) for
benchmark ratios).

---

## When to choose it over `discriminatedUnion`

| | `discriminatedUnion` | `marangetUnion` |
|---|---|---|
| Discriminator keys | 1 | N |
| OpenAPI / JSON Schema | yes | no |
| Catch-all branches | no | yes |
| Positional detection | no | yes |
| `toParseArgsConfig` | no | yes |
| Routing performance | O(1) single switch | O(log N) decision tree |

Use `discriminatedUnion` when you need OpenAPI compatibility or single-key
routing. Use `marangetUnion` for CLI routing and any multi-key dispatch where
OpenAPI compatibility is not required.

---

## Basic usage

```ts
import { dna } from "@ytrynot/dna";

const cli = dna.marangetUnion([
  dna.object({ cmd: dna.literal("build"),  mode: dna.literal("dev")  }),
  dna.object({ cmd: dna.literal("build"),  mode: dna.literal("prod") }),
  dna.object({ cmd: dna.literal("deploy") }),
]);

cli.safeParse({ cmd: "build", mode: "dev" });
// → { success: true, data: { cmd: "build", mode: "dev" } }

cli.safeParse({ cmd: "deploy" });
// → { success: true, data: { cmd: "deploy" } }

cli.safeParse({ cmd: "unknown" });
// → { success: false, errors: [...] }
```

Discriminators are auto-detected: any key that has a finite value set
(`dna.literal`, `dna.enum`, `dna.boolean`) in at least one branch becomes a
routing key. The tree tests `cmd` first (2 values), then `mode` (2 values).

---

## Catch-all branches

A branch that does not declare a discriminator key (or declares it with a
non-finite type like `dna.string()`) acts as a **catch-all** — it matches any
value for that key. This is how you add a fallback branch:

```ts
const cli = dna.marangetUnion([
  dna.object({ cmd: dna.literal("build") }),
  dna.object({ cmd: dna.literal("deploy") }),
  dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "fallback" })),
]);

cli.safeParse({ cmd: "build" });
// → { success: true, data: { cmd: "build" } }

cli.safeParse({ cmd: "zzz" });
// → { success: true, data: { cmd: "zzz", w: "fallback" } }
```

The catch-all branch is reached when no specific branch matches. By default
(`constructor-priority` mode), specific branches always win over the catch-all
even if declared after it — see [Routing modes](#routing-modes).

---

## Routing modes

When multiple branches can match the same input, the **mode** decides which one
wins. The mode is set at construction time and serialized in the DNA (roundtrip
via `fromDna` preserves it).

### `constructor-priority` (default)

Specific branches (with finite discriminator values) **always win** over
catch-all branches, regardless of declaration order. The catch-all is a pure
fallback — it only catches inputs that no specific branch matches.

```ts
const cp = dna.marangetUnion([
  dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "catch" })),
  dna.object({ cmd: dna.literal("build") }),
]);
cp.safeParse({ cmd: "build" });
// → { success: true, data: { cmd: "build" } }  — specific branch wins

cp.safeParse({ cmd: "zzz" });
// → { success: true, data: { cmd: "zzz", w: "catch" } }  — catch-all fallback
```

### `source-order`

The **first branch in declaration order** that matches wins. A catch-all
declared first catches everything, including inputs that would match a later
specific branch.

```ts
const so = dna.marangetUnion([
  dna.looseObject({}).transform((d: Record<string, unknown>) => ({ ...d, w: "catch" })),
  dna.object({ cmd: dna.literal("build") }),
], { mode: "source-order" });
so.safeParse({ cmd: "build" });
// → { success: true, data: { cmd: "build", w: "catch" } }  — catch-all wins (first match)
```

### `cli`

Routes like `constructor-priority` and additionally sorts discriminator columns
by **positional priority** (fewest values first = most likely subcommand). This
is the mode `dna.cliUnion` uses. Positionals and flags are derived from the
branch shapes, never stored in the DNA — see
[cli-union.md](cli-union.md#auto-detection) for details.

---

## Branches routing on different keys

A branch can route on a **different key** than the other branches. For example,
a CLI with `build` and `deploy` commands plus a `--help` flag:

```ts
const cli = dna.marangetUnion([
  dna.object({ cmd: dna.literal("build") }),
  dna.object({ cmd: dna.literal("deploy") }),
  dna.object({ help: dna.literal("help") }),
]);

cli.safeParse({ cmd: "build" });
// → { success: true, data: { cmd: "build" } }

cli.safeParse({ help: "help" });
// → { success: true, data: { help: "help" } }

cli.safeParse({ cmd: "help" });
// → { success: false }  — "help" is not a valid cmd value
```

The `help` branch does not declare `cmd`, so it has a wildcard on `cmd` (matches
any value) and a constructor on `help`. The routing tree tests `cmd` first: if
`cmd` is `"build"` or `"deploy"`, the corresponding branch wins; if `cmd` is
absent or unknown, the tree falls through to test `help`.

This works correctly because DNA keeps the clause matrix **position-aligned** —
a branch that skips a leading column carries an explicit marker so later values
do not shift into the wrong position.

---

## Optional discriminator keys

A key declared `.optional()` routes on both its finite values **and** on
`undefined` (absence). This lets you distinguish "flag present and true" from
"flag absent":

```ts
const cli = dna.marangetUnion([
  dna.object({ cmd: dna.literal("build"), verbose: dna.literal(true).optional() }),
  dna.object({ cmd: dna.literal("deploy") }),
]);

cli.safeParse({ cmd: "build", verbose: true });
// → branch 0 (verbose present and true)

cli.safeParse({ cmd: "build" });
// → branch 0 (verbose absent — optional, still matches)

cli.safeParse({ cmd: "deploy", verbose: true });
// → branch 1 (verbose is wildcard for this branch)
```

A key is treated as a discriminator when **at least one branch** has a finite
value set for it. A branch that does not declare the key contributes a wildcard
cell, not an optional one — optionality comes from `.optional()` /
`.nullish()` / `dna.undefined()`, not from absence.

---

## Command aliases (or-patterns)

A single branch can accept **multiple values** on the same key using
`dna.enum([...])`. The branch appears in multiple `switch` cases, all pointing
to the same branch — this is how you declare command aliases:

```ts
const cli = dna.marangetUnion([
  dna.object({ cmd: dna.enum(["build", "b"]) }),
]);

cli.safeParse({ cmd: "build" });
// → { success: true, data: { cmd: "build" } }

cli.safeParse({ cmd: "b" });
// → { success: true, data: { cmd: "b" } }
```

Both `"build"` and `"b"` route to the same branch. The generated `switch` has
two cases (`case "build"` and `case "b"`) pointing to the same subtree.

---

## What is NOT supported

- **Non-finite discriminator keys**: `dna.string()`, `dna.number()`,
  `dna.record()`, `dna.array()` cannot be routing keys — they have no finite
  value set to build `switch` cases from. Use `dna.literal` or `dna.enum` for
  routing keys.
- **`DnaLazy` discriminator keys**: lazy schemas cannot be introspected for
  finite values. A lazy branch can be routed **to**, but a lazy key cannot be
  a routing key.
- **JSON Schema / OpenAPI**: `marangetUnion` is DNA-specific. `toJSONSchema()`
  does not emit it. Use `discriminatedUnion` if you need OpenAPI compatibility.
- **`.default()` on routing keys before routing**: a default is applied
  **inside the branch** (after routing), not before. If the key is absent,
  routing fails before the default is injected. To default a routing key before
  routing, inject the default at the `parseArgs` layer — see
  [cli-union.md — `.default()` on routing keys](cli-union.md#default-on-routing-keys).

For the full list of edge cases and limitations, see
[cli-union.md — Limitations](cli-union.md#limitations).
