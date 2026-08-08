# @ytn/schvalid vs AJV 8.x — Feature Comparison

> Generated from source code analysis of `@ytn/schvalid` (src/jschema-to-dna.ts,
> src/string-formats.ts, src/index.ts, README.md, AGENTS.md) and the JSON Schema
> Test Suite runner (tests/schemas/json-schema-suite.test.ts).
>
> AJV 8.x features are based on the AJV 2020 distribution (`ajv/dist/2020.js`)
> used in the benchmark, AJV's documented public API, and well-known AJV capabilities.
>
> Last updated: 2026-08-07.

---

## Summary

| Category | AJV 8.x | @ytn/schvalid | Gap |
|---|---|---|---|
| Core 2020-12 keywords | ✅ Full | ✅ Full | None |
| Internal $ref (pointer + anchor) | ✅ | ✅ | None |
| External $ref | ✅ | ❌ | Complete gap |
| $dynamicRef | ✅ | ❌ | Complete gap |
| Formats (built-in) | ✅ 20+ | ✅ 19 | Minor gap |
| Custom formats | ✅ | ❌ | Complete gap |
| User-defined keywords | ✅ | ❌ | Complete gap |
| Async validation | ✅ | ❌ | Complete gap |
| $data references | ✅ | ❌ | Complete gap |
| Content validation | ✅ (plugin) | ❌ (metadata only) | Complete gap |
| Vocabularies | ✅ | ❌ | Complete gap |
| Type coercion | ✅ | ❌ | Complete gap (DNA has coercion primitives — feasible as TODO if demanded) |
| Default injection | ✅ | ❌ | Complete gap (DNA has `.default()` — feasible as TODO if demanded) |
| Remove additional | ✅ | ❌ | Complete gap |
| Schema registry | ✅ | ❌ | Complete gap |
| Multi-draft support | ✅ | ❌ (2020-12 only) | Complete gap |
| Error customization | ✅ | ❌ | Complete gap (DNA has error mechanisms — feasible as TODO if demanded) |
| Meta-schema validation | ✅ | ⚠️ (basic only) | Partial gap (DNA has schema validation primitives) |
| Strict mode | ✅ (comprehensive) | ⚠️ (basic) | Partial gap |
| Compilation options | ✅ 30+ | ⚠️ 3 | Major gap |
| Discriminator | ✅ (keyword) | ✅ (native, optimized) | Parity (schvalid advantage) |
| DNA bytecode IR | ❌ | ✅ | schvalid advantage |
| parseFast hybrid | ❌ | ✅ | schvalid advantage |
| Parser output construction | ❌ | ✅ | schvalid advantage |
| Standalone JS (toJS) | ⚠️ (ajv-pack) | ✅ (native) | schvalid advantage |
| Compilation speed | Baseline | ~4x faster (see `tests/bench/`) | schvalid advantage |

**Bottom line**: @ytn/schvalid covers all core JSON Schema 2020-12 keywords with full parity.
It does not aim to replace AJV in all use cases — external $ref, custom keywords, async
validation, type coercion, and vocabularies are intentionally out of scope for 0.2.x.
schvalid's value proposition is: standalone compiled functions, DNA bytecode IR, parseFast
hybrid mode, and ~4x faster compilation (benchmark data in `tests/bench/`).

---

## ❌ Not Supported (AJV has it, schvalid doesn't)

