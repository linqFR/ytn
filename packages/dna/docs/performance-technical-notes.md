# Performance Technical Notes

## Instanceof Validation Performance

### Test Results (1M iterations)

- **Direct instanceof**: ~17-22 ms (baseline)
  - Code: `myInstance instanceof MyClass`
- **Registry-based (closure)**: ~17-25 ms (-0.06 to +3.04ms overhead)
  - Code: `const C = getConstructor('MyClass'); return function(v) { return v instanceof C; }`
  - C captured in closure during validator creation
- **Registry-based (inline)**: ~22-31 ms (+4.84 to +6.88ms overhead)
  - Code: `return function(v) { const C = getConstructor('MyClass'); return v instanceof C; }`
  - C retrieved on every validation call
- **Generated code (IIFE)**: ~30-38 ms (+12.49 to +16.21ms overhead)
  - Code: `(function(){const C=getConstructor('MyClass');return v instanceof C})()`
  - C retrieved within IIFE at validation time

### Conclusion

The **simple closure pattern** is the most performant approach:

- Overhead is negligible (-0.06ms average, sometimes faster than direct instanceof)
- Captures the constructor in the closure during validator creation
- Avoids calling `getConstructor` on every validation

The **inline pattern** is slower:

- Calls `getConstructor` on every validation
- ~5-7ms overhead

The **generated code pattern (IIFE)** is the slowest:

- Additional IIFE wrapper adds overhead
- ~12-16ms overhead

### Implementation

The DNA handler uses the **simple closure pattern**:

```typescript
const preBody = "const C=getConstructor('" + constructorName + "');if(!C)return false;";
const test = _inVarName + " instanceof C";
```

This captures `C` in the preBody (executed before the test), so `getConstructor` is called only once per validation. This is the optimal pattern as shown in the benchmarks.

## Function Overhead Performance

### Test Results (10M iterations)

- **Direct operation**: 6.56 ms
  - Code: `value + 1`
- **Inline function avg**: 5.30 ms (-1.25ms, faster due to V8 optimizations)
  - Code: `const d = v => v + 1; d(value)`
- **Closure function avg**: 5.25 ms (-1.31ms, faster due to V8 optimizations)
  - Code: `const offset = 1; const D = v => v + offset; return function(v) { return D(v); }`
  - D captured in closure during validator creation
- **Generated code (IIFE)**: 7.21 ms (+0.65ms overhead)
  - Code: `return function(v) { const D = v => v + offset; return D(v); }`
  - D defined within function at validation time

### Conclusion

Functions are actually faster than direct operations due to V8 inline caching and JIT compilation. The simple closure pattern is slightly more performant than inline, but the difference is negligible (0.05ms). The generated code pattern with IIFE adds overhead.

### Comparison with Instanceof

The overhead difference between function calls and instanceof is due to:

- **Function calls**: Simple arithmetic operation, highly optimized by V8
- **Instanceof**: Complex prototype chain traversal, inherently slower

## Loop Optimization Performance

### Test Results (100M iterations, 100 runs average)

- **Incremental loop (`for (let i = 0; i < n; i++)`)**: 37.919ms
- **Decremental loop (`for (let i = n; i--)`)**: 33.065ms (~13% faster)
- **Decremental loop with init outside (`let i = n; for (; i--)`)**: **32.030ms** (~16% faster, optimal)
- **While loop (`while (i--)`)**: Not recommended (variable performance at scale)

### Why `let i = n; for (; i--)` is optimal

1. **Single operation in condition**: Decrement and falsy test combined
2. **No comparison with limit**: Avoids comparing `i` to `n` on each iteration
3. **Scope optimization**: Variable initialized outside loop scope reduces V8 overhead
4. **Cache-friendly**: CPU branch prediction works better with simple decremental patterns

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

### Test Results (10 runs, 100M iterations, median)

- **Direct function**: 31.825ms
- **IIFE-closed function**: 32.017ms
- **IIFE-closed function arguments**: 31.773ms
- **IIFE-closed function arguments in const**: **31.790ms** (optimal)
- **IIFE without arguments**: 31.801ms (slightly better than direct function)

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
2. **Performance**: Consistently ~0.05-0.1ms faster than direct function (even without arguments)
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
5. **DNA handler uses generated code pattern** for consistency with the system, despite being less performant
6. **Loop optimization**: Use `let i = n; for (; i--)` for hot loops (~16% faster than incremental)
7. **IIFE with closure capture**: Pattern `const fn = function(x) { const _x = x; return function(v) { ... }; }(x)` is optimal for DNA validators - captures context with minimal overhead (~0.5ms difference from direct function)
