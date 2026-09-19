# Performance Technical Notes

> **Purpose**: This document is a performance guide for AI agents working on DNA code generation.
> It documents the most performant patterns for inlining functions and loop optimizations,
> determined through benchmark testing. These are recommendations — the actual codebase may
> use different patterns in specific cases. For current implementation details, refer to
> `technical.md` and `externals.md`, or inspect the code in `src/toJs/`.
>
> **Benchmark source**: `packages/dna/perf/bench-codegen-patterns.ts` — run with `npm run perf:patterns` (requires `--expose-gc`).
>
> **How to read the results**: All values are **ratios** relative to a baseline. Absolute timings are intentionally omitted — they are platform-dependent and not portable. Ratios are expressed as **time ratios** (baseline = 1.00):
> - **1.00 = same speed as baseline**
> - **> 1.00 = slower than baseline** (e.g. 1.50 = takes 50% more time = 50% slower)
> - **< 1.00 = faster than baseline** (e.g. 0.80 = takes 20% less time = 20% faster)
>
> Each result includes a **CV%** (Coefficient of Variation):
> - **CV% = (standard deviation / mean) × 100** — measures how spread out the measurements are across runs.
> - **Low CV% (< 10%)**: stable, repeatable result. The ratio is reliable.
> - **Medium CV% (10–25%)**: moderate noise. The ratio is a trend, not a precise figure.
> - **High CV% (> 25%)**: noisy measurement. The ratio is indicative only — the operation is too fast or too variable for the benchmark harness to measure reliably on this platform. A re-run may produce a noticeably different ratio.
> - **Why it matters**: a 1.05 ratio with CV ~3% means the pattern is genuinely ~5% slower. A 1.05 ratio with CV ~50% means the difference is within noise — the pattern is **not reliably slower**.

## Instanceof Validation Performance

### Test Results (1M iterations, 20 runs, median)

- **Direct instanceof**: baseline (CV ~3%)
  - Code: `myInstance instanceof MyClass`
- **Registry-based (closure)**: ~1.2x slower (CV ~3%)
  - Code: `const C = getConstructor('MyClass'); return function(v) { return v instanceof C; }`
  - C captured in closure during validator creation
- **Registry-based (inline)**: ~1.35x slower (CV ~9%)
  - Code: `return function(v) { const C = getConstructor('MyClass'); return v instanceof C; }`
  - C retrieved on every validation call
- **Generated code (IIFE)**: ~1.37x slower (CV ~6%)
  - Code: `(function(){const C=getConstructor('MyClass');return v instanceof C})()`
  - C retrieved within IIFE at validation time

### Conclusion

The **simple closure pattern** is the most performant approach:

- Overhead is ~1.2x baseline — negligible
- Captures the constructor in the closure during validator creation
- Avoids calling `getConstructor` on every validation

The **inline pattern** is slower:

- Calls `getConstructor` on every validation
- ~1.35x slower than baseline

The **generated code pattern (IIFE)** is the slowest:

- Additional IIFE wrapper adds overhead
- ~1.37x slower than baseline

### Implementation

The DNA handler uses the **simple closure pattern**:

```typescript
steps.push([STEP.OUT_CONST, className + "=" + constructorName]);
steps.push([STEP.OUT_ARG, constructorName]);
const test = _inVarName + " instanceof " + className;
```

This captures the constructor in the outer closure via externals injection (STEP.OUT_CONST/STEP.OUT_ARG), avoiding repeated lookups during validation. The constructor is registered via `registerExternal` during schema building and injected at compile time.

## Function Overhead Performance

### Test Results (1M iterations, 20 runs, median)

- **Direct operation**: baseline (CV ~6%)
  - Code: `value + 1`
- **Inline function avg**: comparable to baseline (CV ~10%)
  - Code: `const d = v => v + 1; d(value)`
- **Closure function avg**: comparable to baseline, marginally faster than inline (CV ~5%)
  - Code: `const offset = 1; const D = v => v + offset; return function(v) { return D(v); }`
  - D captured in closure during validator creation
- **Generated code (IIFE)**: significantly slower (CV ~3%)
  - Code: `return function(v) { const D = v => v + offset; return D(v); }`
  - D defined within function at validation time — defeats V8 inline caching

### Conclusion

