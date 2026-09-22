---
"@ytrynot/mcp-core": minor
---

Generic MCP server factory + client — declarative tool registry over the @modelcontextprotocol SDK

- `createCore` validates tool names at construction (duplicates throw, spec-nonconforming names warn) and snapshots the tool list; the same registry drives MCP stdio, a CLI hook, or in-process dispatch.
- `startStdioServer` serves the registry over stdio with era-aware protocol negotiation; `publishDiscoveryFile` writes a JSON descriptor for sibling processes (owner-only, mode 0600 — still never put secrets in `fields`).
- `createMcpClient` connects via stdio subprocess or a caller-provided transport (exactly one required — both or neither throws), exposes `{ call, tools, toolNames, listMeta, raw, close }`, auto-refreshes the tool list on `tools/list_changed` (refresh failures route to `onerror`), and closes the transport if the handshake fails.
- `call()` is a thin pass-through to `callTool` — it returns the raw `CallToolResult` verbatim (`content`, `structuredContent`, `isError`); how to read the result is the caller's business.
- Multi-round-trip surface: `toolInputRequired`, `isToolInputRequired`, `toolAcceptedContent`, `IToolCallInfo` — a handler can return `input_required` and get the elicited answers back on the retry (`req.inputResponses`).
- SDK-free help generation: `describeEntry`, `compactSig`, `helpParts`, `buildToolHelp` render signatures and help from the registry + schema `.meta()` payloads.
- Schema support is structural (Standard Schema V1 + `jsonSchema`) — DNA, Zod v4, and `fromJsonSchema` documents qualify without runtime dependencies; the main entry point stays SDK-free.
