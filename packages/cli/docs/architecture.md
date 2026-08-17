# Architecture

> Explanation — the **why** behind the 5-layer design, the routing model, and
> the `\x00ID` convention. For **how to use** the API, see
> [How To: Define a CLI Contract](./how-to-define-a-cli-contract.md). For
> signatures, see [API Reference](./api-reference.md).

## Table of Contents

- [Design goals](#design-goals)
- [The 5-layer pipeline](#the-5-layer-pipeline)
- [Why DNA, not Zod](#why-dna-not-zod)
- [Routing: Maranget decision tree](#routing-maranget-decision-tree)
- [The `\x00ID` convention](#the-x00id-convention)
- [Portability boundary: where `process.exit` lives](#portability-boundary-where-processexit-lives)
- [AOT compilation scope](#aot-compilation-scope)
- [What is NOT included](#what-is-not-included)

---

## Design goals

`@ytrynot/cli` is a CLI router that turns `process.argv` into DNA-validated
objects. The design pursues three goals:

1. **Single source of truth for routing and validation.** The same DNA schema
   that declares a subcommand's shape also validates its arguments. There is
   no separate routing table and no separate validation layer.
2. **Stop at any layer.** The pipeline is split into 5 standalone DNA schemas
   chained via `.pipe()` / `.transform()`. A consumer that only needs routing
   (layer 1) never pays for handlers, formatting, or `process.exit`.
3. **Portable core, Node-specific shell.** Layers 0-3 are pure bytecode +
   externals — they run anywhere DNA runs. Only layer 4 touches Node globals
   (`process`, `console`).

---

## The 5-layer pipeline

```
Layer 0 (preprocess):  dna.preprocess((argv) => ({ argv }), object(config).transform(parseArgs+remap, {parseArgs}))
Layer 1 (routing):     layer0.pipe(cliUnion).transform(extract \x00ID → {route, payload})
Layer 2 (handlers):    layer1.transform(handlerDispatch, {handlers}) → {success, data?} | {success, error?}
Layer 3 (formatter):   layer2.transform(msgFormatter, {formatter}) → {exit: 0|1, message: string}
Layer 4 (Node exit):   layer3.transform(processSortie) → void (console + process.exit)
```

| Layer | Function | Externals | Sync/Async | Portable |
|-------|----------|-----------|------------|----------|
| 0-1 | `createContract()` → `execute()` | `parseArgs` | sync (`safeParse`) | yes |
| 2 | `executeContract()` | `parseArgs`, `handlers` | async (`safeParseAsync`) | yes |
| 3 | `cliFactory()` | `parseArgs`, `handlers`, `formatter` | async | yes |
| 4 | `fullCli()` | + Node globals (`process`, `console`) | async + `process.exit` | Node-only |

```
process.argv
     │
     ▼
util.parseArgs (config from cliUnion.toParseArgsConfig)
     │
     ▼  { values, positionals }
flatten (positionals[index] → key, flags → key)
     │
     ▼  flat object
dna.cliUnion.safeParse (Maranget routing + DNA validation)
     │
     ▼  { route, payload }
handler dispatch (layer 2 transform)
     │
     ▼  { success, data? } | { success, error? }
formatter (layer 3 transform)
     │
     ▼  { exit: 0|1, message: string }
console + process.exit (layer 4, Node globals)
```

Each layer is a DNA schema. Stopping at layer 1 gives a pure
router/validator. Stopping at layer 2 gives handler dispatch without
formatting. Stopping at layer 3 gives a formatted result without touching
Node globals. Only layer 4 calls `process.exit`.

---

## Why DNA, not Zod

Validation is performed by `@ytrynot/dna` bytecode, compiled by `toJS` — not
Zod. The reasons:

- **AOT compilation.** DNA bytecode compiles to standalone JavaScript via
  `toJS`. The compiled function requires no DNA runtime at call time — only
  the captured externals. Zod schemas cannot be serialized to a standalone
  function this way.
- **Maranget routing.** `dna.cliUnion` builds a decision tree on the `cmd`
  discriminator using Maranget's algorithm. This gives O(log N) dispatch on
  discriminator values and scales to any number of subcommands. Zod's
  `discriminatedUnion` is a linear scan and has historically had arity
  limits.
- **Single schema, dual use.** The same DNA object that declares a route's
  fields also produces the `parseArgs` config (via `toParseArgsConfig`).
  Declaring a field once gives both the parseArgs option and the validator.

---

## Routing: Maranget decision tree

`dna.cliUnion` builds a Maranget decision tree on the `cmd` discriminator
field. Each route MUST declare `cmd: dna.literal("<name>")` — the literal
value is the discriminator value.

When `process.argv` is parsed:

1. `parseArgs` splits argv into `values` (flags) and `positionals` (bare
   words).
2. The CLI preprocessor flattens positionals into the flat object
   (`positionals[0]` → `cmd`, etc.).
3. `cliUnion.safeParse` walks the decision tree on `cmd` and dispatches to
   the matching route's object schema.
4. The route's object schema validates the remaining fields.

Routing is O(log N) on the number of distinct `cmd` values — not a linear
scan over routes.

---

## The `\x00ID` convention

Each route MUST declare `.meta({ cli: { routeId: "..." } })`.
`createContract()` injects `\x00ID: dna.string().default(routeId)` via
`apply()`.

**Why a NUL-prefixed key?**

- The NUL byte (`\x00`) makes the key impossible to pass as a CLI argument.
  Unix C-strings are NUL-terminated, so `\x00ID` cannot appear in argv.
  Node.js `child_process.spawn` also rejects NUL bytes in arguments.
- This guarantees the internal route identifier can never collide with a
  user-supplied flag or positional.
- `\x00ID` is filtered from `toParseArgsConfig().options` (it is not a
  user-visible flag) and stripped from the final `payload` by the extract
  transform (layer 1).

The route identifier is internal — it is the key used by handler dispatch
(layer 2) to look up the handler for a matched route.

---

## Portability boundary: where `process.exit` lives

`process.exit()` is **outside** DNA transforms. It lives in `fullCli()`
(layer 4), not in the bytecode.

- Layers 0-3 are portable: pure bytecode + externals. They run anywhere DNA
  runs — workers, embedded runtimes, tests.
- Layer 4 binds the formatted contract to Node.js globals (`process.argv`,
  `console`, `process.exit`). It is Node-only.
- `process` and `console` are Node globals — they are **not** externals, not
  in the bytecode. They are captured by closure in `fullCli()`.

This separation means a consumer can use layers 0-3 in a non-Node
environment and handle exit/printing themselves.

---

## AOT compilation scope

Only **layer 1** (routing + validation) is AOT-compilable via `compile()`.

- `compile()` uses `toJS(false, true)` (parser mode + builder opcode mapper)
  and instantiates the generated function via `new Function`.
- 1 external: `parseArgs` (captured at compile time from
  `processed.externals`).
- The compiled parser is synchronous (layer 1 has no async transforms).
- Results are cached per contract (WeakMap, identity-based).

Layers 2-4 add async transforms (handler dispatch, formatter, Node exit).
They contain user code (handlers, formatter) provided at runtime, so they
cannot be AOT-compiled. The compiled parser gives a standalone,
DNA-runtime-free function for the routing + validation step.

---

## What is NOT included

- **No Zod**: validation is DNA-only.
- **No `pico` API**: removed, replaced by the DNA builder API.
- **No bitmask routing**: replaced by Maranget decision tree via `cliUnion`.
- **No REPL**: not an objective.
