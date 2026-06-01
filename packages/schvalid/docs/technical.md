# Technical Documentation

## DNA Format Specification

### DNA Structure

The DNA bytecode is an array of instruction tuples. During processing, DNA is stored as an object with numeric keys for efficient referencing, but the final output is an array:

```typescript
type tsDna = [tsDnaOpcode, ...any[]];
type tsDnaOpcode = "string" | "number" | "boolean" | "object" | "array" | ...;
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

- `"o"` for object type
- `"s"` for string type
- `"n"` for number type
- `"i"` for integer type
- `"b"` for boolean type
- `"n0"` for null type

## DNA Opcodes

The implementation uses short opcodes for optimal V8 performance. Each DNA instruction is a tuple: `[opcode, args..., {meta}]`.

Underscore prefix (e.g., `"_o"`, `"_s"`, `"_n"`) indicates unconstrained types. If the type does not match, constraints and validation will not be performed.

### Primitive Types

- `["s", [min, max, pattern, format], {meta}]` - String type with constraints (with type check)
  - `min`: Minimum length (number or null)
  - `max`: Maximum length (number or null)
  - `pattern`: Regex pattern string (string or null)
  - `format`: Format identifier like "email", "url" (string or null)
  - Validation: Pattern has priority over format in `dna-js-full.ts`

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
  - Used for Zod `.int()` schemas (detected via `format: "safeint"`)

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
  - `keys`: Array of discriminator values
  - `refs`: Array of DNA index references corresponding to keys
  - Uses `switch` statement for efficient dispatching
  - Discriminator property removed from sub-schemas during generation

- `["not", ref]` - Negation of validator
  - `ref`: DNA index reference
  - Validation: Referenced schema must fail

- `["ifThenElse", [ifRef, thenRef, elseRef]]` - Conditional validation
  - `ifRef`: DNA index reference for condition schema
  - `thenRef`: DNA index reference for schema if condition passes
  - `elseRef`: DNA index reference for schema if condition fails

### Modifiers

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

## Architecture

### Stack-Based Traversal

The `jschemaToDna` function uses an iterative stack-based approach:

- Processes schema nodes by pushing them onto a stack
- Uses a store mechanism to hold intermediate DNA results with numeric references
- Handles back-references and complex keyword processing through store IDs

### Store Mechanism

The `store` is a Map that holds intermediate DNA results during traversal, allowing back-references and complex keyword processing. Store IDs are used to reference DNA entries before they are finalized.

### DNA to JavaScript Compilation

DNA bytecode is compiled to standalone JavaScript functions via the `dna-js-full.ts` engine. The generated code uses:

- **Hashmaps instead of Sets**: For tracking evaluated properties/items (`evalSet`, `passedIdx`), plain objects `{}` are used instead of `Set` for better performance and smaller generated code.
- **Compact assignments**: Hashmap entries use `=1` instead of `=key` for minimal overhead.
- **Truthy checks**: `!hashmap[key]` instead of `===undefined` for existence checks.
- **Optimized loops**: Array iteration uses `i-->0` pattern to correctly handle index 0.
- **Label-based control flow**: Labeled blocks (`oB0:`, `evalIB0:`) with `break` statements for fail-fast validation.

#### Validation Modes

The DNA-to-JS compiler produces two types of functions:

1. **Validator Mode** (`validator(dna)`): Boolean-only validation with fail-fast semantics. Returns `true/false` immediately on first error.
2. **Parser Mode** (`parser(dna)`): Full error collection with data transformation. Returns `{success: true, data: {...}}` or `{success: false, errors: [...]}`.

### Performance Optimizations

- Direct DNA generation without intermediate representations
- Short opcodes for V8 optimization
- Numeric sentinels (-1, null) for absent constraints
- Lazy evaluation with stack-based processing
- Hashmap-based tracking for evaluated properties/items (no Set overhead)
- Standalone generated functions (no external dependencies)

## Zod v4 to DNA Conversion

### Zod v4 Architecture

Zod v4 introduced significant changes from v3:

- **Internal Structure**: `._def` moved to `._zod.def` for definition access
- **ZodEffects Dropped**: Refinements no longer wrapped in ZodEffects class
- **Checks Concept**: Each schema contains an array of "checks" that generalizes refinements
- **Access Protocol**:
  - Use `instanceof` for base type identification
  - Use `._zod` buffer for internal data access (NOT `_def`)
  - Use `._zod.def` for definition access
  - Use `.unwrap()` for wrappers (optional, nullable, default)
  - Use `._zod.checks` for refinements/checks
  - Use `._zod.bag` for constraint storage (minimum, maximum, format, etc.)

### Zod to DNA Conversion Patterns

#### Number Constraints

Zod v4 stores number constraints in `._zod.bag`:

```typescript
const bag = (schema as any)._zod.bag || {};
const minVal = bag.minimum !== undefined ? bag.minimum : null;
const maxVal = bag.maximum !== undefined ? bag.maximum : null;
const multOfVal = bag.multipleOf !== undefined ? bag.multipleOf : null;
const exclMinVal = bag.exclusiveMinimum !== undefined ? true : null;
const exclMaxVal = bag.exclusiveMaximum !== undefined ? true : null;
```

**Integer Detection**: Use `bag.format === "safeint"` to detect integer types and emit opcode `"i"` instead of `"n"`.

**Exclusive Bounds**: Zod v4 uses `exclusiveMinimum`/`exclusiveMaximum` as numeric values. In DNA, these are converted to boolean flags (`true`/`null`) per `dna-js-full.ts` expectations.

**Safeint Defaults**: Zod v4 adds default safeint bounds (`-9007199254740991` to `9007199254740991`) when using `.int()`. These should be preserved in DNA output.

#### String Constraints

Zod v4 stores string constraints in `._zod.bag`:

```typescript
const bag = (schema as any)._zod.bag || {};
const minVal = bag.minimum !== undefined ? bag.minimum : null;
const maxVal = bag.maximum !== undefined ? bag.maximum : null;
const formatVal = bag.format !== undefined ? bag.format : null;
```

**Pattern Extraction**: For formats like `.email()`, the pattern regex is not stored as a string in `._zod.bag.patterns`. Instead, extract it from `toJSONSchema()`:

```typescript
const jsonSchema = schema.toJSONSchema();
const patternVal = jsonSchema.pattern || null;
```

**Format vs Pattern**: Both are included in DNA output. Pattern has priority for validation (used in `dna-js-full.ts`), format is stored for compatibility/future use.

#### Object Properties

**Required Fields**: Extract required fields by detecting non-optional/nullable/default properties:

```typescript
const required: string[] = [];
entries.forEach(([key, fieldSchema]) => {
  const isOptional = fieldSchema instanceof z.ZodOptional || 
                    fieldSchema instanceof z.ZodNullable ||
                    fieldSchema instanceof z.ZodDefault;
  if (!isOptional) {
    required.push(key);
  }
});
```

**Optional Handling**: For object properties, unwrap optional/nullable/default wrappers before processing. The optional status is handled by the `required` array, not by an `optional` wrapper in DNA:

```typescript
const unwrappedField = unwrapZod(fieldSchema);
stack.push({ schema: unwrappedField, ... });
```

**Standalone Optional**: For schemas outside object properties, use the `optional` wrapper: `["optional", [baseIndex]]`.

**Additional Properties**:
- `strictObject`: `additionalProperties: false`
- `looseObject`: `additionalProperties: true`
- Normal object: no `additionalProperties` (undefined)

Detect strictness via catchall:
```typescript
const def = (schema as any)._zod.def;
const isStrict = def.catchall && def.catchall.constructor.name === "ZodNever";
const isLoose = def.catchall && def.catchall.constructor.name === "ZodAny";
```

#### DNA Cache

Use JSON.stringify-based caching to avoid duplicate DNA instructions:

```typescript
const dnaCache = new Map<string, number>();
const _dna = JSON.stringify(byteDNA);
if (dnaCache.has(_dna)) return dnaCache.get(_dna);
```

#### Placeholder Mechanism

Use `storeDNA`/`storeId`/`storePosition` for deferred DNA emission (similar to `jschema-to-dna`):

```typescript
const setStore = (targets: any): number => {
  const storeId = store.size;
  store.set(storeId, targets);
  return storeId;
};