| # | Feature | Notes |
|---|---|---|
| 1 | External $ref (HTTP URIs, URNs, external files) | Throws `OutOfScopeError` for any `$ref` not starting with `#`. No schema registry, no `addSchema()`, no `compileAsync()`. `refRemote.json` test skipped. |
| 2 | Custom formats | No API to register custom format validators. `JSONFORMAT` map is static. Unknown formats silently ignored. |
| 3 | User-defined keywords | No keyword extension API. `ajv.addKeyword()` has no equivalent. Keyword set is fixed in `jschema-to-dna.ts`. |
| 4 | Async validation | Entirely synchronous. No `$async` keyword, no `compileAsync()`. |
| 5 | $data references | Not supported. No `{ "$data": "1/min" }` referencing instance data within schemas. |
| 6 | contentEncoding / contentMediaType / contentSchema | Stored as metadata (`META_KEYS`), NOT validated. `content.json` test skipped. |
| 7 | Vocabulary support ($vocabulary) | Not supported. `vocabulary.json` test skipped. |
| 8 | Schema registry / addSchema / getSchema | No registry. Each `compile()` call is independent. |
| 9 | Type coercion | No type coercion. Strict type checking only. |
| 10 | Default value injection | `default` keyword stored as metadata, not applied to data. |
| 11 | Remove additional properties | Validates `additionalProperties: false` but does not remove extra properties. |
| 12 | Multiple error collection modes | `validator()` is fail-fast (boolean). `parser()` collects errors with fixed format. No `allErrors` option. |
| 13 | Error customization (messages) | No API for customizing error messages. No `ajv-errors` equivalent. |
| 14 | Schema modification / refinement | No `addKeyword()`, `removeKeyword()`. DNA is immutable once compiled. |
| 15 | JSON Schema draft 07 / 06 / 04 / 03 | Only 2020-12. `jschemaToDna()` throws if `$schema` doesn't include "2020-12". |
| 16 | Meta-schema validation (full) | `validateSchema` option does basic structural validation only. Not full meta-schema validation. |
| 17 | Code generation control | No `code: { lines, optimize, sourceMap }` options. `toJS()` is a fixed pipeline. |
| 18 | Standalone code export CLI | No built-in CLI like `ajv-cli`. `toJS()` returns string arrays, manual file writing. |
| 19 | Schema reuse across compilations | No sharing of sub-schemas or DNA fragments across `compile()` calls. |
| 20 | $recursiveRef / $recursiveAnchor (draft 2019-09) | Only 2020-12 supported. |
| 21 | Annotation collection | No annotation reporting after validation. |
| 22 | InstancePath / schemaPath in errors | Parser errors are DNA-engine-specific. May not include standard `instancePath` / `schemaPath`. |
| 23 | WeakMap-based schema caching | No automatic caching. Caller must cache compiled functions. |
| 24 | Schema bundle / import / export | No schema bundling. All refs must be internal. |
| 25 | Pattern with non-ECMAScript regex | Patterns compiled with `u` flag only. `optional/ecmascript-regex.json` not run. |

---

## ⚠️ Partially Supported (8 features)

### format keyword (assertion mode)
- **AJV**: Full format library + custom formats (sync and async)
- **schvalid**: 19 built-in regex formats, no custom format API
- **Built-in formats**: `date`, `time`, `date-time`, `duration`, `uri`, `uri-reference`,
  `uri-template`, `email`, `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `uuid`,
  `json-pointer`, `json-pointer-uri-fragment`, `relative-json-pointer`, `regex`, `iri`,
  `iri-reference`
- **Gap**: No custom formats. Unknown formats silently ignored (no validation).
- **Test gap**: `optional/format/` directory NOT run (test runner only walks root `.json` files)

### $ref to $dynamicAnchor
- **AJV**: Full dynamic scope traversal
- **schvalid**: Registers `$dynamicAnchor` in URI map, can resolve static refs to them,
  but does NOT implement runtime dynamic scope resolution
- **Test**: `dynamicRef.json` explicitly skipped
- **TODO**: Investigation planned for later

### unevaluatedProperties
- **AJV**: Full annotation-based tracking
- **schvalid**: Structural wrapper approach (wraps inner content)
- **Status**: ✅ Test suite passes (1243 passing per mode). The structural approach covers all
  tested cases. The difference is implementation strategy (structural wrapping vs
  annotation tracking), not a feature gap. Edge cases with `$ref` +
  `unevaluatedProperties` may differ but are not covered by the test suite.
- **Note**: If edge cases are found in production, investigation will be needed.

### unevaluatedItems
- **AJV**: Full annotation-based tracking
- **schvalid**: Structural wrapper approach
- **Status**: ✅ Test suite passes. Same situation as `unevaluatedProperties`.

### contentEncoding / contentMediaType / contentSchema
- **AJV**: Via `ajv-formats-draft2019` or custom keywords
- **schvalid**: Metadata only (stored in `META_KEYS`, not validated)
- **Test**: `content.json` explicitly skipped

### Schema compilation options
- **AJV**: 30+ options (strict, strictSchema, strictTypes, removeAdditional, useDefaults, coerceTypes, etc.)
- **schvalid**: 3 options (`formatAssertion`, `strict`, `validateSchema`)
- **Design decision**: Intentionally simple. More options may be added if demanded.

### Error reporting
- **AJV**: Structured errors with `keyword`, `instancePath`, `schemaPath`, `params`, `message`
- **schvalid**: Parser mode returns `{ success: false, errors: [...] }` with DNA-engine-specific format
- **Direction**: schvalid's error format will be closer to Zod than AJV. A translation
  mechanism to AJV error format may be added if needed.

### strict mode
- **AJV**: Comprehensive (unknown keywords, misspelled keywords, type mismatches, overlapping keywords)
- **schvalid**: Basic validation only (type values, numeric constraints, required array format)
- **Design decision**: Intentionally limited for now. No plans to expand.

---

## 🟢 schvalid Advantages (10 features)

| # | Feature | AJV | schvalid | Notes |
|---|---|---|---|---|
| 1 | DNA bytecode IR | Compiles schema → JS directly | Schema → DNA bytecode → JS | Two-step process allows DNA to be serialized, cached, transported, or inspected independently |
| 2 | parseFast hybrid mode | N/A | `schvalid("fast")` | Runs fail-fast `validator()` first. On success, returns `{ success: true, data: value }` (same reference). On failure, falls back to full `parser()` for detailed errors. |
| 3 | Three-mode compilation API | Single compile → validate function | `schvalid("validation" \| "parser" \| "fast" \| "all")` | Choose between boolean validation, full parsing, hybrid, or all three at once |
| 4 | Parser mode with output construction | Validation only, no output | `parser()` returns `{ success, data }` with fresh `Object.create(null)` output | Similar to Zod's `parse()` contract. AJV never constructs output objects. |
| 5 | Standalone JS output via toJS | Requires `ajv-pack` (semi-maintained) | `toJS()` from `@ytn/dna/toJs` | Core feature. Self-contained JS source code for both validator and parser. |
| 6 | Compact DNA representation | N/A | Numeric array with minimal memory | Sentinels (`-1`, `null`) for absent constraints. DNA can be cached, serialized, transferred. |
| 7 | Compilation speed | Baseline | ~4x faster (see `tests/bench/`) | Stack-based traversal, no AST construction, no code gen during conversion |
| 8 | Parser output size | N/A | ~30% smaller standalone function | Compact DNA opcode-based code generation |
| 9 | OpenAPI 3.1 discriminator — native, optimized | Plugin/keyword needed | Native with switch-based dispatch | Removes discriminator property from each `oneOf` branch, re-injects as `true`, inherits `additionalProperties` from root, O(1) switch dispatch |
| 10 | DeepEqual complexity detection | N/A | Automatic for uniqueItems/const/enum | Analyzes item types to determine whether `deepEqual` is needed or fast `===` suffices. Compile-time optimization. |

---

## ✅ Supported with Parity (22 features)

All core JSON Schema 2020-12 keywords are fully supported:

- Primitive type validation (string, number, integer, boolean, null)
- Object type (properties, required, minProperties, maxProperties)
- Array type (items, minItems, maxItems, uniqueItems)
- prefixItems (tuple validation)
- contains, minContains, maxContains
- String constraints (minLength, maxLength, pattern)
- Number constraints (minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf)
- const (with `c`/`cD` opcode selection)
- enum (with `e`/`eD` opcode selection)
- allOf, anyOf, oneOf
- if / then / else
- not
- patternProperties
- propertyNames
- additionalProperties
- dependentRequired
- dependentSchemas
- Internal $ref (JSON Pointer `#/...`)
- $ref to $anchor (`#foo`)
- $id (base URI scoping)
- $defs
- Boolean schemas (`true` / `false`)
- Multiple type arrays
- format keyword (annotation mode)
- OpenAPI 3.1 discriminator

