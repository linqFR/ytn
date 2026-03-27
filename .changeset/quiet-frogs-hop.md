---
"@ytn/czvo": minor
---

# Major Engine Refactor & Architecture Reorganization

- **Pico-Zod**: Unified the recursive Proxy logic into a single `bridgeZod` engine for consistent sealing and CSV pre-processing. Enforced strict Zod v4 nominal compliance while maintaining full API method chaining.
- **Architecture**: Major reorganization into domain-specific folders (`core`, `cli-engine`, `schema`, `output`, `types`). Centralized bit-router logic and internal types.
- **Public API**: Enhanced `index.ts` with explicit type exports (`OResponse`, `OHelpData`, `tsProcessedContract`). Fixed internal `Contract` import path.
- **Documentation**: Added technical cross-reference link in the main README for `pico-zod` behavior.
- **Tests**: Comprehensive suite expansion with dedicated tests for `codecs`, `dsl-conversion`, and `contract-schema` validation. Added `zvo-test-gate.ts` to streamline assertions.
