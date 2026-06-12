# Zod V4 Test Suite Evaluation for DNA Schema

**Date**: 2026-05-31  
**Purpose**: Evaluation of Zod V4 test suite for DNA schema compatibility  
**Source**: `node_modules/zod/src/v4/classic/tests` (79 test files)  
**Target**: `packages/dna-schema/tests/zod-test-suite` (39 files)

## Important Note on Test Format

The tests in `packages/dna-schema/tests/zod-test-suite` are **NOT direct copies** of Zod V4 tests. They are specifically formatted for the Zod→DNA conversion system:

- **Zod V4 format**: Uses `test()`, `describe()`, `expect()` from vitest
- **DNA test format**: Exports arrays of test groups with structure:
  ```typescript
  export const xxxTests = [
    {
      description: string,
      schema: z.Schema,
      tests: [
        { description: string, data: any, valid: boolean }
      ]
    }
  ]
  ```

The `zod-suite.test.ts` runner converts Zod schemas to DNA, then validates that DNA produces the same results as Zod. Therefore, the test files must follow the DNA-specific format, not the Zod V4 vitest format.

## Executive Summary

- **Total Zod V4 tests**: 79 files
- **DNA test suite files**: 39 files (custom format for Zod→DNA conversion)
- **Coverage assessment**: The DNA test suite covers core Zod types relevant to DNA conversion

---

## Test File Evaluation Matrix

### ✅ CRITICAL - HIGH PRIORITY (Must Have)

These tests are essential for DNA schema validation and type system correctness.

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`refine.test.ts`](../../../node_modules/zod/src/v4/classic/tests/refine.test.ts) | ❌ NEEDS DNA FORMAT | **CRITICAL** | Refinements are core to Zod validation; DNA must support custom validation logic - needs DNA-formatted tests |
| [`transform.test.ts`](../../../node_modules/zod/src/v4/classic/tests/transform.test.ts) | ❌ NEEDS DNA FORMAT | **CRITICAL** | Transformations are essential for data conversion; DNA needs transform opcode support - needs DNA-formatted tests |
| [`optional.test.ts`](../../../node_modules/zod/src/v4/classic/tests/optional.test.ts) | ❌ NEEDS DNA FORMAT | **CRITICAL** | Optional fields are fundamental to object schemas; DNA must handle optin/optout correctly - needs DNA-formatted tests |
| [`partial.test.ts`](../../../node_modules/zod/src/v4/classic/tests/partial.test.ts) | ❌ NEEDS DNA FORMAT | **CRITICAL** | Partial/required modifiers are essential for object manipulation - needs DNA-formatted tests |
| [`union.test.ts`](../../../node_modules/zod/src/v4/classic/tests/union.test.ts) | ✅ PRESENT | **CRITICAL** | Union types map to DNA `anyOf` opcode |
| [`intersection.test.ts`](../../../node_modules/zod/src/v4/classic/tests/intersection.test.ts) | ✅ PRESENT | **CRITICAL** | Intersection maps to DNA `allOf` opcode |
| [`discriminated-unions.test.ts`](../../../node_modules/zod/src/v4/classic/tests/discriminated-unions.test.ts) | ✅ PRESENT | **CRITICAL** | Discriminated unions map to DNA `discriminator` opcode |
| [`record.test.ts`](../../../node_modules/zod/src/v4/classic/tests/record.test.ts) | ✅ PRESENT | **CRITICAL** | Record maps to DNA `additionalProperties`/`patternProperties` |
| [`lazy.test.ts`](../../../node_modules/zod/src/v4/classic/tests/lazy.test.ts) | ✅ PRESENT | **CRITICAL** | Lazy schemas enable recursive type definitions |
| [`object.test.ts`](../../../node_modules/zod/src/v4/classic/tests/object.test.ts) | ✅ PRESENT | **CRITICAL** | Object schemas are the backbone of data structures |
| [`array.test.ts`](../../../node_modules/zod/src/v4/classic/tests/array.test.ts) | ✅ PRESENT | **CRITICAL** | Array validation is fundamental |
| [`tuple.test.ts`](../../../node_modules/zod/src/v4/classic/tests/tuple.test.ts) | ✅ PRESENT | **CRITICAL** | Tuples require fixed-length validation |
| [`enum.test.ts`](../../../node_modules/zod/src/v4/classic/tests/enum.test.ts) | ✅ PRESENT | **CRITICAL** | Enums map to DNA enum constraints |
| [`literal.test.ts`](../../../node_modules/zod/src/v4/classic/tests/literal.test.ts) | ✅ PRESENT | **CRITICAL** | Literals are building blocks for complex types |

