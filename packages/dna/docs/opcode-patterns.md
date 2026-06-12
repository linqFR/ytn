# DNA Opcode Code Generation Patterns

This document describes the patterns (molds/templates) used by DNA opcode handlers to generate JavaScript code from DNA bytecode. Each pattern represents a specific approach to code generation with distinct characteristics, return types, and use cases.

## Overview

DNA opcode handlers in `src/toJs/dna-js-json.ts` (canonical opcodes) and `src/toJs/dna-js-builder.ts` (builder-specific opcodes) follow distinct patterns for generating JavaScript code. Understanding these patterns is essential for:

- Adding new opcodes
- Debugging code generation issues
- Understanding the contract between `seq` and its children
- Maintaining consistency across the codebase

## Universal Opcode Handler Model

Every opcode handler follows a **decision tree model** with the following steps. This model captures all the decisions a handler must make when generating code.

### Step 0: Constant Declaration

**Questions**:

- Are there helper functions to declare (fCount, dEq, regex patterns)?
- Are there eval sets to initialize (unevaluated properties)?
- Are there state variables to initialize (passedIdx for additionalProperties)?

**Examples**:

- `string`: `const fCount=s=>{let i=s.length,c=0;while(i--){if((s.charCodeAt(i)&0xFC00)!==0xDC00)c++}return c};`
- `constTypeComplex`: `const dEq=(a,b)=>a===b||typeof a==="object"&&a!==null&&typeof b==="object"&&b!==null&&deepEqual(a,b);`
- `object`: `passed0={}` for additionalProperties tracking
- `array`: `unik0=true` for uniqueItems tracking
- `object`: `rxPP0_0=/pattern/u` for patternProperties

**Impact**:

- Emits via `[STEP.CONST, "constName=code"]`
- Helpers are available in generated code
- Eval sets track which properties/items have been evaluated

### Step 1: Context Analysis

**Questions**:

- Is this validator mode (`isCond`) or parser mode?
- Is there a parent block to break to (`parentCtx.breakBlock`)?
- Is there a parent counter (`parentCtx.counter`)?
- Has the type already been checked upstream (`parentCtx.typeChecked`)?
- Are there eval sets for unevaluated properties (`parentCtx.unEvalArr`, `parentCtx.unEvalObj`)?

**Impact**:

- `isCond`: Determines whether to generate `return false`/`break` vs `errors.push()`
- `breakBlock`: Determines whether to generate `break <label>` or `return false`
- `counter`: Determines whether to increment counter on success (combinator children)
- `typeChecked`: Allows skipping type test if already verified upstream
- `unEvalArr/unEvalObj`: Determines whether to track eval-set marks

### Step 2a: Code Generation Preprocessing (Handler-Level)

**Questions**:

- Are there preparatory calculations needed before emitting code?
- Are there flags to set based on DNA options (needLength, needLoop, hasDynamicProps)?
- Are there helper states to initialize (uniqueItemsState, containsSteps)?
- Are there pattern matches to precompute (patternPropChecks)?

**Examples**:

- `array`: `needLength = true` when minItems/maxItems/contains present
- `array`: `needLoop = true` when items/contains present
- `array`: `uniqueItemsState` initialization for deep equality checks
- `object`: `hasDynamicProps` for propertyNames/patternProperties
- `object`: `patternPropChecks` array for patternProperties matching

**Impact**:

- Determines what code sections to emit (loops, length checks, etc.)
- Initializes state for complex validations (unique items tracking)
- Precomputes pattern matches for efficiency

### Step 2b: Value Preprocessing / Mutations

**Questions**:

- Are there input mutations to apply before validation?
- Are there coercions (toString, toNumber, toBoolean, toBigInt)?
- Are there value substitutions (prefault, default)?
- Are there wrappers to handle (optional, nullable)?

**Examples**:

- `coerce`: `v=String(v);` then dispatch child
- `wrp`: `if(v===undefined)break;` for optional
- `mutate`: `v=v.trim();` for string transformations
- `codec`: `v=decodeFn(v);` for bidirectional transformations

**Impact**:

- Modifies `_inVarName` before validation
- May short-circuit validation (optional, nullable, default)
- May change the type of the value (coercion)

