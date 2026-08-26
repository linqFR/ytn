# Technical Documentation

## Relationship with @ytrynot/schvalid

> [!IMPORTANT]
> Understanding `@ytrynot/schvalid` is essential to understanding this document: **`@ytrynot/schvalid` and its performance rely entirely on `@ytrynot/dna`**.

`@ytrynot/schvalid` is the **JSON Schema** front-end (pure JSON Schema validation); `@ytrynot/dna` is the back-end engine that does the heavy lifting, and also exposes its own **Zod-like builder** API:

- **`@ytrynot/schvalid` converts** a JSON Schema into **DNA bytecode** (`jschemaToDna`).
- **`@ytrynot/dna` provides** a Zod-like fluent builder (`dna.string()`, `dna.object()`, …) that emits DNA bytecode directly, **and compiles** any DNA bytecode into standalone JavaScript validators/parsers (`toJS` in `src/toJs/`).

Therefore, every performance characteristic of `@ytrynot/schvalid` is inherited from `@ytrynot/dna`'s code generation: the short opcodes, the numeric sentinels, the labelled-block control flow, the fused per-key object blocks, the plain-object eval-sets, and the `if(!(test)) break <label>;` fast-fail discipline documented below. **A change to the DNA format or to the `toJs` codegen directly impacts `@ytrynot/schvalid`** — the two packages MUST be reasoned about and tested together.