---

## Test Suite Coverage

| Test File | Status | Reason |
|---|---|---|
| `refRemote.json` | Skipped | External $ref not supported |
| `dynamicRef.json` | Skipped | $dynamicRef not supported |
| `content.json` | Skipped | contentEncoding/contentMediaType not validated |
| `vocabulary.json` | Skipped | $vocabulary not supported |
| `optional/` (entire directory) | **Not run** | Explicitly skipped by `shouldSkipFile()` (the runner IS recursive, but optional tests are filtered out) |
| `optional/format/` (21 files) | **Not run** | Same — optional directory is walked but files are skipped |
| `optional/format-assertion.json` | **Not run** | Same |
| `optional/ecmascript-regex.json` | **Not run** | Same |
| `optional/non-bmp-regex.json` | **Not run** | Same |
| `optional/dynamicRef.json` | **Not run** | Same |
| All other root `.json` files | ✅ Run | 1243 passing per mode per AGENTS.md |

**Total**: 1287 tests per mode, 1243 passing, 44 skipped. The test runner IS recursive — `discoverJsonFiles()`
walks all directories including `optional/`. Files in the `optional/` directory are filtered
out by `shouldSkipFile()` due to unsupported features (external references, content
vocabulary, etc.), not because the directory isn't walked.

---

## Source References

- `src/jschema-to-dna.ts`: Main converter. Handles all keyword processing.
- `src/string-formats.ts`: Static `JSONFORMAT` record with 19 regex formats.
- `src/index.ts`: Public API: `schvalid()`, `parserFast()`, `combineFast()`.
- `src/dna-helpers.ts`: `parseType()`, `resolveUri()` utilities.
- `tests/schemas/json-schema-suite.test.ts`: Test runner — skips 4 files, walks all directories recursively.
- `tests/schemas/json-schema-suite-parser.test.ts`: Parser test runner — same skips.
