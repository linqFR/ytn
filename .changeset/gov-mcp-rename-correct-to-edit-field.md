---
"@ytrynot/gov-mcp": minor
---

Rename MCP tool `correct` to `edit_field`

- The `correct` tool name was ambiguous: it read as an adjective ("everything is correct") rather than a verb ("correct this field"), causing agents to miss the tool and search for `update_<entity>` instead.
- `correct_field` would have conflicted with `add_free_field` / `deprecate_free_field` / `get_free_fields`.
- `edit_field` is unambiguous: verb + object, snake_case, no conflict with free_field tools, and clearly signals that it edits one field on an entity.

BREAKING CHANGE: The MCP tool name changes from `correct` to `edit_field`. All callers (agents, hooks, docs) must use the new name. The internal handler function (`write.correct`), input schema (`correctInput`), and output schema (`correctOutputSchema`) keep their names — only the MCP-exposed tool name changes.