const updateStore = (storeId: number, targetIdx: number, position?: number | number[]): void => {
  if (typeof position === "number") {
    store.get(storeId)[position] = targetIdx;
  } else if (Array.isArray(position)) {
    store.get(storeId)[position[0]][position[1]] = targetIdx;
  } else {
    store.set(storeId, targetIdx);
  }
};
```

### Key Differences from JSON Schema Conversion

1. **Constraint Storage**: Zod uses `._zod.bag` instead of direct schema properties
2. **Integer Detection**: Zod uses `format: "safeint"` instead of `type: "integer"`
3. **Optional Handling**: Zod uses wrapper classes (`ZodOptional`, `ZodNullable`) instead of schema-level flags
4. **Pattern Storage**: Zod stores patterns in `toJSONSchema()` output, not in internal structure
5. **Default Values**: Zod uses `ZodDefault` wrapper instead of `default` property

### DNA Output Format

Each DNA instruction includes a meta object at the end:

```typescript
["s", [min, max, pattern, format], {}]
["i", [min, exclMin, max, exclMax, multOf], {}]
["o", [["required", required], ["properties", propertiesDef]], {}]
```

### Missing Conversions

The following Zod v4 features are not yet converted to DNA:

- **ZodPipe**: Handle `.in`/`.out` for transforms
- **ZodTransform**: Transform function extraction and serialization
- **Refinements/Checks**: Custom validation functions
- **ZodUnion**: Union type conversion → opcode `anyOf`
- **ZodDiscriminatedUnion**: Discriminated union conversion → opcode `discriminator`
- **ZodRecord**: Record type conversion (both arguments required in v4)
- **ZodIntersection**: Intersection type conversion → opcode `allOf`
- **XOR** : → opcode `oneOf`

### Shared Infrastructure

Use `@ytn/shared` helpers from `shared/zod/zod-reflection.ts`:

- `unwrapZod()`: Single level unwrap (uses `.unwrap()`)
- `unwrapZodDeep()`: Recursive unwrap with pipe/lazy support
- `getZodShape()`: Extract object shape (shallow)
- `isZodOptional()`, `isZodDefault()`, etc.: Type checkers

