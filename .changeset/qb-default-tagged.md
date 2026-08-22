---
"@ytrynot/qb": minor
---

DEFAULT values: native `.default()` with automatic SQL quoting

- Use Zod/DNA native `.default()` to declare column defaults — the introspector quotes the value into a SQL literal automatically.
- Strings → single-quoted with `'` escaped as `''` (e.g. `.default("user")` → `DEFAULT 'user'`).
- Numbers → unquoted (e.g. `.default(42)` → `DEFAULT 42`).
- Booleans → `TRUE`/`FALSE` (e.g. `.default(true)` → `DEFAULT TRUE`).
- Dates → ISO 8601 quoted (e.g. `.default(() => new Date("2024-01-01"))` → `DEFAULT '2024-01-01T00:00:00.000Z'`).
- Manual `qbColumn.defaultValue` accepts two signatures: tagged `{ string: "user" }` (auto-quoted) or direct `"CURRENT_TIMESTAMP"` (raw SQL via `.toString()`).
- New export: `resolveDefault()` from `@ytrynot/qb` for manual SQL literal quoting.
- New type: `tsDefaultValue` for the `qbColumn.defaultValue` field.

BREAKING CHANGE: `meta.default` and `meta.defaultValue` are no longer read by the introspectors or DDL engine. Use native `.default()` on Zod/DNA schemas instead. `qbColumn.defaultValue` type changed from `unknown` to `tsDefaultValue` — manual columns using `defaultValue: "'user'"` (raw SQL string) still work via the direct form but produce unquoted output; migrate to `defaultValue: { string: "user" }` for automatic quoting.
