---
"@ytn/czvo": patch
---

Security, stability, and feature release:

- **Feature**: Added `allowNegative` engine option to support negatable CLI flags (e.g., `--no-verbose` sets `verbose` to `false`).
- **Stability**: Fixed positional argument mapping in the routing engine to correctly handle multi-argument signatures in complex test scenarios.
- **Security**: Hardened the `pico` API with an immutable Proxy that prevents internal mutation of Zod properties.
- **Robustness**: Enforced a 31-argument limit to prevent bitmask overflow on 32-bit signed integers in JavaScript.
- **Documentation**: Comprehensive JSDoc audit and README update covering engine options (`onlyAllowedValues`, `allowNegative`) and safety constraints.
- **Testing**: Reached 87/87 passing tests with new regression and behavioral suites.
