---
"@ytrynot/dna": minor
---

Compact JSON Schema output for unions, nullable, and intersections

- `dna.union()` of naked primitives (no constraints, no wrappers, no refinements) now emits `type: ["string", "number", ...]` instead of `anyOf: [...]` from `toJSONSchema()`, matching Zod 4.5's compact form.
- `dna.string().nullable()` (and other naked primitive nullables) now emits `type: ["string", "null"]` instead of `anyOf: [{type: "string"}, {type: "null"}]`.
- `dna.intersection()` of two objects now emits a single merged `type: "object"` schema instead of `allOf: [...]`, avoiding the `allOf` + `additionalProperties: false` trap that made valid intersections unvalidatable.
- Unions with constraints, wrappers, refinements, or non-primitive members still emit `anyOf` — only naked primitive unions are compacted.

BREAKING CHANGE: `toJSONSchema()` output for naked primitive unions, naked nullable primitives, and object intersections now uses Zod 4.5's compact forms (`type: [...]` and merged objects) instead of `anyOf`/`allOf`. Consumers that compared DNA's JSON Schema output structurally against the previous `anyOf`/`allOf` forms must update their comparisons.