### Step 3: Type Checking (with Preprocessing)

**Questions**:

- Is a type test required?
- Should the type test be coercitive (coerce to type) or lenient (check type)?
- Has the type already been checked upstream (`parentCtx.typeChecked`)?

**Preprocessing**:

- Check `parentCtx.typeChecked` to skip redundant type tests
- For example, if `parentCtx.typeChecked === "string"`, skip `typeof v==="string"`
- Set `parentCtx.typeChecked` after successful type check for downstream handlers

**Examples**:

- `s`: `typeof v==="string"` (skipped if `parentCtx.typeChecked === "string"`)
- `n`: `typeof v==="number"` (skipped if `parentCtx.typeChecked === "number"`)
- `boolean`: `typeof v==="boolean"` (skipped if `parentCtx.typeChecked === "boolean"`)
- `date`: `v instanceof Date&&v.getTime()===v.getTime()`
- `coerce`: `v=String(v)` then set `parentCtx.typeChecked = "string"`

**Impact**:

- Generates type test condition (or skips if already checked)
- May skip if `parentCtx.typeChecked` matches
- May be coercitive (convert then set typeChecked) or lenient (check only)
- Propagates typeChecked to children to avoid redundant checks

### Step 4: Variable Declaration

**Questions**:

- Are there temporary variables to declare (loop counters, property values)?
- Are there intermediate variables needed for validation?
- Are there state variables to track (uniqueItems flag, contains counter)?

**Examples**:

- `string`: `let strCnt=fCount(v);` for min/max checks
- `array`: `let aLen=v.length;` for minItems/maxItems
- `array`: `let val;` for loop variable
- `array`: `let containsCnt=0;` for contains validation
- `object`: `let ob0pp0=v[name];` for property value extraction
- `object`: `let oLen=Object.keys(v).length;` for property count

**Impact**:

- Emits via `[STEP.LET, "varName=value"]` or inline in body
- Variables are available in generated code for validation
- May be conditional (only declared if needed)

### Step 5: Pre-checker Preprocessing

**Questions**:

- Are there pre-body statements needed before constraints?
- Are there calculations to perform before validation?

**Examples**:

- `string`: `strCnt=fCount(v);` before min/max checks (declaration + assignment)
- `array`: `unik0=true;` before uniqueItems check
- `object`: `keyLoopNeeded` check before emitting loop code

**Impact**:

- Adds pre-body statements before constraint checks
- May be conditional based on flags from Step 2a

### Step 6: Constraint Checkers

**Questions**:

- Are there constraint checks to apply (min, max, pattern, format)?
- Are these checks simple (single condition) or complex (multiple)?
- Should failures break or continue (for combinator children)?

**Examples**:

- `string.min(5)`: `strCnt>=5`
- `string.pattern(/abc/)`: `/abc/u.test(v)`
- `number.multipleOf(3)`: `v%3===0`

**Impact**:

- Uses `_errMode(isCond, condition, error)` for each constraint
- In validator mode: just the condition
- In parser mode: `((condition)||error)` with error push
- May use `simpleNodeToJs` for complex constraint logic

### Step 7: Custom Checkers

**Questions**:

- Are there custom validation checks (uppercase, lowercase, startsWith, endsWith, includes)?
- Are there custom function checks (refine, transform)?
- What is the arity of custom functions (1 arg, 2 args with context)?

**Examples**:

- `check.uppercase`: `v===v.toUpperCase()`
- `check.startsWith("abc")`: `v.startsWith("abc")`
- `check.func(fn)`: `fn(v)` or `fn(v, ctx)`

**Impact**:

- Generates custom test conditions
- Handles function serialization challenges
- May need context parameter for custom functions

### Step 8: Counter Management

**Questions**:

- Is this handler a child of a combinator (anyOf, allOf, oneOf)?
- Should success increment a counter?
- Should failure leave counter unchanged?

**Examples**:

- `anyOf` children: `++anyCnt` on success
- `allOf` children: `++allCnt` on success
- `oneOf` children: `++oneCnt` on success

**Impact**:

- Uses `parentCtx.counter` to increment on success
- In `simpleNodeToJs`, counter affects failure behavior (no break if counter present)
- Counter is checked at the end of combinator to determine success