### ⚠️ IMPORTANT - MEDIUM PRIORITY (Should Have)

These tests cover important edge cases and advanced features.

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`template-literal.test.ts`](../../../node_modules/zod/src/v4/classic/tests/template-literal.test.ts) | ❌ NEEDS DNA FORMAT | **HIGH** | Template literals create complex string patterns; DNA should support them - needs DNA-formatted tests |
| [`readonly.test.ts`](../../../node_modules/zod/src/v4/classic/tests/readonly.test.ts) | ❌ NEEDS DNA FORMAT | **HIGH** | Readonly is important for immutability guarantees in DNA schemas - needs DNA-formatted tests |
| [`pickomit.test.ts`](../../../node_modules/zod/src/v4/classic/tests/pickomit.test.ts) | ❌ NEEDS DNA FORMAT | **HIGH** | Pick/omit are essential for schema manipulation and composition - needs DNA-formatted tests |
| [`recursive-types.test.ts`](../../../node_modules/zod/src/v4/classic/tests/recursive-types.test.ts) | ❌ NEEDS DNA FORMAT | **HIGH** | Recursive types are essential for complex data structures; DNA must support them - needs DNA-formatted tests |
| [`error.test.ts`](../../../node_modules/zod/src/v4/classic/tests/error.test.ts) | ❌ NEEDS DNA FORMAT | **HIGH** | Error handling is critical for DNA to provide meaningful validation feedback - needs DNA-formatted tests |
| [`error-utils.test.ts`](../../../node_modules/zod/src/v4/classic/tests/error-utils.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | Error utilities are Zod-specific |
| [`default.test.ts`](../../../node_modules/zod/src/v4/classic/tests/default.test.ts) | ✅ PRESENT | **MEDIUM** | Default values are useful but not core to DNA |
| [`nullable.test.ts`](../../../node_modules/zod/src/v4/classic/tests/nullable.test.ts) | ✅ PRESENT | **CRITICAL** | Nullable is fundamental to type systems |
| [`nonoptional.test.ts`](../../../node_modules/zod/src/v4/classic/tests/nonoptional.test.ts) | ✅ PRESENT | **MEDIUM** | Nonoptional is the inverse of optional |
| [`coalesce.test.ts`](../../../node_modules/zod/src/v4/classic/tests/coalesce.test.ts) | ✅ PRESENT | **LOW** | Coalesce is a utility method |
| [`catch.test.ts`](../../../node_modules/zod/src/v4/classic/tests/catch.test.ts) | ✅ PRESENT | **MEDIUM** | Catch is similar to default with error handling |

### 🔧 INFRASTRUCTURE - LOW PRIORITY (Nice to Have)

These tests are Zod-internal or implementation-specific.

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`assignability.test.ts`](../../../node_modules/zod/src/v4/classic/tests/assignability.test.ts) | ❌ NOT RELEVANT | **LOW** | TypeScript type assignability is compile-time only |
| [`async-parsing.test.ts`](../../../node_modules/zod/src/v4/classic/tests/async-parsing.test.ts) | ❌ NOT RELEVANT | **LOW** | DNA is synchronous; async parsing is not relevant |
| [`async-refinements.test.ts`](../../../node_modules/zod/src/v4/classic/tests/async-refinements.test.ts) | ❌ NOT RELEVANT | **LOW** | DNA is synchronous; async refinements not applicable |
| [`continuability.test.ts`](../../../node_modules/zod/src/v4/classic/tests/continuability.test.ts) | ❌ NOT RELEVANT | **LOW** | Continuation is Zod-specific error handling |
| [`detached-methods.test.ts`](../../../node_modules/zod/src/v4/classic/tests/detached-methods.test.ts) | ❌ NOT RELEVANT | **LOW** | Detached methods are Zod-specific API |
| [`firstparty.test.ts`](../../../node_modules/zod/src/v4/classic/tests/firstparty.test.ts) | ❌ NOT RELEVANT | **LOW** | First-party schemas are Zod-specific |
| [`generics.test.ts`](../../../node_modules/zod/src/v4/classic/tests/generics.test.ts) | ❌ NOT RELEVANT | **LOW** | Generics are TypeScript compile-time |
| [`global-config.test.ts`](../../../node_modules/zod/src/v4/classic/tests/global-config.test.ts) | ❌ NOT RELEVANT | **LOW** | Global config is Zod-specific |
| [`hash.test.ts`](../../../node_modules/zod/src/v4/classic/tests/hash.test.ts) | ❌ NOT RELEVANT | **LOW** | Hashing is Zod-specific |
| [`index.test.ts`](../../../node_modules/zod/src/v4/classic/tests/index.test.ts) | ❌ PARTIALLY RELEVANT - NEEDS DNA FORMAT | **MEDIUM** | expect() tests are relevant for parsing/validation; expectTypeOf() tests are compile-time only |
| [`jitless-allows-eval.test.ts`](../../../node_modules/zod/src/v4/classic/tests/jitless-allows-eval.test.ts) | ❌ NOT RELEVANT | **LOW** | JIT compilation is Zod-specific |
| [`prototypes.test.ts`](../../../node_modules/zod/src/v4/classic/tests/prototypes.test.ts) | ❌ NOT RELEVANT | **LOW** | Prototype tests are Zod-specific |
| [`registries.test.ts`](../../../node_modules/zod/src/v4/classic/tests/registries.test.ts) | ❌ PARTIALLY RELEVANT | **MEDIUM** | Registry metadata is now transferred to DNA via extractDescription(); globalRegistry tests are relevant |
| [`standard-schema.test.ts`](../../../node_modules/zod/src/v4/classic/tests/standard-schema.test.ts) | ❌ NOT RELEVANT | **MEDIUM** | Standard Schema is a cross-library standard; may be relevant for DNA |
| [`validations.test.ts`](../../../node_modules/zod/src/v4/classic/tests/validations.test.ts) | ❌ NOT RELEVANT | **MEDIUM** | Built-in validations are covered by individual type tests |
| [`void.test.ts`](../../../node_modules/zod/src/v4/classic/tests/void.test.ts) | ❌ NEEDS DNA FORMAT - NEEDS DNA FORMAT| **LOW** | Void is rarely used in data schemas BUT NEEDED|
| [`base.test.ts`](../../../node_modules/zod/src/v4/classic/tests/base.test.ts) | ❌ NOT RELEVANT | **LOW** | Base tests are Zod-specific |
| [`fix-json-issue.test.ts`](../../../node_modules/zod/src/v4/classic/tests/fix-json-issue.test.ts) | ❌ NOT RELEVANT | **LOW** | Issue-specific fix test |
| [`describe-meta-checks.test.ts`](../../../node_modules/zod/src/v4/classic/tests/describe-meta-checks.test.ts) | ❌ RELEVANT - NEEDS DNA FORMAT | **LOW** | Tests Zod's globalRegistry mechanism; DNA has meta support but would test it in conversion tests |

