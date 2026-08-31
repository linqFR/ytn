---
"@ytrynot/dna": minor
---

ISO datetime: align with Zod 4.5 soundness fixes

- `dna.iso.datetime()` now rejects `HH:MMZ` and `HH:MM+HH:MM` formats — seconds are mandatory when a `Z` or offset qualifier is present, matching RFC 3339 and Zod 4.5.
- `dna.iso.datetime({ local: true })` still accepts `HH:MM` without seconds (no qualifier).
- `dna.iso.datetime({ local: true, offset: true })` accepts `HH:MM` only in the local (unqualified) branch; `HH:MMZ` and `HH:MM+02:00` are rejected.

BREAKING CHANGE: `dna.iso.datetime()` and `dna.iso.datetime({ offset: true })` now reject minute-precision datetimes with a `Z` or offset qualifier. Code that relied on `2022-10-13T12:52Z` being valid must use `2022-10-13T12:52:00Z` instead, or use `dna.iso.datetime({ local: true })` for unqualified local times.
