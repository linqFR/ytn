# API Reference

> Reference — signatures, parameters, return types, and type definitions for
> every public export of `@ytrynot/cli`. For **how to use** these APIs, see
> [How To: Define a CLI Contract](./how-to-define-a-cli-contract.md). For the
> architectural rationale, see [Architecture](./architecture.md).

## Table of Contents

- [Functions](#functions)
  - [createContract()](#createcontract)
  - [execute()](#execute)
  - [executeContract()](#executecontract)
  - [cliFactory()](#clifactory)
  - [fullCli()](#fullcli)
  - [compile()](#compile)
  - [buildHelp()](#buildhelp)
  - [printHelp()](#printhelp)
  - [formatCliError()](#formatclierror)
- [Types (`ts` namespace)](#types-ts-namespace)
  - [ts.Contract](#tscontract)
  - [ts.ContractOptions](#tscontractoptions)
  - [ts.CliOptions](#tsclioptions)
  - [ts.CliMeta](#tsclimeta)
  - [ts.ProcessedContract](#tsprocessedcontract)
  - [ts.ExecutableContract](#tsexecutablecontract)
  - [ts.FormattedContract](#tsformattedcontract)
  - [ts.Handlers](#tshandlers)
  - [ts.RouteHandler](#tsroutehandler)
  - [ts.FormatterFn](#tsformatterfn)
  - [ts.ExecuteResult](#tsexecuteresult)
  - [ts.HandlerResult](#tshandlerresult)
  - [ts.FormattedResult](#tsformattedresult)
  - [ts.ParseArgsConfig](#tsparseargsconfig)
  - [ts.PositionalMeta](#tspositionalmeta)
  - [ts.FlagMap](#tsflagmap)
  - [ts.CliError](#tsclierror)
- [Handler result contract](#handler-result-contract)
- [Handler throw behavior](#handler-throw-behavior)
- [Route metadata](#route-metadata)

---

## Functions

### createContract()

```typescript
function createContract(contract: ts.Contract, options?: ts.ContractOptions): ts.ProcessedContract
```

Assembles layers 0-1 of the pipeline: a `dna.preprocess` that wraps argv,
runs `parseArgs`, flattens positionals into the flat object, pipes through
`dna.cliUnion` for Maranget routing, and extracts `{ route, payload }` by
stripping `\x00ID`.

**Parameters**:

- `contract` — see [ts.Contract](#tscontract).
- `options` — see [ts.ContractOptions](#tscontractoptions). Rarely needed;
  `parseArgsConfig` and `positionalMeta` are computed automatically by
  default.

**Returns**: [ts.ProcessedContract](#tsprocessedcontract) with `pipeline`
(DNA schema, sync, `safeParse`), `cliUnion`, `externals` (`{ parseArgs }`),
`parseArgsConfig`, `positionalMeta`, `flagMap`.

**Throws**:

- If `targets` is empty.
- If any route is missing `cmd: dna.literal(...)`.
- If any route is missing `cli: { routeId: "..." }` in its `.meta()`.
- If `cli: { flag: true }` is set on a field (route-level only).

```typescript
import { dna } from "@ytrynot/dna";
import { createContract } from "@ytrynot/cli";

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [
    dna.object({
      cmd: dna.literal("build"),
      files: dna.array(dna.string()).optional(),
      output: dna.string().optional(),
    }).meta({ cli: { routeId: "build" }, description: "Build the project" }),
  ],
  fallbacks: [
    dna.looseObject({
      cmd: dna.literal("help"),
    }).meta({ cli: { flag: true, short: "h", routeId: "help" }, description: "Show help" }),
  ],
  cli: { positionals: ["cmd", "files"] },
});
```

---

### execute()

```typescript
function execute(processed: ts.ProcessedContract, argv: string[]): ts.ExecuteResult
```

Synchronous convenience wrapper around
`processed.pipeline.safeParse(argv, processed.externals)`. Extracts
`{ route, payload }` from the DNA result.

**Parameters**:

- `processed` — output of `createContract()` (layer 1).
- `argv` — raw argv string array (e.g. `process.argv.slice(2)` or a literal
  array for testing).

**Returns**: [ts.ExecuteResult](#tsexecuteresult) —
`{ success: true, route, payload }` on success,
`{ success: false, errors }` on validation failure.

```typescript
import { execute } from "@ytrynot/cli";

const result = execute(processed, ["build", "a.ts", "--output", "dist/"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"], output: "dist/" } }
```

---

### executeContract()

```typescript
function executeContract(processed: ts.ProcessedContract, handlers: ts.Handlers): ts.ExecutableContract
```

Adds a handler-dispatch transform (layer 2). The transform dispatches by
`\x00ID` (route), calls the matching handler, and returns
`{ success: true, data }` or `{ success: false, error }`.

**Parameters**:

- `processed` — output of `createContract()` (layer 1).
- `handlers` — see [ts.Handlers](#tshandlers). Map of routeId → handler.

**Returns**: [ts.ExecutableContract](#tsexecutablecontract) with `pipeline`
(async transform), `externals` (`{ parseArgs, handlers }`), `handlers`.

**Async**: the transform is async — `safeParseAsync` is required. Sync
`safeParse` throws.

```typescript
import { executeContract } from "@ytrynot/cli";

const executable = executeContract(processed, {
  build: (payload) => ({ success: true, data: `Built ${payload.files.length} files` }),
  help: () => ({ success: true, data: "Usage: mycli <command>" }),
});

const result = await executable.pipeline.safeParseAsync(
  ["build", "a.ts"],
  executable.externals,
);
// → { success: true, data: { success: true, data: "Built 1 files" } }
```

Handlers that return nothing produce
`{ success: false, error: "Handler returned no result" }`.

---

### cliFactory()

```typescript
function cliFactory(executable: ts.ExecutableContract, formatter: ts.FormatterFn): ts.FormattedContract
```

Adds a formatter transform (layer 3). The transform calls the formatter on
the handler result and returns `{ exit: 0|1, message: string }`.

**Parameters**:

- `executable` — output of `executeContract()` (layer 2).
- `formatter` — see [ts.FormatterFn](#tsformatterfn). Receives
  `ts.HandlerResult`, returns `ts.FormattedResult`.

**Returns**: [ts.FormattedContract](#tsformattedcontract) with `pipeline`,
`externals` (`{ parseArgs, handlers, formatter }`), `handlers`, `formatter`.

```typescript
import { cliFactory } from "@ytrynot/cli";
import type { ts } from "@ytrynot/cli";

const formatted = cliFactory(executable, (result) => {
  if (result.success) return { exit: 0, message: String(result.data) };
  return { exit: 1, message: `Error: ${result.error}` };
});

const result = await formatted.pipeline.safeParseAsync(
  ["build", "a.ts"],
  formatted.externals,
);
// → { success: true, data: { exit: 0, message: "Built 1 files" } }
```

---

### fullCli()

```typescript
function fullCli(formatted: ts.FormattedContract): () => Promise<void>
```

Binds a formatted contract to Node.js globals (layer 4). Returns a function
that reads `process.argv.slice(2)`, runs the full pipeline via
`safeParseAsync`, prints the message, and exits.

**Parameters**:

- `formatted` — output of `cliFactory()` (layer 3).

**Returns**: `() => Promise<void>` — the CLI entry point.

**Behavior**:

- Reads `process.argv.slice(2)`.
- Runs `formatted.pipeline.safeParseAsync(argv, formatted.externals)`.
- On validation failure (cliUnion rejection): formats DNA errors, prints to
  `console.error`, calls `process.exit(1)`.
- On success: prints `message` to `console.log` (exit 0) or `console.error`
  (exit 1), calls `process.exit(exit)`.
- Does **not** catch handler throws — they propagate as unhandled rejections.

**Node-only**: `process` and `console` are Node globals, not externals.

```typescript
import { fullCli } from "@ytrynot/cli";

const run = fullCli(formatted);
await run();
```

---

### compile()

```typescript
function compile(processed: ts.ProcessedContract): (argv: string[]) => ts.ExecuteResult
```

Compiles layer 1 into a standalone JS function via `toJS(false, true)` +
`new Function`. The compiled parser captures `processed.externals` at
compile time.

**Parameters**:

- `processed` — output of `createContract()` (layer 1).

**Returns**: `(argv: string[]) => ts.ExecuteResult` — a synchronous parser
function. No DNA runtime required at call time.

**Cached**: results are cached per contract (WeakMap, identity-based).
Subsequent calls with the same `ts.ProcessedContract` reference return the
cached parser.

**Sync only**: layer 1 has no async transforms. Layers 2-4 are not
AOT-compilable (they contain user code provided at runtime).

```typescript
import { compile } from "@ytrynot/cli";

const parser = compile(processed);
const result = parser(["build", "a.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }
```

---

### buildHelp()

```typescript
function buildHelp(processed: ts.ProcessedContract, forCommand?: string): string
```

Builds help text from a processed contract. Generated from `.meta().description`
on routes and fields, and from `cliUnion.toParseArgsConfig().options` for
flag types.

**Parameters**:

- `processed` — output of `createContract()`.
- `forCommand` — if provided, shows only that command's help (used by
  `mycli build --help` → routes to `help` → `buildHelp("build")`).

**Returns**: help text string.

**Hidden routes**: routes with `.meta({ cli: { hidden: "cmd" | "all" } })`
are excluded from the general help "Commands" section. They appear when
explicitly requested via `forCommand`.

```typescript
import { buildHelp } from "@ytrynot/cli";

const helpText = buildHelp(processed);          // General help
const buildHelpText = buildHelp(processed, "build");  // Command-specific
```

---

### printHelp()

```typescript
function printHelp(processed: ts.ProcessedContract, forCommand?: string): void
```

Prints help text to stdout. Convenience wrapper around `buildHelp()` +
`console.log()`.

**Parameters**: same as `buildHelp()`.

```typescript
import { printHelp } from "@ytrynot/cli";

printHelp(processed);          // Prints general help to stdout
printHelp(processed, "build"); // Prints build-specific help
```

---

### formatCliError()

```typescript
function formatCliError(errors: ts.CliError[]): string
```

Formats DNA parser errors into a human-readable string. Each error is
formatted as `"Error: <message> at <path>"` (or just `"Error: <message>"`
if the path is empty). Multiple errors are joined with newlines.

**Parameters**:

- `errors` — array of [ts.CliError](#tsclierror) (`{ message, path, input }`).

**Returns**: formatted error string.

```typescript
import { formatCliError } from "@ytrynot/cli";

const text = formatCliError([{ message: "number is required", path: "#/cli/0/port", input: null }]);
// → "Error: number is required at #/cli/0/port"
```

---

## Types (`ts` namespace)

All public types are exported as a single `ts` namespace. Import with
`import type { ts } from "@ytrynot/cli"` and access as `ts.Contract`,
`ts.Handlers`, `ts.FormatterFn`, etc.

```typescript
import type { ts } from "@ytrynot/cli";

const handlers: ts.Handlers = { /* ... */ };
const formatter: ts.FormatterFn = (result) => { /* ... */ };
```

### ts.Contract

```typescript
type Contract = {
  name: string;
  description: string;
  targets: readonly [DnaObject, ...DnaObject[]];
  fallbacks?: readonly DnaObject[];
  cli?: ts.CliOptions;
};
```

User input to `createContract()`.

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | CLI name (used in help "Usage: <name> ..."). |
| `description` | yes | CLI description (used in help header). |
| `targets` | yes | Primary routes (subcommands). `readonly [DnaObject, ...DnaObject[]]`. |
| `fallbacks` | no | Fallback routes (help, version, etc.). `readonly DnaObject[]`. |
| `cli` | no | See [ts.CliOptions](#tsclioptions). |

---

### ts.ContractOptions

```typescript
type ContractOptions = {
  parseArgsConfig?: ts.ParseArgsConfig;
  positionalMeta?: ts.PositionalMeta[];
};
```

Options for `createContract()`. Rarely needed — `parseArgsConfig` and
`positionalMeta` are computed automatically from the routes and `cli.positionals`.

---

### ts.CliOptions

```typescript
type CliOptions = {
  positionals?: string[];
  strict?: boolean;
  allowNegative?: boolean;
};
```

CLI config, passed via `ts.Contract.cli`.

| Field | Required | Description |
|-------|----------|-------------|
| `positionals` | no | Positional field names in order (e.g. `["cmd", "files"]`). |
| `strict` | no | parseArgs strict mode (default: `false`). |
| `allowNegative` | no | Allow `--no-foo` for boolean flags (default: `false`). |

---

### ts.CliMeta

```typescript
type CliMeta = {
  flag?: boolean;
  short?: string;
  hidden?: "cmd" | "flag" | "all";
  routeId?: string;
};
```

Structure expected in `.meta().cli` on DNA schemas.

- On a **route** (DnaObject): `{ flag: true, short?: string }` declares the
  route as accessible via `--<cmdValue>` (flag interceptor). `short` adds a
  short alias (e.g. `-h` for `--help`).
- On a **field**: `{ short?: string }` adds a short alias for the
  corresponding parseArgs option.
- `flag: true` on a **field** is forbidden (semantically incorrect).

| Field | Level | Description |
|-------|-------|-------------|
| `routeId` | route | **Required**. Internal route identifier, injected as `\x00ID` by `apply`. |
| `flag` | route | Marks the route as accessible via `--<cmdValue>` (flag interceptor). Implies `hidden: "cmd"`. |
| `short` | route | Short alias for the flag interceptor (e.g. `"h"` for `--help`). Only with `flag: true`. |
| `short` | field | Short alias for the parseArgs option (e.g. `"o"` for `--output`). |
| `hidden` | route | Hide from help: `"cmd"` (Commands), `"flag"` (Options), `"all"` (everywhere). Auto `"cmd"` when `flag: true`. |

---

### ts.ProcessedContract

```typescript
type ProcessedContract = {
  name: string;
  description: string;
  pipeline: DnaType<{ route: string; payload: Record<string, unknown> }>;
  cliUnion: DnaCliUnion<readonly DnaSomeType[]>;
  routes: readonly DnaObject[];
  parseArgsConfig: ts.ParseArgsConfig;
  positionalMeta: ts.PositionalMeta[];
  externals: Record<string, unknown>;
  allowNegative?: boolean;
  flagMap: ts.FlagMap;
};
```

Output of `createContract()` (layer 1). The `pipeline` is a sync DNA schema
— use `safeParse` directly or the `execute()` helper.

---

### ts.ExecutableContract

```typescript
type ExecutableContract = {
  name: string;
  description: string;
  pipeline: DnaType<ts.HandlerResult>;
  externals: Record<string, unknown>;
  handlers: ts.Handlers;
};
```

Output of `executeContract()` (layer 2). The `pipeline` is async — use
`safeParseAsync`.

---

### ts.FormattedContract

```typescript
type FormattedContract = {
  name: string;
  description: string;
  pipeline: DnaType<ts.FormattedResult>;
  externals: Record<string, unknown>;
  handlers: ts.Handlers;
  formatter: ts.FormatterFn;
};
```

Output of `cliFactory()` (layer 3). The `pipeline` is async — use
`safeParseAsync`.

---

### ts.Handlers

```typescript
type Handlers = {
  [route: string]: ts.RouteHandler | undefined;
};
```

Map of routeId → handler. Keys are the `routeId` values declared in
`.meta().cli.routeId`. A missing handler for a matched route produces
`{ success: false, error: "No handler for route: <route>" }`.

---

### ts.RouteHandler

```typescript
type RouteHandler = (payload: Record<string, unknown>) => ts.HandlerResult | Promise<ts.HandlerResult>;
```

Handler function for a route. Receives the validated payload (the route's
object fields, with `\x00ID` stripped). Can be sync or async.

---

### ts.FormatterFn

```typescript
type FormatterFn = (result: ts.HandlerResult) => ts.FormattedResult;
```

Formatter function (layer 3). Receives the handler result and returns
`{ exit, message }`. `result.success` narrows correctly to the `data`
branch — use `if (result.success)` to access `result.data`.

---

### ts.ExecuteResult

```typescript
type ExecuteResult =
  | { success: true; route: string; payload: Record<string, unknown> }
  | { success: false; errors: ts.CliError[] };
```

Return type of `execute()` and the compiled parser from `compile()`.

---

### ts.HandlerResult

```typescript
type HandlerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
```

What handlers return. See [Handler result contract](#handler-result-contract).

---

### ts.FormattedResult

```typescript
type FormattedResult = {
  exit: number;
  message: string;
};
```

Output of the formatter (layer 3). `exit: 0` → `console.log(message)`.
`exit: 1` → `console.error(message)`.

---

### ts.ParseArgsConfig

```typescript
type ParseArgsConfig = {
  allowPositionals: true;
  strict: boolean;
  allowNegative?: boolean;
  options: Record<string, { type: "string" | "boolean"; multiple: boolean; short?: string }>;
};
```

The config passed to `node:util.parseArgs`. Built automatically by
`createContract()` from the routes and `.meta().cli`.

---

### ts.PositionalMeta

```typescript
type PositionalMeta = {
  name: string;
  variadic: boolean;
};
```

Metadata for each positional field. `variadic: true` means the positional
collects all remaining positionals as an array.

---

### ts.FlagMap

```typescript
type FlagMap = Record<string, string>;
```

Flag → subcommand mapping (e.g. `{ help: "help", version: "version" }`).
Keys are parseArgs option names (not `--help`, but `help`). Values are
subcommand names routed to after parseArgs. Built automatically by
`createContract()` from `.meta().cli.flag` on routes.

---

### ts.CliError

```typescript
type CliError = {
  message: string;
  path: string;
  input: unknown;
};
```

A DNA parser error, passed through to `ts.ExecuteResult.errors` and
`formatCliError()`.

---

## Handler result contract

Handlers (layer 2) must return `ts.HandlerResult`:

```typescript
type HandlerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };
```

- **`{ success: true, data }`** — handler succeeded, `data` is passed to the
  formatter.
- **`{ success: false, error }`** — handler failed, `error` is passed to the
  formatter.
- **`undefined`** (returns nothing) — produces
  `{ success: false, error: "Handler returned no result" }`.

---

## Handler throw behavior

If a handler `throw`s, it's a bug in the handler — `fullCli()` does **not**
catch it. The throw propagates via `safeParseAsync` → unhandled rejection.
`process.exit` is never called.

Handlers must catch their own errors and return
`{ success: false, error: "..." }` to pass errors through the formatter
cleanly.

---

## Route metadata

Routes declare CLI metadata via `.meta({ cli: { ... } })`:

```typescript
dna.object({ cmd: dna.literal("help"), ... })
  .meta({
    cli: {
      routeId: "help",        // Required — injected as \x00ID
      flag: true,             // Route accessible via --<cmdValue> flag (implies hidden: "cmd")
      short: "h",             // Short alias (-h for --help)
    },
    description: "Show help",  // Help text
  });
```

See [ICliMeta](#iclimeta) for the full field reference.
