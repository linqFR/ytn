# AGENTS.md (Package: @ytrynot/mcp-core)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to @ytrynot/mcp-core.

---

## Architecture

`@ytrynot/mcp-core` is a generic MCP server/client factory. A domain package owns a declarative tool list — `IToolEntry` entries (`name` + Standard-Schema `args`/`output` + pure `(ctx, input, req?) → tsToolOutcome` handler) — and this package serves it over MCP stdio or dispatches it in-process.

### Directory layout

- `src/types.ts` — Core contracts: `IToolEntry`, `IToolResult`, `IToolSchema`, `IMcpCore`, `createCore`, `dispatchTool`, `createDispatcher`, `toolError`, `toolDescription` + the multi-round-trip surface (`tsToolOutcome`, `IToolInputRequired`, `IToolInputRequest`, `IToolCallInfo`, `toolInputRequired`, `isToolInputRequired`, `toolAcceptedContent`) (SDK-free)
- `src/help.ts` — Help generation: `describeEntry`, `compactSig`, `helpParts`, `buildToolHelp` + `IToolHelpMeta`/`IToolHelpCategory`/`tsHelpToken` (SDK-free)
- `src/server.ts` — Transport layer: `registerTools`, `startStdioServer` (era-aware via `serveStdio`), `toCallToolResult`, `publishDiscoveryFile` — **the only module importing `@modelcontextprotocol/server`**
- `src/client.ts` — Client factory: `createMcpClient`, `IMcpClient`/`IMcpClientOpts`/`IStdioClientOpts`/`IToolListMeta` — **the only module importing `@modelcontextprotocol/client`**
- `src/index.ts` — SDK-free public facade (types + dispatch + help helpers)
- `docs/` — `how-to-server-and-client.md`, `how-to-help.md`
- `tests/` — Vitest suites: `dispatch`, `help`, `discovery`, `client-elicit`, `client-edge`, `e2e-{dna,zod,jsonschema}` (shared `e2e-suite.ts` over `InMemoryTransport`)

### Key invariants

1. **Main entry is SDK-free** — `index.ts`, `types.ts`, `help.ts` must never import `@modelcontextprotocol/*`. The `server`/`client` subpaths are the only SDK importers; this is what lets hooks and tests dispatch tools with zero transport code.
2. **No domain references** — no mention of `@ytrynot/gov-mcp` (or any consuming package) in code, docs, or tests; the generic layer must not name the domain it was extracted from.
3. **Zero runtime dependencies** — the MCP SDK halves are peer dependencies; schema support is structural (Standard Schema V1 + `jsonSchema`), so DNA, Zod v4, and `fromJsonSchema` documents qualify without imports.
4. **Help metadata lives on the schema** — `description`, `usage`, `returns`, `foot`, `category` are authored on the input schema's `.meta()`; the external meta map is only an override for schemas that cannot carry meta. See `docs/how-to-help.md`.
5. **`createCore` validates names at construction** — duplicates throw, spec-nonconforming names warn; the same contract holds on the in-process and wire paths.

### Dependencies

- `@modelcontextprotocol/server`, `@modelcontextprotocol/client` — peer dependencies (server/client subpaths only)
- Schema libraries are the consumer's choice — none required at runtime

### Build

```bash
npm.cmd run build -w @ytrynot/mcp-core
```

### Test

```bash
npm.cmd test -w @ytrynot/mcp-core
npm.cmd test -w @ytrynot/mcp-core -- --typecheck
```
