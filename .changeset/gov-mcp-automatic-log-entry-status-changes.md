---
"@ytrynot/gov-mcp": patch
---

Automatic log_entry for all status changes + fixes

- `update_idea_status` and `update_problem_status` now automatically create a `log_entry` with `type: "status"`, matching the existing behavior of `update_decision_status` and `update_action_status`.
- `create_spec` now accepts `version: 0` (pre-spec/exploration stage), previously minimum was 1.
- `help` tool output includes an "Automatic Traceability" section explaining that all `create_*` and `update_*_status` calls log automatically.
- `how-to.md` and `architecture.md` document that status changes are automatically traced — no manual `log_entry` needed.
