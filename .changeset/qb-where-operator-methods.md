---
"@ytrynot/qb": minor
---

WHERE operator methods — typed alternatives to whereRaw for common SQL predicates

- `whereEq(fields)`: alias for `where()` — `col = @param`. Provided for API symmetry with `whereNotEq`, `whereLike`, etc.
- `whereNotEq(fields)`: `col != @param` — inequality with bound parameter.
- `whereNotIn(col, target)`: `col NOT IN (...)` — symmetric to `whereIn`, accepts literal list or subquery Builder.
- `whereLike(col, param)`: `col LIKE @param` — LIKE with bound parameter (not interpolated literal).
- `whereNull(col)`: `col IS NULL`.
- `whereEmpty(col)`: `col = ''` — empty string test.
- `whereNullish(col)`: `(col IS NULL OR col = '')` — null or empty string, parenthesized for safe AND composition.
- `whereExists(subquery)`: `EXISTS (...)` — correlated subquery existence test.
- `whereNotExists(subquery)`: `NOT EXISTS (...)` — symmetric to `whereExists`.
- `whereLiteralNotEq(col, value)`: `col != 'literal'` — symmetric to `whereLiteral`, for inequality against a SQL literal.
- `clone()` preserves all new state.
- 427 total tests pass (17 new tests for the 10 new methods + clone isolation).
