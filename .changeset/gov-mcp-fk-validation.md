---
"@ytrynot/gov-mcp": patch
---

Validate linked entity references and align output schemas with actual handler results

- `create_problem`, `create_action`, `create_decision`, `create_spec`, and `update_idea_status` now validate linked entity IDs (`linkedSpec`, `linkedAct`, `specRef`, `supersedes`, `promotedTo`, `dependencies`) against the database before insert, returning clear errors (`Linked spec X not found`) instead of raw SQLite foreign-key failures.
- Fixed output-schema mismatches that caused "Output validation error" at call time: `list_writers` (nanoid and last_read_at not selected), `get_action` (workstreamLinks/problemLinks keys), `get_free_fields` (freeFields/count keys), `audit_consistency` (findings/summary keys), `get_doc` (filename/size missing), `list_docs` (returns filename/size/title, not description), `get_scope_info` (`counts` now returns plain numbers instead of raw `{count}` query rows), `generate_daily_report` (counts.logEntries missing), `get_handoff` (nullable subject), and `get_idea`/`get_action_lineage` (null vs undefined for missing linked decisions).
- `list_*` tools now declare projection schemas matching the columns they actually select, instead of requiring full table rows.
- `generate_daily_report` no longer crashes when a log entry's author has been deleted from the writers table (null vs undefined filter).
- Daily report log entries now display the author's `default_scope`.
- Added a conformance test that invokes every registered tool and validates its structured output against the advertised schema, so future handler/schema drift is caught by the test suite instead of at call time.
