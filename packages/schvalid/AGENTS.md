# AGENTS.md (Package: @ytn/dna)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the DNA Schema package.

---

## Core Architecture

The codebase is organized around DNA bytecode conversion and validation. DNA is a compact opcode-based format for high-performance JSON Schema validation.

### Core Modules

- **`src/dna.type.ts`**: Core DNA type definitions and instruction structures. This is the foundation for all DNA operations.
- **`src/jschema-to-dna.ts`**: Primary JSON Schema to DNA converter using stack-based traversal.
- **`src/dna-to-jschema.ts`**: DNA to JSON Schema bijection (reverse conversion).
- **`src/dna-to-zod.ts`**: DNA to Zod schema conversion with full V4 compliance.
- **`src/zod-to-dna.ts`**: Zod to DNA conversion for bidirectional compatibility.
- **`src/dnaz-processor.ts`**: DNA validation engine and runtime processor.
- **`src/dna-helpers.ts`**: Utility functions for DNA manipulation and inspection.
- **`src/string-formats.ts`**: String format validation utilities.

### Conversion Modules

- **`src/dna-to-js.ts`**: DNA to JavaScript validation functions.
- **`src/toJS/`**: Directory containing JavaScript conversion utilities.
  - **`kw-to-js-full.ts`**: Full keyword-to-JavaScript conversion handlers.
  - **`kw-to-js-valid.ts`**: Validation-focused keyword-to-JavaScript conversion (work in progress)
  - **`jshelpers.ts`**: JavaScript helper functions.
  - **`utils.ts`**: General utility functions.

---

## DNA to JavaScript Code Generation

### Code Generation Architecture

The DNA to JavaScript conversion uses a step-based system that generates JavaScript validation functions from DNA opcodes. The core type is `tsJSFn` which can be either a string or an array of steps.

### Core Types

```typescript
type tsJSStepString = string;
type tsJSStepOp = [number, string, string?, string?, tsJSParentCtx?];
type tsJSStepAct = [(typeof STEP)[keyof typeof STEP], string];
type tsJSFn = tsJSStepString | (tsJSStepOp | tsJSStepAct)[];
```

- **`tsJSStepString`**: Direct JavaScript expression (e.g., `typeof v==="string"`)
- **`tsJSStepOp`**: DNA operation tuple with opcode and context
- **`tsJSStepAct`**: Action step like `STEP.BODY` or `STEP.LET`

### Step Processing

The `dna-to-js.ts` processor handles two types of step results:

1. **String Return**: Directly concatenated to the output body
2. **Array Return**: Steps are pushed onto a stack and processed in reverse order

```typescript
if (typeof steps === "string") {
  sBody += steps; // Direct expression
} else {
  // Push steps onto stack for processing
  stack.push(...steps);
}
```

### Execution Modes

#### isCond Mode (Conditional Mode)

Used for validation-only scenarios where no error collection is needed.

- **Purpose**: Generate boolean expressions for validation
- **Primitives**: Return expressions (e.g., `typeof v==="string"`)
- **Applicators**: Return step arrays with conditional logic
- **Key Pattern**: Use `counter` context to capture validation results

Example of counter pattern:

```typescript
{ ...parentCtx, isCond: true, counter: "tmpVar=true" }
```

This generates: `expression && (tmpVar=true)`

#### Parser Mode

Used for parsing scenarios where error collection and data transformation are needed.

- **Purpose**: Generate full validation with error reporting
- **Primitives**: Return assignments with error handling (e.g., `v = expr ? v : err`)
- **Applicators**: Return step arrays with error collection
- **Key Pattern**: Use output variable for result assignment

### Primitive vs Applicator Signatures

#### Primitives (type, number, boolean, string, etc.)

**Signature**: `tsJSStepString` (returns string)

**isCond Mode**: Returns expression

```typescript
return "typeof v==='string'";
```

**Parser Mode**: Returns assignment with error

```typescript
return _outVarName + "=" + test + "?" + _inVarName + ":" + err + ";";
```

#### Applicators (ifThenElse, not, anyOf, allOf, object, array, etc.)

**Signature**: `tsJSStepOp[]` (returns array of steps)

**isCond Mode**: Returns step array with counter pattern for result capture

```typescript
steps.push([STEP.BODY, "let tmpVar=false;"]);
steps.push([schemaIdx, inputVar, "", path, { isCond: true, counter: "tmpVar=true" }]);
steps.push([STEP.BODY, ";"]);
steps.push([STEP.BODY, "if(tmpVar)"]);
```

**Parser Mode**: Returns step array with output variable assignment

```typescript
steps.push([STEP.BODY, "let tmpVar=false;"]);
steps.push([schemaIdx, inputVar, tmpVar, path, { isCond: true }]);
steps.push([STEP.BODY, "if(tmpVar)"]);
```

### Critical Pattern: Counter for Result Capture

In isCond mode, primitives return expressions without assignments. To capture results:

