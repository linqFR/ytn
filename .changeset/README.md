# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

## How to write a changeset

A changeset is a markdown file in this directory with YAML frontmatter and a description:

```markdown
---
"@ytrynot/dna": minor
---

Brief title

- What changed, in user-observable terms.
- What gained (functionality, performance, bugfix).
```

## Rules

### Frontmatter

- List the affected package(s) with the bump type: `patch`, `minor`, or `major`.
- Only packages not in the `ignore` list of `.changeset/config.json` need changesets. Check the config for the current list.

### Bump type

- **patch**: bug fix, no API change.
- **minor**: new feature or backward-compatible behavior change. Include `BREAKING CHANGE:` line if existing behavior changes.
- **major**: breaking API change (removed/renamed exports, changed signatures).

### Description

- **User-observable only**: what changed for the user, what they gained.
- **No internal mechanics**: do not mention implementation details (codegen, opcodes, internal variable names, internal helper functions, `keepOnly`, `outObT`, `Object.hasOwn`, etc.).
- **No history**: do not mention dates, "previously", "was removed", "before this change". State the current behavior.
- **Concise**: bullet points, one line each.
- If breaking, add a `BREAKING CHANGE:` line explaining what the user must change.

### Examples

Good:
```markdown
---
"@ytrynot/dna": minor
---

Object output: preserve explicitly-present `undefined` values (Zod v4 alignment)

- `dna.object()`, `dna.strictObject()`, and `dna.looseObject()` now preserve optional keys with `undefined` value when the key is present in the input, matching Zod v4.
- Object parser performance: ~3.4x faster on simple objects, ~3.7x faster on nested objects.
- `discriminatedUnion` with optional discriminator keys no longer adds an artificial `undefined` key to the output when the discriminator is absent from the input.

BREAKING CHANGE: `safeParse().data` on standard objects now includes keys with `undefined` values when those keys were present in the input. Code that relied on `undefined`-valued optional keys being stripped must check key presence rather than value truthiness.
```

Bad (internal mechanics, history, dates):
```markdown
- The `keepOnly` loop's `&& !== undefined` filter was removed on 2026-08-14.
- `useSingleAlloc = keepOnly !== undefined && !isCond && !hasDynamicProps` writes directly to `data = {}`.
- The `outObT0` temporary allocation was eliminated.
```

## Creating a changeset

```bash
npx.cmd changeset
```

Or create the file manually in `.changeset/` with a descriptive name (e.g. `object-undefined-single-alloc.md`).

## Publishing

Publishing is automated via GitHub Actions OIDC trusted publishing. See `AGENTS.md` → "Commits & Versions" for the full procedure. Never run `npm publish` or `changeset publish` locally.
