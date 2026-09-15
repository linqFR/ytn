---
"@ytrynot/gov-mcp": patch
---

Validate linked entity references and fix report bugs

- `create_problem`, `create_action`, `create_decision`, `create_spec`, and `update_idea_status` now validate linked entity IDs (`linkedSpec`, `linkedAct`, `specRef`, `supersedes`, `promotedTo`, `dependencies`) against the database before insert, returning clear errors (`Linked spec X not found`) instead of raw SQLite foreign-key failures.
- `list_writers` output schema no longer requires `nanoid` — it was stripped by the query but still required by the schema, causing an output validation error.
- `generate_daily_report` no longer crashes when a log entry's author has been deleted from the writers table (null vs undefined filter).
- Daily report log entries now display the author's `default_scope`.