```typescript
// Counter pattern forces assignment
{ isCond: true, counter: "resultVar=true" }

// Generates: expression && (resultVar=true)
```

This is essential for applicators like `ifThenElse`, `not` that need to use the inner schema's result.

### Example: ifThenElse Implementation

The `ifThenElse` keyword demonstrates the complexity of handling both modes:

```typescript
if (isCond) {
  // Capture if schema result using counter pattern
  steps.push([STEP.BODY, "let ifV0=false;"]);
  steps.push([ifPart, input, "", path, { isCond: true, counter: "ifV0=true" }]);
  steps.push([STEP.BODY, ";"]);
  steps.push([STEP.BODY, "if(ifV0)"]);

  // Handle then branch
  if (thenPart === -1) {
    steps.push([STEP.BODY, "{valid=ifV0;}"]);
  } else {
    steps.push([STEP.BODY, "{"]);
    steps.push([thenPart, input, output, path, { isCond: true, counter: "valid=true" }]);
    steps.push([STEP.BODY, ";"]);
    steps.push([STEP.BODY, "}"]);
  }

  // Handle else branch
  if (elsePart === -1) {
    steps.push([STEP.BODY, "else{valid=true;}"]);
  } else {
    steps.push([STEP.BODY, "else{"]);
    steps.push([elsePart, input, output, path, { isCond: true, counter: "valid=true" }]);
    steps.push([STEP.BODY, ";"]);
    steps.push([STEP.BODY, "}"]);
  }
}
```

**Generated Code**:

```javascript
let valid = false;
ifB0: {
  let ifV0 = false;
  typeof v === "number" && v < 0 && (ifV0 = true);
  if (ifV0) {
    valid = ifV0;
  } else {
    typeof v === "number" && v % 2 === 0 && (valid = true);
  }
}
return valid;
```

### Array Handling: contains and itemsIndex

The `contains` keyword requires special handling in array validation, particularly when combined with the `items` keyword.

#### itemsIndex Values

- **number (DNA index)**: Reference to items schema for validation
- **true**: Accept all extra items, copy as-is
- **false**: Reject all extra items beyond prefixItems
- **0 (undefined)**: No items schema, items are not validated

#### contains Behavior

**contains is a control, not an assigner**:

- Validates that at least one item matches the contains schema
- Does not filter or transform items
- Original data must be preserved in parser output

#### Loop Generation Logic

The `needLoop` flag determines whether an item loop is generated:

```typescript
// Triggers needLoop:
// - prefixItems present
// - items schema present (itemsIndex !== 0)
// - contains schema present (containsSteps.length > 0)
```

#### itemsIndex === 0 Handling

When `itemsIndex === 0` (no items schema):

1. **Without prefixItems**: Direct array copy

   ```typescript
   if (itemsIndex === 0 && !needLoop) {
     if (prefixItemsLength > 0) needLoop = true;
     else steps.push([STEP.BODY, _outVarName + "=" + _inVarName + ";"]);
   }
   ```

2. **With prefixItems**: Loop for additional items

   ```typescript
   // In loop:
   else {
       steps.push([STEP.BODY, _outVarName + "[i]=" + loopVar + ";"]);
   }
   ```

#### Unique Loop Variable Names

For nested arrays, use unique loop variable names to avoid conflicts:

```typescript
const loopVar = "val" + idx;
steps.push([STEP.BODY, "for(let i=" + prefixItemsLength + ";i<" + aLen + ";i++){const " + loopVar + "=" + _inVarName + "[i];"]);
```

#### Contains Validation Pattern

For non-primitive contains schemas, use temporary variables to avoid labeled blocks in expressions:

```typescript
// isCond mode:
steps.push([STEP.BODY, "let tmpContains=false;"]);
steps.push([STEP.BODY, "if(condition){tmpContains=true;}"]);
steps.push([STEP.BODY, "if(!tmpContains)++containsCnt;"]);

// Parser mode:
steps.push([STEP.BODY, "let tmpContains=false;"]);
steps.push([STEP.BODY, "if(condition){tmpContains=true;}"]);
steps.push([STEP.BODY, "if(!tmpContains)++containsCnt;"]);
```

### Common Pitfalls

1. **Missing counter in isCond mode**: Results not captured when needed

   - **Solution**: Use `counter: "var=true"` pattern

2. **Invalid syntax with missing branches**: `if(true){}` when then/else absent

   - **Solution**: Generate explicit assignments or empty blocks

3. **Signature mismatch**: Treating primitives as applicators or vice versa

   - **Solution**: Check return type and handle string vs array accordingly

4. **Context propagation**: Not passing correct `isCond` flag to child schemas

   - **Solution**: Always propagate `isCond` in parentCtx, override only when needed

5. **Variable naming conflicts in nested loops**: Using the same loop variable name across nested array levels

   - **Solution**: Use unique loop variable names per level: `loopVar = "val" + idx`