### Step 9: Eval Sets (Unevaluated)

**Questions**:

- Are there eval sets for unevaluated properties?
- Should successful marks be tracked?
- Should marks be propagated to parent?
- Are there multiple branches that need separate scratch sets?

**Examples**:

- `unevaluatedProperties`: track property names in eval set
- `unevaluatedItems`: track array indices in eval set
- `anyOf` with eval sets: each branch gets scratch set, accumulator on success

**Impact**:

- Declares eval set variables: `let evalSet={};`
- Adds marks on success: `evalSet[key]=1;`
- Propagates to parent: `for(const v in evalSet)parentSet[v]=1;`
- For combinators: uses scratch sets per branch, accumulator for matches

### Step 10: Child Schema Dispatch

**Questions**:

- Are there child schemas to validate?
- Should children be dispatched in sequence or in parallel?
- Should children use the same context or a modified context?
- Should children use the same input variable or a transformed one?

**Examples**:

- `seq`: dispatch children in sequence with tmpVar signal
- `object`: dispatch property schemas in loop
- `array`: dispatch item schemas in loop
- `anyOf`: dispatch all branches, short-circuit on first match (unless eval sets)
- `allOf`: dispatch all branches, count matches
- `oneOf`: dispatch all branches, ensure exactly one match

**Impact**:

- Adds child dispatch steps: `[childId, _inVarName, _outVarName, pathVar, childCtx]`
- May modify context for children (breakBlock, counter, eval sets)
- May transform input before dispatch (coerce, codec)
- May use loops for repeated dispatch (object properties, array items)

### Step 11: Post-processing / Post-mutations

**Questions**:

- Are there post-mutations to apply after validation?
- Are there transformations to apply (encode side of codec)?
- Are there default values to assign?
- Should the output be assigned to a specific variable?

**Examples**:

- `codec`: `v=encodeFn(v);` after outSchema validation
- `assign`: `outVar=inVar;` or `outVar=true;`
- `seq`: `valid=true;` at the end of block

**Impact**:

- Modifies `_inVarName` or assigns `_outVarName` after validation
- May be the success signal for parent (e.g., `tmpVar=true` in seq)
- May be the final output value (parser mode)

### Step 12: Control Flow / Return

**Questions**:

- Should success break a block or return?
- Should failure break a block or return?
- Is there a labeled block to manage?

**Examples**:

- Validator mode with breakBlock: `break seqB0;`
- Validator mode without breakBlock: `return false;`
- Parser mode: `errors.push(...)` then `break` or continue

**Impact**:

- Uses `parentCtx.breakBlock` to determine break target
- In `simpleNodeToJs`, generates `break <label>` or `return false` based on context
- For combinator children, may not break on failure (counter pattern)

### Step 13: Output Assignment

**Questions**:

- Should the output be assigned to `_outVarName`?
- Should the output be the original value or a transformed value?
- Is this a validator (boolean) or parser (value) mode?

**Examples**:

- Validator mode: `tmpVar=true;` or `valid=true;`
- Parser mode: `data=v;` or `data=transformedValue;`
- Transformations: `data=fn(v);`

**Impact**:

- In validator mode, `_outVarName` is a success signal (boolean)
- In parser mode, `_outVarName` is the parsed value
- `simpleNodeToJs` handles this automatically: `outAssigned_ = _outVarName ? _outVarName + "=true;" : ""`

---

## Pattern Classification (Revised)

Based on the universal model above, the patterns can be reclassified by which steps they emphasize:

### 1. SimpleNodeToJs Pattern (Steps 0, 1, 3, 6, 12, 13)

**Return Type**: `tsJSStepString`

**Description**: The most common pattern for scalar validation handlers. Uses the `simpleNodeToJs()` helper which automatically handles both validator and parser modes, assigns the output variable correctly, and manages error reporting.

**Steps Covered**:

- **Step 0**: Constant declaration (none - delegates to caller)
- **Step 1**: Context analysis (isCond, breakBlock, counter, typeChecked)
- **Step 3**: Type checking (via `test` parameter)
- **Step 6**: Constraint checkers (via `body` parameter)
- **Step 12**: Control flow (break vs return based on breakBlock)
- **Step 13**: Output assignment (automatic `_outVarName=true` in validator mode)

