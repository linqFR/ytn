---
"@ytrynot/dna": patch
"@ytrynot/schvalid": patch
"@ytrynot/qb": patch
---

Pin Zod to ~4.4.3 to prevent the 4.5 breaking change on string length counting.

- Zod 4.5 changed `.min()`, `.max()`, and `.length()` to count Unicode code points instead of UTF-16 code units. This is a breaking change for tests that document the divergence between Zod (code units) and DNA (code points).
- All packages now pin `~4.4.3` instead of `^4.4.3` to prevent automatic upgrade to 4.5.x.
- `utf16-length.test.ts` is now version-aware: it probes Zod's counting mode at runtime and adapts assertions accordingly, so it passes on both Zod ≤4.4 (code units) and Zod ≥4.5 (code points).
