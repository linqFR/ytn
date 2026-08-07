---
"@ytn/dna": minor
"@ytn/schvalid": patch
---

Normalize externals mechanism: registry typed as `Map<string, unknown>`, rename `jose` external to `jwtFn` (injects `jose.decodeProtectedHeader` directly), align code with documented contract. Move `zod` from peerDependencies to devDependencies in schvalid (used only for benchmarks).