6. **NEVER treat Contains as assigner**: Trying to use contains as an assigner or transformer is incorrect.

   - **Solution**: Contains is ALWAYS a control (check), NEVER an assigner. It validates that at least one item matches the schema but does not transform the data.

7. **Labeled blocks in expressions**: Using labeled breaks inside expressions causes syntax errors
   - **Solution**: Use temporary variables and separate if-blocks for contains validation

### Debugging Code Generation

1. **View generated function**: Use `validator.toString()` to inspect generated code
2. **Check syntax errors**: Look for missing semicolons or invalid constructs
3. **Verify counter pattern**: Ensure `&& (var=true)` is present when needed
4. **Test both modes**: Validate isCond and parser mode separately

---

## DNA Format Specification

### DNA Structure

```typescript
type tsDna = [tsDnaOpcode, ...any[]];
type tsDnaSeq = tsDna[];
type tsDnaOpcode = "string" | "number" | "boolean" | "object" | "array" | ...;
```

### Key Principles

- **Array-Based Instructions**: DNA instructions are tuples with opcode first, followed by parameters.
- **Categorized Opcodes**: Opcodes are organized by logical groups (Primitive Types, Constraints, Object Structure, etc.).
- **Reference-Based**: Complex structures use numeric references to avoid duplication.
- **Stack Processing**: Iterative stack-based traversal with store mechanism for reference resolution.

---

## Development Guidelines

### Testing DNA Conversions

- **Bijection Testing**: Always test both directions (Schema ↔ DNA ↔ Schema) to ensure lossless conversion.
- **Use `./sandbox/`**: Create test files in the sandbox directory for experimentation.
- **Reference Validation**: Compare DNA output against known valid patterns.
- **IMPORTANT**: When debugging, use `console.dir(obj, {depth: null})` instead of `JSON.stringify(obj, null, 2)` - the latter is considered bad practice.

### Performance Considerations

- **Direct Generation**: Avoid intermediate AST representations when possible.
- **Numeric Sentinels**: Use `-1` and `null` for absent constraints to minimize memory.
- **Lazy Evaluation**: Implement stack-based processing for complex schemas.

---

## Module-Specific Instructions

### jschema-to-dna.ts

- **Stack Management**: Properly handle stack-based traversal and store mechanism.
- **Keyword Processing**: Use the `keywords/` directory for complex JSON Schema keywords.
- **Reference Resolution**: Handle `$ref` pointers within the same document only.

### dna-to-zod.ts

- **V4 Patterns**: Use `z.strictObject()`, `z.looseObject()` over method calls.
- **Error Handling**: Use `{ error: ... }` parameter instead of deprecated `{ message: ... }`.
- **Pipeline Support**: Handle `.in` and `.out` for transforms correctly.

### dnaz-processor.ts

- **Runtime Validation**: Implement efficient opcode execution.
- **Error Reporting**: Provide clear, actionable validation errors.
- **Performance**: Optimize for high-throughput validation scenarios.

---

## Testing Workflow

### Required Test Types

1. **Unit Tests**: Individual opcode and conversion function tests.
2. **Integration Tests**: End-to-end Schema ↔ DNA ↔ Schema bijection tests.
3. **Performance Tests**: Validation throughput benchmarks.
4. **Type Tests**: Verify TypeScript type correctness with `expectTypeOf`.

### Test Organization

- **`tests/`**: Main test suite with comprehensive coverage.
- **`sandbox/`**: Experimental test files and validation scripts.
- **Bijection Verification**: Always include round-trip conversion tests.

---

## Conversion Workflows

### JSON Schema → DNA → Zod

1. Parse JSON Schema using `jschema-to-dna.ts`
2. Optimize DNA structure if needed
3. Convert to Zod using `dna-to-zod.ts`
4. Validate bijection by converting back

### Zod → DNA → JSON Schema

1. Convert Zod to DNA using `zod-to-dna.ts`
2. Process DNA with validation engine
3. Convert back to JSON Schema using `dna-to-jschema.ts`
4. Verify structural equivalence

---

## Limitations & Constraints

### Current Limitations

- **External References**: No support for external `$ref` URIs (HTTP/remote files).
- **Custom Formats**: Limited support for JSON Schema `format` keyword.
- **Schema Extensions**: Does not handle vendor-specific extensions.

### Design Constraints

- **Memory Efficiency**: Prioritize compact DNA representation.
- **Validation Speed**: Optimize for runtime performance over conversion time.
- **Type Safety**: Maintain strict TypeScript compliance throughout.

---

## Debugging Guidelines

### Common Issues

- **Reference Loops**: Detect and handle circular references in schemas.
- **Type Mismatches**: Ensure DNA opcodes match expected types.
- **Memory Leaks**: Monitor DNA store cleanup in complex conversions.

### Debug Tools

- Create sandbox scripts to isolate conversion issues.
- **IMPORTANT**: When debugging, use `console.dir(obj, {depth: null})` instead of `JSON.stringify(obj, null, 2)` - the latter is considered bad practice.