**Signature**:

```typescript
export const handler = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
  const test = "...";  // Validation test
  const condErr = _err(parentCtx, _inVarName, pathVar + "/...", "...") + ERR_UNDEF;
  parentCtx.typeChecked = "...";  // Optional: mark type as checked
  return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
```

**Characteristics**:

- Automatically assigns `_outVarName = true` in validator mode on success
- Automatically generates error pushes in parser mode on failure
- Respects `parentCtx.breakBlock` for proper control flow
- Respects `parentCtx.counter` for combinator children (anyOf/allOf/oneOf)
- Handles `mustMatchType` parameter for type checking

**Examples**:

- `boolean` (dna-js-json.ts:500)
- `nan` (dna-js-json.ts:510)
- `nullType` (dna-js-json.ts:516)
- `constType` (dna-js-json.ts:559)
- `literal` (dna-js-json.ts:582)
- `enumType` (dna-js-json.ts:606)
- `sym` (dna-js-builder.ts:201)
- `date` (dna-js-builder.ts:210)
- `file` (dna-js-builder.ts:223)

**Generated Code Example** (validator mode):

```javascript
// For boolean handler
if (!(typeof v === "boolean")) return false;
tmp0 = true;
```

**Generated Code Example** (parser mode):

```javascript
// For boolean handler
data = typeof v === "string" ? v : errors.push({ message: "String is required", path: "#/string", input: v }) && undefined;
```

**When to Use**:

- Simple scalar type checks (string, number, boolean, etc.)
- Single validation condition with error message
- Handlers that don't need complex control flow or loops

---

### 2. StepsArray Pattern (Steps 0, 1, 2a, 2b, 4, 8, 9, 10, 11, 12, 13)

**Return Type**: `tsJSStepOp[]`

**Description**: Used for handlers that need to generate multiple statements, create labeled blocks, or dispatch child schemas. Returns an array of step operations that are processed by the main compiler loop.

**Steps Covered**:

- **Step 0**: Constant declaration (helpers, eval sets, state variables)
- **Step 1**: Context analysis (isCond, breakBlock, counter, eval sets)
- **Step 2a**: Code generation preprocessing (flags, state initialization)
- **Step 2b**: Value preprocessing/mutations (coerce, wrp, codec transformations)
- **Step 4**: Variable declaration (loop counters, property values)
- **Step 8**: Counter management (for combinator children)
- **Step 9**: Eval sets (unevaluated properties/items)
- **Step 10**: Child schema dispatch (sequential or loop-based)
- **Step 11**: Post-processing (assign outputs, propagate eval sets)
- **Step 12**: Control flow (labeled blocks, break statements)
- **Step 13**: Output assignment (final success signals)

**Signature**:

```typescript
export const handler = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepOp[] => {
  const steps: tsJSStepOp[] = [];
  const idx = labelId();
  const block = "handlerB" + idx;

  steps.push([STEP.BODY, block + ":{"]);
  // ... generate steps
  steps.push([STEP.BODY, "}"]);

  return steps;
};
```

**Characteristics**:

- Can create labeled blocks for control flow (`block:{ ... }`)
- Can dispatch child schemas via `[childId, _inVarName, _outVarName, pathVar, childCtx]`
- Can add constants via `[STEP.CONST, "constName=value"]`
- Can add function arguments via `[STEP.OUT_ARG, "argName"]`
- Manages context propagation to children
- Handles both validator and parser modes explicitly

**Examples**:

- `seq` (dna-js-json.ts:316) - Sequential validation with tmpVar signal pattern
- `coerce` (dna-js-builder.ts:11) - Type coercion with child dispatch
- `wrp` (dna-js-builder.ts:49) - Wrapper dispatcher (optional, nullable, default, prefault)
- `object` (dna-js-json.ts:1038) - Object validation with property loops
- `array` (dna-js-json.ts:1303) - Array validation with item loops
- `not` (dna-js-json.ts:1446) - Logical negation with child dispatch
- `anyOf` (dna-js-json.ts:1487) - OR combinator with counter
- `allOf` (dna-js-json.ts:1598) - AND combinator with counter
- `oneOf` (dna-js-json.ts:1672) - XOR combinator with counter
- `instanceOf` (dna-js-builder.ts:233) - Instance check with constructor registry
- `codec` (dna-js-builder.ts:251) - Bidirectional transformation

