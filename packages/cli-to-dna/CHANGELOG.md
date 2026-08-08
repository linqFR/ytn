# @ytrynot/cdna

## 0.2.1

### Patch Changes

- a6a381d: Add `repository`, `bugs`, and `homepage` fields to package.json. Fix GitHub URLs to point to `linqFR/ytn` (was `linqFR/ytrynot` in cli-to-zvo).

## 0.2.0

### Minor Changes

- 6abc226: Initial 0.2.0 release of the Command Line Interface to DNA (CDNA) package.

  - Introduces the `pico` DSL for concise, DNA-based CLI contract definitions.
  - Adds contract runtime (`contract.ts`), command execution (`execute.ts`) and DSL union support.
  - Exposes `index.ts` and `./min` entry points built with tsdown.
  - Adds test coverage for basic contracts, pico DSL and DSL unions.
