---
"@ytrynot/gov-mcp": major
---

Unified DNA schema architecture: input + output schemas as single source of truth.

## Summary

Implements DEC-0066: every readonly tool now declares both an input and output DNA schema. The same schemas serve three roles:

1. **MCP Server** — `registerTool({ inputSchema, outputSchema })` validates the wire protocol (input on call, output before the result leaves the server).
2. **Client** — `dna.infer<typeof toolDefs[K]["schema"]>` for inputs and `dna.infer<typeof toolDefs[K]["output"]>` for outputs. No manual type maps.
3. **Tool registry** — `toolDefs` carries `schema`, `output`, `isReadonly` per tool; `toolList` derives `output` from it.

## Added

- `src/schemas/tool-outputs.ts` — DNA output schemas for all readonly tools (`whoamiOutputSchema`, `getUpdatesOutputSchema`, `getHandoffOutputSchema`, …).
- `output` field on every readonly entry in `toolDefs`.
- `outputSchema` passed to `server.registerTool` for every readonly tool. The MCP SDK validates `structuredContent` against it before the result is sent. The schema is advertised in `tools/list` so clients can validate too.

## Removed

- `ToolResults` map (28 manual entries) — replaced by `dna.infer<typeof toolDefs[K]["output"]>`.
- `ToolResults` re-export from `@ytrynot/gov-mcp/client`.

## Changed

- `McpClient` type: output types are now derived from DNA output schemas via `dna.infer<NonNullable<typeof toolDefs[K]["output"]>>` instead of the manual `ToolResults[K]` lookup. Input types remain `dna.infer<typeof toolDefs[K]["schema"]>`.
- `server.ts` passes `outputSchema` to `registerTool` when the tool has an output schema. Tools without `output` (write/reports/help) register without it.

## MCP compliance

gov-mcp is now fully compliant with the MCP 2025-06-18 spec for structured output: `outputSchema` is declared, `structuredContent` is validated by the SDK before leaving the server, and the schema is advertised in `tools/list` for client-side validation.

## Rule: dna.stringbool on external inputs

Per the discussion preceding this change, boolean inputs received from external agents should use `dna.stringbool()` so values like `"true"`, `"false"`, `"yes"`, `"no"` are accepted and normalized. Outputs generated internally by the server remain native `dna.boolean()`. The existing input schemas already follow this rule where applicable; future input schemas should apply it to any boolean field received from external agents.
