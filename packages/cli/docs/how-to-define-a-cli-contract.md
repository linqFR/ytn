# How To: Define a CLI Contract

> Practical guide — for each CLI shape you want, the exact DNA schema to write.
> Covers subcommands, flags, positionals (required/optional/variadic), `--help`,
> `--version`, short aliases, hidden routes, coercion, and AOT compilation.
>
> See also: [README](../README.md) (Quick Start) ·
> [API Reference](./api-reference.md) (signatures) ·
> [Architecture](./architecture.md) (design rationale).

## Table of Contents

- [Mental model](#mental-model)
- [The 3 building blocks](#the-3-building-blocks)
- [Recipe 1 — Single subcommand](#recipe-1--single-subcommand)
- [Recipe 2 — Multiple subcommands](#recipe-2--multiple-subcommands)
- [Recipe 3 — Subcommand + positional variadic (`build a.ts b.ts`)](#recipe-3--subcommand--positional-variadic-build-ats-bts)
- [Recipe 4 — Subcommand + flag `multiple` (`--files a --files b`)](#recipe-4--subcommand--flag-multiple---files-a---files-b)
- [Recipe 5 — Add `--help` / `-h` and `--version` / `-v`](#recipe-5--add---help---h-and---version---v)
- [Recipe 6 — Short aliases on fields (`-o` for `--output`)](#recipe-6--short-aliases-on-fields--o-for---output)
- [Recipe 7 — Boolean flags (`--watch`, `--dry-run`)](#recipe-7--boolean-flags---watch---dry-run)
- [Recipe 8 — Coercion (`--port 3000` → number)](#recipe-8--coercion---port-3000--number)
- [Recipe 9 — Hidden routes](#recipe-9--hidden-routes)
- [Recipe 10 — Loose routes with catchall](#recipe-10--loose-routes-with-catchall)
- [Recipe 11 — Full CLI with handlers + formatter + `process.exit`](#recipe-11--full-cli-with-handlers--formatter--processexit)
- [Recipe 12 — AOT compilation (standalone parser)](#recipe-12--aot-compilation-standalone-parser)
- [Reference — `ts.CliMeta` fields](#reference---tsclimeta-fields)
- [Reference — `ts.Contract` fields](#reference---tscontract-fields)
- [Decision table — positional vs flag](#decision-table--positional-vs-flag)
- [Common pitfalls](#common-pitfalls)

---

## Mental model

A CLI contract is a set of **routes** (DNA objects). Each route is one possible
subcommand. `@ytrynot/cli` uses `dna.cliUnion` to route `process.argv` to the
matching route using a Maranget decision tree on the `cmd` discriminator.

```
process.argv
  → util.parseArgs (config derived from the routes)
  → cliUnion routing (Maranget on `cmd`)
  → extract { route, payload }
  → handler dispatch (layer 2)
  → formatter (layer 3)
  → console + process.exit (layer 4)
```

Every route MUST:

1. Have a `cmd: dna.literal("<name>")` field — this is the discriminator.
2. Declare `.meta({ cli: { routeId: "<name>" } })` — this is the internal
   route identifier (injected as `\x00ID`, stripped from the public payload).
3. Optionally declare `.meta({ description: "..." })` for help text.

---

## The 3 building blocks

### Block 1 — Route (DNA object)

```ts
dna.object({
  cmd: dna.literal("build"),           // required — discriminator
  files: dna.array(dna.string())       // optional fields
    .optional()
    .meta({ description: "Files to build" }),
}).meta({
  cli: { routeId: "build" },           // required — internal id
  description: "Build the project",    // optional — help text
});
```

### Block 2 — Contract (`ts.Contract`)

```ts
const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, deployRoute],          // required, ≥1
  fallbacks: [helpRoute, versionRoute],        // optional
  cli: { positionals: ["cmd", "files"] },      // optional
});
```

### Block 3 — Run (layer 1 → 4)

```ts
// Layer 1 — sync, 1 external (parseArgs)
const result = execute(processed, ["build", "a.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }

// Layer 2-4 — async, with handlers + formatter + process.exit
const run = fullCli(cliFactory(executeContract(processed, handlers), formatter));
await run();  // reads process.argv.slice(2)
```

---

## Recipe 1 — Single subcommand

**CLI shape**: `mycli build`

```ts
import { dna } from "@ytrynot/dna";
import { createContract, execute } from "@ytrynot/cli";

const buildRoute = dna.object({
  cmd: dna.literal("build"),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
});

const result = execute(processed, ["build"]);
// → { success: true, route: "build", payload: { cmd: "build" } }
```

**Notes**:
- `cmd` is auto-detected as a positional (required, non-boolean, discriminator).
- No `cli.positionals` needed — auto-detect handles it.
- No `fallbacks` — unknown commands return a DNA error.

---

## Recipe 2 — Multiple subcommands

**CLI shape**: `mycli build` | `mycli deploy`

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const deployRoute = dna.object({
  cmd: dna.literal("deploy"),
  target: dna.string().optional().meta({ description: "Deployment target" }),
}).meta({ cli: { routeId: "deploy" }, description: "Deploy the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, deployRoute],
});

execute(processed, ["build"]);     // → { success: true, route: "build", ... }
execute(processed, ["deploy"]);    // → { success: true, route: "deploy", ... }
execute(processed, ["unknown"]);   // → { success: false, errors: [...] }
```

**Notes**:
- `cmd` is the discriminator — `cliUnion` builds a Maranget tree on it.
- Each route can have different fields. Fields not in the matched route are
  ignored for that route.

---

## Recipe 3 — Subcommand + positional variadic (`build a.ts b.ts`)

**CLI shape**: `mycli build a.ts b.ts c.ts`

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional()
    .meta({ description: "Files to build" }),
  output: dna.string().optional()
    .meta({ description: "Output directory" }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  cli: { positionals: ["cmd", "files"] },   // ← declare files as positional
});

const result = execute(processed, ["build", "a.ts", "b.ts", "c.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts","b.ts","c.ts"] } }
```

**Why `cli.positionals` is required here**:
- `files` is `.optional()` → DNA's `detectPositionals` skips optional fields
  (a positional is "required by nature" in POSIX).
- Without `cli.positionals`, `files` would be treated as a **flag** and
  `build a.ts b.ts c.ts` would not populate `files`.
- `cli.positionals: ["cmd", "files"]` tells `cliUnion` that `files` is a
  positional, not a flag. parseArgs collects all positionals in order; the
  CLI layer maps `positionals[0]` → `cmd`, `positionals.slice(1)` → `files`.

**What happens at runtime** (verified on Node ≥25):

When the user types `mycli build a.ts b.ts c.ts`, Node's `parseArgs`
splits the argv into two buckets:
- **Flags** (`--name value`): collected into `values`. Here, none.
- **Positionals** (bare words, no `--` prefix): collected into
  `positionals` in order. Here: `['build', 'a.ts', 'b.ts', 'c.ts']`.

The CLI layer then maps the positionals to the declared fields:
`positionals[0]` → `cmd` (the subcommand), `positionals[1:]` → `files`
(the variadic array). So `payload.files` ends up as
`['a.ts', 'b.ts', 'c.ts']`.

If the user types just `mycli build` (no files), `positionals` is
`['build']` only. There's nothing after `build`, so `files` is
`[]` (an empty array — the variadic positional collects 0 elements,
and the `.optional()` field accepts the empty array).

**Mixing positionals and flags**: when the user types
`mycli build a.ts b.ts --output dist`, parseArgs stops collecting
positionals as soon as it hits `--output`. So `positionals` is
`['build', 'a.ts', 'b.ts']` and `values.output` is `'dist'`. The
CLI layer maps `positionals[1:]` → `files` (`['a.ts', 'b.ts']`) and
`values.output` → `output` (`'dist'`). This is why a variadic
positional only collects bare words up to the next flag — it does
not "eat" flag values.

**Variadic = optional by nature**: `[file2 ...]` in POSIX notation means
0 or more. Use `.optional()` on the `dna.array(...)` field. If you want
≥1 file, validate in the handler.

---

## Recipe 4 — Subcommand + flag `multiple` (`--files a --files b`)

**CLI shape**: `mycli build --files a.ts --files b.ts`

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string())               // ← NO .optional() if required,
    .meta({ description: "Files to build" }),   //   or .optional() if optional
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  // NO cli.positionals — files is a flag, not a positional
});

const result = execute(processed, ["build", "--files", "a.ts", "--files", "b.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts","b.ts"] } }
```

**parseArgs behavior** (verified on Node ≥25):
- `--files a.ts b.ts` → `values.files = ['a.ts']`, `positionals = ['b.ts']`
  (parseArgs does **not** do greedy consumption — each flag occurrence
  consumes exactly one value).
- `--files a.ts --files b.ts` → `values.files = ['a.ts','b.ts']`
- `--files=a.ts --files=b.ts` → same as above

**When to use this vs positional variadic**:
- Positional variadic (`build a b c`) is the POSIX standard for file lists.
- Flag `multiple` (`--files a --files b`) is useful when you want the flag
  name to be explicit, or when mixing multiple list flags.

See [Decision table — positional vs flag](#decision-table--positional-vs-flag).

---

## Recipe 5 — Add `--help` / `-h` and `--version` / `-v`

**CLI shape**: `mycli --help` | `mycli -h` | `mycli --version` | `mycli -v`

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const helpRoute = dna.looseObject({
  cmd: dna.literal("help"),
}).catchall(dna.unknown()).meta({
  cli: { flag: true, short: "h", routeId: "help" },
  description: "Show help",
});

const versionRoute = dna.looseObject({
  cmd: dna.literal("version"),
}).catchall(dna.unknown()).meta({
  cli: { flag: true, short: "v", routeId: "version" },
  description: "Show version",
});

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  fallbacks: [helpRoute, versionRoute],   // ← help/version are fallbacks
});

execute(processed, ["--help"]);     // → { success: true, route: "help", ... }
execute(processed, ["-h"]);         // → { success: true, route: "help", ... }
execute(processed, ["--version"]);  // → { success: true, route: "version", ... }
execute(processed, ["-v"]);         // → { success: true, route: "version", ... }
```

**Key points**:
- `cli: { flag: true }` marks the route as a **flag interceptor** — accessible
  via `--<cmdValue>` (here `--help`, `--version`).
- `cli: { short: "h" }` adds the short alias `-h`.
- `flag: true` implies `hidden: "cmd"` — the route is hidden from the
  "Commands" section of help (it appears as `--help` in "Options", not as
  `mycli help`).
- Help/version routes go in `fallbacks`, not `targets` — they're not
  subcommands you run positionally.
- `dna.looseObject(...).catchall(dna.unknown())` allows any extra args
  after `--help` (e.g. `--help build` to get help for `build`).

**How flag routing works internally**:
1. `parseArgs` sees `--help` as a boolean flag → `values.help = true`.
2. The CLI preprocessor checks `flagMap` (`{ help: "help", version: "version" }`)
   and prepends `"help"` to `positionals` → `positionals = ["help"]`.
3. `cliUnion` routes on `cmd` → matches the `help` route.

---

## Recipe 6 — Short aliases on fields (`-o` for `--output`)

**CLI shape**: `mycli build --output dist/` | `mycli build -o dist/`

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  output: dna.string().optional()
    .meta({
      cli: { short: "o" },                   // ← short alias on the field
      description: "Output directory",
    }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
});

execute(processed, ["build", "--output", "dist/"]);  // → payload.output = "dist/"
execute(processed, ["build", "-o", "dist/"]);        // → payload.output = "dist/"
```

**Key points**:
- `cli: { short: "o" }` on a **field** adds the short alias for the
  corresponding parseArgs option.
- `cli: { short: "h" }` on a **route** (with `flag: true`) adds the short
  alias for the flag interceptor (see Recipe 5).
- `cli: { flag: true }` on a **field** is **forbidden** — it's semantically
  incorrect (flags are route-level interceptors, not field-level options).

---

## Recipe 7 — Boolean flags (`--watch`, `--dry-run`)

**CLI shape**: `mycli build --watch` | `mycli deploy --dryRun`

> **Note**: parseArgs does **not** convert kebab-case to camelCase. The
> DNA field name is the parseArgs option name as-is. `dryRun` → `--dryRun`,
> not `--dry-run`. Use single-word names (`watch`, `verbose`) or accept
> `--dryRun` syntax.

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  watch: dna.boolean().optional()
    .meta({ description: "Watch for changes" }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const deployRoute = dna.object({
  cmd: dna.literal("deploy"),
  dryRun: dna.boolean().optional()
    .meta({ description: "Dry run — don't actually deploy" }),
}).meta({ cli: { routeId: "deploy" }, description: "Deploy the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, deployRoute],
});

execute(processed, ["build", "--watch"]);         // → payload.watch = true
execute(processed, ["build"]);                    // → payload.watch = undefined
execute(processed, ["deploy", "--dryRun"]);       // → payload.dryRun = true
```

**Key points**:
- `dna.boolean()` fields become parseArgs options with `type: "boolean"`.
- Boolean flags don't take a value — `--watch` sets `values.watch = true`,
  absence means `undefined` (with `.optional()`).
- DNA's `detectPositionals` skips boolean keys → they're always flags.
- The option name is the **exact field key** — no kebab-case conversion.
  `dryRun` → `--dryRun`, not `--dry-run`.

---

## Recipe 8 — Coercion (`--port 3000` → number)

**CLI shape**: `mycli deploy --port 3000`

```ts
const deployRoute = dna.object({
  cmd: dna.literal("deploy"),
  port: dna.coerce.number().optional()
    .meta({ description: "Port number" }),
}).meta({ cli: { routeId: "deploy" }, description: "Deploy the project" });

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [deployRoute],
});

execute(processed, ["deploy", "--port", "3000"]);
// → { success: true, route: "deploy", payload: { cmd: "deploy", port: 3000 } }

execute(processed, ["deploy", "--port", "abc"]);
// → { success: false, errors: [...] }  ← coercion fails, DNA rejects
```

**Key points**:
- `dna.coerce.number()` converts the string from parseArgs to a number
  during validation.
- If the string is not coercible (`"abc"`), DNA rejects with a validation
  error.
- Use `dna.coerce.string()`, `dna.coerce.number()`, `dna.coerce.boolean()`,
  `dna.coerce.bigint()`, `dna.coerce.date()` for type coercion from string
  argv.

---

## Recipe 9 — Hidden routes

**CLI shape**: `mycli build` (but `mycli internal-cmd` exists but is hidden from help)

```ts
const buildRoute = dna.object({
  cmd: dna.literal("build"),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const internalRoute = dna.object({
  cmd: dna.literal("internal-cmd"),
}).meta({
  cli: { routeId: "internal-cmd", hidden: "all" },   // ← hide from all help
  description: "Internal command",
});

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, internalRoute],
});

execute(processed, ["internal-cmd"]);  // → works, but hidden from help
buildHelp(processed);                   // → doesn't list "internal-cmd"
buildHelp(processed, "internal-cmd");   // → shows help for internal-cmd explicitly
```

**`hidden` values**:
- `"cmd"` — hide from "Commands" section (still appears as `--flag` if it's
  a flag interceptor). Automatically set when `flag: true`.
- `"flag"` — hide from "Options" section (still appears in "Commands" if
  it's a positional command).
- `"all"` — hide from all help sections.

---

## Recipe 10 — Loose routes with catchall

**CLI shape**: `mycli help build` | `mycli help anything-here`

```ts
const helpRoute = dna.looseObject({
  cmd: dna.literal("help"),
  topic: dna.string().optional(),
}).catchall(dna.unknown()).meta({
  cli: { flag: true, short: "h", routeId: "help" },
  description: "Show help",
});

const processed = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [/* ... */],
  fallbacks: [helpRoute],
  cli: { positionals: ["cmd", "topic"] },   // ← topic is an optional positional
});

execute(processed, ["--help", "build"]);
// → { success: true, route: "help", payload: { cmd: "help", topic: "build", ... } }
```

**Key points**:
- `dna.looseObject(...)` allows unknown keys (unlike `dna.object()` which
  strips them).
- `.catchall(dna.unknown())` accepts any extra args as `unknown` values.
- Useful for `help`/`version` routes that accept arbitrary trailing args
  (`--help build`, `--help deploy`, etc.).
- Regular subcommands (`build`, `deploy`) should use `dna.object()` —
  strict, unknown keys are stripped.

---

## Recipe 11 — Full CLI with handlers + formatter + `process.exit`

**CLI shape**: `mycli build a.ts` → prints "Built 1 files" → `exit(0)`

```ts
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

**Handler contract**:
- Handlers return `{ success: true, data: unknown }` or
  `{ success: false, error: string }`.
- Returning nothing → `{ success: false, error: "Handler returned no result" }`.
- If a handler `throw`s, it's a bug in the handler — `fullCli` does **not**
  catch it. The throw propagates as an unhandled rejection. Handlers must
  catch their own errors and return `{ success: false, error: "..." }`.
- Handlers can be **async**: `(payload) => Promise<ts.HandlerResult>`.
  `fullCli` uses `safeParseAsync` and awaits the result before
  `process.exit`.

**Formatter contract**:
- Receives `ts.HandlerResult` (`{ success: true, data }` or
  `{ success: false, error }`).
- `if (result.success)` narrows correctly to the `data` branch.
- Returns `ts.FormattedResult` (`{ exit: 0 | 1, message: string }`).
- `exit: 0` → `console.log(message)`. `exit: 1` → `console.error(message)`.

---

## Recipe 12 — AOT compilation (standalone parser)

**CLI shape**: compile layer 1 into a standalone JS function (no DNA runtime).

```ts
import { createContract, compile } from "@ytrynot/cli";

const processed = createContract({ /* ... */ });

// Compile — produces a standalone parser function
const parser = compile(processed);

// Use it — no DNA runtime needed, only the `parseArgs` external
const result = parser(["build", "a.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }
```

**Key points**:
- `compile()` uses `toJS(false, true)` + `new Function` to generate a
  standalone JS function from the DNA bytecode.
- Only **layer 1** (routing + validation) is AOT-compilable. Layers 2-4
  (handlers, formatter, `process.exit`) are user code provided at runtime.
- 1 external: `parseArgs` (captured at compile time from
  `processed.externals`).
- The compiled parser is **synchronous** (layer 1 has no async transforms).
- Results are cached per contract (WeakMap, identity-based).

**What AOT gives you**:
- No DNA runtime dependency at runtime — just the generated JS function.
- Faster cold start (no bytecode interpretation).
- Embeddable in a single `.mjs` file.

---

## Reference — `ts.CliMeta` fields

`.meta({ cli: { ... } })` on a DNA schema:

| Field | Level | Description |
|-------|-------|-------------|
| `routeId` | route | **Required**. Internal route identifier, injected as `\x00ID` by `apply`. |
| `flag` | route | Marks the route as accessible via `--<cmdValue>` (flag interceptor). Implies `hidden: "cmd"`. |
| `short` | route | Short alias for the flag interceptor (e.g. `"h"` for `--help`). Only with `flag: true`. |
| `short` | field | Short alias for the parseArgs option (e.g. `"o"` for `--output`). |
| `hidden` | route | Hide from help: `"cmd"` (Commands), `"flag"` (Options), `"all"` (everywhere). Auto `"cmd"` when `flag: true`. |

**Forbidden**: `flag: true` on a **field** (semantically incorrect — flags
are route-level interceptors).

---

## Reference — `ts.Contract` fields

`createContract({ ... })`:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | CLI name (used in help "Usage: <name> ..."). |
| `description` | yes | CLI description (used in help header). |
| `targets` | yes | Primary routes (subcommands). `readonly [DnaObject, ...DnaObject[]]`. |
| `fallbacks` | no | Fallback routes (help, version, etc.). `readonly DnaObject[]`. |
| `cli.positionals` | no | Positional field names in order (e.g. `["cmd", "files"]`). |
| `cli.strict` | no | parseArgs strict mode (default: `false`). |
| `cli.allowNegative` | no | Allow `--no-foo` for boolean flags (default: `false`). |

---

## Decision table — positional vs flag

| You want... | CLI shape | Schema | `cli.positionals` |
|-------------|-----------|--------|-------------------|
| Subcommand only | `mycli build` | `cmd: dna.literal("build")` | not needed (auto) |
| Subcommand + required arg | `mycli build <project>` | `project: dna.string()` (required) | `["cmd", "project"]` (auto-detect may work) |
| Subcommand + optional arg | `mycli build [project]` | `project: dna.string().optional()` | `["cmd", "project"]` **required** |
| Subcommand + variadic files | `mycli build a.ts b.ts` | `files: dna.array(dna.string()).optional()` | `["cmd", "files"]` **required** |
| Subcommand + flag list | `mycli build --files a --files b` | `files: dna.array(dna.string())` | **not** in `cli.positionals` |
| Boolean flag | `mycli build --watch` | `watch: dna.boolean().optional()` | not needed (auto) |
| String flag | `mycli build --output dist/` | `output: dna.string().optional()` | not needed (auto) |
| Short alias | `mycli build -o dist/` | field `.meta({ cli: { short: "o" } })` | — |
| `--help` / `-h` | `mycli --help` | route with `cli: { flag: true, short: "h" }` in `fallbacks` | — |
| `--version` / `-v` | `mycli --version` | route with `cli: { flag: true, short: "v" }` in `fallbacks` | — |

**Rule of thumb**:
- If the value comes **after the subcommand as a bare word**
  (`build a.ts`), it's a **positional** → declare in `cli.positionals`.
- If the value comes **with a `--name` prefix** (`build --output dist/`),
  it's a **flag** → don't declare in `cli.positionals`.

---

## Common pitfalls

### 1. Optional positional not declared in `cli.positionals`

```ts
// ❌ Wrong — files will be treated as a flag
const route = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional(),
}).meta({ cli: { routeId: "build" } });

createContract({ name: "mycli", description: "...", targets: [route] });
execute(processed, ["build", "a.ts"]);  // → files is undefined, a.ts is a positional
```

```ts
// ✅ Correct — declare files as positional
createContract({
  name: "mycli", description: "...", targets: [route],
  cli: { positionals: ["cmd", "files"] },
});
execute(processed, ["build", "a.ts"]);  // → payload.files = ["a.ts"]
```

**Why**: DNA's `detectPositionals` skips optional fields (POSIX positionals
are "required by nature"). You must explicitly declare optional positionals
in `cli.positionals`.

### 2. Missing `routeId` in `.meta().cli`

```ts
// ❌ Wrong — createContract throws
const route = dna.object({ cmd: dna.literal("build") })
  .meta({ description: "Build" });  // no cli.routeId

// ✅ Correct
const route = dna.object({ cmd: dna.literal("build") })
  .meta({ cli: { routeId: "build" }, description: "Build" });
```

**Why**: `routeId` is the internal route identifier, injected as `\x00ID`
by `apply`. Without it, `createContract` cannot build the routing.

### 3. `flag: true` on a field

```ts
// ❌ Wrong — createContract throws
const route = dna.object({
  cmd: dna.literal("build"),
  output: dna.string().optional().meta({ cli: { flag: true } }),  // forbidden
}).meta({ cli: { routeId: "build" } });
```

**Why**: `flag: true` means "this route is accessible via `--<cmdValue>`"
— it's a route-level concept, not a field-level one.

### 4. Help/version in `targets` instead of `fallbacks`

```ts
// ❌ Works but help/version appear as subcommands (mycli help, mycli version)
createContract({
  name: "mycli", description: "...",
  targets: [buildRoute, helpRoute, versionRoute],
});

// ✅ Correct — help/version are fallbacks, accessed via --help/--version
createContract({
  name: "mycli", description: "...",
  targets: [buildRoute],
  fallbacks: [helpRoute, versionRoute],
});
```

**Why**: `targets` are primary subcommands (routed positionally).
`fallbacks` are secondary routes (routed via flags or as a last resort).
Help/version are flag interceptors (`flag: true`), not subcommands.

### 5. Handler that `throw`s instead of returning `{ success: false, error }`

```ts
// ❌ Wrong — fullCli does not catch, unhandled rejection
const handlers = {
  build: (payload) => {
    throw new Error("Build failed");  // ← bug
  },
};

// ✅ Correct — return { success: false, error }
const handlers = {
  build: (payload) => {
    try { /* ... */ }
    catch (e) { return { success: false, error: String((e as Error).message) }; }
    return { success: true, data: "built" };
  },
};
```

**Why**: `fullCli` uses `safeParseAsync` which propagates throws as
rejections. `process.exit` is never called → unhandled rejection. The
formatter (layer 3) only sees `{ success: false, error }` returns, not
throws.

### 6. Using `dna.object()` for a route that accepts extra args

```ts
// ❌ Wrong — unknown keys are stripped, --help build loses "build"
const helpRoute = dna.object({
  cmd: dna.literal("help"),
}).meta({ cli: { flag: true, short: "h", routeId: "help" } });

// ✅ Correct — looseObject + catchall accepts extra args
const helpRoute = dna.looseObject({
  cmd: dna.literal("help"),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "h", routeId: "help" } });
```

**Why**: `dna.object()` strips unknown keys. `dna.looseObject()` with
`.catchall(dna.unknown())` preserves them. Help/version routes that
accept trailing args (`--help build`) need loose objects.

### 7. Kebab-case flag names (`--dry-run` vs `--dryRun`)

```ts
// ❌ --dry-run does NOT work — parseArgs doesn't convert kebab-case
const route = dna.object({
  cmd: dna.literal("deploy"),
  dryRun: dna.boolean().optional(),
}).meta({ cli: { routeId: "deploy" } });

execute(processed, ["deploy", "--dry-run"]);  // → dryRun is undefined

// ✅ --dryRun works (exact field key match)
execute(processed, ["deploy", "--dryRun"]);   // → dryRun = true
```

**Why**: parseArgs uses the option name as-is — no kebab-case to
camelCase conversion. The DNA field key `dryRun` becomes the parseArgs
option `dryRun`, so the user must type `--dryRun`. Use single-word
names (`watch`, `verbose`) when possible, or accept `--dryRun` syntax.

### 8. Optional positional in a fallback route not declared in `cli.positionals`

```ts
// ❌ Wrong — topic is optional, not auto-detected as positional
const helpRoute = dna.looseObject({
  cmd: dna.literal("help"),
  topic: dna.string().optional(),
}).catchall(dna.unknown()).meta({ cli: { flag: true, short: "h", routeId: "help" } });

createContract({
  name: "mycli", description: "...",
  targets: [buildRoute],
  fallbacks: [helpRoute],
  // no cli.positionals → topic is a flag, not a positional
});
execute(processed, ["--help", "build"]);  // → topic is undefined

// ✅ Correct — declare topic as positional
createContract({
  name: "mycli", description: "...",
  targets: [buildRoute],
  fallbacks: [helpRoute],
  cli: { positionals: ["cmd", "topic"] },
});
execute(processed, ["--help", "build"]);  // → topic = "build"
```

**Why**: Same as Pitfall 1 — `detectPositionals` skips optional fields.
This applies to fallback routes too, not just targets.
