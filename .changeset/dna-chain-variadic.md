---
"@ytrynot/dna": minor
---

Add `dna.chain(step0, step1, ...otherSteps)` — variadic pipe builder

- New public API to chain N schemas (≥2) into a single flat `DnaPipe`.
- Chain coherence enforced at the type level: each step's output must be assignable to the next step's input.
- `step0`/`step1` naming mirrors `dna.pipe(src, target)` for API continuity.
- `pipe` and `.pipe()` remain the canonical 2-step constructors.