**Generated Code Example** (seq in validator mode):

```javascript
seqB0:{
  let tmp0;
  tmp0=false;
  [childHandler code];  // Should assign tmp0=true on success
  if(!tmp0)break seqB0;
  tmp0=false;
  [childHandler code];
  if(!tmp0)break seqB0;
  valid=true;
}
```

**When to Use**:

- Handlers that need multiple statements
- Handlers that dispatch child schemas
- Handlers that need labeled blocks for control flow
- Handlers that need loops (object properties, array items)
- Combinators (anyOf, allOf, oneOf, not)

---

### 3. StringStepsHybrid Pattern (Steps 0, 1, 2a, 3, 4, 5, 6, 12, 13)

**Return Type**: `tsJSFn` (either `tsJSStepString` or `tsJSStepOp[]`)

**Description**: Used for type handlers that may generate simple code or complex steps depending on the presence of constraints. Often uses internal helper functions with `_errMode()` for constraint generation.

**Steps Covered**:

- **Step 0**: Constant declaration (helper functions like fCount, dEq)
- **Step 1**: Context analysis (isCond, typeChecked)
- **Step 2a**: Code generation preprocessing (constraint flags)
- **Step 3**: Type checking (via `test` parameter)
- **Step 4**: Variable declaration (pre-body variables like strCnt)
- **Step 5**: Pre-checker preprocessing (pre-body statements)
- **Step 6**: Constraint checkers (via `_errMode` for min/max/pattern/format)
- **Step 12**: Control flow (via `simpleNodeToJs` or custom block logic)
- **Step 13**: Output assignment (via `simpleNodeToJs` or custom assignment)

**Signature**:

```typescript
const internalHandler = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx, declared: boolean): tsJSFn => {
  const isCond = parentCtx.isCond;
  const body: string[] = [];
  const steps: tsJSStepOp[] = [];

  // Add constraints using _errMode
  if (constraint) {
    body.push(_errMode(isCond, "condition", "error message"));
  }

  // If complex, return steps; otherwise return string
  if (needsSteps) {
    steps.push([STEP.CONST, "helperFunction"]);
    steps.push([STEP.BODY, "complex code"]);
    return steps;
  }

  return simpleNodeToJs(parentCtx, _inVarName, _outVarName, errMsg, test, preBody, body, declared);
};

export const publicHandler = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSFn =>
  internalHandler(dnaOpt, _inVarName, _outVarName, pathVar, labelId, parentCtx, true);
```

**Characteristics**:

- Uses `_errMode(isCond, condition, error)` for constraint generation
- Can add helper constants via `[STEP.CONST, "fnName=code"]`
- Can add pre-body statements (e.g., `strCnt=fCount(v);`)
- Delegates to `simpleNodeToJs` for simple cases
- Returns steps for complex cases (e.g., deep equality)

**Examples**:

- `string` (dna-js-json.ts:387) - String with min/max/pattern/format constraints
- `number` (dna-js-json.ts:436) - Number with min/max/multipleOf constraints
- `constTypeComplex` (dna-js-json.ts:566) - Complex constants with deep equality
- `enumTypeDeep` (dna-js-json.ts:620) - Enums with non-primitive values
- `ifThenElse` (dna-js-json.ts:1308) - Conditional validation

**Generated Code Example** (string with minLength):

```javascript
// Validator mode
strCnt = fCount(v);
if (!(strCnt >= 5)) return false;
tmp0 = true;

// Parser mode
strCnt = fCount(v);
data = (strCnt >= 5 || (errors.push({ message: "String length must be at least 5", path: "#/string/minLength", input: v }) && undefined)) && v;
```

**When to Use**:

- Type handlers with optional constraints (min, max, pattern, etc.)
- Handlers that may need helper functions (deep equality, string counting)
- Handlers that need pre-body statements
- Handlers with conditional complexity

