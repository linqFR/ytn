# @ytrynot/cli

[![npm version](https://img.shields.io/npm/v/@ytrynot/cli)](https://www.npmjs.com/package/@ytrynot/cli)
[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@ytrynot/cli)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> **Looking for testers!** This package is actively seeking early users and feedback. If you try it out, please share your experience — issues, suggestions, or ideas are all welcome.
>
> npm: https://www.npmjs.com/package/@ytrynot/cli · GitHub: https://github.com/linqFR/ytn/tree/main/packages/cli

DNA-validated CLI router that compiles contracts into standalone JS functions and files — no runtime dependency on `@ytrynot/dna`, just `node:util.parseArgs`.

## Table of Contents

- [Overview](#overview)
- [CLI contract](#cli-contract)
- [Layers](#layers)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Public API](#public-api)
- [Documentation](#documentation)
- [Status](#status)
- [License](#license)

## Overview

`@ytrynot/cli` transforms `process.argv` into DNA-validated objects using `dna.cliUnion` for routing and validation. Contracts compile to standalone JS functions and files — the generated code has no runtime dependency on `@ytrynot/dna`, only on `node:util.parseArgs`.

- **Standalone output**: `compile()` produces a JS function with no DNA runtime at call time. The generated code can be embedded in a single `.mjs` file that depends only on `node:util.parseArgs` — no `node_modules`, no `@ytrynot/dna` peer at runtime.
- **Routing**: Maranget decision tree (via `dna.cliUnion`) — scales to any number of subcommands, O(log N) dispatch on discriminator values.
- **Validation**: DNA bytecode — compiled by `@ytrynot/dna` `toJS`, not Zod.
- **Help**: Automatic generation from the DNA contract.
- **Contract**: DNA-based, not Zod-based.
- **Async**: Native support for async handlers via `safeParseAsync`.

## Requirements

- **Node.js** `>= 25.0.0`
- **Peer dependency**: `@ytrynot/dna` `^0.7.0` (provides `dna.cliUnion`, `dna.preprocess`, `toJS`, and the builder API)

## Installation

```bash
npm install @ytrynot/cli @ytrynot/dna
```

`@ytrynot/dna` is a peer dependency — consumers provide it. It is not bundled.

## CLI contract

A CLI contract is a DNA schema definition that describes the entire CLI structure — routes (subcommands), positional arguments, flags, and their validation rules. You define each route as a `dna.object` with a `cmd: dna.literal(...)` discriminator and `.meta({ cli: { routeId: "..." } })`, then pass the routes to `createContract()` which assembles the 5-layer pipeline. The contract is the single source of truth: routing, validation, help generation, and AOT compilation all derive from it. Handlers and formatters are added in subsequent layers — they are not part of the contract itself.

```typescript
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional(),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  cli: { positionals: ["cmd", "files"] },
});
```

For the full recipe-oriented guide (subcommands, flags, positionals, `--help`, short aliases, coercion, hidden routes, catchalls), see [How To: Define a CLI Contract](./docs/how-to-define-a-cli-contract.md).

## Layers

The CLI is built as 5 DNA schema layers, each chained via `.pipe()` or
`.transform()`. Each layer is a standalone DNA schema — you can stop at any
layer depending on how much of the pipeline you need.

| Layer | Function | Externals | Sync/Async | Portable |
|-------|----------|-----------|------------|----------|
| 0-1 | `createContract()` → `execute()` | `parseArgs` | sync (`safeParse`) | yes |
| 2 | `executeContract()` | `parseArgs`, `handlers` | async (`safeParseAsync`) | yes |
| 3 | `cliFactory()` | `parseArgs`, `handlers`, `formatter` | async | yes |
| 4 | `fullCli()` | + Node globals (`process`, `console`) | async + `process.exit` | Node-only |

**Layer 0-1 (routing + validation)** — `createContract()` assembles a
`dna.preprocess` that wraps argv, runs `parseArgs`, flattens positionals,
pipes through `dna.cliUnion` for Maranget routing, and extracts
`{ route, payload }`. Sync, 1 external (`parseArgs`), portable. The
`execute()` helper runs `safeParse` and returns `OExecuteResult`.

**Layer 2 (handlers)** — `executeContract()` adds a handler-dispatch
transform. The transform dispatches by route, calls the matching handler,
and returns `{ success: true, data }` or `{ success: false, error }`.
Async (`safeParseAsync` required), 2 externals, portable.

**Layer 3 (formatter)** — `cliFactory()` adds a formatter transform that
receives the handler result and returns `{ exit: 0|1, message: string }`.
Async, 3 externals, portable.

**Layer 4 (Node exit)** — `fullCli()` binds the formatted contract to
Node.js globals. Reads `process.argv.slice(2)`, runs the full pipeline,
prints to `console.log` (exit 0) or `console.error` (exit 1), and calls
`process.exit()`. Node-only — `process` and `console` are Node globals,
not externals, not in the bytecode.

**`process.exit()` is outside DNA transforms** — it lives in `fullCli()`
(layer 4), not in the bytecode. Layers 0-3 are portable (pure bytecode +
externals) and run anywhere DNA runs.

**AOT**: layers 0-1 compile via `compile()` into a standalone JS function
using `toJS(false, true)` + `new Function`. The compiled parser requires no
DNA runtime at call time — only the captured `parseArgs` external. Layers
2-4 are not AOT-compilable (they contain user code provided at runtime).

For the full architectural rationale, see [Architecture](./docs/architecture.md).



## Quick Start

A complete CLI with one subcommand, `--help`, handlers, formatter, and `process.exit`:

```typescript
import { dna } from "@ytrynot/dna";
import {
  createContract,
  executeContract,
  cliFactory,
  fullCli,
} from "@ytrynot/cli";
import type { ts } from "@ytrynot/cli";

// --- Routes ---

const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional()
    .meta({ description: "Files to build" }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const helpRoute = dna.looseObject({
  cmd: dna.literal("help"),
}).catchall(dna.unknown()).meta({
  cli: { flag: true, short: "h", routeId: "help" },
  description: "Show help",
});

// --- Contract ---

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  fallbacks: [helpRoute],
  cli: { positionals: ["cmd", "files"] },
});

// --- Handlers (layer 2) ---

const handlers: ts.Handlers = {
  build: (payload) => ({
    success: true,
    data: `Built ${(payload.files as string[] | undefined)?.length ?? 0} files`,
  }),
  help: () => ({
    success: true,
    data: "Usage: mycli <command> [options]",
  }),
};

// --- Formatter (layer 3) ---

const formatter: ts.FormatterFn = (result) => {
  if (result.success) return { exit: 0, message: String(result.data ?? "") };
  return { exit: 1, message: `Error: ${result.error}` };
};

// --- Run (layer 4) ---

const run = fullCli(cliFactory(executeContract(processed, handlers), formatter));
await run();
// Reads process.argv.slice(2), runs the full pipeline, prints, exits.
```

**Layer 1 only** (sync, no handlers, no `process.exit`) — useful for testing
or embedding:

```typescript
import { createContract, execute } from "@ytrynot/cli";

const result = execute(processed, ["build", "a.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }
```

**AOT compilation** (standalone parser, no DNA runtime at call time):

```typescript
import { compile } from "@ytrynot/cli";

const parser = compile(processed);
const result = parser(["build", "a.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }
```

## Public API

| Export | Kind | Layer | Description |
|--------|------|-------|-------------|
| `createContract()` | function | 1 | Assembles the DNA pipeline (routing + validation). |
| `execute()` | function | 1 | Sync helper around `pipeline.safeParse`. |
| `executeContract()` | function | 2 | Adds handler-dispatch transform. |
| `cliFactory()` | function | 3 | Adds formatter transform. |
| `fullCli()` | function | 4 | Binds to Node globals, calls `process.exit`. |
| `compile()` | function | AOT | Compiles layer 1 into a standalone JS function. |
| `buildHelp()` | function | — | Builds help text from the contract. |
| `printHelp()` | function | — | Prints help text to stdout. |
| `formatCliError()` | function | — | Formats DNA errors into a CLI-readable string. |
| `ts` | namespace | — | All public types: `ts.Contract`, `ts.Handlers`, `ts.FormatterFn`, `ts.RouteHandler`, `ts.ExecuteResult`, `ts.HandlerResult`, `ts.FormattedResult`, `ts.CliError`, `ts.CliMeta`, `ts.CliOptions`, `ts.ParseArgsConfig`, `ts.PositionalMeta`, `ts.FlagMap`, `ts.ProcessedContract`, `ts.ExecutableContract`, `ts.FormattedContract`, `ts.ContractOptions`. |

Full signatures, parameters, and return types: see [API Reference](./docs/api-reference.md).

## Documentation

- **[How To: Define a CLI Contract](./docs/how-to-define-a-cli-contract.md)** —
  practical recipes for each CLI shape (subcommands, flags, positionals,
  `--help`, short aliases, coercion, hidden routes, AOT).
- **[API Reference](./docs/api-reference.md)** — every public export,
  signatures, parameters, return types, type definitions.
- **[Architecture](./docs/architecture.md)** — the 5-layer pipeline, Maranget
  routing, the `\x00ID` convention, portability boundary, AOT scope.
- **[How To: Use CLI Routing in a REPL](./docs/how-to-use-cli-in-a-repl.md)** —
  build a stdin-based REPL on top of `dna.cliUnion` (no `@ytrynot/cli` dependency
  required, bypasses `parseArgs` and `process.exit`).

## Status

Stable — 228 tests passing, AOT layer 1 working, published on npm.

## License

MIT — Copyright (c) 2026 linqFR. See [LICENSE](./LICENSE) for details.
