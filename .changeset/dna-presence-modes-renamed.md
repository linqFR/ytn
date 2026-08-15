---
"@ytrynot/dna": patch
---

Presence-check modes renamed and documented

- `toJS` third argument renamed: `"none"` → `"hasown"`, `"partial"` → `"in-filtered"`, `"full"` → `"in-object"`.
- New documentation section in `docs/technical.md` covering the three modes, sensitive keys, compliance, and performance.
- `docs/zod-comparison.md` presence-detection section updated to reflect the three modes instead of the old global `_hop` behavior.