---

### 4. DirectString Pattern (Steps 1, 12, 13)

**Return Type**: `tsJSStepString`

**Description**: Used for special cases that generate code directly without using helpers. These are typically edge cases or very simple operations.

**Steps Covered**:

- **Step 1**: Context analysis (isCond only)
- **Step 12**: Control flow (manual break/return logic)
- **Step 13**: Output assignment (manual assignment or counter increment)

**Signature**:

```typescript
export const handler = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
  if (parentCtx.isCond) {
    // Validator mode code
    return "...";
  }
  // Parser mode code
  return "...";
};
```

**Characteristics**:

- Direct code generation without helpers
- Explicit handling of validator vs parser modes
- Often for edge cases or special semantics
- May not respect standard contracts (e.g., `falseSchema`)

**Examples**:

- `assign` (dna-js-json.ts:311) - Simple assignment
- `trueSchema` (dna-js-json.ts:535) - Always succeeds
- `falseSchema` (dna-js-json.ts:543) - Always fails

**Generated Code Example** (trueSchema):

```javascript
// Validator mode
counter++;
tmp0 = true;

// Parser mode
counter++;
data = v;
```

**Generated Code Example** (falseSchema):

```javascript
// Validator mode
return false;

// Parser mode
errors.push({ message: "Schema is always false", path: "#/false", input: v }) && undefined;
return false;
```

**When to Use**:

- Edge cases that don't fit standard patterns
- Always-true or always-false schemas
- Simple assignments without validation

---

### 5. Mutate Pattern (Steps 1, 2b, 11)

**Return Type**: `tsJSStepString`

**Description**: Used for transformation operations that modify the input value. This pattern modifies `_inVarName` directly and does NOT assign `_outVarName`, which breaks the `seq` contract in validator mode.

**Steps Covered**:

- **Step 1**: Context analysis (isCond only)
- **Step 2b**: Value preprocessing/mutations (modifies `_inVarName` directly)
- **Step 11**: Post-processing (none - violates seq contract by not assigning `_outVarName`)

**Known Issue**: Does not cover Step 13 (Output Assignment), which violates the `seq` contract in validator mode.

**Signature**:

```typescript
export const mutate = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
  const op = dnaOpt[0][0];
  const isCond = parentCtx.isCond;
  let mutation = "";

  switch (op) {
    case "trim": mutation = _inVarName + ".trim();"; break;
    case "toUpperCase": mutation = _inVarName + ".toUpperCase();"; break;
    // ...
  }

  return mutation ? _inVarName + "=" + mutation + (parentCtx.isCond ? ";" : "") : "";
};
```

**Characteristics**:

- Modifies `_inVarName` (the value being validated)
- Does NOT assign `_outVarName` (the signal variable in `seq`)
- Generates different code for validator vs parser modes
- **BUG**: Does not respect the `seq` contract in validator mode

**Examples**:

- `mutate` (dna-js-builder.ts:119) - String transformations (trim, toUpperCase, etc.)

**Generated Code Example** (trim):

```javascript
// Validator mode
v = v.trim();

// Parser mode
v = v.trim();
```

**When to Use**:

- Transformation operations that modify the input value
- String methods (trim, toUpperCase, toLowerCase, normalize)
- Custom function transformations

**Known Issues**:

- Does not assign `_outVarName = true` in validator mode
- Breaks the `seq` contract which expects child handlers to signal success
- Generates double semicolon in validator mode (`v=v.trim();;`)

---

### 6. Check Pattern (Steps 1, 3, 7, 12, 13)

**Return Type**: `tsJSStepString`

**Description**: Used for custom validation checks. Uses `simpleNodeToJs` but depends on the parent context for proper break behavior.

**Steps Covered**:

