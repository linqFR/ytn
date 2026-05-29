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
- `["_s", [min, max, pattern, format], {meta}]` - String constraints only (without type check)
- `["n", [min, exclMin, max, exclMax, multOf], {meta}]` - Number type with constraints (with type check)
- `["_n", [min, exclMin, max, exclMax, multOf], {meta}]` - Number constraints only (without type check)
- `["i", [min, exclMin, max, exclMax, multOf], {meta}]` - Integer type with constraints
- `["bi", [min, exclMin, max, exclMax, multOf], {meta}]` - BigInt type with constraints
- `["b", {meta}]` - Boolean type
- `["n0", {meta}]` - Null type

### Value Constraints

- `["c", value, {meta}]` - Constant value (simple/primitive types)
- `["cD", value, {meta}]` - Constant value (complex/object types, deep comparison)
- `["l", value, {meta}]` - Literal value (complex/object types)
- `["e", [values], {meta}]` - Enumeration of values (shallow comparison)
- `["eD", [values], {meta}]` - Enumeration of values (deep comparison)

### Object Types

- `["o", [constraints], {meta}]` - Object type with constraints (with type check)
- `["_o", [constraints], {meta}]` - Object constraints only (without type check)

**Constraints** are:

- `["minProperties", n]` - Minimum properties
- `["maxProperties", n]` - Maximum properties
- `["properties", [["key", ref], ...]]` - Property definitions with references
- `["patternProperties", [[pattern, ref], ...]]` - Pattern-based properties
- `["additionalProperties", bool|ref]` - Additional properties schema (boolean or reference)
- `["propertyNames", ref]` - Property names validation (schema reference)
- `["required", [keys], targetIdx]` - Required properties with target reference
- `["dependentRequired", object]` - Dependent required properties
- `["dependentSchemas", [[key, ref|bool], ...]]` - Dependent schemas (conditional validation based on property presence)
- `["unevaluatedProperties", ref]` - Unevaluated properties

### Array Types

- `["a", [constraints], {meta}]` - Array type with constraints (with type check)
- `["_a", [constraints], {meta}]` - Array constraints only (without type check)

**Constraints** are:

- `["minItems", n]` - Minimum items
- `["maxItems", n]` - Maximum items
- `["uniqueItems", complexity]` - Unique items constraint (0 for simple types, 1 for deep comparison)
- `["contains", ref]` - Contains validation (schema reference)
- `["minContains", n]` - Minimum contains
- `["maxContains", n]` - Maximum contains
- `["prefixItems", [refs]]` - Tuple prefix items
- `["items", ref]` - Items schema (schema reference)
- `["unevaluatedItems", ref]` - Unevaluated items

### Schema Composition

- `["allOf", [refs]]` - Must pass all validators
- `["anyOf", [refs]]` - Must pass at least one validator
- `["oneOf", [refs]]` - Must pass exactly one validator
- `["discriminator", propertyName, [keys], [refs]]` - Optimized polymorphic validation using OpenAPI 3.1 discriminator. Uses a `switch` statement for efficient dispatching based on the discriminator property value. The discriminator property is removed from sub-schemas during DNA generation to avoid double validation, and reintroduced in the output during parsing if no errors occurred.
- `["not", ref]` - Negation of validator
- `["ifThenElse", [ifRef, thenRef, elseRef]]` - Conditional validation

### Modifiers

- `["optional"]` - Optional property
- `["nullable"]` - Nullable value
- `["default", value]` - Default value
- `["prefault", value]` - Pre-fault value
- `["seq"]` - Sequence modifier

### References

- `["ref", targetIdx, {meta}]` - JSON Schema reference with target index and metadata. The target is a numeric reference to another DNA index.

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
