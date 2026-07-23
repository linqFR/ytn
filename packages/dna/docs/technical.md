# Technical Documentation

## Relationship with @ytn/schvalid

> [!IMPORTANT]
> Understanding `@ytn/schvalid` is essential to understanding this document: **`@ytn/schvalid` and its performance rely entirely on `@ytn/dna`**.

`@ytn/schvalid` is the **JSON Schema** front-end (pure JSON Schema validation); `@ytn/dna` is the back-end engine that does the heavy lifting, and also exposes its own **Zod-like builder** API:

- **`@ytn/schvalid` converts** a JSON Schema into **DNA bytecode** (`jschemaToDna`).
- **`@ytn/dna` provides** a Zod-like fluent builder (`dna.string()`, `dna.object()`, …) that emits DNA bytecode directly, **and compiles** any DNA bytecode into standalone JavaScript validators/parsers (`toJS` in `src/toJs/`).

Therefore, every performance characteristic of `@ytn/schvalid` is inherited from `@ytn/dna`'s code generation: the short opcodes, the numeric sentinels, the labelled-block control flow, the fused per-key object blocks, the plain-object eval-sets, and the `if(!(test)) break <label>;` fast-fail discipline documented below. **A change to the DNA format or to the `toJs` codegen directly impacts `@ytn/schvalid`** — the two packages MUST be reasoned about and tested together.

The sections below (notably **DNA Opcodes** and the generated-code examples routed through `@ytn/schvalid`'s `jschemaToDna`) describe this shared contract from the DNA side.

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

The opcode-to-JavaScript handlers are split across two modules, along the same front-end boundary as the **[Relationship with @ytn/schvalid](#relationship-with-ytnschvalid)** section:

- **`dna-js-json.ts` — canonical / JSON-validation opcodes.** Contains everything needed for **JSON Schema validation**: the opcodes that `@ytn/schvalid`'s `jschemaToDna` produces (`s`/`_s`, `n`/`_n`/`i`/`bi`, `b`, `o`/`_o`, `a`/`_a`, `anyOf`/`oneOf`/`allOf`/`not`, `discriminator`, `if`/`then`/`else`, `c`/`cD`/`l`/`e`/`eD`, `ref`, `unevaluated*`, etc.). This is the JSON-Schema-complete handler set; it is the module imported and consumed by `@ytn/schvalid`.

- **`dna-js-builder.ts` — builder-specific opcodes.** Contains the handlers for opcodes emitted **only** by the `@ytn/dna` Zod-like builder, which have no JSON Schema equivalent: `wrp` (the generic `optional`/`nullable`/`default`/`prefault` wrapper dispatcher), `mutate` (transforms), `check` (string refinements like `lowercase`/`startsWith`/…), `coerce`, plus extra runtime types `sym`, `date`, `file`. `@ytn/schvalid` does NOT use these — it produces canonical DNA opcodes directly.

Both modules share the same low-level codegen primitives from `utils.ts` (`simpleNodeToJs`, `_err`, `_envFrame`, the `ERR_*` fragments), so the generated code style is identical regardless of which module emitted a given opcode. `dna-to-js.ts` orchestrates dispatch across both.

### Performance Optimizations

- Direct DNA generation without intermediate representations
- Short opcodes for V8 optimization
- Numeric sentinels (-1, null) for absent constraints
- Lazy evaluation with stack-based processing
- Hashmap-based tracking for evaluated properties/items (no Set overhead)
- Standalone generated functions (no external dependencies)

---

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
const outAssign_ = _outVarName ? _outVarName + "=" + (parentCtx.not ?? "") + "true;" : "";

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

The following snippets are the **actual output** of `toJS` for representative JSON Schemas (Draft 2020-12), routed through `@ytn/schvalid`'s `jschemaToDna` converter. They are regeneratable for any schema by converting it to DNA and calling `toJS(true, false)(dna)` / `toJS(false, false)(dna)`; the full collection for the test suite is produced by `packages/schvalid/sandbox/collect-schema-adn-functions.ts`.

Formatting note: the codegen emits a single-line body (no whitespace). The snippets below are presented as-emitted; line breaks are visual aids only.

#### 10.1 `{ "type": "string", "minLength": 3, "maxLength": 10, "pattern": "^[a-z]+$" }`

**Validator:**

```js
function (v) {
  const fCount = s => { let i=s.length,c=0; while(i--){ if((s.charCodeAt(i)&0xFC00)!==0xDC00) c++ } return c };
  let valid, strCnt;
  if(!(typeof v==="string")) return false;
  strCnt = fCount(v);
  if(!((strCnt>=3) && (strCnt<=10) && (/^[a-z]+$/u.test(v)))) return false;
  valid = true;
  return !!valid;
}
```

Three constraints fused into a single conjunctive guard. Note the unicode flag `u` on the regex (JSON Schema ECMA-262 dialect) and the `fCount` helper that counts code points (not UTF-16 code units) by skipping low surrogates.

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