### 🌐 CONVERSION - CONTEXT DEPENDENT (Evaluate Separately)

These tests are for JSON Schema conversion, which may be relevant depending on DNA's goals.

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`from-json-schema.test.ts`](../../../node_modules/zod/src/v4/classic/tests/from-json-schema.test.ts) | ❌ NOT RELEVANT | **LOW** | JSON Schema conversion is Zod-specific |
| [`to-json-schema.test.ts`](../../../node_modules/zod/src/v4/classic/tests/to-json-schema.test.ts) | ❌ NOT RELEVANT | **LOW** | JSON Schema conversion is Zod-specific |
| [`to-json-schema-methods.test.ts`](../../../node_modules/zod/src/v4/classic/tests/to-json-schema-methods.test.ts) | ❌ NOT RELEVANT | **LOW** | JSON Schema conversion is Zod-specific |

### 📝 LOCALIZATION - LOW PRIORITY

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`locales_ka.test.ts`](../../../node_modules/zod/src/v4/classic/tests/locales_ka.test.ts) | ❌ NOT RELEVANT | **LOW** | Localization is Zod-specific |
| [`locales_ro.test.ts`](../../../node_modules/zod/src/v4/classic/tests/locales_ro.test.ts) | ❌ NOT RELEVANT | **LOW** | Localization is Zod-specific |

