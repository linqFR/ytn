# AGENTS.md (Package: @ytn/dna)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the DNA bytecode engine.

> [!WARNING]
> **CRITICAL DEPENDENCY**: This package is intimately linked to `@ytn/schvalid`. The `toJs` module (especially `dna-to-js.ts` and `dna-js-full.ts`) is imported and used by `@ytn/schvalid` for DNA → JavaScript compilation. **ANY changes to toJS can have direct repercussions on schvalid**. Always test both packages together when modifying toJS code.

---

## Core Architecture

This package provides the DNA bytecode runtime engine. It is NOT the JSON Schema converter (that's `@ytn/schvalid`). This package focuses on:

- **DNA Schema Builder**: Zod-like API for constructing DNA bytecode schemas
- **DNA → JavaScript Compilation**: High-performance code generation from DNA opcodes
- **Runtime Validation**: Ultra-fast boolean validators and parsers

### Core Modules

- **`src/builder/index.ts`**: DNA schema factory with Zod-like fluent API (`dna.string()`, `dna.object()`, etc.)
- **`src/toJs/dna-to-js.ts`**: Main compiler entry point, orchestrates DNA → JavaScript conversion
- **`src/toJs/dna-js-full.ts`**: Opcode-to-JavaScript mapper (full keyword handlers)
- **`src/types/`**: DNA bytecode type definitions and inference types
- **`src/shared/`**: Shared utilities (stack steps, constants)

### Documentation

- **`docs/technical.md`**: Detailed technical documentation about DNA opcodes, architecture, and implementation details.

---

## DNA Bytecode Format

DNA is a compact opcode-based format for validation:

```typescript
type tsDna = [tsDnaOpcode, ...any[]];
type tsDnaSeq = tsDna[];
```

- **Array-Based Instructions**: Each instruction is a tuple with opcode first
- **Reference-Based**: Complex structures use numeric references to avoid duplication
- **Stack Processing**: The compiler uses iterative stack-based traversal

---

## Code Generation Architecture

### Two Execution Modes

1. **Validator Mode** (`validateMode: true`):
   - Ultra-fast boolean validation (fail-fast)
   - No error collection
   - Returns `true`/`false`
   - Uses `isCond: true` context for expression generation

2. **Parser Mode** (`validateMode: false`):
   - Full error collection with data transformation
   - Returns `{ success: true, data: any }` or `{ success: false, errors: tsParserError[] }`
   - Uses output variable assignment pattern

### Step-Based Compilation

The compiler uses a step-based system (`tsStackFrame`):

- **`STEP.BODY`**: Direct JavaScript code concatenation
- **`STEP.CONST`/`STEP.LET`**: Variable declarations
- **`STEP.START_REF`/`STEP.END_REF`**: Reference function generation for circular schemas
- **Opcode handlers**: Each DNA opcode maps to a handler in `dna-js-full.ts`

### Reference Handling

Circular schemas are handled via reference functions:
- Each referenced schema gets a dedicated function (`L0000`, `L0001`, etc.)
- Functions include memoization via `.visit` Map to prevent infinite loops
- Functions accept `_ea`/`_eo` parameters for unevaluated properties propagation

---

## Builder API

The builder provides a Zod-like fluent API:

```typescript
import { dna } from "@ytn/dna";

const schema = dna.object({
  name: dna.string().min(2),
  age: dna.number().min(0),
  email: dna.string().email()
});
```

All builder methods produce DNA bytecode directly, no intermediate JSON Schema.

---

## Naming Standards

This package follows global naming standards:

### 1. DNA Types (`ts*`)

- **Examples**: `tsDna`, `tsDnaOpcode`, `tsDnaSeq`, `tsValidatorFn`, `tsParserFn`

### 2. Runtime Types (no I/O prefix)

- DNA types are internal bytecode representations, not input/output structures
- Use `ts*` prefix for all DNA-related types

### 3. Opcodes

- Opcodes are defined in `dna-core.types.ts`
- Use descriptive names: `"string"`, `"number"`, `"object"`, `"array"`, etc.

---

## Development Guidelines

### Testing

- **Unit Tests**: Test individual opcode handlers in `toJs/dna-js-full.ts`
- **Integration Tests**: Test end-to-end builder → DNA → JavaScript → validation
- **Performance Tests**: Benchmark validator vs parser modes
- **Type Tests**: Use `expectTypeOf` for complex type inference

### Code Generation

- **No AST**: Generate JavaScript strings directly, no intermediate AST
- **Numeric Sentinels**: Use `-1` and `null` for absent constraints
- **Stack Safety**: Always handle stack reversal when pushing steps

### Common Pitfalls

1. **Stack Reversal**: Steps are pushed in reverse order (LIFO)
   - **Solution**: Use `while (i--) stack[j++] = steps[i]` pattern

2. **Context Propagation**: Not passing `parentCtx` correctly
   - **Solution**: Always propagate `parentCtx` to child schema calls

3. **Reference Memoization**: Forgetting `.visit` Map in ref functions
   - **Solution**: Always include memoization prelude in reference functions

4. **Mode Confusion**: Mixing validator and parser patterns
   - **Solution**: Check `parentCtx.isCond` before generating code

---

## Debugging

When debugging generated code:

```typescript
const validateFn = validator(dna);
console.log(validateFn.toString()); // Inspect generated JavaScript
```

**IMPORTANT**: Use `console.dir(obj, { depth: null })` instead of `JSON.stringify(obj, null, 2)` for debugging objects.

---

## Build & Distribution

- **tsup Configuration**: Standard build with JSDoc preservation
- **No Minification**: This package is a library, not a production bundle
- **Type Declarations**: Automatically generated via tsup
