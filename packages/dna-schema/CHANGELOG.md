# @ytn/dna

## 0.1.1

### Patch Changes

- Initial release of @ytn/dna (formerly @ytn/dna-schema), a high-performance JSON Schema validation library.

  **Features:**

  - Converts JSON Schema to compact DNA bytecode for ultra-fast validation
  - Two validation modes: Validator (boolean, fail-fast) and Parser (error collection with transformation)
  - OpenAPI 3.1 discriminator support with optimized switch-based dispatch
  - Bidirectional conversion: JSON Schema ↔ DNA ↔ Zod
  - 1157 tests passing (JSON Schema 2020-12 test suite + discriminator tests)

  **Performance:**

  - Compilation: 14x faster than AJV
  - Validation (valid data): >1.15x faster than AJV Minimal
  - Generated code size: 4x smaller than AJV
  - Parser mode: 30-40% smaller standalone code with performance close to AJV minimal

  **Limitations:**

  - Only supports JSON Schema 2020-12 with internal references (no external $ref)