The sections below (notably **DNA Opcodes** and the generated-code examples routed through `@ytrynot/schvalid`'s `jschemaToDna`) describe this shared contract from the DNA side.

## Presence-check strategies (`toJS` `ownProperties` option)

The `toJS(validateMode, enhancedMapper, ownProperties?)` function accepts an optional third argument that controls how property presence is checked in generated validation/parser code. This affects 6 input sites in `dna-js-json.ts` (required keys, optional keys, dependentRequired, etc.). The keepOnly output-copy loop always uses `_hop.call` directly and is not affected by this option.

### Modes

| Mode | Check expression | Default for | JSON Schema Test Suite |
|------|-----------------|-------------|------------------------|
| `"hasown"` | `_hop.call(v, key)` for all keys | — (opt-in) | ✅ compliant |
| `"in-filtered"` | `_hop.call` for the 12 `Object.prototype` member names, `("key" in v)` for all other keys | `@ytrynot/schvalid` (`enhancedMapper === false`) | ✅ compliant |
| `"in-object"` | `("key" in v)` for all keys | DNA builder (`enhancedMapper === true`) | ❌ not compliant (see below) |

### Sensitive keys

The 12 well-known `Object.prototype` own-property names that require `_hop.call` in `"in-filtered"` mode:

`__proto__`, `toString`, `constructor`, `hasOwnProperty`, `valueOf`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`

These are the keys where `in` would see an inherited `Object.prototype` member on a plain `{}` and incorrectly report the key as present. The set is fixed by the ECMAScript specification (since ES2015) and is defined as the `SENSITIVE` map in `src/toJs/dna-to-js.ts`.

### Why `"in-object"` fails the JSON Schema Test Suite

The Test Suite includes a group titled *"properties whose names are Javascript object property names"* with the comment: *"Ensure JS implementations don't universally consider e.g. __proto__ to always be present in an object."*

With `"in-object"`, `"toString" in {}` returns `true` (inherited from `Object.prototype`), so:
- `required: ["toString"]` on `{}` passes (should fail — `toString` is not an own property)
- `properties: { toString: { type: "number" } }` on `{}` triggers validation of `Object.prototype.toString` (a function) against `type: "number"` (should not apply — `toString` is not an own property)

`"in-filtered"` avoids this by using `_hop.call` for these 12 keys, while keeping `in` performance for all other keys.

### Performance

`"in-filtered"` and `"in-object"` are both significantly faster than `"hasown"` (~56–66% on the reference schema) because `in` avoids the `Object.prototype.hasOwnProperty` lookup + `.call` overhead on the common path. `"in-filtered"` is the fastest JSON Schema Test Suite compliant mode. `"in-object"` is slightly slower (within noise) and not compliant.

### `_hop` hoisting

When `_hop.call` is used (in `"hasown"` mode, or for sensitive keys in `"in-filtered"` mode), DNA hoists `Object.prototype.hasOwnProperty` into a `_hop` variable in the outer closure (`STEP.OUT_CONST`), giving ~17% speedup over `Object.hasOwn` with identical own-property semantics.

## DNA Format Specification

### DNA Structure

The DNA bytecode is an array of instruction tuples. During processing, DNA is stored as an object with numeric keys for efficient referencing, but the final output is an array:

```typescript
type tsDna = [tsDnaOpcode, ...any[]];
type tsDnaOpcode = "s" | "n" | "b" | "o" | "a" | ...;
```

### Example DNA Output

```javascript
[
  [
    "o",
    [
      [
        "properties",
        [
          ["name", 2],
          ["age", 1],
        ],
      ],
    ],
    {},
  ],
  ["n", [0, null, null, null, null], {}],
  ["s", [3, null, null, null], {}],
  [],
  [],
];
```

**Note**: The implementation uses opcodes:

- `"_a"` for unconstrained array type
- `"$o"` for constrained object type
- `"b"` for boolean type
- `"bi"` for BigInt type
- `"chkList"` for list check type
- `"chkSeq"` for sequential check type
- `"cidrv6"` for CIDR v6 format
- `"codec"` for codec type
- `"coerce"` for coercion type
- `"date"` for Date type
- `"F"` for false literal
- `"function"` for function type
- `"i"` for integer type
- `"instanceOf"` for instance-of type
- `"json"` for JSON type
- `"jwt"` for JWT format
- `"map"` for Map type
- `"mutate"` for mutation type
- `"n"` for number type
- `"n0"` for null type
- `"nan"` for NaN type
- `"o"` for object type
- `"pipe"` for pipe type
- `"promise"` for Promise type
- `"rcd"` for record type
- `"s"` for string type
- `"sb"` for Symbol-based type
- `"set"` for Set type
- `"symbol"` for Symbol type
- `"T"` for true literal
- `"template"` for template literal type
- `"transform"` for transform type
- `"url"` for URL format
- `"void"` for void type

## DNA Opcodes

The implementation uses short opcodes for optimal V8 performance. Each DNA instruction is a tuple: `[opcode, args..., {meta}]`.

Underscore prefix (e.g., `"_o"`, `"_s"`, `"_n"`) indicates unconstrained types. If the type does not match, constraints and validation will not be performed.

### Primitive Types

- `["s", [min, max, pattern, format], {meta}]` - String type with constraints (with type check)

  - `min`: Minimum length (number or null)
  - `max`: Maximum length (number or null)
  - `pattern`: Regex pattern string (string or null)
  - `format`: Format identifier like "email", "url" (string or null)
  - Validation: Pattern has priority over format in `dna-js-json.ts`

- `["_s", [min, max, pattern, format], {meta}]` - String constraints only (without type check)

  - Same args as `"s"`, but skips type validation
  - Used for unconstrained string validation in composition

- `["n", [min, exclMin, max, exclMax, multOf], {meta}]` - Number type with constraints (with type check)

  - `min`: Minimum value (number or null)
  - `exclMin`: Exclusive minimum flag (true/null) - if true, use `>` instead of `>=`
  - `max`: Maximum value (number or null)
  - `exclMax`: Exclusive maximum flag (true/null) - if true, use `<` instead of `<=`
  - `multOf`: Multiple of constraint (number or null)

- `["_n", [min, exclMin, max, exclMax, multOf], {meta}]` - Number constraints only (without type check)

  - Same args as `"n"`, but skips type validation

- `["i", [min, exclMin, max, exclMax, multOf], {meta}]` - Integer type with constraints

  - Same args as `"n"`, but validates integer with `%1===0` check

- `["bi", [min, exclMin, max, exclMax, multOf], {meta}]` - BigInt type with constraints

  - Same args as `"n"`, but validates bigint type

- `["b", {meta}]` - Boolean type

  - No args, just type check

- `["n0", {meta}]` - Null type
  - No args, just null check

### Value Constraints

- `["c", value, {meta}]` - Constant value (simple/primitive types)

  - `value`: Primitive value (string, number, boolean, null)
  - Validation: Strict equality `===`

- `["cD", value, {meta}]` - Constant value (complex/object types, deep comparison)

  - `value`: Object or array value
  - Validation: Deep equality via `dEq` helper function

- `["l", value, {meta}]` - Literal value (complex/object types)

  - `value`: Literal value (same as `"cD"` for complex types)

- `["e", [values], {meta}]` - Enumeration of values (shallow comparison)

  - `values`: Array of allowed values
  - Validation: Value must be in array (shallow comparison)

- `["eD", [values], {meta}]` - Enumeration of values (deep comparison)
  - `values`: Array of allowed values
  - Validation: Value must be in array (deep comparison)

### Object Types

- `["o", [constraints], {meta}]` - Object type with constraints (with type check)

  - `constraints`: Array of constraint tuples
  - Type check: `typeof v === "object" && v !== null && !Array.isArray(v)`

- `["_o", [constraints], {meta}]` - Object constraints only (without type check)
  - Same args as `"o"`, but skips type validation

**Constraints** are:

- `["minProperties", n]` - Minimum properties count

  - `n`: Minimum number of properties (number)

- `["maxProperties", n]` - Maximum properties count

  - `n`: Maximum number of properties (number)

- `["properties", [["key", ref], ...]]` - Property definitions with references

  - `key`: Property name (string)
  - `ref`: DNA index reference (number)
  - Format: Array of `[key, ref]` tuples

- `["patternProperties", [[pattern, ref], ...]]` - Pattern-based properties

  - `pattern`: Regex pattern string
  - `ref`: DNA index reference (number)
  - Format: Array of `[pattern, ref]` tuples

- `["additionalProperties", bool|ref]` - Additional properties schema

  - `bool`: `false` (no extra props), `true` (any extra props allowed)
  - `ref`: DNA index reference for validation schema of extra props

- `["propertyNames", ref]` - Property names validation

  - `ref`: DNA index reference for schema to validate property names

- `["required", [keys]]` - Required properties

  - `keys`: Array of required property names (strings)
  - Properties not in this array are optional

- `["dependentRequired", object]` - Dependent required properties

  - `object`: Mapping of property names to arrays of dependent property names

- `["dependentSchemas", [[key, ref|bool], ...]]` - Dependent schemas

  - `key`: Property name (string)
  - `ref|bool`: DNA index reference or boolean for conditional validation

- `["unevaluatedProperties", ref]` - Unevaluated properties
  - `ref`: DNA index reference for schema to validate unevaluated properties

### Array Types

- `["a", [constraints], {meta}]` - Array type with constraints (with type check)

  - `constraints`: Array of constraint tuples
  - Type check: `Array.isArray(v)`

- `["_a", [constraints], {meta}]` - Array constraints only (without type check)
  - Same args as `"a"`, but skips type validation

**Constraints** are:

- `["minItems", n]` - Minimum items count

  - `n`: Minimum number of items (number)

- `["maxItems", n]` - Maximum items count

  - `n`: Maximum number of items (number)

- `["uniqueItems", complexity]` - Unique items constraint

  - `complexity`: `0` for simple types, `1` for deep comparison

- `["contains", ref]` - Contains validation

  - `ref`: DNA index reference for schema that must match at least one item

- `["minContains", n]` - Minimum contains count

  - `n`: Minimum number of items that must match `contains` schema

- `["maxContains", n]` - Maximum contains count

  - `n`: Maximum number of items that can match `contains` schema

- `["prefixItems", [refs]]` - Tuple prefix items

  - `refs`: Array of DNA index references for tuple items (fixed positions)

- `["items", ref]` - Items schema

  - `ref`: DNA index reference for schema to validate all array items
  - **Sentinel**: The `toJs` `array` handler uses `-1` as the "no items declared" sentinel. DNA index `0` is a valid items target (e.g. a recursive `$ref` pointing back to the root node at index 0), so `0` MUST NOT be used as the absent-constraint marker. Guards in both validate and parser modes use `itemsIndex >= 0` to emit the items-loop body. Using truthiness (`&& itemsIndex`) or explicit exclusion (`!== 0`) instead of `>= 0` reintroduces a silent-accept bug for recursive schemas.

- `["unevaluatedItems", ref]` - Unevaluated items
  - `ref`: DNA index reference for schema to validate unevaluated items

### Schema Composition

- `["allOf", [refs]]` - Must pass all validators

  - `refs`: Array of DNA index references
  - Validation: All referenced schemas must pass

- `["anyOf", [refs]]` - Must pass at least one validator

  - `refs`: Array of DNA index references
  - Validation: At least one referenced schema must pass

- `["oneOf", [refs]]` - Must pass exactly one validator

  - `refs`: Array of DNA index references
  - Validation: Exactly one referenced schema must pass

- `["discriminator", propertyName, [keys], [refs]]` - Optimized polymorphic validation

  - `propertyName`: Discriminator property name (string)
  - `keys`: Array of discriminator values — one entry per branch. Each entry is either a **primitive** (for a single `const` / `literal` value, e.g. `"build"`) or an **array of primitives** (for `enum` / multi-value `literal([...])`, e.g. `["a", "b"]`). The two emission paths (builder and schvalid) agree on this format: singletons are flattened to their raw value (not wrapped in an array), matching schvalid's `const` handling.
  - `refs`: Array of DNA index references — `refs[0]` is the pre-validation object (checks `type: "object"` + discriminator key presence), `refs[1..N]` are the branch sub-schemas.
  - Uses `switch` statement for efficient dispatching
  - Branch sub-schemas are emitted **as-is** (not cloned): the discriminator property retains its original schema (literal/enum/pipe/...). Redundant `hasOwn` and const-check on the routing key are elided at codegen time via `parentCtx.testedProp` (see [§5bis](#5bis-discriminatorcli-routing-key-redundancy-elision-parentctxtestedprop)). This preserves transforms/pipes on the routing key (e.g. `pipe(literal("build"), transform(...))`) that the previous cloner (which replaced the key with `DnaAny`) silently dropped.

- `["maranget", discAdn, discriminKeys, branchDef, mode]` - multi-key routing union (Maranget)

  - `discAdn`: `(string | string[])[]` — routing key names (column order). Required columns are strings; optional columns are grouped in a **final sub-array** (the optionality marker), e.g. `["cmd", "mode", ["verbose"]]`. Unlike `discriminator` (single-key), `maranget` supports multiple keys.
  - `discriminKeys`: the **clause matrix** (DEC-0041 Option A) — one array per branch, position = column. Singleton → direct value; multi-value → sub-array (`["dev","prod"]`); `undefined` PRESENT → real value (`dna.undefined()`, `.optional()`, `.nullish()`); a position beyond the array length → wildcard (trailing absences stay sparse); a **non-trailing** absence (a wildcard BEFORE a value, e.g. a branch routing on a different key) → the explicit `WILDCARD_CELL` marker `"\x00"` at its position (keeps the matrix aligned — NUL is JSON-safe and impossible as a CLI input).
  - `branchDef`: Array of DNA index references — `branchDef[0]` is the pre-validation object (checks `type: "object"` + required key presence), `branchDef[1..N]` are the branch sub-schemas.
  - `mode`: `"constructor-priority"` (default) | `"source-order"` — routing semantics (DEC-0041).
  - **Codegen**: the matrix arrives in the opcode args (zero generic plumbing — no `utils.dna`). The handler converts ADN cells (`WILDCARD_CELL` marker `"\x00"` and beyond-length positions → WILDCARD), calls `algo/maranget.ts > compile(rows, mode, isOptionalKey)` (pure matrix → tree, see [Maranget decision tree codegen](#maranget-decision-tree-codegen-cli-opcode) below), then emits JS. The tree is computed at codegen time, not stored in the DNA.
  - Branch sub-schemas are emitted **as-is** (same as `discriminator`): routing keys retain their original schema. Redundant `hasOwn` and const-check on routing keys are elided via `parentCtx.testedProp` (see [§5bis](#5bis-discriminatorcli-routing-key-redundancy-elision-parentctxtestedprop)). Branch mutations (`.extend()`, `.transform()`, `.default()`) are preserved naturally.
  - **No JSON Schema equivalent**: `maranget` is a DNA-specific opcode with no OpenAPI/JSON Schema counterpart. It is emitted only by the builder's `dna.marangetUnion()`/`dna.cliUnion()`.
  - **Optional keys**: a column is optional when the builder marks it in `discAdn` (any declaring branch is optional/nullish/`dna.undefined()`/any/unknown/non-finite — the builder knows the live types; "the wrap gives the value"). The codegen emits `if (key === undefined)` first, then dispatches on remaining values (see codegen rule 2). A plain wildcard (absent cell) does NOT make a column optional by itself.
  - **`toParseArgsConfig()`**: the class exposes a delegate to `introspect.toParseArgsConfig` (CLI-facing schema concern — needs no Maranget output). It infers option types (`"string"` / `"boolean"`) from leaf schemas, detects `multiple` from `DnaArray` wrappers. Defaults are NOT injected — DNA owns defaulting via `DnaDefault` wrappers. See [CLI Union](cli-union.md) for full documentation.
  - **`flags` getter**: returns non-positional keys across all branches. These are the keys that `@ytrynot/cli` maps to `parseArgs` options.

- `["not", ref]` - Negation of validator

  - `ref`: DNA index reference
  - Validation: Referenced schema must fail

- `["ifThenElse", [ifRef, thenRef, elseRef]]` - Conditional validation
  - `ifRef`: DNA index reference for condition schema
  - `thenRef`: DNA index reference for schema if condition passes
  - `elseRef`: DNA index reference for schema if condition fails

### Modifiers

Optional, nullable, and default don’t do the same thing: they change what inputs are accepted and/or what value you get after parsing.

- optional (`.optional()` / `dna.optional(...)`)  
An optional schema allows `undefined` inputs (so the value can be missing). 
Example: `dna.optional(z.literal("yoda"))` (or `dna.literal("yoda").optional()`) makes that schema optional.

- nullable (`.nullable()` / `dna.nullable(...)`)  
A nullable schema allows `null` inputs (the value can be explicitly `null`).
Example: `dna.nullable(z.literal("yoda"))` (or `dna.literal("yoda").nullable()`) makes that schema nullable.

- nullish (`z.nullish(...)`)  
If you want to allow both `undefined` and `null`, use `dna.nullish(...)` (optional + nullable).

- default (`.default(...)`)  
- prefault (`.prefault(...)`)


- `["optional", [ref]]` - Optional property wrapper

  - `ref`: DNA index reference to optional schema
  - Used for standalone optional schemas (not object properties)
  - For object properties, optional is handled by `required` array

- `["nullable", [ref]]` - Nullable value wrapper

  - `ref`: DNA index reference to nullable schema
  - Allows `null` as valid value

- `["default", value]` - Default value (post-validation)

  - `value`: Default value to use if input is `undefined`
  - Applied after validation, value must match output type

- `["prefault", value]` - Pre-fault value (pre-validation)

  - `value`: Default value to use if input is `undefined`
  - Applied before validation, value must match input type

- `["seq", [refs]]` - Sequence modifier
  - `refs`: Array of DNA index references
  - Validates schemas in sequence, all must pass

### References

- `["ref", targetIdx, {meta}]` - JSON Schema reference
  - `targetIdx`: Numeric reference to another DNA index
  - `{meta}`: Metadata object
  - Used for circular references and schema reuse

## JSON Schema → DNA Builder Chaining — Equivalence & Parity

This section maps **frequent, emblematic JSON Schema patterns** to their equivalent **DNA builder method chaining** (`dna.object({...}).strict()`, `dna.string().min(3).optional().default("x")`, `dna.discriminatedUnion("k", [...])`, …) and documents the **behavioral parity** between the two paths:

- **Path A (JSON Schema)**: `jschemaToDna(schema)` → `validator(dna)` / `parser(dna)` from `@ytrynot/schvalid`.
- **Path B (builder)**: `dna.xxx().yyy()` → `.validate()` / `.safeParse()` from `@ytrynot/dna`.

Equivalence means **identical `validate` results AND identical `safeParse` results** (both `success` flag and `data` shape) on the same inputs. Parity pitfalls are noted where the two paths diverge — these are **not bugs** but semantic differences between JSON Schema (annotation-only `default`, `prefixItems` not required, `additionalProperties` defaults to allowed) and the DNA builder (applied `default`, tuple requires all positions, `standard` object strips unknown keys via `keepOnly`).

> The parity observations below were verified by execution (comparing both paths on a battery of valid + invalid + edge-case inputs). Regenerate via `sandbox/parity-examples.ts`.

### Object patterns

#### Simple object — `properties` + `required`

```json
{ "type": "object", "properties": { "name": { "type": "string" }, "age": { "type": "integer" } }, "required": ["name"] }
```

**Builder chaining:**

```typescript
dna.object({ name: dna.string(), age: dna.int().optional() })
```

**Parity:** ✓ identical `validate` and `safeParse` on all tested inputs. `required` maps to keys present without `.optional()`; absent-from-`required` maps to `.optional()`. Both paths reject missing required keys, wrong types, and non-objects.

#### Strict object — `additionalProperties: false`

```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"], "additionalProperties": false }
```

**Builder chaining:**

```typescript
dna.strictObject({ id: dna.string() })
```

**Parity:** ✓ identical. Both reject extra keys. `.strict()` (or `dna.strictObject(...)`) sets `objType: "strict"`, which the codegen translates into the `passed0` hashmap check that rejects any unaccounted-for key.

#### Standard object — no `additionalProperties` keyword ⚠️

```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
```

**Builder chaining:**

```typescript
dna.object({ id: dna.string() })   // objType: "standard" (default)
```

**Parity pitfall — `keepOnly` strips unknown keys on the builder side.** When `additionalProperties` is **not declared** in JSON Schema, the spec default is "extra keys allowed" — the schvalid parser **keeps** them in the output (`{id:"abc", extra:"ok"}` → parsed as-is). The builder's `standard` mode uses the `keepOnly` mechanism (see [Object Output: `keepOnly` vs JSON-Schema modes](#object-output-keeponly-vs-json-schema-modes)) which **strips** undeclared keys from the parsed output (`{id:"abc", extra:"ok"}` → `{id:"abc"}`). `validate` agrees (both pass), but `safeParse().data` **differs**.

**To get parity:** use `dna.looseObject({ id: dna.string() })` (or `.loose()`) — `objType: "loose"` preserves unknown keys via `Object.assign` pre-copy, matching the JSON Schema default. Conversely, if you want the builder's stripping behavior on the JSON Schema side, declare `"additionalProperties": false` explicitly.

#### Dictionary — `additionalProperties` (value schema)

```json
{ "type": "object", "additionalProperties": { "type": "number" } }
```

**Builder chaining:**

```typescript
dna.record(dna.string(), dna.number())
```

**Parity:** ✓ identical `validate` and `safeParse`. JSON Schema has no dedicated "record" type — the dictionary pattern is `additionalProperties` (value schema) with an implicit string-key constraint. The builder's `dna.record(keySchema, valueSchema)` emits the `rcd` opcode (a variant of `o` that rejects non-plain prototypes like `Date`/`Map`), but the validation/parsing behavior on plain-object inputs matches. Note: `dna.record` rejects `new Date()` / `new Map()` instances (plain-object prototype check), while the JSON Schema `o` opcode accepts them — a divergence only on non-plain-object inputs.

### Array patterns

#### Array of items — `items` + `minItems`

```json
{ "type": "array", "items": { "type": "string" }, "minItems": 1 }
```

**Builder chaining:**

```typescript
dna.array(dna.string()).min(1)
```

**Parity:** ✓ identical. `.min(n)` maps to `minItems`; `.max(n)` maps to `maxItems`; `.length(n)` sets both.

#### Tuple — `prefixItems` + `items` ⚠️

```json
{ "type": "array", "prefixItems": [{ "type": "string" }, { "type": "integer" }], "items": { "type": "boolean" } }
```

**Builder chaining:**

```typescript
dna.tuple([dna.string(), dna.int()], dna.boolean())
```

**Parity pitfall — tuple requires all prefix positions.** JSON Schema `prefixItems` is **not** a `required` constraint by default: an array shorter than the prefix (e.g. `[]`) **passes** validation (each prefix position is only checked if the item exists). The builder's `dna.tuple([...], rest)` **requires** all prefix positions to be present — `[]` **fails** validation. This is a deliberate semantic choice (tuples are fixed-arity in the builder's model), but it diverges from JSON Schema `prefixItems` semantics.

**To get parity:** there is no direct builder chaining that reproduces the "prefix optional" semantics. Use `dna.array(dna.union([dna.string(), dna.int(), dna.boolean()]))` if all positions share a common type, or accept the divergence. On the JSON Schema side, adding `"minItems": 2` makes the two paths agree (both reject short arrays).

#### `contains` — no direct builder equivalent ⚠️

```json
{ "type": "array", "items": { "type": "integer" }, "contains": { "type": "integer", "minimum": 10 }, "minContains": 1 }
```

**Builder chaining:** none. `DnaArray` does not expose a `.contains()` method. The `contains`/`minContains`/`maxContains` keywords have no builder API equivalent.

**Parity gap:** this is a JSON-Schema-only feature. To validate "array must contain at least one item matching schema X", use `.refine()` on the builder side:

```typescript
dna.array(dna.int()).refine(arr => arr.some(n => n >= 10), { error: "must contain an item >= 10" })
```

This reproduces the validation behavior but not the exact error structure (a single custom error vs. the schvalid `contains`-specific error path).

### Combinator patterns

#### `anyOf` — `dna.union`

```json
{ "anyOf": [{ "type": "string" }, { "type": "integer" }] }
```

**Builder chaining:**

```typescript
dna.union([dna.string(), dna.int()])
```

**Parity:** ✓ identical. `anyOf` maps directly to `dna.union` — at least one branch must pass. `validate` returns `true` if any branch passes; `safeParse` returns the first matching branch's data.

#### `oneOf` with `discriminator` — `dna.discriminatedUnion` ⚠️

```json
{
  "type": "object",
  "discriminator": { "propertyName": "kind" },
  "required": ["kind"],
  "oneOf": [
    { "type": "object", "properties": { "kind": { "const": "cat" }, "meow": { "type": "string" } }, "required": ["kind", "meow"], "additionalProperties": false },
    { "type": "object", "properties": { "kind": { "const": "dog" }, "bark": { "type": "string" } }, "required": ["kind", "bark"], "additionalProperties": false }
  ]
}
```

**Builder chaining:**

```typescript
dna.discriminatedUnion("kind", [
  dna.strictObject({ kind: dna.literal("cat"), meow: dna.string() }),
  dna.strictObject({ kind: dna.literal("dog"), bark: dna.string() }),
])
```

**Parity pitfall — null/non-object input handling.** Both paths agree on valid discriminator values and wrong-type branches, but the builder's `discriminatedUnion` **throws** on `null` input (cannot read the discriminator property) instead of returning `{success: false}`. The schvalid path handles `null` gracefully (returns `{success: false, errors: [...]}`). This is a robustness gap in the builder's discriminated-union dispatch — it assumes the input is an object before reading the discriminator key.

**Detection difference:** `jschemaToDna` only emits the `discriminator` opcode when strict conditions hold (`type: "object"`, `discriminator.propertyName` is a string, every branch has a `const` for the discriminator, and the discriminator property is in `required`). The builder's `dna.discriminatedUnion` always emits the discriminated-union opcode regardless of whether branches use `literal` for the discriminator — the contract is enforced by TypeScript types (`tsDnaDiscriminatedUnionObjects<K>`), not by runtime detection.

**DNA bytecode parity — `discriminKeys` format.** Both paths now emit `discriminKeys` in the same format: a **primitive** (raw value) for single-value discriminators (`const: "build"` / `dna.literal("build")` → `"build"`), and an **array** for multi-value discriminators (`enum: ["a","b"]` / `dna.literal(["a","b"])` → `["a","b"]`). The builder's `finiteValueSet()` always returns an array; singletons are flattened at emission time (`values.length === 1 ? values[0] : values`) to match schvalid's `const` format.

**DNA bytecode parity — branch emission.** Both paths now emit branch sub-schemas **as-is** (the builder no longer clones branches with the discriminator replaced by `DnaAny`). Redundant `hasOwn` and const-check on routing keys are elided at codegen time via `parentCtx.testedProp` (see [§5bis](#5bis-discriminatorcli-routing-key-redundancy-elision-parentctxtestedprop)), preserving transforms/pipes on the routing key. The builder emits properties in their declaration order; schvalid reorders via object spread (`{ [discriminator]: true, ...requiredKeys, ...optionalKeys }`).

**Remaining structural diffs (no functional impact).** The generated `validate`/`parse` functions are functionally identical, but the DNA bytecode still differs in three cosmetic aspects:
1. **Constraint order inside `o`**: builder emits `properties` → `required` → `additionalProperties`; schvalid emits `required` → `properties` → `additionalProperties`. Both produce the same runtime checks.
2. **Property tuple format**: builder emits 3-element tuples `["key", idx, {}]` (always includes the meta object); schvalid emits 2-element tuples `["key", idx]` (no meta). The `toJs` handler accepts both.
3. **DNA index assignment**: children are pushed onto the collector stack in different orders, so the numeric indices may be permuted (e.g. builder assigns `cmd=3, out=4`; schvalid assigns `cmd=4, out=3`). The references are consistent within each DNA sequence — only the absolute indices differ.

#### `allOf` — `dna.intersection`

```json
{ "allOf": [
  { "type": "object", "properties": { "a": { "type": "string" } }, "required": ["a"] },
  { "type": "object", "properties": { "b": { "type": "integer" } }, "required": ["b"] }
] }
```

**Builder chaining:**

```typescript
dna.intersection(
  dna.object({ a: dna.string() }),
  dna.object({ b: dna.int() })
)
```

**Parity:** ✓ identical. `allOf` maps to `dna.intersection` — all sub-schemas must pass. The parsed output is the intersection of all branches' contributions.

#### Multi-`type` — `dna.union`

```json
{ "type": ["string", "number"] }
```

**Builder chaining:**

```typescript
dna.union([dna.string(), dna.number()])
```

**Parity:** ✓ identical. JSON Schema `type: ["string", "number"]` is semantically an `anyOf` over primitive types; the builder expresses it as `dna.union`. The schvalid converter emits a `["type", typeArray]` opcode that dispatches to the matching primitive checks; the builder emits a `union` opcode. Both produce the same validate/parse results.

### Wrapper patterns

#### `default` — applied vs annotation-only ⚠️

```json
{ "type": "object", "properties": { "name": { "type": "string" }, "count": { "type": "integer", "default": 0 } }, "required": ["name"] }
```

**Builder chaining:**

```typescript
dna.object({ name: dna.string(), count: dna.int().default(0) })
```

**Parity pitfall — `default` application.** JSON Schema `default` is **annotation-only** by default (Draft 2020-12): the schvalid parser does **not** inject the default value into the output — `{name: "A"}` parses to `{name: "A"}` (no `count` key). The builder's `.default(0)` is **applied** during parsing — `{name: "A"}` parses to `{name: "A", count: 0}`. `validate` agrees (both pass), but `safeParse().data` **differs**.

**To get parity:** there is no schvalid option to apply `default` during parsing (it would violate the Draft 2020-12 annotation-only contract). On the builder side, if you want annotation-only behavior, do not call `.default()` — use `.optional()` instead and handle the missing value downstream. The two paths are **not** parity-equivalent for `default`; this is a fundamental design difference.

#### `nullable` — `anyOf: [T, null]`

```json
{ "anyOf": [{ "type": "string" }, { "type": "null" }] }
```

**Builder chaining:**

```typescript
dna.string().nullable()
```

**Parity:** ✓ identical. Both accept `null` and the string value; both reject other types. `.nullable()` wraps the inner schema in a `nullable` wrapper that short-circuits on `null` input.

#### `optional` — `undefined` acceptance

```typescript
dna.string().optional()
```

**JSON Schema equivalent:** there is no direct JSON Schema keyword for "accept `undefined`" — `required` controls which keys are required, and a key absent from `required` is optional (accepts missing/`undefined`). For a standalone optional schema, JSON Schema has no equivalent; the builder's `.optional()` is a wrapper that accepts `undefined` and is primarily meaningful in object property context.

**Parity:** in object property context, both paths agree — a key absent from `required` (JSON Schema) or wrapped with `.optional()` (builder) accepts `undefined`/missing. The builder's parser preserves explicitly-present `undefined`-valued optional properties in the output (aligned with Zod v4), matching schvalid's behavior. Static objects (no dynamic props) use a single-allocation fast path (no `outObT0` temp, no copy loop); dynamic-prop objects use the temp + `keepOnly` loop. See [zod-comparison.md — Object output: `undefined` handling](zod-comparison.md#object-output-undefined-handling) and [Object output: `keepOnly` mechanism and single-allocation](zod-comparison.md#object-output-keeponly-mechanism-and-single-allocation-performance).

### Patterns with no builder equivalent

| JSON Schema keyword | Status | Note |
|---|---|---|
| `if`/`then`/`else` | no direct equivalent | Use `.refine()` with conditional logic, or `dna.union` of the two branches. No builder chaining reproduces the conditional applicator semantics exactly. |
| `not` | no direct equivalent | Use `.refine(v => !inner.validate(v))`. No `.not()` method on the builder. |
| `contains`/`minContains`/`maxContains` | no direct equivalent | Use `.refine(arr => arr.some(...))` on `dna.array()`. |
| `dependentRequired`/`dependentSchemas` | no direct equivalent | Use `.refine()` with conditional logic. |
| `unevaluatedProperties`/`unevaluatedItems` | no direct equivalent | Builder's `strict`/`loose`/`standard` object modes cover the common cases; `unevaluated*` with `allOf`/`oneOf` has no builder chaining. |
| `propertyNames` | partial | `dna.record(keySchema, ...)` validates keys via the key schema; standalone `propertyNames` on a non-record object has no builder equivalent. |
| `patternProperties` | no direct equivalent | Use `.refine()` or restructure as a `dna.record` with a `templateLiteral` key pattern. |

## Architecture

### Stack-Based Traversal — interaction with the collector

The `jschemaToDna` function uses an iterative DFS instead of recursion (deeply-nested schemas with `$ref` cycles would blow the JS call stack). The stack frames carry **both** the schema node **and** the placeholder slot the resulting DNA index must fill.

#### Frame format

```typescript
type StackFrame = [
  parentPath: string,    // JSON Pointer for diagnostics
  node: any,             // schema (sub)tree to process
  storeMark: number,     // placeholder slot to fill with this node's DNA index
  storePosition: number, // position inside that slot's array
];

const stack: StackFrame[] = [[currentBase, root]];   // root has no parent slot
while (stack.length > 0) {
  const [path, node, storeMark, position] = stack.pop()!;
  // ...emit DNA for `node`, optionally call storeDNA(..., storeMark, position)
  // to fill the slot reserved by the parent frame.
}
```

The key invariant: **a parent frame `setStore(...)`s the slot before pushing its children**, so by the time a child pops, its `storeMark` already exists and `storeDNA(dna, storeMark, position)` can fill it atomically.

#### Self-referencing slot trick

Many composite opcodes (`seq`, `unevaluatedItems`, `unevaluatedProperties`) need a single shared placeholder for all their children. The pattern from `jschemaToDna`:

```typescript
const seqDef = new Array(innerCount);  // child slots
const seqStoreId = setStore(seqDef);   // reserve once
seqDef.fill(seqStoreId);                // every slot pre-points to its own storeId
storeDNA([node, meta], ["seq", seqDef], parentStoreMark, parentPos);
// then push children with `seqStoreId` as their storeMark
for (let i = childCount; i--;) stack.push([path, children[i], seqStoreId, i]);
```

Because `seqDef` is the same array reference held both by the parent DNA and by the store, every `updateStore(seqStoreId, childIdx, i)` mutates it in place. By the time the loop finishes, the `seq` DNA already carries the correct child indices — no rewrite needed.

#### Reverse-order child push

Children are pushed onto the stack **from last to first** (`for (let i = n.length; i--;)` or equivalent) so they `pop` in their natural order. This matches JSON Schema's left-to-right semantics for `allOf`/`anyOf`/`oneOf`/`prefixItems`.

#### `storeMark` promotion across wrappers

When multiple wrapper-style applicators stack at the same node (e.g. `unevaluatedProperties` over `seq` over `allOf`), the converter chains them by **promoting** `storeMark` after each wrapper:

```typescript
storeDNA(["unevaluatedProperties", ...], unEvalDef, storeMark, storePosition());
storeMark = wrpStoreId;        // outer wrapper's slot is now the active target
storePosition.count();          // bump position counter
// ...next layer uses the new storeMark
```

This mirrors the `_storeWrapper` pattern in the builder (see [DnaCollector — Storage & Build Flow](#dnacollector--storage--build-flow)) — same deferred-fill discipline, applied iteratively here instead of as a function call.

#### Why this matters

The combined pattern (stack + collector with deferred placeholders) lets the converter:

- **Avoid recursion** — handles arbitrarily deep / cyclic schemas without stack overflow.
- **Emit DNA in flat order** — the resulting `dnaList` is ready for `validator(dnaSeq)` / `parser(dnaSeq)` with no post-processing.
- **Deduplicate transparently** — `storeDNA`'s `JSON.stringify` cache (see Cache & deduplication below) collapses identical fragments across the whole tree, including across `$ref` boundaries.

### DnaCollector — Storage & Build Flow

`DnaCollector` (in `src/builder/index.ts`) is the central registry that turns a builder chain (`dna.string().min(3).optional()`) into a flat, indexable `tsDnaSeq`. Every schema implementation calls into it through a small 4-method API and a strict ordering contract.

#### API surface (`IDnaCollector`)

| Method | Purpose |
|---|---|
| **`storeDNA(dna, storeMark?, storePosition?)`** | Append `dna` to the flat list, return its index. If `storeMark`/`storePosition` are given, also write that index into a previously reserved slot (placeholder fill-in). Deduplicates via `dnaCache` keyed on `JSON.stringify(dna)` — identical DNA fragments are stored once. |
| **`setStore(targets)`** | Reserve a placeholder slot that will hold a child-index (or array of child-indices) computed later. Returns a `storeMark: number` used by subsequent `updateStore`/`storeDNA` calls. |
| **`updateStore(storeMark, targetIdx, position?)`** | Fill the reserved slot at `position` with `targetIdx`. Used when the placeholder is an array (e.g. `seq` opcode params). |
| **`getDnaSeq(externals?)`** | Finalize: returns `[...dnaList, refList, externalsKeys]` — the complete program. The DNA at index `0` is the entry point. |

#### Two storage patterns

**Pattern A — direct storage** (leaves and self-contained DNA): one call, no placeholder.

```typescript
const idx = collector.storeDNA(["s", [3, 10, null, null], {}]);
// idx is the position in dnaList; can be referenced as innerDnaId by parents.
```

**Pattern B — deferred placeholder** (parents that embed children indices): reserve, fill later. This is mandatory when a parent DNA needs to **contain** child indices that are not yet computed.

```typescript
const dna_params = new Array(3);                   // 3 children expected
const storeId = collector.setStore(dna_params);    // reserve the array slot
collector.storeDNA(["seq", dna_params, {}]);       // parent DNA references the same array
// later, as each child is built:
const childIdx = collector.storeDNA(["mutate", "s=>s.toLowerCase()"]);
collector.updateStore(storeId, childIdx, 0);       // fill position 0
```

#### Mandatory ordering: **inner-first**

Wrappers (`["wrp", [type, innerDnaId, value], meta]`), refs (`["ref", targetIdx, meta]`) and combinators (`anyOf`/`allOf`/`oneOf`/`seq`) all carry **indices** of their children. The child index only exists once the child is stored. Therefore:

```typescript
// CORRECT — inner first
toDna(ctx) {
  const selfDna: tsDna = ["s", [...constraints], this._meta];
  const innerDnaId = this._dnaCollector.storeDNA(selfDna, null, undefined);
  const storeWrap = super._storeWrapper(innerDnaId);   // wrap with optional/default/...
  // ...emit `seq` for mutators/checkers using `storeWrap`
}
```

```typescript
// WRONG — _storeWrapper called without innerDnaId throws TS2554 / produces broken DNA
const storeWrap = super._storeWrapper();   // ❌ index of what?
```

#### Wrapper chain (`_preprocess`) — outermost first in the DNA list

Wrappers (`optional`, `nullable`, `default`, `prefault`) accumulate in `this._preprocess` in **call order** (`.optional().default(x)` pushes `optional` then `default`). `_storeWrapper` walks the array **from end to start** (`for (; len--;)`), so the **last-pushed wrapper is stored innermost** and the first-pushed becomes the outermost — matching the natural reading order of `value.optional().default(x)` ("evaluate `default` first, then `optional`").

Each wrapper iteration:

1. `setStore(def)` — reserve a slot for this wrapper's link to its parent (the next outer wrapper).
2. `storeDNA(["wrp", [type, innerDnaId, value], meta], parentStoreId, parentPosition)` — append the wrapper DNA, optionally filling the slot of the *previous* (outer) wrapper.
3. The `parentStoreId` / `parentPosition` are then promoted so the next iteration (one level outward) can fill them.

Result: `dnaList` ends with `[..., innerDna, innermost_wrp, ..., outermost_wrp]`, and `getDnaSeq` returns the outermost wrapper's index as entry point.

#### `seq` placeholder pattern (mutators + checkers)

`StringImpl.toDna` shows the canonical use of `setStore`/`updateStore` for an `seq` opcode whose children are computed in a loop:

```typescript
const dna_params = new Array(this._mutatorList.length + this._checkerList.length + 1);
const storeId = this._dnaCollector.setStore(dna_params);              // 1. reserve
const dnaId   = this._dnaCollector.storeDNA(["seq", dna_params, {}], ...storeWrap);  // 2. parent
[unconstrainedHead, ...mutators, constrainedSelf, ...checkers].forEach((it, i) => {
  const itId = this._dnaCollector.storeDNA(it, ...storeWrap);          // 3. child
  this._dnaCollector.updateStore(storeId, itId, i);                    // 4. fill slot i
});
```

The `seq` DNA carries `dna_params` as its arg array; `updateStore` mutates that same array in-place, so by the time `getDnaSeq` is called, the indices are visible to the codegen.

#### Cache & deduplication

`storeDNA` keys every fragment by `JSON.stringify(dna)`. Identical leaves (e.g. two `["s", [null,null,null,null], {}]`) collapse to a single entry. Wrappers and refs that target a deduplicated index automatically share. This keeps `dnaList` minimal and makes the DNA stable across builds.

#### Top-level finalization

`getDnaSeq(externals)` returns:

```typescript
[
  ...dnaList,        // all DNA fragments, entry at index 0
  refList,           // collected $ref / lazy / recursive entries
  Object.keys(externals ?? {})   // external symbol names (regexes, custom validators)
]
```

This tuple is what `validator(dnaSeq)` and `parser(dnaSeq)` consume to produce the compiled JS function.

### DNA to JavaScript Compilation

DNA bytecode is compiled to standalone JavaScript functions via the `dna-js-json.ts` engine. The generated code uses:

- **Hashmaps instead of Sets**: For tracking evaluated properties/items (`evalSet`, `passedIdx`), plain objects `{}` are used instead of `Set` for better performance and smaller generated code.
- **Compact assignments**: Hashmap entries use `=1` instead of `=key` for minimal overhead.
- **Truthy checks**: `!hashmap[key]` instead of `===undefined` for existence checks.
- **Optimized loops**: Array iteration uses `i-->0` pattern to correctly handle index 0.
- **Label-based control flow**: Labeled blocks (`oB0:`, `evalIB0:`) with `break` statements for fail-fast validation.

#### Validation Modes

The DNA-to-JS compiler produces two types of functions:

1. **Validator Mode** (`validator(dna)`): Boolean-only validation with fail-fast semantics. Returns `true/false` immediately on first error.
2. **Parser Mode** (`parser(dna)`): Full error collection with data transformation. Returns `{success: true, data: {...}}` or `{success: false, errors: [...]}`.

#### Opcode handler modules: `dna-js-json.ts` vs `dna-js-builder.ts`

The opcode-to-JavaScript handlers are split across two modules, along the same front-end boundary as the **[Relationship with @ytrynot/schvalid](#relationship-with-ytrynotschvalid)** section:

- **`dna-js-json.ts` — canonical / JSON-validation opcodes.** Contains everything needed for **JSON Schema validation**: the opcodes that `@ytrynot/schvalid`'s `jschemaToDna` produces (`s`/`_s`, `n`/`_n`/`i`/`bi`, `b`, `o`/`_o`, `a`/`_a`, `anyOf`/`oneOf`/`allOf`/`not`, `discriminator`, `if`/`then`/`else`, `c`/`cD`/`l`/`e`/`eD`, `ref`, `unevaluated*`, etc.). This is the JSON-Schema-complete handler set; it is the module imported and consumed by `@ytrynot/schvalid`.

- **`dna-js-builder.ts` — builder-specific opcodes.** Contains the handlers for opcodes emitted **only** by the `@ytrynot/dna` Zod-like builder, which have no JSON Schema equivalent: `wrp` (the generic `optional`/`nullable`/`default`/`prefault` wrapper dispatcher), `mutate` (transforms), `check` (string refinements like `lowercase`/`startsWith`/…), `coerce`, plus extra runtime types `sym`, `date`, `file`. `@ytrynot/schvalid` does NOT use these — it produces canonical DNA opcodes directly.

Both modules share the same low-level codegen primitives from `utils.ts` (`simpleNodeToJs`, `_err`, `_envFrame`, the `ERR_*` fragments), so the generated code style is identical regardless of which module emitted a given opcode. `dna-to-js.ts` orchestrates dispatch across both.

### Performance Optimizations

- Direct DNA generation without intermediate representations
- Short opcodes for V8 optimization
- Numeric sentinels (-1, null) for absent constraints
- **Sentinel discipline**: DNA index `0` is a valid reference. Any field that can hold a DNA index MUST use `-1` (never `0`) as the "absent" sentinel, and guards MUST use `>= 0` rather than truthiness. The `array` handler's `itemsIndex` previously defaulted to `0` and used truthiness checks, which silently dropped the items-loop body for recursive schemas whose `items` pointed to index 0 — fixed in the `array` handler, regression-tested in `packages/schvalid/tests/schemas/regression-failles.test.ts`.
- Lazy evaluation with stack-based processing
- Hashmap-based tracking for evaluated properties/items (no Set overhead)
- Standalone generated functions (no external dependencies)

---

## DNA → Schema Reconstruction (`fromDna`)

`src/fromDna/index.ts` rebuilds a fluent `@ytrynot/dna` builder schema from the bytecode produced by `schema.toDna()`. It is the inverse of the builder's emission layer and is the backbone of the `from-dna-extended.test.ts` roundtrip suite.

### Input format

`fromDna` expects the same tuple that `toDna` returns: a flat `tsDnaSeq` followed by an optional `refList` and an optional `externals` key list. The entry node is always at index `0`.

```typescript
const rebuilt = fromDna(schema.toDna());
```

### Typing `fromDna` — Type parameter and inference

`fromDna` accepts an optional type parameter `S extends DnaSomeType<any, any>`:

```typescript
function fromDna<S extends DnaSomeType<any, any> = DnaSomeType<any, any>>(seq: tsDnaSeq): S
```

**Why a type parameter is needed**: A `tsDnaSeq` is a flat array of opcodes (`[...tsDna[], number[]]`). The opcode at index 0 determines the root schema class, but this is a runtime string — TypeScript cannot infer the concrete schema type from the bytecode. This is the same limitation as `JSON.parse()` returning `any`: the data format carries no compile-time type information.

**Default (no type argument)**: `fromDna(seq)` returns `DnaSomeType<any, any>`. This is a fully functional schema — `safeParse`, `validate`, `toDna`, `meta` are all available — but `_output` is `any`, so `dna.infer<typeof rebuilt>` resolves to `any`.

```typescript
const rebuilt = fromDna(bytecode);              // DnaSomeType<any, any>
type Out = dna.infer<typeof rebuilt>;           // any
rebuilt.safeParse(input);                        // ✓ works
rebuilt.validate(input);                         // ✓ works
```

**With explicit type argument**: Pass the expected schema class to get full type safety, including `_output` inference and schema-specific methods like `.implement()` on `DnaFunction`.

```typescript
// Primitive — pass the DNA class directly
const rebuiltStr = fromDna<dna.DnaString>(bytecode);
type OutStr = dna.infer<typeof rebuiltStr>;     // string

// Object — pass the exact schema type
const objSchema = dna.object({ name: dna.string(), age: dna.number() });
const rebuiltObj = fromDna<typeof objSchema>(objSchema.toDna());
type OutObj = dna.infer<typeof rebuiltObj>;     // { name: string, age: number }

// Function — pass ReturnType to unlock .implement()
const fnSchema = dna.function().input([dna.string()]).output(dna.number());
const rebuiltFn = fromDna<ReturnType<typeof dna.function>>(fnSchema.toDna());
const impl = rebuiltFn.implement((s: string) => s.length);  // ✓ typed
```

**Available DNA classes for type arguments**: All exported classes that extend `DnaTypeWithWrappers` can be used: `dna.DnaString`, `dna.DnaNumber`, `dna.DnaBoolean`, `dna.DnaObject<...>`, `dna.DnaArray<...>`, `dna.DnaTuple<...>`, `dna.DnaEnum<...>`, `dna.DnaLiteral<...>`, `dna.DnaOptional<...>`, `dna.DnaNullable<...>`, `dna.DnaFunction<...>`, `dna.DnaPipe<...>`, `dna.DnaRecord<...>`, `dna.DnaMap<...>`, `dna.DnaSet<...>`, etc. For complex generics, prefer `typeof originalSchema` or `ReturnType<typeof dna.<factory>>`.

### Core helpers

- **`isMeta(v)`**: Detects the trailing `{meta}` object on a DNA tuple. A meta object is any plain object (not an array) and it is always the last element.
- **`getMeta(node)`**: Returns the trailing meta object if present, otherwise `undefined`.
- **`getParams(node)`**: Returns the opcode argument. It correctly handles the two common layouts:
  - `[opcode, params, {meta}]`
  - `[opcode, {meta}]` (no params)
- **`build(id)`**: The recursive index resolver. It maintains a `Map<number, DnaTypeWithWrappers>` cache and returns the cached instance if the same `id` has already been built.
- **`buildNode(node, build, dnaList, id, cache)`**: The opcode dispatcher. It receives the normalized `params` and `meta` and constructs the corresponding `DnaType` subclass.

### Recursion handling (`ref` and `$o`)

Recursive schemas are the trickiest part of `fromDna` because a child may reference a parent whose index is larger in the flat `dnaList`.

The `$o` (object) branch pre-creates a `DnaObject` skeleton via `initDna` and immediately stores it in the cache before building its `propertySchemas`:

```typescript
const skeleton = initDna(c.DnaObject, { propertySchemas: {}, ... }, meta);
cache.set(id, skeleton);
const built = buildPropertiesAndReturn(skeleton);
```

When a `ref` opcode is encountered, `build(id)` looks up `cache` first. If the target is the object currently being built, the skeleton is returned, so the cyclic reference is preserved without creating an extra `DnaLazy` indirection. Only unresolved `ref` nodes fall back to `DnaLazy`.

### Opcode dispatch highlights

| Opcode | Reconstructed class | Notes |
|---|---|---|
| `s` | `DnaString` | params `[min, max, pattern, format]` |
| `n` | `DnaNumber` | params `[min, exclMin, max, exclMax, multOf]` |
| `i` | `DnaInt` | same layout as `n` |
| `bi` | `DnaBigInt` | bigint constraints, uses same numeric sentinel layout |
| `b` | `DnaBoolean` | no params |
| `l` / `e` | `DnaLiteral` / `DnaEnum` | single or multiple values |
| `$o` | `DnaObject` | properties, `additionalProperties`, `requiredKeys`, `objType` (`strict` / `loose` / `standard`) |
| `a` | `DnaArray` | items, prefix items, min/max, contains, unique |
| `rcd` | `DnaRecord` | standard, loose, partial, finite keys via `keys` / `required` / `additionalProperties` |
| `wrp` | wrappers | `optional`, `nullable`, `nullish`, `nonoptional`, `exactOptional`, `default`, `prefault`, `catch` |
| `pipe` | `DnaPipe` / `DnaMap` / `DnaSet` | Generic pipeline; special-cased for `Map`/`Set` via `extractMapSet` |
| `transform` | `DnaTransform` | `[fnStr, arity]` executed in a `pipe` |
| `chk` | refiner list | `property` constraints and `func` refinements |
| `jwt` | `DnaJwt` | decoded parameters |
| `discriminator` | `DnaDiscriminatedUnion` | `[propertyName, keys, refs]` |
| `ref` | target schema or `DnaLazy` | see recursion handling above |

### `pipe` reconstruction for `Map` / `Set`

A fluent `dna.map(dna.string(), dna.number())` emits a `pipe` opcode containing:

1. `instanceOf "Map"` with `readonly` meta
2. `transform` (Map → entries object)
3. `rcd` with `propertyNames` and `additionalProperties`
4. `coerce` / default validators
5. `transform` (entries object → Map)

`extractMapSet` scans the `pipe` steps for the `instanceOf`, `chk` (size), `rcd` / `a`, and `transform` markers, then calls `initDna(DnaMap, ...)` or `initDna(DnaSet, ...)` with the rebuilt key/value/item schemas. The `readonly` flag is read from the `instanceOf` step's meta, not the `pipe` node, because the builder stores it there.

### `chkSeq` and refinements

The `chkSeq` opcode carries the schema's accumulated `refinerList`. `fromDna` supports two shapes:

- `["property", propertyName, schema]` → rebuilds a property-level check.
- `["func", fnStr, arity, errorOpt?]` → pushes the function string directly back into the cloned schema's `refinerList` so that `toDna()` emits the same entry.

`refine()` / `superRefine()` / `.check()` all now emit `func` entries, so `fromDna` does not need to distinguish them at reconstruction time.

### `template` reconstruction

The `template` opcode stores pre-computed regex fragments (`passiveParts`) and child schema IDs (`partIds`). Reconstructing via the normal `dna.templateLiteral(parts)` API is **not possible** because `_emitSelf` re-escapes string parts (literals and regex fragments are indistinguishable after the original serialization).

`fromDna` uses an internal subclass `DnaTemplateReconstructed` that overrides `_emitSelf` to inject the `passiveParts` and child schemas directly, bypassing the part→regex transformation. The `canMutate` flag (index 3) distinguishes `templateLiteral` (false) from `templateLiteralMutate` (true).

### Metadata preservation

Every `buildNode` branch calls `initDna(Class, seed, meta)` with the normalized `meta` object extracted from the DNA tuple. This restores:

- `readonly` on primitives, `Map`, `Set`, booleans
- `description` / `~inner` / `coerce` flags
- `nonoptional` wrapper markers

### Limitations

- `func` entries only roundtrip when the original function's `toString()` is complete (no captured variables, no `__name` helpers).
- `async` refinements and `transform`/`preprocess`/`coerce` roundtrip at the DNA level but `toJs` may not generate the matching `ctx` / `await` code yet.
- `dna.function()` serializes as `["function", [inputDnaId, outputDnaId]]` — the input tuple and output schema are full children in the DNA graph. `fromDna` reconstructs the `DnaFunction` with both child schemas. `.implement(fn, externals?)` / `.implementAsync(fn, externals?)` accept an optional externals map (merged with `getRegisteredExternals()`); the returned function exposes `requiredExternals: string[]`.
- `toDna()` equality is a necessary but not sufficient condition for `safeParse` parity; the `toJs` codegen must also support the same opcodes.

## Maranget decision tree codegen (`maranget` opcode)

> **Full reference**: the complete Maranget technical reference — clause matrix
> format, compilation rules, heuristics, P2'-carrying, routing modes, wildcard
> encoding, F1 fix, validation evidence — is in
> [technical-maranget.md](technical-maranget.md). The section below is the
> codegen-specific subset.

> **Conceptual guide**: for the algorithm explained with diagrams (clause
> matrix, mixture rule, P2'-carrying, routing modes), see
> [maranget.md](maranget.md). This section is the codegen reference.

The `maranget` opcode (`dna-js-json.ts > maranget()`, formerly `cli`) compiles a multi-key routing clause matrix into a nested `switch`/`if` decision tree. This is a **simplified adaptation** of Luc Maranget's algorithm (*"Compiling Pattern Matching to Good Decision Trees"*, ML'08, 2008), tailored for CLI-scale schemas (3–50 branches, 2–5 discriminator keys).

### Algorithm

```
Input: clause matrix P (N branches × K keys)
       P[i][j] = finite value set for branch i, key j

emitTree(rows, remainingCols):
  1. If rows is empty → emit fail
  2. col = chooseColumn(rows, remainingCols)
  3. If col == -1 (no column splits) → emit branch validation (leaf)
  4. Group rows by value on column col
     (a row with multiple values appears in multiple groups — specialization)
  5. If key is optional:
       emit if(key === undefined) { subtree } break
       then switch/if on remaining values
       fall-through → fail
     If key is required:
       emit switch(key) { case v: subtree; break; ... default: fail }
  6. Recurse emitTree(group.rows, remainingCols - col) for each group
```

### Column selection heuristic (q-heuristic, simplified)

At each tree node, the algorithm chooses the column to test:

```
chooseColumn(rows, remainingCols):
  for each col in remainingCols:
    count distinct values across all rows for that column
    if distinct < 2 → skip (doesn't split)
  return col with minimum distinct values
```

This is a **simplification of Maranget's usefulness heuristic**. Maranget original selects the column that maximizes branch elimination (usefulness). The codegen selects the column with the **fewest distinct values that still splits** — producing a smaller branching factor at each node.

**Difference**: for N=3 (typical CLI), both heuristics produce the same tree. For N=50 (git/npm scale), Maranget's usefulness would produce a more balanced tree. The simplified heuristic may produce an unbalanced tree (e.g. a 49/1 split instead of 17/17/16).

**Why the simplification is acceptable for CLI**:
- CLI schemas rarely exceed 10–20 branches
- The benchmark ([`perf/bench-ifchain-vs-maranget.ts`](../perf/bench-ifchain-vs-maranget.ts)) shows the tree is 1.2x–2.5x faster than if-chain regardless of balance
- The codegen runs once at schema definition time; only the generated code runs per-call

### Codegen rules (leaf patterns)

The tree leaves and internal nodes follow 6 rules validated by micro-benchmarks (see `sandbox/cli-branches-union-dna-format.md`):

| Rule | Node type | Pattern | Benchmark finding |
|---|---|---|---|
| 1 | Required key | `switch(value)` | Tied with `if-else` (v2) |
| 2 | Optional key | `if(key === undefined)` first, then dispatch | 20% faster than `case undefined` (v2) |
| 3 | Singleton | `if(key === value)` | Tied with 1-case switch |
| 4 | Multi-value | `switch` with explicit `return` per case | 12% faster than `if-or` for 4 values (v3) |
| 5 | Leaf | `return _validate_branchN(input, ctx)` | Trivial |
| 6 | Fail | `return _fail(input, ctx, reason)` | Trivial |

**Rejected alternatives** (benchmark-validated):
- `Set.has` / `Map.has` / `Array.includes`: 40–100% slower for 2–8 values
- Numeric encoding (string→int + switch on int): 2x slower than string switch
- `Object.hasOwn` for optional detection: 2x slower than `=== undefined`

### Optional key handling (DNA fast-fail pattern)

Optional keys (columns marked optional in `discAdn` by the builder — a declaring branch carries `undefined` in its cell, e.g. `[true, undefined]` for `.optional()`) use a labelled sub-block with `break`:

```javascript
cliO0: {
  if(input.verbose === undefined) {
    // subtree for absent verbose
    break cliO0;
  }
  if(input.verbose === true) {
    // subtree for verbose=true
    break cliO0;
  }
  // fall-through: no value matched → fail
  _fail(input, ctx, "cli: no branch matches (verbose)");
}
```

This follows the DNA fast-fail discipline: no `else` chains, each successful path `break`s out of the sub-block, and the fall-through is always the failure case.

### What the codegen does NOT do

- **No matrix construction**: the clause matrix arrives in the opcode args (built by the builder) — the codegen only converts absent cells and `WILDCARD_CELL` markers → WILDCARD and emits the tree computed by `algo/maranget.ts`.
- **No overlap detection**: if two branches have overlapping cells, the tree generates two paths for the same input. The first match wins (determined by tree structure), but this is implicit. Overlap validation should be done at construction time (`cliUnion` factory), not in the codegen.
- **No branch shape recovery**: `fromDna` rebuilds the schema from `branchDef` (the branches are emitted as-is); the matrix is preserved in the ADN (roundtrip verified).

### Wildcard handling (F1 fix, ACT-0028)

The codegen handles **two kinds of wildcard cells** in the ADN matrix:

- **Trailing wildcards** (absent columns at the end of a branch array): encoded
  as positions beyond the array length (sparse). The codegen fills these with
  `WILDCARD` during cell conversion.
- **Non-trailing wildcards** (a wildcard BEFORE a declared value, e.g. a branch
  routing on a different key like `{help:"help"}` without `cmd`): encoded with
  the explicit `WILDCARD_CELL` marker `"\x00"` at their position. The codegen
  converts `"\x00"` → `WILDCARD` (same as beyond-length positions).

Without the marker, a non-trailing absence would shift later values into the
wrong column (misrouting). The marker keeps the matrix position-aligned. See
[maranget.md — F1](maranget.md#f1-non-trailing-wildcard-alignment) for the full
explanation and validation evidence (24 000 oracle comparisons, 0 divergence).

### Benchmark (architecture: if-chain vs Maranget tree)

The benchmark ([`perf/bench-ifchain-vs-maranget.ts`](../perf/bench-ifchain-vs-maranget.ts), 15 runs, 1M iters, polymorphic, GC-controlled) shows the Maranget tree is 1.2x–2.5x faster than if-chain for N ≥ 10 branches, with no measurable difference for N ≤ 3. Full results table and methodology in [cli-union.md — Routing complexity](cli-union.md#routing-complexity).

**Caveat**: the benchmark generates functions via `new Function(...)` with hand-written strings, not via the real `cli.toJS()` codegen. The real generated code may differ slightly in structure (labels, closures, prevalidation step).

## Generated JS Code — Shape & Conventions

This section describes what the **compiled JavaScript** produced by `toJS` in `src/toJs/dna-to-js.ts` looks like, the fast-fail discipline, and the labelled-block layout used by every composite validator.

### 0. Inlining principle

The generated code must be **as inline as possible**. Two consequences:

- **No intermediate `let` / `const`** unless the value is reused at least twice or required for break-semantics (loop counters, eval sets, `prfV<idx>` for `prefault`). Sub-expressions are concatenated directly into the test.
- **No multi-line statement blocks** when a single statement suffices. A guard, an assignment and a `break` should fit on one line: `if(!(test)) break <label>;` — not a 3-line `if { } block`.

Concretely, the `if` body of a fast-fail check is **always a single statement** (`break`, `return`, or an error-push expression), never a brace-delimited block. Braces appear only on labelled-block openers (`oB12:{`, `seqB0:{`) and on the rare positive-gate `if(positive){ ... }` (e.g. `wrp` optional), where their content is itself a flat list of inlined statements.

**Codegen string building — `"" + ""`, never template literals.** All emission code in `src/toJs/*.ts` builds the JS body by **string concatenation** (`"if(!(" + test + "))" + break_`), never by backtick template literals. Reasons:

- **Runtime cost**: every `${expr}` placeholder forces a `ToString` coercion and an intermediate string allocation per interpolation site; the resulting concat is then re-allocated into the final template. Plain `+` on short fragments folds into a single rope/cons-string in V8, is monomorphic, and inlines cleanly into the JIT — consistently faster in hot codegen loops that emit thousands of fragments per schema.
- **Literal beats interpolation, even on identical content**: `"foo" + x + "bar"` is faster than `` `foo${x}bar` `` because the two literal halves are interned constants the JIT can deduplicate; the template form re-builds the surrounding scaffolding on every call.
- **Audit & grep-ability**: every fragment is a literal `"..."` substring, so the exact emitted JS can be grepped from sources (`"break "`, `"if(!("`, `"errors.push({"`, etc.) — template literals would mask fragments behind `${...}` placeholders and make string-level diffs noisier.

Naming convention for pre-formatted fragments (already used in the source): a trailing `_` means the string ends with `;`, a leading `_` means it starts with `;`, so concatenation never requires post-processing — e.g. `break_`, `_break_`, `innerBreak_`, `outerBreak_`.

**Preferred loop form — reverse decrement.** When iterating an array by index (eval-set propagation, prefixItems walking, etc.), the codegen emits:

```js
for (let i = arr.length; i--; ) {
  /* body uses arr[i] */
}
for (let i = arr.length; i--; ) oneOperation;
```

Rationale:

- **Single local variable** (`i`) doubles as both index and loop condition (the `i--` post-decrement evaluates to the current value, then decrements). No separate length cache needed.
- **Comparison against `0` is the cheapest test in V8** — the loop terminates when `i` becomes `0` (falsy), no `<` or `>` comparison.
- **Order-insensitive workloads only**: this form walks indices `n-1 → 0`. Use a forward `for(let i=0;i<n;i++)` only when the operation is order-sensitive (e.g. emitting errors in source order, or stopping on first failure that must report the lowest index).

`while` loops are avoided unless they save a variable that the equivalent `for` would force into existence.

**Object-key iteration — two forms, distinct purposes**:

- `for(const k of Object.keys(obj))` for **user-provided inputs** (`v`, `data`): walks only own enumerable string keys. The `Object.keys` allocation is the price to pay to avoid prototype-pollution leaking into the validation loop. Used in `_unEvalEnv`, `properties`, etc.
- `for(const k in set)` for **internal eval-sets** (`evalISet<idx>`, `evalPSet<idx>`, …): we own these `{}` containers — no inherited keys are possible — so the bare `for…in` is correct and avoids the `Object.keys` array allocation.

Never use `Object.keys(obj).forEach(...)` (extra closure) nor `Object.entries(obj)` (pair allocation per key).

### 1. Function skeleton

`toJS` returns the argument list + body string fed to `new Function(...args, body)` (see `toJS` in `src/toJs/dna-to-js.ts`):

```js
// (v, helper1, helper2, ...)
const FN_dEq=..., FN_fCount=..., L0001=..., L0002=...;   // constBody
let valid /* or data */, tmp0, oVar1, ...;               // letBody
L0001.visit = new Map(); L0002.visit = new Map();        // initBody

/* sBody — generated statement by statement from DNA */

return !!valid;                                          // validator mode
// or:
// return errors.length ? {success:false, errors} : {success:true, data};
```

Two modes, switched by `validateMode`:

- **Validator** — `target = "valid"`, `defaultCtx = { isCond: true }`, returns boolean.
- **Parser** — `target = "data"`, `const errors=[]` added to `constBody`, returns `{ success, data | errors }` (constant `PARSE_RETURN` in `src/toJs/utils.ts`).

### 2. Fast-fail primitive: `if(!(test)) <break|return false>`

The whole codegen funnels through `simpleNodeToJs` in `src/toJs/utils.ts`. For every scalar check:

**Validator mode (`isCond: true`)** — bare-bones early exit:

```js
if (!(typeof v === "string")) return false;
valid = true;
```

**Validator mode under a combinator** (`counter` set, e.g. inside `anyOf`/`allOf`/`oneOf` branch) — failure just **skips the counter increment**; the outer combinator decides:

```js
if(!(test)) break oB12;
counter++;
```

**Parser mode** — error pushed, expression evaluates to `undefined` so it composes safely in `&&` chains (the `&&undefined` tail is the constant `ERR_UNDEF` exported from `utils.ts`):

```js
if (!(typeof v === "string")) errors.push({ message: "...", path: "#", input: v }) && undefined;
data = v;
```

### 3. Labelled blocks for composite validators — `_envFrame`

Instead of nested closures, DNA emits **one labelled block per composite scope** (object, array, `anyOf`/`allOf`/`oneOf`, `unevaluated*`, `not`, the builder's `wrp`). Every consumer goes through the shared helper `_envFrame` in `src/toJs/utils.ts`, which computes the block label, the local break statement, and the outer break statement consistently.

```js
oB12:{                                  // object scope id 12
  if(!(typeof v==="object"&&v!==null&&!Array.isArray(v))) break oB12;
  /* preChecks (minProperties / maxProperties / propertyNames) */
  if((/*minProps fail*/)||(/*maxProps fail*/)) break oB12;
  /* per-key body — fused properties + required + dependent* */
  /* postChecks */
  count++;                              // or: valid = true;
}
```

#### API

```ts
import { _envFrame, type tsCondEnvFrame } from "./utils.js";

const frame: tsCondEnvFrame = _envFrame(parentCtx, "oB", idx);
// {
//   needsOwnBlock: boolean,   // false → block omitted; failures use outerBreak_
//   block:         string,    // "" if no own block, else `${prefix}${idx}`
//   innerBreak_:   string,    // "break <block>;"
//   outerBreak_:   string,    // "break <parent.breakBlock>;"  OR  "return false;"
//   break_:        string,    // innerBreak_ if owned, else outerBreak_
//   _break_:       string,    // ";" + break_  (handy for inline conjunctions)
// }
```

Ownership policy:

| Situation | `needsOwnBlock` |
|---|---|
| `parentCtx.breakBlock` is set (parent already has a scope to break to) | `false` — reuse parent's block, no extra label |
| `parentCtx.ownScope === false` AND no `parentCtx.counter` | `false` — opt-in optimization |
| Otherwise (default) | `true` — emit own labelled block |

The skip-own-block paths are **pure optimizations** for collapsing redundant labels; the semantic contract (failures cannot leak past the success-tail) is preserved because `break_` is rewired to the parent's block in that case.

#### Block-name prefixes observed in the codegen

- `oB<idx>` — `object`
- `arB<idx>` — `array`
- `evalIB<idx>` / `evalPB<idx>` — `unevaluatedItems` / `unevaluatedProperties`
- `anyB<idx>` / `oneB<idx>` / `allB<idx>` — `anyOf` / `oneOf` / `allOf`
- `notB<idx>` — `not`
- `seqB<idx>` — `seq` opcode
- `wrpB<idx>` — builder `wrp` (skip-on-exception wrappers: `optional` / `nullable` / `default`)
- `mb` — main function-level block (constant in `utils.ts`)

#### String-fragment naming convention

Documented in the JSDoc of `_envFrame` and used everywhere in the codegen:

> `_X` = `";X"`, `X_` = `"X;"`, `_X_` has both.

So variables like `break_`, `_break_`, `innerBreak_`, `outerBreak_` are pre-formatted concatenation fragments — **not** statements. Always splice them into emitted strings as-is; never wrap them in further punctuation.

#### When to use `_envFrame`

Any opcode that needs a **single success point** with one or more conditional fail paths inside it. The canonical pattern:

```ts
const idx = labelId();
const frame = _envFrame(parentCtx, "myB", idx);
const { block, break_ } = frame;
const counter_  = parentCtx.counter ?? "";
const outAssign_ = _outVarName ? _outVarName + "=true;" : "";

if (block) steps.push([STEP.BODY, block + ":{"]);
// ...emit fail paths using `break_` (== `break <block>;` or `return false;`)
// ...emit inner DNA with breakBlock=block so inner failures break here
if (counter_ || outAssign_) steps.push([STEP.BODY, counter_ + outAssign_]);
if (block) steps.push([STEP.BODY, "}"]);
```

This pattern guarantees that `counter_` and `outAssign_` are emitted **exactly once** on the success path, and **never** on any failure path. See `wrp` in `src/toJs/dna-js-builder.ts` for a minimal reference implementation; `object`, `array`, `anyOf`, `oneOf`, `allOf`, `not` in `dna-js-json.ts` for more elaborate ones.

### 4. Break policy: local vs propagated

From `_envFrame`:

```ts
const innerBreak_ = "break " + block + ";";
const outerBreak_ = parentCtx.breakBlock ? "break " + parentCtx.breakBlock + ";" : "return false;";
const break_ = needsOwnBlock ? innerBreak_ : outerBreak_;
```

Two parent regimes:

- **Counter pattern** (`anyOf`/`oneOf`/`allOf` children): `parentCtx.counter` is defined, no `breakBlock` is propagated — a local failure just **skips the increment**; the outer combinator reads `count` and decides.
- **Break pattern** (e.g. `properties` which unconditionally marks its `evalSet` after the child returns): `parentCtx.breakBlock` is defined — failures must **escalate** so the parent's success marker does NOT fire.

`simpleNodeToJs` encodes this: if `counter` is set it replaces the error message (absence of increment = error); otherwise the failure path emits `break <block>;` or `return false;`.

### 5. Type-check hoisting (`parentCtx.typeChecked`)

Each type opcode remembers the last `typeof` it produced so downstream opcodes **don't retest** it:

```ts
const test = parentCtx.typeChecked === "string" ? "" : "typeof " + inVar + '==="string"';
parentCtx.typeChecked = "string";
```

### 5bis. Discriminator/CLI routing-key redundancy elision (`parentCtx.testedProp`)

`discriminatedUnion`/`cliUnion` dispatch via a `switch` (single key) or a Maranget
decision tree (multi-key) — see [Maranget decision tree codegen](#maranget-decision-tree-codegen-cli-opcode).
By the time a branch's own object body runs, the router has *already* proven,
via that `switch`'s `case` control flow, that the routing key's value equals
one of this branch's declared values. Without `testedProp`, the branch would
redundantly re-verify the same fact twice: once via `Object.hasOwn` (handler
`o`) and once via a `literal`/`enumType` equality check — both always `true`
at that point, i.e. dead code that still costs a function call + branch on
every `validate()`/`parse()`. The branch would also re-read `v[key]` for the
output, a redundant property access when the router already has the value in
a local variable.

`parentCtx.testedProp?: Record<string, string>` (`dna-js.types.ts`) removes all three:

1. **`discriminator` handler** (`dna-js-json.ts`) propagates `{ [key]: discValVar }`
   (e.g. `{ cmd: "discVal0" }`) into each branch's `childCtx.testedProp`. The
   `discValVar` is the `const` variable declared before the `switch`.
2. **`cli` handler** pre-declares `const cliV<idx>_<col> = v[key], ...` for all
   routing keys and propagates `{ [key]: "cliV<idx>_<col>" }` into each branch's
   `childCtx.testedProp`. The decision tree also uses these variables instead of
   re-reading `v[key]` at each level.
3. **Handler `o`**, for each declared property `k`: skips the `hasOwn`
   fast-fail when `k` is in `testedProp`, uses the pre-bound variable
   (`let ob2pp0 = discVal0` instead of `let ob2pp0 = v["cmd"]`), and — critically
   — **shrinks** `testedProp` to `{ [k]: varName }` (or explicit `undefined`,
   never a stale spread) in the fresh `childrenCtx` it builds for *that* property
   before invoking its sub-schema. Evaluated-property marking (`evalMark`/`unEvalObj`)
   and the sub-schema invocation are never skipped — only the redundant tests
   and the redundant property access are.
4. **`literal`/`enumType`** (not `enumTypeDeep`, see below) check
   `parentCtx.testedProp` and, if set, skip their own equality test entirely —
   no need to inspect *which* value matched, since reaching this code at all
   already proves it (the `switch`'s `case`, not this leaf, is the actual proof).

**Performance benefit.** Each routing key is read from the input object exactly
once (by the router). The branch reuses the pre-bound variable for output
assignment, transforms, and pipe steps — eliminating one property access per
routing key per `validate()`/`parse()`.

**Propagation boundary — linear chains only.** `wrp` (optional/nullable/
default/prefault) and `pipe` steps forward `parentCtx` (and thus `testedProp`)
unchanged to their target, because they represent the *same* value along one
deterministic path (this is what lets a piped routing key, e.g.
`pipe(literal("build"), transform(...))`, keep its `transform` step
executing normally — only the `literal` step's own check is skipped, and the
transform applies on the pre-bound value).
`allOf`/`oneOf` must **not** forward `testedProp` to their members: those are
branching applicators (several simultaneous or alternative sub-schemas), and
the router's `switch` does not necessarily validate all of them as a whole.
This is currently moot — `finiteValueSet` rejects any `allOf`/`oneOf`-shaped
routing key before a `discriminatedUnion`/`cliUnion` can even be constructed
— but keep the invariant if that restriction is ever relaxed. `anyOf`
coincidentally already doesn't leak `testedProp` (its `childrenCtx` is built
from scratch, not spread from `parentCtx`), but that is an accident of
unrelated code, not a deliberate guard.

**Why `enumTypeDeep` never reads `testedProp`.** A `switch`/`case` compares by
`===`; it cannot express deep equality (`FN_dEq`). A discriminator value that
requires deep-equal comparison can therefore never be produced by a `switch`
in the first place — `finiteValueSet` rejects it at construction, same as for
`allOf`/`oneOf`. Adding the skip to `enumTypeDeep` would guard an unreachable
branch, not close a real gap.

### `state.kind` vs `.type` getter: the hybrid label problem

The internal `BaseCore` stores a `kind` field (formerly `type`) that serves a **dual purpose** depending on the schema class:

1. **As the DNA opcode** (directly emitted into bytecode by `_emitSelf`):
   - `DnaNumber`: `kind = "n"` → emitted as `["n", ...]`
   - `DnaBigInt`: `kind = "bi"` → emitted as `["bi", ...]`
   - `DnaInt`: `kind = "i"` → emitted as `["i", ...]`
   - `DnaBoolean`: `kind = "b"` → emitted as `["b"]`

2. **As a descriptive label only** (the opcode is hardcoded in `rawDna` or constructed in `_emitSelf`):
   - `DnaAny`: `kind = "any"` → `rawDna = ["T"]` (opcode is `"T"`)
   - `DnaUnknown`: `kind = "unknown"` → `rawDna = ["F"]` (opcode is `"F"`)
   - `DnaNull`: `kind = "null"` → `rawDna = ["n0"]` (opcode is `"n0"`)
   - `DnaString`: `kind = "string"` → `rawDna = ["s", ...]` (opcode is `"s"`)
   - `_DnaWrapper`: `kind = "wrap"` → `rawDna = ["wrp", ...]` (opcode is `"wrp"`)

Because of this duality, `kind` is typed as `string` (not `tsDnaOpcode`). When `_emitSelf` uses `kind` as an opcode, it casts with `as tsDnaOpcode`.

The public `.type` getter returns a **Zod-aligned descriptive name** via per-class overrides:

| Class | `state.kind` (internal) | `.type` getter (public) | Source of `.type` |
|---|---|---|---|
| `DnaNumber` | `"n"` | `"number"` | `NumberImpl` override |
| `DnaBigInt` | `"bi"` | `"bigint"` | `DnaBigInt` override |
| `DnaInt` | `"i"` | `"int"` | `DnaInt` override |
| `DnaInt32` | `"i"` | `"int32"` | `DnaInt32` override |
| `DnaBoolean` | `"b"` | `"boolean"` | `DnaBoolean` override |
| `DnaStringBool` | `"sb"` | `"stringbool"` | `DnaStringBool` override |
| `DnaString` | `"string"` | `seed.format \|\| "string"` | `DnaString` override |
| `DnaEmail` | `"string"` | `"email"` | inherited from `DnaString` (via `seed.format`) |
| `DnaUUID` | `"string"` | `"uuid"` | inherited (via `seed.format`) |
| `DnaTemplateLiteral` | `"string"` | `"templateLiteral"` | `DnaTemplateLiteral` override |
| `DnaUnion` | `"anyOf"` | `"union"` | `DnaCombinator` override (via `seed.combinatorType`) |
| `DnaIntersection` | `"allOf"` | `"intersection"` | `DnaCombinator` override |
| `DnaXorUnion` | `"oneOf"` | `"xor"` | `DnaCombinator` override |
| `DnaDiscriminatedUnion` | `"discriminator"` | `"discriminatedUnion"` | `DnaDiscriminatedUnion` override |
| `_DnaWrapper` subclasses | `"wrap"` | `seed.wrapperType` | `_DnaWrapper` override |
| `DnaOptional` | `"wrap"` | `"optional"` | inherited (via `seed.wrapperType`) |
| `DnaNullable` | `"wrap"` | `"nullable"` | inherited |
| `DnaDefault` | `"wrap"` | `"default"` | inherited |
| `DnaAny` | `"any"` | `"any"` | base getter (`state.kind` is already descriptive) |
| `DnaUnknown` | `"unknown"` | `"unknown"` | base getter |
| `DnaLiteral` | `"literal"` | `"literal"` | base getter |
| `DnaObject` | `"object"` | `"object"` | base getter |
| ... | ... | ... | base getter (when `kind` is already descriptive) |

The base `DnaType.get type()` returns `this._core.state.kind` as-is. Classes where `kind` is a short opcode override the getter to return a descriptive name. Classes where `kind` is already descriptive (e.g. `"any"`, `"object"`, `"literal"`) rely on the base getter.

### `_core` is public (no more `SymCore`)

The `_core` field on `DnaType` was previously `protected` and accessed externally via a `SymCore` symbol. This indirection was removed: `_core` is now `public` on `DnaType` and all subclasses. The `SymCore` symbol declaration has been deleted. The `DnaSomeType` interface declares `readonly _core: BaseCore<any>` directly.

This simplifies internal access patterns (e.g. `schema._core.seed` instead of `schema[SymCore].seed`) and eliminates the symbol-based escape hatch.
```

When `test === ""`, `simpleNodeToJs` emits no test branch — just the success marker. See `s`/`_s`, `n`/`_n`/`i`/`bi`, `boolean`, `nullType`, `sym`, `date`, `file` in `dna-js-json.ts` and `dna-js-builder.ts`.

### 6. Snippet: `wrp` (builder wrapper for optional/nullable/default/prefault)

From the `wrp` handler in `src/toJs/dna-js-builder.ts`. For `z.string().optional()`.

**Style rule (no `else`)**: every branch must collapse into one of three outcomes — _nothing happens_ (fall through), _exit the block_ (`break <label>;`), or _record an error_ (`errors.push({...}) && undefined`). `if/else` chains are forbidden because they nest scopes instead of flattening control flow.

**Validator** — the inner check is gated by a positive `if` only because the exception value (`undefined`/`null`) is itself a legal success; on the path through the gate we keep using `if(!(test)) break`:

```js
if(!(v===void 0)){
  if(!(typeof v==="string")) break mb;
}
valid = true;
```

**Parser** — same shape, exit-on-error stays a `break` (or `return` at root), no `else` to wrap the "happy" branch:

```js
if(v===void 0){ data = void 0; break wrpB0; }
if(!(typeof v==="string")) errors.push({...}) && undefined;
data = v;
```

`default` skips the inner check on `undefined` and emits the literal the same way (early `break` after the literal assignment). `prefault` substitutes the literal upstream then **always** runs the inner check (allocates a `prfV<idx>` temporary, no branching needed).

### 7. Snippet: object with `required`

Style documented next to the `object` handler in `dna-js-json.ts` — AJV-like grouping. One `if(Object.hasOwn(v,K))` block per declared key, fusing `properties` + `required` + `dependentRequired` + `dependentSchemas`. `required` keys emit `if(!hasOwn(v,K)) break oB<idx>;` upfront, without `else`.

### 8. Refs and recursion

The `STEP.END_REF` / `STEP.STR_REF` handlers in `dna-to-js.ts` wrap every referenced schema in a named closure `L0001`, `L0002`, ... with **memoization via a `Map`** (`fn.visit`) to short-circuit cycles:

```js
L0001 = (v, _ea, _eo) => {
  if (L0001.visit.has(v)) return L0001.visit.get(v);
  L0001.visit.set(v, true); // anti-recursion sentinel
  _ea || (_ea = {}); // unEval propagation prelude (hashmap)
  _eo || (_eo = {});
  let d;
  /* body */
  L0001.visit.set(v, d);
  return !!d; // or: d (parser)
};
```

Callers that participate in **in-place applicator propagation** (e.g. a `$ref` sibling of `unevaluatedProperties`) pass their own `unEvalArr`/`unEvalObj` hashmap names as `_ea`/`_eo`; otherwise the prelude allocates dummy hashmaps discarded at return.

**Eval-set containers — plain object `{}` (validated by benchmark).** All eval-tracking structures (`evalISet<idx>`, `evalPSet<idx>`, `oneEvalArr<idx>`, `discEvalObj<idx>`, …) are plain objects `{}` populated via `set[k]=1` and iterated via `for(const k in set)` / `Object.keys(set).length` (see `_unEvalEnv` and `oneOf` / `discriminator` handlers in `dna-js-json.ts`). The `evalPrelude` in `dna-to-js.ts` is also aligned on `{}` (it used to emit `new Set()` inconsistently).

**Benchmark — realistic context** (`sandbox/bench-realistic.ts`, Node v26, 200 000 iters, `new Function()`-built validator with mixed property access + eval-set ops in the same hot loop):

| Workload (string keys)      | n   | `{}` + `[k]=1`/`[k]` | `new Set()` + `.add`/`.has` | `new Map()` + `.set`/`.has` |
| --------------------------- | --- | -------------------- | --------------------------- | --------------------------- |
| Object validator + eval-set | 4   | **15.46 ms**         | 23.80 ms (×1.54)            | 27.06 ms (×1.75)            |
| Object validator + eval-set | 20  | 458 ms (×1.38)       | **333 ms**                  | 361 ms (×1.08)              |

- For the **typical JSON-Schema workload** (≤ ~10 properties), plain object `{}` beats `Set`/`Map` by **1.5–2×** in the actual generated-code context.
- At larger N (≥ ~20 properties), `Set` becomes competitive and eventually faster, but this is atypical for JSON Schema validation.
- Why the prior naïve microbench (`sandbox/bench-set-vs-hashmap.ts`) suggested the opposite: it measured call-sites in isolation inside transpiled TS, where V8 monomorphizes the dispatch. In real `new Function()`-built validators the call-sites are unique and short-lived, so `Set.prototype.add`/`has` cannot be inlined and pay the full megamorphic-builtin cost. The **realistic** bench reflects what the codegen actually pays at runtime.

**Memo Maps stay `Map`.** `L<id>.visit = new Map()` (emitted by the `STEP.END_REF` / `STEP.STR_REF` handlers in `dna-to-js.ts`) keeps `Map` because keys are arbitrary user values (objects/arrays/primitives mixed). Replacing with `{}` would coerce keys to strings (breaking object identity), and `WeakMap` rejects primitives. `Map` is the only correct container for this site.

### 9. Summary table

| Concern                | Mechanism                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| **Control flow**       | `if(!(test)) break <label>;` — never `try/catch`                                                  |
| **Composition**        | labelled blocks (`oB12:{ ... }`), no nested functions                                             |
| **Combinators**        | local counter + skip-increment-on-failure                                                         |
| **Errors (parser)**    | `errors.push({...}) && undefined`                                                                 |
| **Result (validator)** | trailing `valid=true;` then `return !!valid`                                                      |
| **Recursion**          | refs compiled as `L<id>` closures + `.visit` map                                                  |
| **Optimizations**      | `typeChecked` hoist, `_envFrame.needsOwnBlock`, `escStr` for messages, fused per-key object block |

### 10. Real generated examples

The following snippets are the **actual output** of `toJS` for representative JSON Schemas (Draft 2020-12), routed through `@ytrynot/schvalid`'s `jschemaToDna` converter. They are regeneratable for any schema by converting it to DNA and calling `toJS(true, false)(dna)` / `toJS(false, false)(dna)`; the full collection for the test suite is produced by `packages/schvalid/sandbox/collect-schema-adn-functions.ts`.

Formatting note: the codegen emits a single-line body (no whitespace). The snippets below are presented as-emitted; line breaks are visual aids only.

#### 10.1 `{ "type": "string", "minLength": 3, "maxLength": 10, "pattern": "^[a-z]+$" }`

**Validator:**

```js
function (v) {
  const fCount = s => { let i=s.length,c=0; while(i--){ if((s.charCodeAt(i)&0xFC00)!==0xDC00) c++ } return c };
  let valid, strCnt;
  if(!(typeof v==="string")) return false;
  strCnt = fCount(v);
  if(!((strCnt>=3) && (strCnt<=10) && (spptn0.test(v)))) return false;
  valid = true;
  return !!valid;
}
```

Three constraints fused into a single conjunctive guard. The `pattern` regex is compiled once in the outer closure (`const spptn0 = /^[a-z]+$/u;`) and only `spptn0.test(v)` runs on each validation, so large or frequently-used patterns are not re-created on every call. The `fCount` helper counts code points (not UTF-16 code units) by skipping low surrogates.

##### `fCount` vs `String.prototype.length` — spec compliance and Zod divergence

DNA uses `fCount` (code points) for `.min()` / `.max()` / `.length()` string constraints, while Zod v4 uses `String.prototype.length` (UTF-16 code units). This is a **deliberate spec-compliance choice**, not a bug.

**Spec justification:**
- RFC 8259 §7 defines a JSON string as "a sequence of zero or more Unicode characters", and states that an astral character (e.g. U+1D11E) is a single character even though it is encoded as a UTF-16 surrogate pair (`\uD834\uDD1E`).
- JSON Schema Validation §6.3.1/6.3.2 (maxLength/minLength) defines string length as "the number of its characters as defined by RFC 8259" — i.e. code points, not UTF-16 code units.

**Consequence:** for strings containing astral characters (surrogate pairs), DNA and Zod disagree on length:

| Input | Zod `.length` (UTF-16 units) | DNA `fCount` (code points) |
|---|---|---|
| `"abc"` | 3 | 3 |
| `"é"` (U+00E9 precomposed) | 1 | 1 |
| `"e\u0301"` (decomposed) | 2 | 2 |
| `"😀"` (U+1F600) | 2 | 1 |
| `"🇫🇷"` (regional indicator pair) | 4 | 2 |
| `"👩‍🚀"` (ZWJ sequence) | 5 | 3 |

This means `.max(5)` on `"🇫🇷"` passes in DNA (2 ≤ 5) but fails in Zod (4 > 5). Neither counts grapheme clusters — both are "code point" vs "code unit" level, not `Intl.Segmenter` level.

**Performance trade-off:** `fCount` is O(n) (iterates the string), `String.prototype.length` is O(1) (native property). DNA accepts this cost as the price of spec compliance — `@ytrynot/schvalid` targets JSON Schema 2020-12 conformance, where "length" means code points.

**Tests:** `packages/dna/tests/utf16-length.test.ts` documents 29 divergence cases across BMP, astral plane, flag emojis, ZWJ sequences, lone surrogates, and mixed ASCII + astral strings.

#### 10.2 `{ "type": "integer", "minimum": 0, "maximum": 100 }`

**Validator:**

```js
function (v) {
  let valid;
  if(!(typeof v==="number" && v%1===0)) return false;
  if(!((v>=0) && (v<=100))) return false;
  valid = true;
  return !!valid;
}
```

**Parser** — single ternary assignment: `data = (type-test) ? (constraint && constraint && ... && v) : (push type-err)`. Each constraint that fails pushes its **own** error via `||errors.push(...) && undefined`; the conjunction short-circuits the rest of the chain only if a prior constraint already returned a truthy value (it never does, because the `&& undefined` tail ensures every failed constraint contributes `undefined`):

```js
function (v) {
  const errors = [];
  let data;
  data = typeof v==="number" && v%1===0
    ? ((v>=0) || errors.push({message:"Number must be at least 0", path:'#/integer/minimum', input:v}) && undefined)
      && ((v<=100) || errors.push({message:"Number must be at most 100", path:'#/integer/maximum', input:v}) && undefined)
      && v
    : errors.push({message:"integer is required", path:'#/integer', input:v}) && undefined;
  return errors.length ? {success:false, errors} : {success:true, data};
}
```

**Contract**: either the type fails (one type error pushed, no constraint checks attempted), or the type passes and only the actually-failing constraints push their own messages. `simpleNodeToJs`'s parser branch is the single emission point — the ternary structure (rather than two sequential `if(!(...))` statements) is what guarantees this contract.

#### 10.3 `{ "type": "object", "properties": { "name": string, "age": integer ≥ 0 }, "required": ["name","age"] }`

**Validator:**

```js
function (v) {
  let valid;
  oB0: {
    if(!(typeof v==="object" && v!==null && !Array.isArray(v))) break oB0;
    if(!Object.hasOwn(v,"name")) break oB0;
    let ob0pp0 = v["name"];
    if(!(typeof ob0pp0==="string")) break oB0;
    if(!Object.hasOwn(v,"age")) break oB0;
    let ob0pp1 = v["age"];
    if(!(typeof ob0pp1==="number" && ob0pp1%1===0)) break oB0;
    if(!((ob0pp1>=0))) break oB0;
    valid = true;
  }
  return !!valid;
}
```

Canonical example of the section 3 pattern: one labelled block `oB0`, every check inlined as `if(!(test)) break oB0;`, no `else`, no nested blocks. Per-key sub-validation is hoisted into the same block via `let ob0pp<k> = v[K]` aliases.

#### 10.4 `{ "type": "array", "items": { "type": "string" }, "minItems": 1 }`

**Validator:**

```js
function (v) {
  let valid;
  arB0: {
    if(!(Array.isArray(v))) break arB0;
    const aLen0 = v.length;
    if((aLen0<1)) break arB0;
    for(let i=0; i<aLen0; i++) {
      const val0 = v[i];
      if(!(typeof val0==="string")) break arB0;
    }
    valid = true;
  }
  return !!valid;
}
```

> **Note**: the array loop here is forward (`i<aLen0`), not reverse (`i--`). This is **order-sensitive** for parsers (errors must be reported in array order, and the output array is filled in index order). The reverse-decrement form (section 0, "Preferred loop form") is used for **order-insensitive** workloads such as eval-set propagation and `Object.keys` walks.

#### 10.5 `{ "enum": ["red", "green", "blue"] }`

**Validator:**

```js
function (v) {
  let valid;
  if(!((v==="red" || v==="green" || v==="blue"))) return false;
  valid = true;
  return !!valid;
}
```

Strict `===` disjunction — no `Set` lookup, no `Array.includes`. For small enums this is optimal; for very large enums the codegen would emit `dEq` (deep-equal) via `enumTypeDeep` when at least one entry is an object/array.

#### 10.6 strictObject — `additionalProperties: false`

`{ "type":"object", "properties":{ "id":string }, "required":["id"], "additionalProperties": false }`

**Validator:**

```js
function (v) {
  let valid;
  oB0: {
    if(!(typeof v==="object" && v!==null && !Array.isArray(v))) break oB0;
    const passed0 = {}, oVar0 = Object.keys(v), oLen0 = oVar0.length;
    if(!Object.hasOwn(v,"id")) break oB0;
    let ob0pp0 = v["id"];
    if(!(typeof ob0pp0==="string")) break oB0;
    passed0["id"] = "id";
    if(Object.keys(passed0).length < oLen0) break oB0;
    valid = true;
  }
  return !!valid;
}
```

The `passed0` plain-object hashmap accumulates the declared keys that matched (`passed0[K] = K`); the final `Object.keys(passed0).length < oLen0` test rejects any unaccounted-for key in `v`. This is the exact eval-set pattern documented in section 8, applied at object scope.

---

> **Note (2026-06)**: an earlier flattened rewrite of `simpleNodeToJs` (formerly `_assignOrCond`) in `utils.ts` violated the contracts documented in this section (double-pushed type errors, broke the `anyOf` counter pattern, emitted `if(!())` empty tests). The canonical 16-case matrix (`D|T|B|C`) was restored from the initial implementation (`git 9be6cc2`) and now lives in `utils.ts`. The full JSON Schema Draft 2020-12 suite (1148 tests) passes again. Regenerate snippets via `sandbox/gen-examples-v2.ts` if the codegen evolves.

---

## Type Architecture

### `DnaType` vs `DnaSomeType`

`DnaType<T, I>` is the concrete, nominal base class for every schema. It owns the runtime implementation, the collector interface, and the builder chain state. `DnaSomeType<T, I>` is the *structural interface* that `DnaType` implements: it exposes only the public fluent API. This split exists so that methods and properties that must accept or return any subclass (`unwrap`, `_inputSchema`, `_outputSchema`, `.meta()`, `cloner` callbacks, etc.) can be typed through the interface without forcing every implementation to agree on a single concrete generic.

- `DnaType` carries `readonly declare _output: T` and `readonly declare _input: I` to keep output and input types distinct.
- `DnaSomeType` declares `readonly _head: unknown` so that recursive helpers such as `$InputHead` have a base case and do not loop on the head link.
- `DnaSomeType` also serves as the **loose constraint** for wrapper classes (`DnaOptional`, `DnaNullable`, …) and `this`-typed builder methods (`optional()`, `nullable()`, …), mirroring Zod v4's `SomeType = { _zod: _$ZodTypeInternals }`. This is critical for recursive type inference (see [Deferred output/input](#deferred-outputinput-and-recursive-type-inference) below).
- `DnaSomeType` is **not** a catch-all. It is only an interface view of `DnaType`; no value is constructed as `DnaSomeType` directly.

### Core state and the `BaseCore` indirection

Every `DnaType` instance delegates runtime state to a `BaseCore` object exposed via the public `_core` field. Core state includes the seed constraints, the collector, the pre-process wrapper list, meta, and `head`.

- `head` is stored as `unknown` in `BaseCore` and in the `tsStateFull` type. It is an *opaque* link to the previous schema in a chain and is only consumed by the type-level helper `$InputHead`; it is never typed as `DnaType` at runtime.
- `SymSetHead(head: unknown)` mutates the core and returns `this`. The method signature accepts `unknown` so that the head link can be set from any schema type without casting.

### Building instances without casts

`initDna<C, S>(Class, seed, meta?)` returns a `Class<S>` and is the only place where a new schema instance is constructed. `cloner(this, fn)` produces a sibling of the same concrete class while letting the caller mutate the new core. To keep TypeScript from widening the return type:

- The `cloner` callback parameter is annotated as `this` so the generic `R` in `cloner` is inferred as `this`.
- `meta(value?)` uses `cloner(this, (cl: this) => cl._core.rawMeta(value))` and returns `this | tsDnaInnerMeta`; no `as any` cast is needed.

### Wrapper chain and `unwrap()`

`DnaTypeWithWrappers` defines `unwrap(): DnaSomeType`. Because wrappers (`DnaOptional`, `DnaNullable`, `DnaDefault`, `DnaCatch`) wrap an `DnaSomeType` (their `Inner` constraint is `DnaSomeType`, not `DnaType<any, any>`), the base return type is the interface, not a concrete `DnaType`. This lets `DnaPromise.override unwrap()` return the inner promise-wrapped schema as `DnaSomeType` without introducing an extra generic or unsafe cast. The `DnaSomeType` constraint (rather than `DnaType<any, any>`) is also what allows recursive schemas to compile — see [Deferred output/input](#deferred-outputinput-and-recursive-type-inference) below.

### Function schemas and covariance

`DnaFunction` keeps `input` and `output` as bare constraint seeds. Its private helpers `_inputSchema()` and `_outputSchema()` return `DnaSomeType` because the seeds can produce non-`DnaType` nodes (for example `DnaTuple` for variadic arguments, or `DnaUnknown` when no output is declared). Returning the covariant interface avoids the impossible assignment `DnaTuple <: DnaType` and eliminates casts inside `DnaFunction`.

### Why `_head` is `unknown`

`$InputHead<T>` recursively resolves a schema's effective input by following `_head` links. If `_head` were typed as `DnaSomeType | undefined`, the recursion had no base case and `dna.inputHead`/`dna.infer` for array/object chains would hit instantiation depth limits or produce `any`. By declaring `_head: unknown` in `DnaSomeType`, the head link becomes an opaque edge and `$InputHead` falls back to `$Input<T>` when the head is not a concrete schema. This is the reason `BaseCore.head` and `DnaSomeType._head` are both `unknown`.

### Deferred output/input and recursive type inference

Recursive schemas (a `DnaObject` that references itself via a getter, mutual recursion between two objects, linked lists, etc.) require special type-system handling. Without deferral, TypeScript tries to resolve `_output`/`_input` **eagerly** during class instantiation, which creates a circular reference and produces `TS7022`/`TS7023`/`TS2615` errors.

The solution mirrors Zod v4's architecture, where `ZodObject<out Shape>` extends `$ZodType<any, any, $ZodObjectInternals<Shape>>` — the parent class uses `any` for its type parameters, and the actual output/input types are accessed via the `._zod` internals (an indexed access that defers resolution).

#### The deferred pattern in DNA

Every class that computes `_output`/`_input` from a type parameter (e.g. `T` for `DnaObject`, `S` for `DnaArray`, `Inner` for wrappers) follows the same three rules:

1. **Parent uses `any, any`**: The class extends its parent with `any` for both `T` and `I`, so the parent's `readonly declare _output: T` resolves to `any` and does **not** force eager resolution of the computed type.

2. **Re-declare via `declare readonly`**: The actual output/input types are re-declared on the subclass with `declare readonly _output: $ComputedType<Param>`. Because `declare` fields are erased at runtime and are not subject to variance checks, TypeScript defers their resolution until the type is explicitly queried (e.g. `dna.infer<typeof schema>`).

3. **No `out` variance needed on `DnaObject`'s `T`**: The `T` parameter is only used in `declare` fields (not subject to variance checks) and in the `extends DnaTypeWithWrappers<any, any>` parent (which uses `any`, not `T`). Without `out`, `T` is invariant but never checked, so the circular dependency is broken by the deferral alone. Adding `out T` triggers a variance check that fails because `$ReadonlyValue` (a conditional type) wrapping `$DnaObjectOutput<T>` (a mapped type) is not provably covariant. `DnaPipe<out S, out T>` is safe because its `_output` is a conditional type (`$Output<T>`) that resolves to `unknown` for unconstrained `T`.

Classes following this pattern:

| Class | Type param | Parent | Deferred `_output` / `_input` |
|---|---|---|---|
| `DnaObject` | `T` (no `out`) | `DnaTypeWithWrappers<any, any>` | `$DnaObjectOutput<T>` / `$DnaObjectInput<T>` |
| `DnaArray` | `S` | `DnaTypeWithWrappers<any, any>` | `$Output<S>[]` / `$Input<S>[]` |
| `DnaTuple` | `S, R` | `DnaTypeWithWrappers<any, any>` | `tsDnaTupleValueWithRest<S, …>` |
| `DnaPipe` | `out S, out T` | `DnaTypeWithWrappers<any, any>` | `$Output<T>` / `$Input<S>` |
| `DnaDiscriminatedUnion` | `K, S` | `DnaTypeWithWrappers<any, any>` | `$Output<S[number]>` / `$Input<S[number]>` |
| `DnaCliUnion` | `S` | `DnaTypeWithWrappers<any, any>` | `$Output<S[number]>` / `$Input<S[number]>` |
| `DnaRecord` | `K, V` | `DnaTypeWithWrappers<any, any>` | `Record<$Output<K> & PropertyKey, $Output<V>>` |
| `_DnaWrapper` | `Inner` | `DnaTypeWithWrappers<any, any>` | `Out` / `In` (defaults: `$Output<Inner>` / `$Input<Inner>`) |
| `DnaOptional` | `Inner` | `_DnaWrapper<Inner, any, any>` | `$Output<Inner> \| undefined` |
| `DnaNullable` | `Inner` | `_DnaWrapper<Inner, any, any>` | `$Output<Inner> \| null` |
| `DnaNullish` | `Inner` | `_DnaWrapper<Inner, any, any>` | `$Output<Inner> \| null \| undefined` |
| `DnaNonOptional` | `Inner` | `_DnaWrapper<Inner, any, any>` | `$RemoveUndefined<$Output<Inner>>` |

#### `readonly()` and variance: the `$ReadonlyReturnType` helper

The `readonly()` method on `DnaTypeWithWrappers` clones the schema and sets `meta.readonly = true`. Its return type must map `_output` and `_input` through `$ReadonlyValue<T>` (which wraps non-primitive types in `Readonly<T>`).

**The `$ReadonlyReturnType` helper:**

```typescript
type $ReadonlyReturnType<S extends { _output: any; _input: any }> =
  Omit<S, "_output" | "_input" | "readonly"> & {
    readonly _output: $ReadonlyValue<S["_output"]>;
    readonly _input: $ReadonlyValue<S["_input"]>;
  };

readonly(): $ReadonlyReturnType<this> { ... }
```

`_output` and `_input` become **intersection members** (properties), not **type parameters** of a class. Properties are always covariant in TypeScript, so the variance check passes.

**Why `DnaObject` does NOT need `out T`:**

Through sandbox testing (see `sandbox/variance-test.ts`), we proved that:

1. **Without `out`**: `DnaObject<{key: DnaString}>` is assignable to `DnaObject<Record<string, DnaSomeType>>` — TypeScript treats `T` as invariant, but since `DnaObject` extends `DnaTypeWithWrappers<any, any>`, the `T` parameter is only used in `declare` fields (not subject to variance checks). The invariant `T` is never checked because it doesn't appear in any method signature or base class type parameter.

2. **With `out T`**: TypeScript triggers a variance check on `DnaObject<sub-T>` <: `DnaObject<super-T>`. It must verify that `readonly()` is compatible, which requires `$ReadonlyValue<$DnaObjectOutput<sub-T>>` <: `$ReadonlyValue<$DnaObjectOutput<super-T>>`. This fails (TS2636) because:
   - `$DnaObjectOutput<T>` is a **mapped type** `{ [K in keyof T]: $Output<T[K]> }`
   - `$ReadonlyValue` is a **conditional type** `unknown extends T ? T : T extends primitive ? T : Readonly<T>`
   - TypeScript decomposes `$ReadonlyValue<mapped<Sub>>` into a union: `mapped<Sub> | (mapped<Sub> extends primitive ? ... : Readonly<mapped<Sub>>)`
   - The first branch (`mapped<Sub>` itself) is NOT assignable to `$ReadonlyValue<mapped<Super>>` — TypeScript cannot prove that a conditional type wrapping a mapped type is covariant in its parameter

3. **`DnaPipe<out S, out T>` works** because `_output = $Output<T>` is a **conditional type** (not a mapped type). `$ReadonlyValue<$Output<T>>` resolves to `unknown` when `T` is unconstrained (because `$Output<T>` = `unknown` when `T` doesn't extend `{ _output: ... }`, and `$ReadonlyValue<unknown>` = `unknown`). `unknown` is trivially assignable to anything, so the variance check passes.

**The root cause — conditional types wrapping mapped types are not provably covariant:**

The key insight is that `$ReadonlyValue<T>` is a conditional type. When `T` is a mapped type with unresolved type parameters, TypeScript cannot prove covariance because:
- It decomposes the conditional into a union of its branches
- The first branch (`T` itself, before the `extends primitive` check) is not provably assignable to the target conditional type
- Mapped types ARE covariant on their own (`Readonly<Sub> <: Readonly<Super>`), but wrapping them in a conditional type breaks this property

**Why `out` on `DnaType` / `DnaTypeWithWrappers` / `DnaTransform` does not work:**

Adding `out` to these classes moves the TS2636 error onto themselves. The same `$ReadonlyValue` conditional type wrapping indexed access `S["_output"]` creates the same variance violation at the parent level.

**Summary of the variance chain:**

| Class | `out`? | Why |
|---|---|---|
| `DnaObject` | no | `out T` triggers variance check on `$ReadonlyValue<mapped<T>>` which fails (conditional type wrapping mapped type is not provably covariant). Without `out`, `T` is invariant but never checked (only used in `declare` fields). |
| `DnaPipe` | `out S, out T` | `_output = $Output<T>` is a conditional type. `$ReadonlyValue<$Output<T>>` resolves to `unknown` for unconstrained `T`, which is trivially covariant. `out` is needed for `transform()` chain compatibility. |
| `DnaType` | no | `out` causes TS2636 on itself due to `$ReadonlyValue` wrapping indexed access |
| `DnaTypeWithWrappers` | no | Same reason — inherits `readonly()` which uses `$ReadonlyReturnType` with indexed access |
| `DnaTransform` | no | Same reason — appears in `DnaPipe`'s type args, but `DnaPipe<out S, out T>` handles variance at the `DnaPipe` level |

#### Loose constraints (the `DnaSomeType` / `SomeType` parallel)

In addition to deferral, the **type constraints** on builder functions and wrapper classes were loosened to match Zod v4's approach:

- **`dna.object` / `strictObject` / `looseObject`**: `T extends Record<string, any>` (was `Record<string, DnaSomeType>`). This mirrors Zod's `$ZodLooseShape = Record<string, any>`.
- **`dna.array` / `DnaArray`**: `S extends DnaSomeType` (was `DnaType<any, any>`). This mirrors Zod's `SomeType = { _zod: _$ZodTypeInternals }`.
- **Wrapper classes** (`DnaOptional`, `DnaNullable`, …): `Inner extends DnaSomeType` (was `DnaType<any, any>`).
- **`_DnaWrapper`**: `Inner extends DnaSomeType` (was `DnaType<unknown, unknown>`).
- **`this`-typed builder methods** (`optional()`, `nullable()`, `default()`, …): `This extends DnaSomeType` (was `DnaTypeWithWrappers<T, I>`).

The tighter `DnaType<any, any>` constraint forced TypeScript to resolve the full class hierarchy (including `_output`/`_input`) just to verify the constraint, which re-introduced the circular dependency. The looser `DnaSomeType` constraint only requires the structural shape `{ _output, _input, _head, … }`, which is satisfied by `any` (the deferred parent) without resolution.

#### `default()` and `prefault()` use `this["_output"]` / `this["_input"]`

The `default()` and `prefault()` methods on `DnaTypeWithWrappers` use `this["_output"]` and `this["_input"]` for their `value` parameter types, rather than the class type parameters `T` and `I`. This is necessary because the class parameters are `any` (deferred parent), and the actual output/input types are only accessible via the `this`-typed indexed access, which resolves through the `declare` fields on the concrete subclass.

### Practical consequences

- Methods that must return the same concrete class should return `this` and use `cloner` callbacks typed as `this`.
- Methods that intentionally lose the concrete class (cross-schema helpers, `unwrap`, `_inputSchema`/`_outputSchema`) return `DnaSomeType`.
- Always use `instanceof DnaType` for runtime class checks; `DnaSomeType` is a compile-time view only.
- Do not add `| any` parameters or `as any` casts to silence variance errors — widen the return type to `DnaSomeType` or fix the seed typing instead.
- Classes that compute `_output`/`_input` from a type parameter MUST use the deferred pattern (parent `any, any` + `declare readonly` re-declaration) to support recursive schemas. See [Deferred output/input](#deferred-outputinput-and-recursive-type-inference) above.
- Builder methods that accept a schema argument (`optional()`, `nullable()`, `dna.array()`, …) MUST constrain it to `DnaSomeType`, not `DnaType<any, any>`, to avoid re-introducing circular type resolution.
- Methods that transform `_output`/`_input` (e.g. `readonly()`) MUST NOT return `DnaType<NewOut, NewIn>` — the invariant `I` parameter breaks variance. Use a dedicated helper type (`$ReadonlyReturnType<S>`) that emits the transformed types as **intersection properties** instead of class type parameters. See [`readonly()` and variance](#readonly-and-variance-the-readonlyreturntype-helper) above.
- **Do NOT add `out` to `DnaObject`'s `T` parameter.** Without `out`, `T` is invariant but never variance-checked (only used in `declare` fields), so everything works. With `out`, TypeScript triggers a variance check that fails because `$ReadonlyValue` (a conditional type) wrapping `$DnaObjectOutput<T>` (a mapped type) is not provably covariant. `DnaPipe<out S, out T>` works because `$Output<T>` is a conditional type that resolves to `unknown` for unconstrained `T`.

## `DnaCliUnion` typing — specifics and edge cases

`DnaCliUnion<S>` follows the deferred pattern (parent `any, any` + `declare readonly` re-declaration, see [Deferred output/input](#deferred-outputinput-and-recursive-type-inference) above). This section documents the specifics that are not covered by the general deferred pattern.

### `const S` type parameter — tuple inference

```typescript
export function cliUnion<const S extends readonly DnaSomeType[]>(
  schemas: S,
  config?: ICliUnionConfig,
  meta?: string | tsDnaMeta
): DnaCliUnion<S>
```

The `const` modifier on `S` ensures that `dna.cliUnion([a, b, c])` infers `S = readonly [typeof a, typeof b, typeof c]` (a tuple, not a widened array). Without `const`, `S` would be `DnaSomeType[]` and `S[number]` would resolve to `DnaSomeType`, eroding `_output` to `unknown`.

### `.options` getter — the `as unknown as S` cast

```typescript
get options(): S {
  // CAST: _core.seed.schemas is DnaSomeType[] (erased at runtime);
  // S is the static tuple type and TS cannot verify the array-to-tuple correspondence
  return this._core.seed.schemas as unknown as S;
}
```

The cast is **justified** and follows the repo rules (`// CAST:` comment on its own line above the cast). `_core.seed.schemas` is typed `DnaSomeType[]` (the runtime storage erases tuple information), while `S` is the static tuple type. TypeScript cannot verify that the runtime array corresponds to the static tuple. This is the same pattern as `DnaUnion.options` (line 1218-1220 in `dna-interfaces.ts`).

### Empty branch array — `_output = never`

```typescript
const empty = dna.cliUnion([] as const);
type Out = typeof empty["_output"]; // never, not unknown
```

`S = readonly []` → `S[number] = never` → `$Output<never>` distributes over `never` and yields `never`. This is because distributive conditional types over `never` produce `never`, not the `false` branch (`unknown`).

This is **consistent with `DnaUnion<S>`** which uses the same `$Output<S[number]>` pattern. It is semantically defensible (an empty union cannot produce any valid value), but counter-intuitive — `unknown` would have been a safer default to avoid silent `never` propagation in pipelines. Documented here as a known edge case.

### Type erosion when widened to `DnaCliUnion<readonly DnaSomeType[]>`

```typescript
const erased: DnaCliUnion<readonly DnaSomeType[]> = cli;
type Out = typeof erased["_output"]; // unknown
```

`$Output<DnaSomeType>` = `unknown` (the `false` branch of `S extends { _output: any } ? S["_output"] : unknown`). The `@ytrynot/cli` package stores the `cliUnion` as `DnaCliUnion<readonly DnaSomeType[]>` in `IProcessedContract.cliUnion` (see `packages/cli/src/types/contract.types.ts:138`), so the typed output is only available at the construction site, not after storage in the contract.

### `toParseArgsConfig()` — concrete (non-generic) return type

```typescript
toParseArgsConfig(opts?: { strict?: boolean }): {
  allowPositionals: true;
  strict: boolean;
  options: Record<string, {
    type: "string" | "boolean";
    multiple: boolean;
  }>;
}
```

The return type is **concrete**, not generic over `S`. The `options` keys are determined at runtime by introspecting the branches (unwrapping `_DnaWrapper`/`DnaPipe`, extracting leaf types via `unwrapToLeaf` and `deriveOptionType`). Inferring `options` from `S` at the type level would require mapping each branch, unwrapping wrappers, and extracting leaf types — extremely complex for marginal gain. The concrete typing is the right trade-off.

### `ICliUnionConfig` — minimal, runtime-only

```typescript
export interface ICliUnionConfig {
  positionals?: string[];
  discriminators?: string[];
}
```

No `shorts` or `strict` — these are `parseArgs`-level concerns, not schema concerns (ADMIN decision 2026-08-15, documented in the `toParseArgsConfig` JSDoc). `strict` is passed to `toParseArgsConfig({ strict })` at call time. `shorts` auto-generation and override are deprecated and will be removed.

### Verification

The typing was verified by `tsc --noEmit -p tsconfig.json` (strict, NodeNext, verbatimModuleSyntax) with type-regression assertions using `expectTypeOf`:

- `S` is inferred as `readonly [typeof buildDev, typeof buildProd, typeof deploy]` ✓
- `_output` is the union of branch outputs ✓
- `_input` is the union of branch inputs ✓
- `.options` returns `S` ✓
- `.optional()` preserves `_output | undefined` ✓
- Type erosion when widened to `DnaCliUnion<readonly DnaSomeType[]>` → `_output = unknown` ✓
- `dna.infer<typeof cli>` == union of branch outputs ✓
- `toParseArgsConfig()` return type matches the concrete signature ✓
- Single-branch `cliUnion([a])` → `_output = typeof a["_output"]` ✓
- Empty array `cliUnion([] as const)` → `_output = never` ✓

See [cli-union.md — Typing model](cli-union.md#typing-model) for the user-facing documentation of the typing model.