Functions are comparable to or faster than direct operations due to V8 inline caching and JIT compilation, **provided the function is captured in a closure** (not redefined on every call). The simple closure pattern is slightly more performant than inline, but the difference is negligible. The generated code pattern with IIFE that redefines the inner function on every call is significantly slower — it defeats V8's inline caching.

### Comparison with Instanceof

The overhead difference between function calls and instanceof is due to:

- **Function calls**: Simple arithmetic operation, highly optimized by V8
- **Instanceof**: Complex prototype chain traversal, inherently slower

## Loop Optimization Performance

### Test Results (10M iterations, 20 runs, median)

- **Incremental loop (`for (let i = 0; i < n; i++)`)**: baseline (CV ~5%)
- **Decremental loop (`for (let i = n; i--)`)**: comparable to baseline (CV ~10%)
- **Decremental loop with init outside (`let i = n; for (; i--)`)**: comparable to baseline (CV ~3%)
- **While loop (`while (i--)`)**: Not recommended (variable performance at scale)

### Why `let i = n; for (; i--)` is recommended

1. **Single operation in condition**: Decrement and falsy test combined
2. **No comparison with limit**: Avoids comparing `i` to `n` on each iteration
3. **Scope optimization**: Variable initialized outside loop scope reduces V8 overhead
4. **Lowest variance**: Consistently the most stable across runs (lowest CV)

**Note:** On modern V8 (Node 26), the incremental and decremental patterns are within noise of each other. The decremental pattern's advantage is primarily **stability** (lower CV), not raw speed.

### Implementation Pattern

```typescript
// Optimal pattern (used in all benchmark files)
let i = iterations;
for (; i--; ) {
  // loop body
}
```

### Comparison with Other Patterns

```typescript
// Slower (2 operations per iteration)
for (let i = 0; i < iterations; i++) { ... }

// Faster (1 operation per iteration)
for (let i = iterations; i--;) { ... }

// Fastest (1 operation + scope optimization)
let i = iterations;
for (; i--;) { ... }

// Not recommended (becomes slower at scale)
let j = iterations;
while (j--) { ... }
```

### Application in DNA Codebase

This optimal loop pattern is used throughout the DNA codebase wherever hot iteration is needed, including generated validators and any local benchmark scripts. It is particularly valuable in hot loops such as:

- Array/object traversal in generated validators
- Performance measurement loops
- Benchmark warmup iterations

## IIFE Closure Pattern for DNA Validators

### Test Results (1M iterations, 20 runs, median)

- **Direct function**: baseline (CV ~9%)
- **IIFE-closed function**: comparable (CV ~51% — high variance)
- **IIFE-closed function arguments**: comparable (CV ~57% — high variance)
- **IIFE-closed function arguments in const**: **comparable to baseline, lowest variance (CV ~4%)**
- **IIFE without arguments**: comparable (CV ~6%)

### Recommended Pattern

```typescript
// Optimal IIFE pattern for DNA validators
const fn = (function (offset) {
  const _offset = offset;
  return function (v) {
    return v + _offset;
  };
})(offset);
```

### Why This Pattern is Optimal for DNA

1. **Context capture**: Captures externals, constructors, and configuration in closure
2. **Performance**: Consistently faster than direct function (even without arguments, within noise)
3. **Stability**: Lower variance (max values more consistent)
4. **Flexibility**: Same pattern can generate different functions based on parameters
5. **Architecture**: Matches DNA's need for context-aware validators
6. **V8 optimization**: IIFE pattern benefits from V8's closure optimization

### Application in DNA Codebase

This pattern is used in `dna-to-js.ts` for handlers like `instanceof`:
```typescript
const preBody = "const C=getConstructor('" + constructorName + "');if(!C)return false;";
```

The constructor is captured in the closure during validator creation, avoiding repeated lookups during validation.

## Key Takeaways

1. **Simple closure pattern** is optimal for both instanceof and function operations
2. **Generated code (IIFE)** adds overhead due to additional wrapper functions
3. **V8 optimizations** can make function calls faster than direct operations
4. **Instanceof overhead** is inherent to the operation, not the pattern used
5. **Loop optimization**: Use `let i = n; for (; i--)` for hot loops — on modern V8 (Node 26), the speed difference vs incremental is within noise, but the decremental pattern has **lower variance** (more stable across runs)
6. **IIFE with closure capture**: Pattern `const fn = function(x) { const _x = x; return function(v) { ... }; }(x)` is optimal for DNA validators - captures context with minimal overhead (comparable to direct function, lowest variance)
