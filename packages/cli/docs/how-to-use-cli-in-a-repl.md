# How To: Use CLI Routing in a REPL

> Practical guide — how to build a REPL (Read-Eval-Print Loop) that routes JSON
> commands through `dna.cliUnion` with Maranget decision tree, the same routing
> engine used by `@ytrynot/cli`.
>
> This does **not** require `@ytrynot/cli` — only `@ytrynot/dna`. The REPL
> bypasses `parseArgs` and `process.exit` and talks directly to the routing
> and validation core.
>
> See also: [README](../README.md) (Quick Start) ·
> [How To: Define a CLI Contract](./how-to-define-a-cli-contract.md) (argv mode) ·
> [Architecture](./architecture.md) (5-layer design).

## Table of Contents

- [What is a REPL mode?](#what-is-a-repl-mode)
- [When to use REPL vs CLI](#when-to-use-repl-vs-cli)
- [The 3 pieces](#the-3-pieces)
- [Step 1 — Define routes with `dna.cliUnion`](#step-1--define-routes-with-dnacliunion)
- [Step 2 — Define handlers](#step-2--define-handlers)
- [Step 3 — Wire the readline loop](#step-3--wire-the-readline-loop)
- [Full example](#full-example)
- [How to run it](#how-to-run-it)
- [Interactive mode (human)](#interactive-mode-human)
- [Pipe mode (one-shot or scripted)](#pipe-mode-one-shot-or-scripted)
- [Agent mode (programmatic stdin)](#agent-mode-programmatic-stdin)
- [Adding persistence](#adding-persistence)
- [Adding concurrent requests with IDs](#adding-concurrent-requests-with-ids)
- [Differences from `@ytrynot/cli`](#differences-from-ytrynotcli)
- [Common pitfalls](#common-pitfalls)

---

## What is a REPL mode?

A REPL (Read-Eval-Print Loop) is a process that stays alive and accepts
commands one at a time via stdin, writing responses to stdout. Unlike the
normal CLI mode (which reads `process.argv` once and exits), a REPL:

- reads **newline-delimited JSON** from stdin (one command per line),
- routes and validates each command through `dna.cliUnion`,
- dispatches to a handler,
- writes a JSON response to stdout,
- **does not call `process.exit()`** — it loops back and waits for the next line.

```
Normal CLI (argv mode):
  process.argv → parseArgs → route → handler → format → exit

REPL (stdin mode):
  stdin line → JSON.parse → route → handler → stdout → loop
```

## When to use REPL vs CLI

| Use case | Mode | Why |
|---|---|---|
| Human typing in a shell | CLI (argv) | Shell completion, help, familiar |
| Shell script / pipe one-shot | CLI (argv) | Composable, isolated |
| Multiple sequential commands, same process | REPL | Avoid repeated startup, keep state |
| Programmatic agent with stream control | REPL | Send N commands without restarting |
| Fire-and-forget background task | CLI + `--background` | Simpler, no daemon needed |

**Important:** most AI agent terminals (Devin, Cursor, Windsurf) are one-shot
— they launch a process, wait for it to exit, read stdout. They cannot keep a
REPL process open. For these agents, the normal CLI mode is the right choice.
REPL mode is useful when you have a consumer that can keep a stdin stream open
(a human, a custom agent harness, a long-running service).

## The 3 pieces

A REPL on top of `dna.cliUnion` needs only three things:

1. **Routes** — a `dna.cliUnion([...])` schema (same as CLI mode).
2. **Handlers** — a `Record<string, (payload) => result>` map.
3. **A readline loop** — `node:readline` on `process.stdin`.

No `@ytrynot/cli` import. No `parseArgs`. No `createContract`. No `fullCli`.
The routing engine (`cliUnion` + Maranget) and the validator (`safeParse`) are
in `@ytrynot/dna` directly.

## Step 1 — Define routes with `dna.cliUnion`

This is identical to defining routes for `@ytrynot/cli` — same DNA schema,
same `cmd` discriminator, same `dna.literal` / `dna.enum` patterns:

```typescript
import { dna } from "@ytrynot/dna";

const routes = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.enum(["dev", "prod"]),
    output: dna.string().optional(),
  }),
  dna.object({
    cmd: dna.literal("deploy"),
    target: dna.enum(["staging", "prod"]),
    dryRun: dna.literal(true).optional(),
  }),
]);
```

`routes.safeParse(input)` does two things in one call:
- **routes** via the Maranget decision tree on `cmd` (and any other
  discriminators),
- **validates** the payload against the matched branch.

If routing fails (no branch matches) or validation fails (wrong types,
missing fields), `safeParse` returns `{ success: false, errors: [...] }`.

## Step 2 — Define handlers

Handlers are a plain object map — the same shape as `@ytrynot/cli` layer 2:

```typescript
type IHandlerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

const handlers: Record<string, (payload: Record<string, unknown>) => IHandlerResult> = {
  build: (p) => ({
    success: true,
    data: { built: true, mode: p.mode, output: p.output ?? "./dist" },
  }),
  deploy: (p) => ({
    success: true,
    data: { deployed: !p.dryRun, target: p.target },
  }),
};
```

Each handler receives the validated payload (the routed + parsed object) and
returns a result. Handlers can be sync or async — if async, use
`safeParseAsync` and `await` the handler call (see [Full example](#full-example)
for the sync version; adapt with `await` for async).

## Step 3 — Wire the readline loop

```typescript
import * as readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false, // raw stream mode (pipe/agent); use true for interactive human
});

const send = (obj: unknown) => console.log(JSON.stringify(obj));

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  // 1. Parse JSON (replaces parseArgs — no argv tokenization in REPL mode)
  let input: unknown;
  try {
    input = JSON.parse(trimmed);
  } catch {
    send({ success: false, error: `Invalid JSON: ${trimmed}` });
    return;
  }

  // 2. Route + validate via cliUnion (Maranget routing is inside DNA)
  const result = routes.safeParse(input);
  if (!result.success) {
    send({ success: false, error: "Validation failed", issues: result.errors });
    return;
  }

  // 3. Dispatch to handler
  const payload = result.data as Record<string, unknown>;
  const cmd = payload.cmd as string;
  const handler = handlers[cmd];
  if (!handler) {
    send({ success: false, error: `No handler for route: ${cmd}` });
    return;
  }

  // 4. Send response
  send(handler(payload));
});

rl.on("close", () => {
  send({ type: "bye" });
  // No process.exit — EOF ends the process naturally.
});
```

## Full example

Here is the complete runnable file:

```typescript
import * as readline from "node:readline";
import { dna } from "@ytrynot/dna";

// 1. Define routes (same as @ytrynot/cli)
const routes = dna.cliUnion([
  dna.object({
    cmd: dna.literal("build"),
    mode: dna.enum(["dev", "prod"]),
    output: dna.string().optional(),
  }),
  dna.object({
    cmd: dna.literal("deploy"),
    target: dna.enum(["staging", "prod"]),
    dryRun: dna.literal(true).optional(),
  }),
]);

// 2. Define handlers
type IHandlerResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

const handlers: Record<string, (p: Record<string, unknown>) => IHandlerResult> = {
  build: (p) => ({
    success: true,
    data: { built: true, mode: p.mode, output: p.output ?? "./dist", files: 42 },
  }),
  deploy: (p) => ({
    success: true,
    data: { deployed: !p.dryRun, target: p.target, url: p.dryRun ? null : `https://app-${p.target}.ytn.dev` },
  }),
};

// 3. Wire the readline loop
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const send = (obj: unknown) => console.log(JSON.stringify(obj));

send({ type: "ready", routes: ["build", "deploy"] });

rl.on("line", (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let input: unknown;
  try {
    input = JSON.parse(trimmed);
  } catch {
    send({ success: false, error: `Invalid JSON: ${trimmed}` });
    return;
  }

  const result = routes.safeParse(input);
  if (!result.success) {
    send({ success: false, error: "Validation failed", issues: result.errors });
    return;
  }

  const payload = result.data as Record<string, unknown>;
  const cmd = payload.cmd as string;
  const handler = handlers[cmd];
  if (!handler) {
    send({ success: false, error: `No handler for route: ${cmd}` });
    return;
  }

  send(handler(payload));
});

rl.on("close", () => {
  send({ type: "bye" });
});
```

## How to run it

Save the full example above to a file (e.g. `repl.ts`), then run it with `tsx`
or compile it with your preferred TypeScript setup.

### Interactive mode (human)

```bash
npx tsx repl.ts
```

Then type JSON commands, one per line, press Enter after each:

```
{"cmd":"build","mode":"dev"}
{"cmd":"deploy","target":"staging"}
{"cmd":"build","mode":"prod","output":"./out"}
```

Each line produces one JSON response on stdout (verified output):

```
{"type":"ready","routes":["build","deploy"]}
{"success":true,"data":{"built":true,"mode":"dev","output":"./dist","files":42}}
{"success":true,"data":{"deployed":true,"target":"staging","url":"https://app-staging.ytn.dev"}}
{"success":true,"data":{"built":true,"mode":"prod","output":"./out","files":42}}
{"type":"bye"}
```

Press `Ctrl+D` (Unix) or `Ctrl+Z` + Enter (Windows) to send EOF and exit.

**For interactive human use**, set `terminal: true` in the readline config to
get line editing (backspace, arrows, history):

```typescript
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,  // enables line editing for human typing
});
```

### Pipe mode (one-shot or scripted)

Pipe one or more lines into the process:

```bash
echo '{"cmd":"build","mode":"dev"}' | npx tsx repl.ts
```

Or multiple lines (PowerShell):

```powershell
@('{"cmd":"build","mode":"dev"}', '{"cmd":"deploy","target":"prod"}') | npx tsx repl.ts
```

The process reads all lines, responds to each, then exits on EOF. This is
functionally equivalent to calling the CLI twice — but in a single process.

### Agent mode (programmatic stdin)

An agent or harness with stream control can spawn the process and write to
its stdin programmatically:

```typescript
import { spawn } from "node:child_process";

// On Windows, use "npx.cmd" instead of "npx" (per project convention).
// On Unix, use "npx".
const child = spawn("npx.cmd", ["tsx", "repl.ts"], {
  stdio: ["pipe", "pipe", "inherit"],
  shell: true,  // required for .cmd resolution on Windows
});

// Send a command
child.stdin.write(JSON.stringify({ cmd: "build", mode: "dev" }) + "\n");

// Read the response
child.stdout.on("data", (chunk) => {
  console.log("Response:", chunk.toString().trim());
});

// Send another command later
setTimeout(() => {
  child.stdin.write(JSON.stringify({ cmd: "deploy", target: "prod" }) + "\n");
}, 1000);

// Close stdin to end the process
setTimeout(() => {
  child.stdin.end();
}, 2000);
```

**Note:** most AI agent terminals (Devin `exec`, Cursor, Windsurf) are
one-shot and cannot do this. They launch a process, wait for exit, read
stdout. For those agents, use the normal CLI mode (`@ytrynot/cli`), not REPL.

## Adding persistence

To survive crashes and reboots, persist state to a file or database:

```typescript
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const STATE_FILE = ".ytn/repl-state.json";

// Load state on startup
let state: Record<string, unknown> = {};
if (existsSync(STATE_FILE)) {
  state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
}

// Save state after each command
function saveState() {
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

// In your handler:
handlers["build"] = (p) => {
  state.lastBuild = { mode: p.mode, timestamp: Date.now() };
  saveState();
  return { success: true, data: { built: true, ...state.lastBuild } };
};
```

For SQLite persistence, use `@ytrynot/qb` (already in the monorepo).

## Adding concurrent requests with IDs

If a consumer sends multiple commands without waiting for responses, add a
request ID to correlate:

```typescript
rl.on("line", (line: string) => {
  const input = JSON.parse(line) as { id?: string; cmd?: string };
  const { id, ...cmd } = input;  // caller provides an "id" field

  const result = routes.safeParse(cmd);
  const payload = result.success ? (result.data as Record<string, unknown>) : null;
  const response = payload && payload.cmd && handlers[payload.cmd as string]
    ? handlers[payload.cmd as string](payload)
    : { success: false, error: "Validation failed" };

  send({ id, ...response });  // echo the id back
});
```

This is only useful for async handlers (I/O-bound work). For sync handlers,
commands are processed sequentially anyway.

## Differences from `@ytrynot/cli`

| Aspect | `@ytrynot/cli` (argv mode) | REPL (stdin mode) |
|---|---|---|
| Input source | `process.argv.slice(2)` | `process.stdin` (readline) |
| Input format | argv strings (flags, positionals) | JSON objects (one per line) |
| Tokenizer | `node:util.parseArgs` | `JSON.parse` |
| Routing | `dna.cliUnion` (Maranget) | `dna.cliUnion` (Maranget) — **same** |
| Validation | DNA `safeParse` | DNA `safeParse` — **same** |
| Handlers | `Record<string, handler>` | `Record<string, handler>` — **same** |
| Output | formatted string + `console.log` | JSON + `console.log` |
| Exit | `process.exit(0 or 1)` | no exit — loops on EOF |
| Help | `buildHelp()` / `printHelp()` | not included (REPL has no argv help) |
| Error formatting | `formatCliError()` | raw DNA errors in JSON |
| `\x00ID` injection | yes (via `createContract`) | no (not needed — no argv defense) |
| AOT compilation | `compile()` via `toJS` | optional — `safeParse` works without it |

**What's shared:** the routing engine (`dna.cliUnion`), the validation engine
(`safeParse` / DNA bytecode), and the handler pattern.

**What's different:** the input layer (parseArgs vs JSON.parse), the output
layer (formatted string vs JSON), and the lifecycle (exit vs loop).

## Common pitfalls

1. **`terminal: false` disables line editing.** If a human is typing
   interactively, set `terminal: true` or remove the option (readline
   auto-detects TTY). If piping or using an agent, `terminal: false` is
   correct.

2. **EOF kills the process.** When stdin closes (EOF), readline emits
   `"close"` and the process exits naturally. Don't call `process.exit()`
   in the close handler — let it end gracefully.

3. **`echo '...' | repl` is one-shot.** The pipe closes after `echo`
   finishes, sending EOF. The REPL processes one line and exits. This is
   not a persistent session — it's equivalent to one CLI call. For a
   persistent session, the consumer must keep stdin open (see
   [Agent mode](#agent-mode-programmatic-stdin)).

4. **No `parseArgs` means no flags.** In REPL mode, there are no `--flag`
   or `-f` shortcuts. Everything is a JSON field. `{"cmd":"build","mode":"dev"}`
   replaces `build --mode dev` or `build dev`.

5. **Handlers must not throw.** If a handler throws, the error is unhandled
   and crashes the process. Wrap handler calls in try/catch if needed:

   ```typescript
   try {
     send(handler(payload));
   } catch (err) {
     send({ success: false, error: `Handler error: ${String(err)}` });
   }
   ```

6. **`safeParse` is sync.** If your handlers are async (I/O, network), use
   `safeParseAsync` and `await` the handler. The readline callback becomes
   async — readline handles this fine, but don't block the event loop with
   CPU-bound work (it blocks all concurrent commands).
