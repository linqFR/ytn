---
"@ytrynot/dna": patch
---

URL validation: single `new URL()` parse and granular error messages

- `dna.url()` now parses the URL exactly once per validation instead of up to three times, improving performance on URL-heavy workloads.
- Protocol and hostname constraint failures now produce distinct error messages (`Invalid protocol`, `Invalid hostname`) instead of a generic `Invalid URL`, making it easier to identify which constraint was violated.
- URL normalization (`dna.url({ normalize: true })`) no longer re-parses the URL when constraints are also present.
