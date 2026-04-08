---
"@ytn/czvo": minor
---

# Major Refactoring of the CZVO Runtime Engine Architecture

Full refactoring of the runtime architecture toward a functional engine optimized for AOT.
Introduction of `executeRaw` for live contract execution and `execWithFile` for dynamic AOT loading.
Universal command dispatching via `launchCzvo`.
Migration of core logic to `src/core.ts` and removal of legacy abstractions and obsolete utilities.
Stabilization of the type system to support generic launchers.
