# AGENTS.md (Package: @ytrynot/cli)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to @ytrynot/cli.

---

## Core Architecture

`@ytrynot/cli` is a CLI router that uses `@ytrynot/dna` for validation and routing.

- **Routing**: `dna.cliUnion` with Maranget decision tree (opcode `cli`).
- **Validation**: DNA bytecode compiled by `toJS`.
- **Contract**: DNA-based schema definition. Maybe DSL string types in the future.
- **Help**: Automatic generation from the DNA contract.

### Pipeline (DEC-0029: 5-layer architecture)

The CLI is built as 5 DNA schema layers, each chained via `.pipe()` or `.transform()`. Each layer is a standalone DNA schema — users can stop at any layer.

```
Layer 0 (preprocess):  dna.preprocess((argv) => ({ argv }), object(config).transform(parseArgs+remap, {parseArgs}))
Layer 1 (routing):     layer0.pipe(cliUnion).transform(extract \x00ID → {route, payload})
Layer 2 (handlers):    layer1.transform(handlerDispatch, {handlers}) → {success, data?} | {success, error?}
Layer 3 (formatter):   layer2.transform(msgFormatter, {formatter}) → {exit: 0|1, message: string}
Layer 4 (Node exit):   layer3.transform(processSortie) → void (console + process.exit)
```

**Layer 0-1** (`createContract()` → `IProcessedContract`): 1 external (`parseArgs`). Sync, standalone, portable. `execute()` helper runs `safeParse` synchronously.

**Layer 2** (`executeContract()` → `IExecutableContract`): 2 externals (`parseArgs`, `handlers`). Async transform — `safeParseAsync` required. Handlers return `{success: true, data} | {success: false, error}` or nothing (→ default error).

**Layer 3** (`cliFactory()` → `IFormattedContract`): 3 externals (`parseArgs`, `handlers`, `formatter`). Formats handler results into `{exit, message}`.

**Layer 4** (`fullCli()` → `() => Promise<void>`): 3 externals + Node globals (`process`, `console`). Reads `process.argv.slice(2)`, runs `safeParseAsync`, prints message, calls `process.exit()`.

**`process.exit()` is outside DNA transforms** — it lives in `fullCli()` (layer 4), not in the bytecode. Layers 0-3 are portable (pure bytecode + externals). `process`/`console` are Node globals, not externals.

**AOT**: layers 0-1 compile via `toJS(false, true)` into a standalone JS function. 1 external (`parseArgs`). Layers 2-4 add async transforms → `safeParseAsync` required, bytecode becomes `async function`.

### Core Modules

- **`src/index.ts`**: Public entry point — re-exports `createContract`, `execute`, `executeContract`, `cliFactory`, `fullCli`, `compile`, `buildHelp`, `printHelp`, `formatCliError`. Exports public types via the `ts` namespace (`ts.Contract`, `ts.Handlers`, `ts.FormatterFn`, etc.). `ROUTE_ID_KEY` and `CompiledParser` are internal (not re-exported).
- **`src/contract.ts`**: `createContract()` — inject `\x00ID` via `apply`, build cliUnion, assemble layers 0-1, compute externals (1: `parseArgs`)
- **`src/factory.ts`**: `execute()` (layer 1 helper, sync) + `executeContract()` (layer 2) + `cliFactory()` (layer 3) + `fullCli()` (layer 4)
- **`src/compile.ts`**: `compile()` — AOT compilation via `toJS(false, true)` + `new Function`, cached per contract (layer 1 only). `CompiledParser` type is internal (not re-exported).
- **`src/error.ts`**: `formatCliError(errors: CliError[]): string` — DNA errors → CLI messages (Phase 1: passthrough)
- **`src/help.ts`**: `buildHelp(processed, forCommand?): string` + `printHelp(processed, forCommand?): void` — generated from `.meta().description` on routes and fields
- **`src/constants.ts`**: `ROUTE_ID_KEY` (`\x00ID`) — internal, not re-exported from `src/index.ts`
- **`src/types/contract.types.ts`**: Internal type definitions (`IContract`, `IProcessedContract`, `IExecutableContract`, `IFormattedContract`, `OExecuteResult`, `OHandlerResult`, `OFormattedResult`, `IFlagMap`, `ICliMeta`, `OParseArgsConfig`, `OPositionalMeta`, `RouteHandler`, `FormatterFn`). Public access is via the `ts` namespace in `src/index.ts`.

### `\x00ID` convention (DEC-0027)

Each route MUST declare `.meta({ cli: { routeId: "..." } })`. `createContract()` injects `\x00ID: dna.string().default(routeId)` via `apply()` — NOT a user-visible field. The NUL byte (`\x00`) prefix makes it impossible to pass as a CLI argument (NUL-terminated C-strings on Unix, rejected by Node.js `child_process.spawn`). `\x00ID` is filtered from `toParseArgsConfig().options` and stripped from the final `payload` by the extract transform.

### `handlers._error` (DEC-0029: removed)

`IHandlers._error` has been removed in DEC-0029. Error formatting is now handled by the formatter (layer 3). DNA validation errors (cliUnion rejection) are formatted by `fullCli()` directly.

### What is NOT included

- **No Zod**: validation is DNA-only
- **No `pico` API**: removed, replaced by DNA builder API
- **No bitmask routing**: replaced by Maranget decision tree via `cliUnion`
- **No REPL**: not an objective

---

## Dependencies

- **`@ytrynot/dna`** (peer): provides `dna.cliUnion`, `dna.preprocess`, `toJS`, builder API
- **`@ytrynot/dna/toJs`** (peer): `toJS` for AOT compilation
- **`@ytrynot/shared`** (dev, inlined): private toolbox
- **Node.js `node:util.parseArgs`**: lexical tokenizer (passed as external)

---

## Naming Standards

Follows global naming standards (`I*` input/config, `O*` output/result, `ts*` static aliases, `$*` type modifiers, `u*` utilities). No legacy carry-over — `@ytrynot/cli` is a clean rewrite.

---

## Build & Distribution

- **Build**: `tsup` via `tsup.config.ts` extending `../../tsup.config.base.ts`.
- **Output**: ESM only (`"type": "module"`), `dist/index.js` + `dist/index.d.ts`.
- **`@ytrynot/shared`** is inlined via `noExternal` in the base tsup config (devDependency, never shipped).
- **Peer dependency**: `@ytrynot/dna` (not bundled — consumers provide it).
- **Publishing**: OIDC trusted publishing via GitHub Actions (see global `AGENTS.md`). Agents must never run `npm publish` locally.