### 🔤 STRING FORMATS - MEDIUM PRIORITY

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`string-formats.test.ts`](../../../node_modules/zod/src/v4/classic/tests/string-formats.test.ts) | ❌ NEEDS DNA FORMAT | **MEDIUM** | String formats are covered in `string.test.ts` but may need additional tests |
| [`stringbool.test.ts`](../../../node_modules/zod/src/v4/classic/tests/stringbool.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | String/bool conversion is edge case |

### 🛠️ UTILITY METHODS - LOW PRIORITY

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`apply.test.ts`](../../../node_modules/zod/src/v4/classic/tests/apply.test.ts) | ✅ PRESENT | **LOW** | Apply is a Zod-specific utility |
| [`coerce.test.ts`](../../../node_modules/zod/src/v4/classic/tests/coerce.test.ts) | ✅ PRESENT | **MEDIUM** | Coercion is useful for data normalization |
| [`custom.test.ts`](../../../node_modules/zod/src/v4/classic/tests/custom.test.ts) | ✅ PRESENT | **MEDIUM** | Custom schemas are flexible but may not serialize well |
| [`description.test.ts`](../../../node_modules/zod/src/v4/classic/tests/description.test.ts) | ✅ PRESENT | **LOW** | Description is metadata-only |
| [`prefault.test.ts`](../../../node_modules/zod/src/v4/classic/tests/prefault.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | Prefault is a Zod-specific variant |
| [`preprocess.test.ts`](../../../node_modules/zod/src/v4/classic/tests/preprocess.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | Preprocessing is Zod-specific |
| [`preprocess-types.test.ts`](../../../node_modules/zod/src/v4/classic/tests/preprocess-types.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | Preprocess type tests are Zod-specific |

### 🧪 TYPE-SPECIFIC TESTS - EVALUATED INDIVIDUALLY

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`anyunknown.test.ts`](../../../node_modules/zod/src/v4/classic/tests/anyunknown.test.ts) | ❌ NEEDS DNA FORMAT | **MEDIUM** | Split into `any.ts` and `unknown.ts` in DNA |
| [`bigint.test.ts`](../../../node_modules/zod/src/v4/classic/tests/bigint.test.ts) | ✅ PRESENT | **MEDIUM** | BigInt is not JSON-serializable |
| [`boolean.test.ts`](../../../node_modules/zod/src/v4/classic/tests/boolean.test.ts) | ✅ PRESENT | **CRITICAL** | Boolean is fundamental |
| [`brand.test.ts`](../../../node_modules/zod/src/v4/classic/tests/brand.test.ts) | ✅ PRESENT | **LOW** | Branding is TypeScript-specific |
| [`date.test.ts`](../../../node_modules/zod/src/v4/classic/tests/date.test.ts) | ✅ PRESENT | **MEDIUM** | Date is not JSON-serializable |
| [`datetime.test.ts`](../../../node_modules/zod/src/v4/classic/tests/datetime.test.ts) | ✅ PRESENT | **MEDIUM** | DateTime is ISO string in JSON |
| [`file.test.ts`](../../../node_modules/zod/src/v4/classic/tests/file.test.ts) | ✅ PRESENT | **LOW** | File is browser-specific |
| [`function.test.ts`](../../../node_modules/zod/src/v4/classic/tests/function.test.ts) | ✅ PRESENT | **LOW** | Functions are not serializable |
| [`instanceof.test.ts`](../../../node_modules/zod/src/v4/classic/tests/instanceof.test.ts) | ✅ PRESENT | **LOW** | Instanceof is runtime-specific |
| [`json.test.ts`](../../../node_modules/zod/src/v4/classic/tests/json.test.ts) | ✅ PRESENT | **MEDIUM** | JSON parsing is useful |
| [`map.test.ts`](../../../node_modules/zod/src/v4/classic/tests/map.test.ts) | ✅ PRESENT | **LOW** | Map is not JSON-serializable |
| [`nan.test.ts`](../../../node_modules/zod/src/v4/classic/tests/nan.test.ts) | ✅ PRESENT | **LOW** | NaN is an edge case |
| [`nested-refine.test.ts`](../../../node_modules/zod/src/v4/classic/tests/nested-refine.test.ts) | ✅ PRESENT | **HIGH** | Nested refinements are important |
| [`number.test.ts`](../../../node_modules/zod/src/v4/classic/tests/number.test.ts) | ✅ PRESENT | **CRITICAL** | Number is fundamental |
| [`promise.test.ts`](../../../node_modules/zod/src/v4/classic/tests/promise.test.ts) | ✅ PRESENT | **LOW** | Promise is not serializable |
| [`set.test.ts`](../../../node_modules/zod/src/v4/classic/tests/set.test.ts) | ✅ PRESENT | **LOW** | Set is not JSON-serializable |
| [`special-types.test.ts`](../../../node_modules/zod/src/v4/classic/tests/special-types.test.ts) | ✅ PRESENT | **MEDIUM** | Special types are edge cases |
| [`string.test.ts`](../../../node_modules/zod/src/v4/classic/tests/string.test.ts) | ✅ PRESENT | **CRITICAL** | String is fundamental |
| [`url.test.ts`](../../../node_modules/zod/src/v4/classic/tests/url.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | URL validation is covered in string formats |

### 🎭 CODEC TESTS - CONTEXT DEPENDENT

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`codec.test.ts`](../../../node_modules/zod/src/v4/classic/tests/codec.test.ts) | ✅ PRESENT | **CONTEXT** | Codec is Zod-specific encoding/decoding |
| [`codec-examples.test.ts`](../../../node_modules/zod/src/v4/classic/tests/codec-examples.test.ts) | ❌ NEEDS DNA FORMAT | **LOW** | Examples are not test cases |

### 📊 COMPREHENSIVE TESTS - HIGH VALUE

| Test File | Status | Relevance | Justification |
|-----------|--------|----------|---------------|
| [`string.test.ts`](../../../node_modules/zod/src/v4/classic/tests/string.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Partial coverage - NEEDS DNA FORMAT 20+ format validators |
| [`number.test.ts`](../../../node_modules/zod/src/v4/classic/tests/number.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Comprehensive - DNA has more tests than Zod V4 |
| [`object.test.ts`](../../../node_modules/zod/src/v4/classic/tests/object.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Comprehensive - DNA has more tests than Zod V4 |
| [`array.test.ts`](../../../node_modules/zod/src/v4/classic/tests/array.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Partial coverage - needs verification |
| [`record.test.ts`](../../../node_modules/zod/src/v4/classic/tests/record.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Partial coverage - needs verification |
| [`tuple.test.ts`](../../../node_modules/zod/src/v4/classic/tests/tuple.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Partial coverage - needs verification |
| [`enum.test.ts`](../../../node_modules/zod/src/v4/classic/tests/enum.test.ts) (Zod) | ✅ PRESENT (DNA) | **CRITICAL** | Partial coverage - needs verification |

---

## Existing DNA Test Files - Modifications Needed

### Files Requiring Expansion (HIGH Priority)

1. **[string.ts](../tests/zod-test-suite/string.ts)** - NEEDS DNA FORMAT 20+ format validators (url, datetime, regex, ip, cuid, base64, etc.)
2. **[array.ts](../tests/zod-test-suite/array.ts)** - May need more tests for length constraints, item validation, nested arrays
3. **[tuple.ts](../tests/zod-test-suite/tuple.ts)** - May need more tests for length validation, rest elements, optional positions
4. **[union.ts](../tests/zod-test-suite/union.ts)** - Critical for DNA (`anyOf` opcode); verify comprehensive coverage
5. **[intersection.ts](../tests/zod-test-suite/intersection.ts)** - Critical for DNA (`allOf` opcode); verify comprehensive coverage
6. **[discriminated-union.ts](../tests/zod-test-suite/discriminated-union.ts)** - Critical for DNA (`discriminator` opcode); verify comprehensive coverage
7. **[record.ts](../tests/zod-test-suite/record.ts)** - Critical for DNA (`additionalProperties`/`patternProperties`); verify comprehensive coverage
8. **[enum.ts](../tests/zod-test-suite/enum.ts)** - May need more tests for native enums, value extraction

### Files Already Comprehensive

- [number.ts](../tests/zod-test-suite/number.ts) (DNA has more tests than Zod V4)
- [object.ts](../tests/zod-test-suite/object.ts) (DNA has more tests than Zod V4)
- [lazy.ts](../tests/zod-test-suite/lazy.ts) (DNA has more tests than Zod V4)
- [literal.ts](../tests/zod-test-suite/literal.ts) (DNA has more tests than Zod V4)

---

## Appendix: Complete Test File List

### Zod V4 Test Files (79)

1. anyunknown.test.ts
2. apply.test.ts
3. array.test.ts
4. assignability.test.ts
5. async-parsing.test.ts
6. async-refinements.test.ts
7. base.test.ts
8. bigint.test.ts
9. brand.test.ts
10. catch.test.ts
11. coalesce.test.ts
12. codec-examples.test.ts
13. codec.test.ts
14. coerce.test.ts
15. continuability.test.ts
16. custom.test.ts
17. date.test.ts
18. datetime.test.ts
19. default.test.ts
20. describe-meta-checks.test.ts
21. description.test.ts
22. detached-methods.test.ts
23. discriminated-unions.test.ts
24. enum.test.ts
25. error-utils.test.ts
26. error.test.ts
27. file.test.ts
28. firstparty.test.ts
29. fix-json-issue.test.ts
30. from-json-schema.test.ts
31. function.test.ts
32. generics.test.ts
33. global-config.test.ts
34. hash.test.ts
35. index.test.ts
36. instanceof.test.ts
37. intersection.test.ts
38. jitless-allows-eval.test.ts
39. json.test.ts
40. lazy.test.ts
41. literal.test.ts
42. locales_ka.test.ts
43. locales_ro.test.ts
44. map.test.ts
45. nan.test.ts
46. nested-refine.test.ts
47. nonoptional.test.ts
48. nullable.test.ts
49. number.test.ts
50. object.test.ts
51. optional.test.ts
52. partial.test.ts
53. pickomit.test.ts
54. pipe.test.ts
55. prefault.test.ts
56. preprocess-types.test.ts
57. preprocess.test.ts
58. primitive.test.ts
59. promise.test.ts
60. prototypes.test.ts
61. readonly.test.ts
62. record.test.ts
63. recursive-types.test.ts
64. refine.test.ts
65. registries.test.ts
66. set.test.ts
67. standard-schema.test.ts
68. string-formats.test.ts
69. string.test.ts
70. stringbool.test.ts
71. template-literal.test.ts
72. to-json-schema-methods.test.ts
73. to-json-schema.test.ts
74. transform.test.ts
75. tuple.test.ts
76. union.test.ts
77. url.test.ts
78. validations.test.ts
79. void.test.ts

### DNA Schema Test Files (39)

1. any.ts
2. apply.ts
3. array.ts
4. bigint.ts
5. boolean.ts
6. brand.ts
7. catch.ts
8. coalesce.ts
9. codec.ts
10. coerce.ts
11. custom.ts
12. date.ts
13. datetime.ts
14. default.ts
15. description.ts
16. discriminated-union.ts
17. enum.ts
18. file.ts
19. function.ts
20. instanceof.ts
21. intersection.ts
22. json.ts
23. lazy.ts
24. literal.ts
25. map.ts
26. nan.ts
27. nested-refine.ts
28. nonoptional.ts
29. nullable.ts
30. number.ts
31. object.ts
32. promise.ts
33. record.ts
34. set.ts
35. special-types.ts
36. string.ts
37. tuple.ts
38. union.ts
39. unknown.ts
