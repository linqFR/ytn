# How to Serve and Connect with `@ytrynot/mcp-core`

`@ytrynot/mcp-core` serves a declarative tool registry as an MCP server and connects a generic MCP client to it. A domain package owns the registry — `{ name, args, output?, handler }` entries whose handlers return a `tsToolOutcome` (`IToolResult`, or `IToolInputRequired` to ask the client for more input mid-call) — and this package provides the three ways to run it: `startStdioServer` over a transport, `createMcpClient` on the other end, and `core.call` in-process for tests and hooks.

This guide builds a working server + client pair end to end. Every example below was run against the package source and produces the output shown.

## Table of Contents

- [Install](#install)
- [Define the Tool Registry](#define-the-tool-registry)
  - [The same entry in Zod v4 or raw JSON Schema](#the-same-entry-in-zod-v4-or-raw-json-schema)
- [Use a Database via `ctx`](#use-a-database-via-ctx)
- [Serve the Registry over Stdio](#serve-the-registry-over-stdio)
  - [Logging](#logging)
- [Connect a Client](#connect-a-client)
  - [The probe cost on stdio](#the-probe-cost-on-stdio)
- [Handle Elicitation Requests](#handle-elicitation-requests)
  - [Ask for input mid-call (`input_required`)](#ask-for-input-mid-call-input_required)
- [Call Tools In-Process](#call-tools-in-process)
  - [Validating arguments in-process](#validating-arguments-in-process)
- [Publish a Discovery File](#publish-a-discovery-file)
- [Generate Tool Help](#generate-tool-help) — summary; full guide in [how-to-help.md](./how-to-help.md)
- [Validation Behavior](#validation-behavior)
- [Related Documentation](#related-documentation)

## Install

```bash
npm install @ytrynot/mcp-core @modelcontextprotocol/server @modelcontextprotocol/client
```

The MCP SDK halves are peer dependencies — install them alongside. You also need **one** schema source for `args`/`output`; any of these works, and they can be mixed within one registry:

| Schema source | Install | Use for `args`/`output` |
|---|---|---|
| `@ytrynot/dna` | `npm install @ytrynot/dna` | `dna.object({...})` etc. — implements Standard Schema natively |
| `zod` (v4) | `npm install zod` | `z.object({...})` etc. — implements Standard Schema + `meta()` |
| Raw JSON Schema | *(none — SDK built-in)* | `fromJsonSchema(doc)` from `@modelcontextprotocol/server` adapts a JSON Schema document into a Standard Schema |

This guide uses DNA in the examples; swap in the equivalent Zod call or `fromJsonSchema(...)` freely — the registry contract is structural, not library-bound.

The package exports three modules:

| Import path | Contents |
|---|---|
| `@ytrynot/mcp-core` | `createCore`, `dispatchTool`, `createDispatcher`, all types — **zero runtime MCP dependency** |
| `@ytrynot/mcp-core/server` | `registerTools`, `startStdioServer`, `publishDiscoveryFile` |
| `@ytrynot/mcp-core/client` | `createMcpClient` |

The split matters: the main entry point never loads the SDK, so hooks and tests that only need `core.call` carry no transport code.

## Define the Tool Registry

`IToolEntry<Ctx>` is the unit of registry: a name, a Standard Schema for arguments, an optional output schema, and a pure `(ctx, input, req?) → tsToolOutcome` handler. `createCore` binds the list to a domain context and returns `{ tools, ctx, call, close }`.

```typescript
import { createCore, type IToolEntry } from "@ytrynot/mcp-core";
import { dna } from "@ytrynot/dna";

interface ICtx {
  prefix: string;
}

const tools: IToolEntry<ICtx>[] = [
  {
    name: "greet",
    description: "Greets by name.",
    args: dna.object({ name: dna.string() }),
    output: dna.object({ greeting: dna.string() }),
    handler(ctx, input) {
      // inputSchema has already been validated by the SDK at this point
      const { name } = input as { name: string };
      const greeting = `${ctx.prefix} ${name}`;
      return {
        content: [{ type: "text" as const, text: greeting }],
        structuredContent: { greeting },
        isError: false,
      };
    },
  },
];

const core = createCore({ tools, ctx: { prefix: "Hello," } });
```

`createCore` validates tool names once, at construction:

- **Duplicate names throw** — the same failure `registerTool` would raise at server start, surfaced early so the in-process and transport paths share the contract.
- **Names outside the spec's SHOULD** (`/^[A-Za-z0-9_.-]{1,128}$/`) emit a `console.warn` and proceed — mirroring the SDK's own behavior (a legal-but-fragile name is not an error).

`args` must produce `type: "object"` at the root (MCP requires object-typed tool arguments) — a `dna.object({...})`, a `z.object({...})`, or a `fromJsonSchema({type:"object", ...})` document. `output` accepts any JSON Schema shape (object, array, primitive); when present, `structuredContent` is validated against it before leaving the server.

### The same entry in Zod v4 or raw JSON Schema

The handler and the result shape are identical — only `args`/`output` change. All three forms below register and serve correctly (verified over a live `InMemoryTransport` round-trip):

```typescript
import { dna } from "@ytrynot/dna";
import { z } from "zod";
import { fromJsonSchema } from "@modelcontextprotocol/server";

// DNA — implements ~standard natively, .describe() feeds help descriptions
const dnaEntry: IToolEntry<ICtx> = {
  name: "greet",
  description: "Greets by name.",
  args: dna.object({ name: dna.string() }),
  output: dna.object({ greeting: dna.string() }),
  handler(ctx, input) { /* identical body */ },
};

// Zod v4 — same contract, .describe()/.meta() feed help descriptions
const zodEntry: IToolEntry<ICtx> = {
  name: "greet",
  description: "Greets by name.",
  args: z.object({ name: z.string() }),
  output: z.object({ greeting: z.string() }),
  handler(ctx, input) { /* identical body */ },
};

// Raw JSON Schema — the SDK's adapter serves the document verbatim in
// tools/list and validates via the pluggable jsonSchemaValidator (Ajv)
const jsonEntry: IToolEntry<ICtx> = {
  name: "greet",
  description: "Greets by name.",
  args: fromJsonSchema({
    type: "object",
    properties: { name: { type: "string" } },
    required: ["name"],
    additionalProperties: false,
  }),
  // no output → structuredContent is passed through unvalidated
  handler(ctx, input) { /* identical body */ },
};
```

The three can coexist in one `tools` array — pick per tool whatever the domain already owns.

## Use a Database via `ctx`

`Ctx` is the domain-owned context — the natural place for a database handle, compiled statements, or directories. `createCore` stores it; every handler receives it as its first argument. The same context object serves the MCP transport path and `core.call`, so a tool behaves identically whether reached over stdio or in-process.

This example uses `node:sqlite` (built into Node ≥ 26 — no extra dependency); the pattern is identical with `better-sqlite3`, a `@ytrynot/qb` query set, or any other driver:

```typescript
import { DatabaseSync } from "node:sqlite";
import { createCore, type IToolEntry } from "@ytrynot/mcp-core";
import { dna } from "@ytrynot/dna";

interface ICtx {
  db: DatabaseSync;
}

const tools: IToolEntry<ICtx>[] = [
  {
    name: "add_note",
    description: "Save a note.",
    args: dna.object({ text: dna.string() }),
    output: dna.object({ id: dna.number() }),
    handler(ctx, input) {
      const { text } = input as { text: string };
      const res = ctx.db.prepare("INSERT INTO notes(text) VALUES (?)").run(text);
      const id = Number(res.lastInsertRowid);
      return {
        content: [{ type: "text" as const, text: `Saved note ${id}` }],
        structuredContent: { id },
        isError: false,
      };
    },
  },
];

const db = new DatabaseSync("app.db"); // or ":memory:"
const core = createCore({
  tools,
  ctx: { db },
  close: (ctx) => ctx.db.close(), // lifecycle hook — runs on core.close()
});
```

Two details worth noting:

- **Open the resource yourself, close it through `close`.** `createCore` never opens anything — the caller builds `ctx` — but `opts.close(ctx)` runs when `core.close()` is called (idempotent). Serve the core and the handle's `close()` tears down the transport; the domain resource lifecycle stays the caller's responsibility unless you wire `close`.
- **Precompile once, not per call.** For hot paths, prepare statements once at context construction (`ctx: { queries: compileQueries(db) }`) rather than inside each handler — the context lives as long as the core.

Verified output of `core.call("add_note", { text: "water plants" })` after two seeded rows:

```json
{"id":3}
```

## Serve the Registry over Stdio

`startStdioServer` serves `core.tools` over stdio. It wraps the SDK's era-aware entry — the client's opening exchange selects the protocol era per connection, so the same registry speaks the modern era (2026-07-28, identity projection) to modern clients and the legacy era (wrapped results) to 2025-era clients.

```typescript
import { startStdioServer } from "@ytrynot/mcp-core/server";

const handle = await startStdioServer({
  name: "demo",
  version: "1.0.0",
  core,
});
```

The process is now an MCP server. Any host that spawns it lists and calls the registered tools.

Options:

- `instructions` — string shown to clients during the handshake.
- `legacy: "reject"` — refuse 2025-era openings with an unsupported-protocol-version error instead of serving them (default `"serve"` keeps both eras).
- `transport` — bring your own transport instead of process stdio (tests pass one end of `InMemoryTransport.createLinkedPair()`).
- `discovery` — publish a JSON descriptor to the OS temp dir (see [Publish a Discovery File](#publish-a-discovery-file)).

`close()` on the returned handle tears down the server instance and transport:

```typescript
process.on("SIGINT", () => {
  void handle.close();
});
```

### Logging

stdout is the JSON-RPC channel. Log with `console.error` (stderr) — never `console.log`, which corrupts the protocol stream.

## Connect a Client

`createMcpClient` connects to a server either by spawning a stdio subprocess or over a caller-provided transport — exactly one of `stdio`/`transport` is required; supplying both or neither throws. It returns `{ call, tools, toolNames, listMeta, raw, close }`.

```typescript
import { createMcpClient } from "@ytrynot/mcp-core/client";

// Spawn a server subprocess:
const mcp = await createMcpClient({
  name: "my-client",
  version: "1.0.0",
  stdio: { serverScript: "./dist/server.js" },
});

// Or connect over an existing transport (tests):
// const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
// const mcp = await createMcpClient({ transport: clientTransport });
```

`call(name, args)` is a thin pass-through to `callTool` — it returns the raw `CallToolResult` verbatim: `content`, `structuredContent` (when the server produced it), and `isError`. mcp-core does not interpret the payload — how to read or unwrap the result is the caller's business:

```typescript
const result = await mcp.call("greet", { name: "Ada" });
// CallToolResult: { content: [...], structuredContent: { greeting: "Hello, Ada" }, isError: false }
result.structuredContent; // the machine-readable payload (SEP-2106)
result.isError;           // tool errors resolve — they do not reject the promise
```

Protocol-era negotiation defaults to `{ mode: "auto" }`: the client probes `server/discover` (modern era) and falls back to `initialize` (legacy). Override with `versionNegotiation: { mode: "legacy" }` to skip the probe, or `{ mode: { pin: "2026-07-28" } }` to require the modern era. Inspect the negotiated era on `mcp.raw.getProtocolEra()`.

### The probe cost on stdio

The two MCP eras open with *different first messages* — modern-era clients send `server/discover`, legacy clients send `initialize` — so an `auto` client must probe before the real handshake. On stdio this has a concrete cost: the SDK cannot probe on the real connection (a spawned process is not reusable once the probe is consumed), so it runs the probe on a **short-lived sibling process** spawned from the same parameters, then starts your transport once the era is known:

| `versionNegotiation` | Probe | Spawns per `stdio` connect |
|---|---|---|
| `{ mode: "legacy" }` | none | 1 |
| `{ mode: "auto" }` (default) | `server/discover` on a sibling | **2** |
| `{ mode: { pin: "2026-07-28" } }` | mandatory `discover` | 2 |

Consequences worth weighing:

- Each spawn pays the server's full startup (DB open, init, query compilation) — the probe pays it for nothing.
- Against a known-legacy server the probe is guaranteed wasted: it never answers `server/discover`, so the client falls back to `initialize` anyway.
- On `InMemoryTransport` (tests) or any subclassed/custom transport, the SDK probes **on the connection itself** — no extra spawn. That's why the test suite never shows the cost.

Choose `auto` for a generic client discovering arbitrary servers; choose `{ mode: "legacy" }` when the target is known-legacy and startup cost matters — e.g. spawn-per-call patterns.

The advertised tool list refreshes automatically when the server sends `notifications/tools/list_changed` — `tools`/`toolNames`/`listMeta` always reflect the latest `tools/list`. Subscribe with `onToolsChanged` to react to additions or removals.

## Handle Elicitation Requests

Elicitation is the MCP channel for a server to ask the connected user for structured input during `tools/call`. Declare it on the client with an `elicitation` option; `onRequest` receives the request params (`message` + `requestedSchema`, or `url` mode) and returns an `ElicitResult`.

```typescript
const mcp = await createMcpClient({
  stdio: { serverScript: "./dist/server.js" },
  elicitation: {
    url: true, // optional — form mode is the spec default
    onRequest: (params) => {
      // params.message — human-readable prompt
      // params.requestedSchema — JSON Schema of the expected content (form mode)
      return { action: "accept", content: { confirmed: true } };
      // or { action: "decline" } / { action: "cancel" }
    },
  },
});
```

This declares the `elicitation` capability in the handshake (`{ form: {}, url: {} }` when `url: true`). On modern-era connections the same handler also auto-fulfils `input_required` rounds embedded inside `tools/call` results — no extra wiring needed.

### Ask for input mid-call (`input_required`)

On the modern era (2026-07-28) a tool can pause a `tools/call` and ask the client for more input — the spec's multi-round-trip pattern. The handler answers `toolInputRequired(...)` instead of a final result; the client fulfils the embedded requests (via the `elicitation.onRequest` handler above) and retries the same call; on re-entry the handler reads the answers from its third argument, `req.inputResponses`:

```typescript
import {
  toolAcceptedContent,
  toolInputRequired,
  type IToolEntry,
} from "@ytrynot/mcp-core";
import { dna } from "@ytrynot/dna";

const confirmSchema = dna.object({ confirm: dna.boolean() });

const deployArgs = dna.object({ env: dna.string() });

const tools: IToolEntry<ICtx>[] = [
  {
    name: "deploy",
    args: deployArgs,
    handler(ctx, input, req) {
      const { env } = deployArgs.parse(input);
      const answer = toolAcceptedContent<{ confirm: boolean }>(
        req?.inputResponses,
        "confirm",
      );
      if (answer?.confirm !== true) {
        // Round 1 — ask the client; the call is retried after fulfilment.
        return toolInputRequired({
          inputRequests: {
            confirm: {
              kind: "form",
              message: `Deploy to ${env}?`,
              requestedSchema: confirmSchema, // or a raw JSON Schema document
            },
          },
        });
      }
      // Round 2 — the answer arrived in req.inputResponses.
      return { content: [{ type: "text", text: `deployed to ${env}` }], isError: false };
    },
  },
];
```

- `toolInputRequired(spec)` builds the result — at least one of `inputRequests` or `requestState` is required (the spec contract; the builder throws `TypeError` otherwise).
- `toolAcceptedContent<T>(req?.inputResponses, key)` reads the `content` of an *accepted* form answer — `undefined` for missing, declined, or cancelled answers. Values arrive from the client unvalidated; pair the asserted type with the schema you asked for.
- `kind: "url"` sends the user to an out-of-band URL (`{ kind: "url", message, url }`) instead of a form. Embedded sampling and roots exist in the wire vocabulary but are deprecated (SEP-2577) — `IToolInputRequest` does not expose them.
- `requestState` is opaque state the client echoes back verbatim on retry — attacker-controlled on re-entry: integrity-protect it if it drives authorization or business logic.
- `isToolInputRequired(result)` narrows the `tsToolOutcome` union — needed when consuming `core.call`/`dispatchTool` results in-process.

In-process, `input_required` has no client to fulfil it — `core.call` returns the `IToolInputRequired` as-is; the embedder decides how to answer (e.g. a CLI prompt) and replays the call with `call(name, args, { inputResponses })`.

## Call Tools In-Process

`core.call` dispatches a tool by name without any transport — the same registry serves the MCP path and a direct in-process path for CLI hooks and tests:

```typescript
const result = core.call("greet", { name: "Ada" });
// {
//   content: [{ type: "text", text: "Hello, Ada" }],
//   structuredContent: { greeting: "Hello, Ada" },
//   isError: false,
// }
```

An unknown name returns `isError: true` instead of throwing. Note the boundary: in-process dispatch calls the handler directly — `args` schema validation runs on the MCP path (`tools/call`), not here.

### Validating arguments in-process

When a handler can receive untrusted in-process input (a CLI hook, a test harness), add validation on the handler side. Three patterns, from lightest to most integrated — all verified against the package source:

**1. Parse inside the handler.** The simplest form — call the schema's `parse` on `input`:

```typescript
const greetArgs = dna.object({ name: dna.string() });

const handler: IToolEntry<ICtx>["handler"] = (ctx, input) => {
  const { name } = greetArgs.parse(input); // throws the library's error (DnaError / ZodError) on bad input
  const greeting = `${ctx.prefix} ${name}`;
  return { content: [{ type: "text" as const, text: greeting }], isError: false };
};
```

**2. Wrap the handler with a function schema.** The schema library owns the validation boundary — `input` is a tuple describing the handler's `(ctx, args)` parameters, so the first slot stays a pass-through `any` (the core injects the domain context, the schema needn't model it). Both libraries offer the same `function` constructor:

```typescript
// DNA
const greetFn = dna
  .function({ input: [dna.any(), greetArgs] })
  .implement((ctx: ICtx, input) => {
    const greeting = `${ctx.prefix} ${input.name}`; // input narrowed by the schema
    return {
      content: [{ type: "text" as const, text: greeting }],
      structuredContent: { greeting },
      isError: false as const,
    };
  });

// Zod v4 — identical structure
const zGreetArgs = z.object({ name: z.string() });
const zGreetFn = z
  .function({ input: [z.any(), zGreetArgs] })
  .implement((ctx: ICtx, input) => {
    const greeting = `${ctx.prefix} ${input.name}`;
    return {
      content: [{ type: "text" as const, text: greeting }],
      structuredContent: { greeting },
      isError: false as const,
    };
  });

const tools: IToolEntry<ICtx>[] = [
  {
    name: "greet",
    args: greetArgs,
    output: dna.object({ greeting: dna.string() }),
    // CAST: implement() narrows input at runtime; IToolResult is satisfied structurally.
    handler: greetFn as IToolEntry<ICtx>["handler"],
  },
];
```

Bad input then throws the library's error (`DnaError` / `ZodError`) from the wrapper before the handler body runs — on **both** the in-process and the MCP path (it composes with the SDK's own input validation, which still runs first on `tools/call`).

Keep the function's `output` slot empty for `IToolResult` handlers: it validates the *whole* return value, so an output schema describing `structuredContent` alone would reject the `{ content, structuredContent, isError }` wrapper.

**3. No validation** is legitimate when the in-process caller is trusted (tests, internal hooks) — the MCP path remains fully guarded by the SDK.

`dispatchTool(tools, ctx, name, args)` is the unbound one-shot form; `createDispatcher(tools, ctx)` returns the bound closure `core.call` uses internally.

## Publish a Discovery File

**The problem**: an MCP server is spawned by an IDE/agent with its own environment — it knows where its database lives. A sibling process started later by a different parent (a second agent, a CLI invocation, a scheduler job) inherits none of that: no env var, no spawn args. It still needs to reach the same DB.

**The contract**: both sides agree on one path — `<dir>/<fileName>`, where `dir` defaults to the OS temp dir (`os.tmpdir()`) and can be any agreed directory (a per-user state dir, a shared workspace folder). The server writes the descriptor when it starts; any later process reads the same path. The path is the only shared knowledge — it acts as the rendezvous point.

**Writer side** — `mcp-core` owns this half. `startStdioServer`'s `discovery` option publishes the descriptor right after connecting:

```typescript
await startStdioServer({
  name: "my-server",
  version: pkg.version,
  core,
  discovery: { fileName: "my-server.json", fields: { MY_DB: dbPath } },
});
// → writes <os.tmpdir()>/my-server.json:
//   { "MY_DB": "E:/…/data/app.db", "startedAt": "2026-09-22T…" }
```

`fields` is a `Record<string, string | undefined>` — env-var-style values; `undefined` entries are dropped by the JSON serialization. `startedAt` (ISO timestamp) is added automatically. `dir` overrides the target directory — both sides must agree on it when the temp dir is not the rendezvous:

```typescript
discovery: { fileName: "my-server.json", fields: { MY_DB: dbPath }, dir: stateDir },
// → writes <stateDir>/my-server.json
```

For setups that don't go through `startStdioServer` (custom transports, test harnesses), `publishDiscoveryFile` is the standalone form — same write, returns the absolute path:

```typescript
import { publishDiscoveryFile } from "@ytrynot/mcp-core/server";

const path = publishDiscoveryFile("my-server.json", { MY_DB: dbPath }, dir);
// → <dir>/my-server.json (dir optional — defaults to os.tmpdir())
```

**Reader side** — domain-owned; `mcp-core` ships no reader. The sibling process resolves the same path and parses it:

```typescript
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const { MY_DB, startedAt } = JSON.parse(
  readFileSync(join(tmpdir(), "my-server.json"), "utf8"),
);
const db = new Database(MY_DB); // whatever the domain opens — better-sqlite3, @ytrynot/qb…
```

**Limits the reader must handle**:

- **File absent** — the server never ran (or ran without `discovery`). Tolerate `ENOENT` and fall back to defaults.
- **File stale** — nothing deletes the descriptor when the server exits; it outlives the process. `startedAt` is the freshness signal: compare it against the server process's lifetime or a staleness window rather than assuming the settings are current.
- **Owner-readable** — the descriptor is written mode 0600 (same-user sibling processes only). Still: never put secrets or tokens in `fields` (pass paths and identifiers, not credentials).

## Generate Tool Help

Four SDK-free helpers render help from the registry — the auto-derived parts (signature, `Parameters:` block, descriptions) come from the JSON Schema each `args` advertises, and the domain writes its prose (`usage`, `returns`, `foot`, `category`) on the schema's `.meta()` payload:

```typescript
import { buildToolHelp, helpParts } from "@ytrynot/mcp-core";

buildToolHelp(core, "greet");      // detail page for one tool
buildToolHelp(core);               // one compact line per tool
buildToolHelp(core, "greet", tpl); // 3rd arg overrides the default template
helpParts(entry);                  // the 7-part map, for template-free composition
```

The natural use is a `help` tool in the domain registry whose handler calls `buildToolHelp(core, input.name)` — in-process only, no MCP wiring. See **[How to Generate Tool Help](./how-to-help.md)** for the full guide: token sources, default templates and overrides, authoring descriptions and domain parts in DNA / Zod v4 / `fromJsonSchema`, category grouping, and head/body/foot page composition.


## Validation Behavior

A `tools/call` request passes through these gates:

1. **Input validation** — the SDK validates `arguments` against `args` (`~standard.validate`). Invalid input returns `isError: true`; the handler never runs.
2. **Handler executes** — receives the parsed arguments and `ctx`.
3. **Output validation** — when `output` is declared, the SDK validates `structuredContent` against it before the result leaves the server. A mismatch returns `isError: true` with an `Output validation error` message.
4. **Client output check** — the client SDK re-validates `structuredContent` against the advertised `outputSchema` on receipt.

## Related Documentation

- [Package README](../README.md) — concepts, schema contract, package layout
- [How to Generate Tool Help](./how-to-help.md) — the full help-generation guide
- [How to Serve an MCP Server](../../dna/docs/how-to-mcp-server.md) — the underlying SDK serving surface (`registerTool`, `serveStdio`, HTTP)
- [How to Use `@modelcontextprotocol/client`](../../dna/docs/how-to-mcp-client.md) — the underlying SDK client surface
- [Standard Schema Compatibility](../../dna/docs/standard-schema.md) — how DNA implements the `~standard` interface
