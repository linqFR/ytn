# @ytrynot/mcp-core

> **Looking for testers!** This package is actively seeking early users and feedback. If you try it out, please share your experience — issues, suggestions, or ideas are all welcome.

Generic MCP server factory. A domain package owns a **declarative tool list** — `{ name, args, output?, handler }` entries whose handlers are pure `(ctx, input, req?) → tsToolOutcome` functions — and `mcp-core` serves them over MCP stdio or dispatches them in-process.

The same registry can drive an MCP transport, a CLI hook, or a test harness without duplication — the transport layers are thin adapters over the shared core.

<!-- badges:start -->
[![npm version](https://img.shields.io/npm/v/@ytrynot/mcp-core.svg)](https://www.npmjs.com/package/@ytrynot/mcp-core) [![CI](https://img.shields.io/github/actions/workflow/status/linqFR/ytn/ci.yml?label=CI)](https://github.com/linqFR/ytn/actions/workflows/ci.yml) [![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE) [![types](https://img.shields.io/badge/types-TypeScript-blue)](./src/index.ts) [![node](https://img.shields.io/badge/node-%3E%3D26.0.0-brightgreen)](https://nodejs.org) [![MCP](https://img.shields.io/badge/MCP-2.0.0-blue)](https://modelcontextprotocol.io)
<!-- badges:end -->

## Table of Contents

- [Install](#install)
- [Concepts](#concepts)
- [Schema contract](#schema-contract)
- [Raw JSON Schema](#raw-json-schema)
- [Structured content](#structured-content)
- [In-process dispatch](#in-process-dispatch)
- [Stdio server](#stdio-server)
- [Client factory](#client-factory)
- [Discovery file](#discovery-file)
- [Tool help](#tool-help)
- [API by use case](#api-by-use-case)
- [Documentation](#documentation)
- [License](#license)

## Install

```bash
npm install @ytrynot/mcp-core @modelcontextprotocol/server @modelcontextprotocol/client
```

The MCP SDK halves are peer dependencies — install them alongside.

A schema library implementing Standard Schema V1 + `jsonSchema` conversion is required for `args`/`output` — [`@ytrynot/dna`](https://www.npmjs.com/package/@ytrynot/dna) and [Zod v4](https://zod.dev) both qualify, or a raw JSON Schema document via the SDK's `fromJsonSchema`. See [Schema contract](#schema-contract).

## Concepts

```ts
interface IToolEntry<Ctx> {
  name: string;                 // MCP tool name
  args: IToolSchema;            // input schema → tools/list + call validation
  output?: IToolSchema;         // validates structuredContent when present
  description?: string;         // defaults to args.meta().description
  handler(ctx: Ctx, input: unknown, req?: IToolCallInfo): tsToolOutcome;
}

interface IToolResult {
  content: tsToolContent[];   // full MCP ContentBlock union:
                            // text | image | audio | resource_link | resource
                            // (+ optional annotations: audience, priority, lastModified)
  structuredContent?: unknown;
  isError: boolean;
}
```

`Ctx` is the domain-owned context (db handle, compiled queries, directories…). `mcp-core` never interprets it. The registry stays the single source of truth: names, schemas, and metadata live on the entries.

`createCore` validates names once at construction: **duplicates throw** (the same failure `registerTool` would raise at server start, surfaced early so in-process and transport paths share the contract); names outside the spec's SHOULD (`/^[A-Za-z0-9_.-]{1,128}$/`) emit a `console.warn` and proceed — mirroring the SDK's own behavior.

## Schema contract

`args` and `output` on each `IToolEntry` accept any schema object exposing the **Standard Schema V1** interface plus a `jsonSchema` converter — the shape the MCP SDK requires. Concretely, the SDK calls two members on each schema:

- `schema["~standard"].validate(args)` — validates `tools/call` arguments before the handler runs;
- `schema["~standard"].jsonSchema.input({ target })` — produces the JSON Schema document advertised in `tools/list`.

Three ways to produce such an object:

- **[`@ytrynot/dna`](https://www.npmjs.com/package/@ytrynot/dna)** — `dna.object({...})` implements `~standard` natively;
- **[Zod v4](https://zod.dev)** — `z.object({...})` implements `~standard` and `.meta()`;
- **Raw JSON Schema** — `fromJsonSchema(doc)` from `@modelcontextprotocol/server` wraps a plain document into the interface (see [Raw JSON Schema](#raw-json-schema)).

Any other `StandardSchemaWithJSON` implementation (ArkType, Valibot, hand-rolled) works too — the contract is structural, and mcp-core has **zero runtime dependencies**.

`toolDescription()` reads `args.meta().description` when the schema library exposes `.meta()` (DNA and Zod v4 do); otherwise declare `description` on the entry.

## Raw JSON Schema

Two distinct standards are in play — do not conflate them:

- **JSON Schema** (json-schema.org, draft 2020-12) is the *document format* MCP advertises on the wire as `inputSchema`/`outputSchema` in `tools/list`.
- **Standard Schema** (standardschema.dev, the `~standard` object) is the *adapter contract* the SDK calls for validation and JSON Schema conversion.

Raw JSON Schema documents join the registry through the SDK's official adapter — no hand-rolled `~standard` wrapper, and the validator stays the caller's choice:

```ts
import { fromJsonSchema } from "@modelcontextprotocol/server";

const input = fromJsonSchema({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
});
```

`fromJsonSchema` serves the source document verbatim to `tools/list` and validates calls through a **pluggable** `jsonSchemaValidator` provider — the SDK ships a default (`AjvJsonSchemaValidator`, also importable from `@modelcontextprotocol/server/validators/ajv`); pass your own as the second argument to override.

## Structured content

`structuredContent` may be **any JSON value** — object, array, or primitive (MCP spec 2026-07-28 / SEP-2106). When `output` is declared, the SDK validates the value against it and advertises the schema as `outputSchema`.

On **modern-era** connections (protocol 2026-07-28 — the default path: `startStdioServer` serves via the SDK's era-aware `serveStdio` entry, `createMcpClient` negotiates `auto`), the wire is the identity projection: a `structuredContent` of `["a","b"]` arrives as the raw array and `outputSchema` is advertised verbatim.

On **legacy-era** connections (negotiated via the `initialize` handshake), the SDK projects non-object values under a `result` property for backward compatibility: `structuredContent: ["a","b"]` arrives as `{result: ["a","b"]}` and the advertised `outputSchema` becomes `{type:"object", properties:{result: <your schema>}}`. The declared schema itself is preserved verbatim inside `properties.result`.

## In-process dispatch

The main entry point has **no MCP SDK dependency** — usable from hooks and tests:

```ts
import { createCore } from "@ytrynot/mcp-core";

const core = createCore({
  tools: toolList,
  ctx,                              // db handle, queries, dirs — domain-owned
  close: (ctx) => ctx.db.close(),   // optional lifecycle hook
});

core.call("greet", { name: "Ada" });  // tsToolOutcome — IToolResult, or IToolInputRequired
await core.close();                 // idempotent
```

`IMcpCore` carries the context — `core.ctx` is handed to every handler. Lower-level pieces: `dispatchTool(tools, ctx, name, args)` (unbound), `createDispatcher(tools, ctx)` (bound function). Unknown names return `toolError("Unknown tool: <name>")` instead of throwing. A handler may answer `input_required` (see the table below); `isToolInputRequired(result)` narrows the union.

## Stdio server

`@ytrynot/mcp-core/server` is the only module importing `@modelcontextprotocol/server`:

```ts
import { startStdioServer } from "@ytrynot/mcp-core/server";

const handle = await startStdioServer({
  name: pkg.name,
  version: pkg.version,
  instructions,
  core,                             // the same core — tools + ctx
  // legacy: "serve" | "reject",    // how 2025-era openings are handled
  // transport,                     // BYO transport (tests: InMemoryTransport)
});

await handle.close();               // tears down the instance + transport
```

Under the hood this is the SDK's `serveStdio(factory)` entry: the opening exchange selects the protocol era per connection — `server/discover` probes get a modern-era (2026-07-28) instance, `initialize` openings get a legacy-era one — so the same registry serves both.

Lower-level pieces are exported separately:

- `registerTools(server, core)` — wire a core onto an existing `McpServer`.
- `toCallToolResult(result)` — adapt a `tsToolOutcome` (`IToolResult` or `IToolInputRequired`) to the SDK's `CallToolResult`/`InputRequiredResult`.
- `publishDiscoveryFile(fileName, fields)` — see below.

## Client factory

`@ytrynot/mcp-core/client` builds a connected MCP client over a stdio subprocess or any transport:

```ts
import { createMcpClient } from "@ytrynot/mcp-core/client";

const mcp = await createMcpClient({
  stdio: { serverScript: "dist/server.js", env: { MY_DB: dbPath } },
});

const res = await mcp.call("greet", { name: "Ada" });  // → CallToolResult verbatim
res.structuredContent;                   // { greeting: "Hello, Ada" }
res.isError;                             // false — tool errors are not thrown
mcp.toolNames;                               // tools advertised by the server
mcp.tools;                                   // full Tool definitions (schemas, annotations)
mcp.listMeta;                                // { ttlMs?, cacheScope? } from tools/list
await mcp.close();
```

`call()` is a thin pass-through to `callTool` — it returns the raw `CallToolResult` verbatim (`content`, `structuredContent`, `isError`) and does not interpret the payload: how to read the result is the caller's business. `mcp.raw` exposes the underlying SDK `Client` for protocol features not wrapped here.

Protocol behavior inherited from the SDK:

- **Era negotiation** — `versionNegotiation` defaults to `{ mode: "auto" }`: probe `server/discover` (modern era, 2026-07-28), fall back to `initialize` (legacy). `{ mode: "legacy" }` skips the probe; `{ mode: { pin: "2026-07-28" } }` requires modern with no fallback. **Cost on `stdio:`** — the base `StdioClientTransport` runs the probe on a *short-lived sibling process* (one extra spawn per connect, stderr discarded; the real transport starts once the era is known). For spawn-per-call patterns this doubles startup — pass `{ mode: "legacy" }` when the target is known-legacy, or a subclassed/custom transport, which probes in place.
- **List refresh** — `tools`/`toolNames`/`listMeta` refresh automatically on `notifications/tools/list_changed` (servers declaring `tools.listChanged`); `onToolsChanged` fires after each refresh.
- **Output validation** — the SDK's `callTool` validates `structuredContent` against the advertised `outputSchema` on every call (spec: clients SHOULD) — inherited for free.
- **Elicitation** — pass `elicitation: { url?, onRequest }` to declare the capability and register an `elicitation/create` handler (form mode by default; `url: true` adds URL mode). On modern-era connections the same handler auto-fulfils `input_required` rounds embedded in `tools/call`.

Tests use `InMemoryTransport.createLinkedPair()` — pass the server end to `startStdioServer({ transport })`, the client end to `createMcpClient({ transport })` for a full era-aware protocol round-trip in-process.

## Discovery file

**Opt-in** — only relevant when a process that did *not* spawn the server needs its runtime settings (DB path, config values). Pass `startStdioServer`'s `discovery` option and the server writes a small JSON descriptor to `<dir>/<fileName>` after connecting (`dir` defaults to the OS temp dir), with a `startedAt` timestamp added. `publishDiscoveryFile(fileName, fields, dir?)` is the standalone form for setups outside `startStdioServer`. Reading the file is domain-owned: `mcp-core` ships no reader. The file is written world-readable (default umask) — never put secrets or tokens in `fields`. Omit the option entirely when no sibling process exists — nothing is written.

Full mechanism (contract, reader code, staleness limits): [docs/how-to-server-and-client.md](./docs/how-to-server-and-client.md#publish-a-discovery-file).

## Tool help

The registry doubles as a help source: signatures and parameter blocks are derived from each entry's `args` JSON Schema, and the domain writes its prose (`usage`, `returns`, `foot`, `category`) on the schema's `.meta()`. Four in-process helpers — `describeEntry`, `compactSig`, `helpParts`, `buildToolHelp` — cover the spectrum from a single parameter block to a full rendered page; a domain `help` tool is typically one handler calling `buildToolHelp`.

**Full guide: [docs/how-to-help.md](./docs/how-to-help.md)** — helper usage in context, token sources, default templates and overrides, authoring descriptions and domain parts, `category` grouping, head/body/foot page composition.

## API by use case

Every export, by what you want to do:

| I want to… | Use |
|---|---|
| **Serve tools over MCP stdio** | `startStdioServer({ name, version, core })` — `@ytrynot/mcp-core/server` (peer dep: `@modelcontextprotocol/server`) |
| **Attach the registry to an existing `McpServer`** | `registerTools(server, core)` — same entry point |
| **Adapt a result for a manual `tools/call` handler** | `toCallToolResult(result)` — same entry point |
| **Publish a discovery file for sibling processes** | `publishDiscoveryFile(name, data)` or `startStdioServer`'s `discovery` option |
| **Connect a client (spawn or transport)** | `createMcpClient(opts)` — `@ytrynot/mcp-core/client` (peer dep: `@modelcontextprotocol/client`) |
| **Call a tool in-process (hooks, tests)** | `createCore({ tools, ctx, close? })` → `core.call(name, args)`; or `dispatchTool(tools, ctx, name, args)` / `createDispatcher(tools, ctx)` unbound |
| **Build an error result** | `toolError(message)` → `IToolResult` with `isError: true` |
| **Ask the client for more input mid-call** | handler returns `toolInputRequired({ inputRequests })` (form/url elicitation); answers come back in `req.inputResponses` on the retried call — read them via `toolAcceptedContent`; narrow outcomes with `isToolInputRequired`. Modern era (2026-07-28) only — [details](./docs/how-to-server-and-client.md#ask-for-input-mid-call-input_required) |
| **Resolve a tool's description** | `toolDescription(entry)` — `entry.description` else `args.meta().description` |
| **Generate help pages** | `describeEntry`, `compactSig`, `helpParts`, `buildToolHelp` — see [docs/how-to-help.md](./docs/how-to-help.md) |
| **Type a registry / context / result** | `IToolEntry<Ctx>`, `IToolSchema`, `IToolSchemaResult`, `IToolResult`, `IToolInputRequired`, `IToolInputRequest` (`IToolInputRequestForm`/`IToolInputRequestUrl`), `IToolCallInfo`, `tsToolOutcome`, `IMcpCore<Ctx>`, `tsToolContent`, `IContentAnnotations`, `IToolHelpMeta`, `IToolHelpCategory`, `tsHelpToken`, `tsJsonSchemaTarget` |
| **Type server/client options** | `IStdioServerOpts` (server entry), `IMcpClient`/`IMcpClientOpts`/`IStdioClientOpts`/`IToolListMeta` (client entry) |

Only the `server`/`client` subpaths load the MCP SDK — the main entry point (`@ytrynot/mcp-core`) is SDK-free, so hooks and tests carry no transport code.

## Documentation

- [How to Serve and Connect](./docs/how-to-server-and-client.md) — end-to-end server + client walkthrough with verified examples
- [How to Generate Tool Help](./docs/how-to-help.md) — help helpers, tokens, templates, meta authoring

## License

MIT — see [LICENSE](./LICENSE).
