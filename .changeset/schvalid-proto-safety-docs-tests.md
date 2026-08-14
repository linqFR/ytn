---
"@ytrynot/schvalid": patch
---

`__proto__` safety: documentation and empirical test coverage

- `docs/ajv-comparison.md`: added a dedicated `__proto__` safety section comparing AJV's `allSchemaProperties()` filter approach with schvalid's `Object.create(null)` architectural approach. Documents that AJV filters `__proto__` from schema properties (cannot validate it as a declared property) while schvalid preserves and validates it with zero runtime overhead (codegen-time `hasProtoDeclared` check in DNA).
- `tests/schemas/proto-safety.test.ts`: new 8-test suite verifying empirically that `Object.prototype` is not polluted after parsing malicious `JSON.parse` inputs containing `__proto__` keys. Covers parser mode, validator mode, fast mode, nested `__proto__`, array items, strict `additionalProperties: false`, and null-prototype output verification.
