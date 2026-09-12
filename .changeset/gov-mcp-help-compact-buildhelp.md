---
"@ytrynot/gov-mcp": minor
---

Help: compact index, template-based buildHelp, dedicated returns metadata

- `help()` without arguments returns a compact index (~120 lines): Getting Started, How-To, Docs, and one-line signatures per tool (name + params + return shape).
- `help({ tool: "tool_name" })` returns full detail for one tool: description, auto-generated Parameters block, usage prose, and return shape.
- `buildHelp(toolName, template)` is a new exported function that renders a help string from a format template with `{{name}}`, `{{desc}}`, `{{sig}}`, `{{args}}`, `{{usage}}`, `{{return}}` tokens.
- Tool metadata `.meta()` now includes a dedicated `returns` field (return shape string) and a `usage` tuple `[start, end]` instead of a single string.
- `describeSignature` parameter format changed from `(type, required)` to `(type) — description [required]`.
- `helpInput` is now defined in a single location (`definitions/help-input.ts`) with a dynamic enum of all tool names.

BREAKING CHANGE: `IToolMeta.usage` is now `[string, string]` (tuple) instead of `string`. Code that reads `toolMeta[tool].usage` as a string must join the tuple. `IToolMeta.returns` is a new required field.