- **Step 1**: Context analysis (isCond, breakBlock - but seq doesn't pass it)
- **Step 3**: Type checking (none - assumes type already checked)
- **Step 7**: Custom checkers (uppercase, lowercase, startsWith, endsWith, includes, custom functions)
- **Step 12**: Control flow (via `simpleNodeToJs`, depends on breakBlock)
- **Step 13**: Output assignment (via `simpleNodeToJs`)

**Known Issue**: Depends on `parentCtx.breakBlock` which `seq` does not pass, causing incorrect control flow in seq context.

**Signature**:

```typescript
export const check = (dnaOpt: [...], _inVarName: string, _outVarName: string, pathVar: string, labelId: tsLaberlId, parentCtx: tsJSParentCtx): tsJSStepString => {
  const op = dnaOpt[0][0];
  let path, errMsg, test;

  switch (op) {
    case "uppercase":
      path = "/uppercase";
      errMsg = "String must be in UpperCase";
      test = _inVarName + "===" + _inVarName + ".toUpperCase()";
      break;
    // ...
  }

  const condErr = _err(parentCtx, _inVarName, pathVar + path, errMsg) + ERR_UNDEF;
  return simpleNodeToJs(parentCtx, _inVarName, _outVarName, condErr, test, "", "", true);
};
```

**Characteristics**:

- Uses `simpleNodeToJs` like the SimpleNodeToJs pattern
- Depends on `parentCtx.breakBlock` for proper control flow
- **BUG**: `seq` does not pass `breakBlock` in context, causing issues

**Examples**:

- `check` (dna-js-builder.ts:138) - Custom validation checks (uppercase, lowercase, startsWith, endsWith, includes)

**Generated Code Example** (uppercase):

```javascript
// Validator mode (with correct context)
if(!(v===v.toUpperCase()))break seqB0;tmp0=true;

// Validator mode (with empty context - current bug)
tmp0=true;  // Test is not emitted!

// Parser mode
data=(v===v.toUpperCase())?v:errors.push({message:"String must be in UpperCase",path:'#/uppercase',input:v})&&undefined;
```

**When to Use**:

- Custom validation checks beyond standard constraints
- String format checks (uppercase, lowercase, startsWith, endsWith, includes)
- Custom function validation

**Known Issues**:

- `seq` does not pass `breakBlock: seqBlock` in parent context
- Without `breakBlock`, `simpleNodeToJs` generates `return false` instead of `break seqB0`
- In `seq` context, the test may not be emitted correctly

---

## Contract Between seq and Child Handlers

### The seq Contract (Validator Mode)

The `seq` opcode in validator mode uses a **signal variable pattern**:

```typescript
// seq handler (validator mode)
const tmpVar = "tmp" + idx;
steps.push([STEP.BODY, "let " + tmpVar + ";"]);
for (let i = 0; i < seq.length; i++) {
  const it = seq[i];
  steps.push([STEP.BODY, tmpVar + "=false;"]); // Reset signal
  steps.push(
    [it, _inVarName, tmpVar, pathVar, parentCtx], // Dispatch child with tmpVar as _outVarName
    [STEP.BODY, "if(!" + tmpVar + ")break " + seqBlock + ";"], // Check signal
  );
}
```

**The Contract**: Each child handler MUST assign `_outVarName` (which is `tmpVar`) to `true` on success.

### Handlers That Respect the Contract

- **SimpleNodeToJs pattern**: Automatically assigns `_outVarName = true` via `simpleNodeToJs`
- **StepsArray pattern**: Can respect the contract if they use `simpleNodeToJs` or explicitly assign `_outVarName`

### Handlers That Violate the Contract

- **Mutate pattern**: Does NOT assign `_outVarName`, only modifies `_inVarName`
- **Check pattern**: Uses `simpleNodeToJs` but depends on `parentCtx.breakBlock` which `seq` does not pass

### The seq Contract (Parser Mode)

The `seq` opcode in parser mode uses a simpler pattern:

```typescript
// seq handler (parser mode)
for (let i = 0; i < seq.length; i++) {
  const it = seq[i];
  steps.push([it, _inVarName, _outVarName, pathVar, parentCtx], [STEP.BODY, "if(errors.length)break " + seqBlock + ";"]);
}
```

**The Contract**: Child handlers should push errors to `errors[]` on failure. No signal variable is used.

---

## Context Propagation

### parentCtx Properties

The `parentCtx` object passed to handlers contains:

- `isCond`: `true` for validator mode, `false` for parser mode
- `breakBlock`: Label of the block to break to on failure (e.g., `"seqB0"`)
- `counter`: Counter expression for combinator children (e.g., `"++count"`)
- `typeChecked`: Type that has already been checked upstream (e.g., `"string"`)
- `unEvalArr`: Name of eval set for array unevaluated properties
- `unEvalObj`: Name of eval set for object unevaluated properties

### Context Propagation Patterns

**Pass-through**:

```typescript
const childCtx = { ...parentCtx };
[childId, _inVarName, _outVarName, pathVar, childCtx];
```

**Override breakBlock**:

```typescript
const childCtx = { ...parentCtx, breakBlock: "myBlock" };
[childId, _inVarName, _outVarName, pathVar, childCtx];
```

**Add counter**:

```typescript
const childCtx = { ...parentCtx, counter: "++count" };
[childId, _inVarName, _outVarName, pathVar, childCtx];
```

**Strip eval sets**:

```typescript
const childCtx = { ...parentCtx, unEvalArr: undefined, unEvalObj: undefined };
[childId, _inVarName, _outVarName, pathVar, childCtx];
```

---

## Helper Functions

### simpleNodeToJs

The core helper for scalar validation. Handles the complex logic of validator vs parser mode, error reporting, and output assignment.

**Signature**:

```typescript
simpleNodeToJs(
  parentCtx: tsJSParentCtx,
  _inVarName: string,
  _outVarName: string,
  errMsg: string,
  test: string,
  preBody: string,
  body: string | string[],
  mustMatchType: boolean
): string
```

**Encoding**: Uses a 4-bit encoding for code generation:

- D (MustMatchType): Type check failure must fail
- T (Test): Test must be emitted
- B (Body): Constraint body present
- C (Counter): Parent provided a counter

### \_errMode

Helper for generating constraint code that differs between validator and parser modes.

**Signature**:

```typescript
_errMode(isCond: boolean | undefined, cond: string, err: string): string
```

**Behavior**:

- Validator mode: Returns just `cond`
- Parser mode: Returns `((cond)||err)` with proper parentheses

### \_err

Helper for generating error push statements.

**Signature**:

```typescript
_err(ctx: tsJSParentCtx, _inVarName: string, path: string, msg: string, isLiteral = true): string
```

**Behavior**:

- Returns `errors.push({message:msg, path:path, input:_inVarName})`

---

## Choosing the Right Pattern

When adding a new opcode handler, choose the pattern based on the requirements:

| Requirement                           | Pattern                        |
| ------------------------------------- | ------------------------------ |
| Simple scalar validation              | SimpleNodeToJs                 |
| Type with optional constraints        | StringStepsHybrid              |
| Multiple statements or child dispatch | StepsArray                     |
| Edge case or special semantics        | DirectString                   |
| Value transformation                  | Mutate (with seq contract fix) |
| Custom validation check               | Check (with context fix)       |

---

## Known Issues and TODOs

### seq Contract Violations

1. **mutate handler**: Does not assign `_outVarName = true` in validator mode

   - **Fix**: Add assignment after mutation in validator mode
   - **Fix**: Remove duplicate semicolon in built-in mutations

2. **check handler**: Depends on `parentCtx.breakBlock` which `seq` does not pass

   - **Fix**: Pass `breakBlock: seqBlock` in `seq` context to children

3. **seq context**: Currently passes empty context `{}` to children
   - **Fix**: Pass `{...parentCtx, breakBlock: seqBlock}` to children

### Pattern Inconsistencies

- Some handlers use `simpleNodeToJs` correctly (SimpleNodeToJs pattern)
- Some handlers use `simpleNodeToJs` but depend on context (Check pattern)
- Some handlers don't use `simpleNodeToJs` at all (Mutate pattern)

This inconsistency makes it hard to reason about the contract between `seq` and its children.

---

## References

- `src/toJs/dna-js-json.ts` - Canonical opcode handlers
- `src/toJs/dna-js-builder.ts` - Builder-specific opcode handlers
- `src/toJs/utils.ts` - Helper functions (`simpleNodeToJs`, `_errMode`, `_err`)
- `src/toJs/dna-to-js.ts` - Main compiler that processes step arrays
- `docs/technical.md` - DNA format and architecture documentation
