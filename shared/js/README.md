# @ytn/shared/js

Core JavaScript utility layer for the YTN monorepo. This directory contains agnostic, high-performance helpers for data manipulation, logic isolation, and execution.

## Table of Contents

- [Data Structures](#data-structures)
  - [Arrays (arr)](#arrays-arr)
  - [Objects (obj)](#objects-obj)
  - [Strings (str)](#strings-str)
  - [Sets and Records (rec)](#sets-and-records-rec)
- [Logic and Execution](#logic-and-execution)
  - [Functions and Reflection (fn)](#functions-and-reflection-fn)
  - [Isolated VM (vms)](#isolated-vm-vms)
  - [Guarded Objects (lockobj)](#guarded-objects-lockobj)
  - [Caching (memo)](#caching-memo)
  - [Timeouts (timeout)](#timeouts-timeout)
- [Math and Bitwise](#math-and-bitwise)
  - [BitOps (bitops)](#bitops-bitops)
  - [MathOps (math)](#mathops-math)
- [Utilities](#utilities)
  - [JSON (json)](#json-json)
  - [Packages (pkg)](#packages-pkg)
  - [Casting (cast)](#casting-cast)

---

## Data Structures

### Arrays (arr)

Specialized array manipulation and inspection.

- `unique<T>(array: T[]): T[]`: Returns unique values using a Set (O(N)).
- `groupBy<T, K>(array: T[], getter: (item: T) => K): Record<K, T[]>`: Group elements by key.
- `ensureArray<T>(val: T | T[]): T[]`: Guarantees an array output.

### Objects (obj)

- `deepClone<T>(obj: T): T`: Deterministic clone using `structuredClone`.
- `deepMerge(target, ...sources)`: Deep recursive merging of pure objects.
- `isPureObject(val)`: Precisely identifies if a value is a standard `{}` object.

### Strings (str)

Industry-standard case transformations.

- `toCamelCase`, `toSnakeCase`, `toPascalCase`, `toKebabCase`, `toScreamingSnakeCase`.
- `isCamelCase`, `isSnakeCase`, etc. (Validation regexes).

### Sets and Records (rec)

- `diff<T>(a: Set<T>, b: Set<T>)`: Returns the symmetrical difference between two sets.
- `mergeRecords<T>(...records: Record<string, T>[])`: Deep merge for specialized record maps.

---

## Logic and Execution

### Functions and Reflection (fn)

Static analysis of JavaScript functions using the TypeScript AST.

- `getFnUndeclared(code: string): string[]`: Identifies missing global dependencies (e.g., `db`, `logger`) in a serialized function string.

### Isolated VM (vms)

Encapsulated execution for dynamic gates.

- `safeRunVM<T>(code: string, sandbox: Record<string, any>, options?: IVMOptions): SafeResult<T>`: Runs code in a `createContext` sandbox with a configurable timeout.

### Guarded Objects (lockobj)

- `protectObject<T>(obj: T): T`: Wraps an object in a Proxy to prevent unauthorized mutations (Immutability layer).

### Caching (memo)

- `memoize<T>(fn: (...args: any[]) => T): (...args: any[]) => T`: Lightweight memoization for performance-heavy functions.

### Timeouts (timeout)

- `withTimeout<T>(promise: Promise<T>, ms: number, msg?: string): Promise<T>`: Wraps any promise with a strict execution deadline.

---

## Math and Bitwise

### BitOps (bitops)

Low-level bitwise operations for performance-critical logic.

- `hasBit(bitset, bit)`: Checks if a bit is set in a bitmask.
- `combineBits(...bits)`: Merges multiple flags into a single bitset.
- `toHex(n)`: Standardized hex string conversion.

### MathOps (math)

- `allCombinations<T>(...arrays: T[][]): T[][]`: Generates the Cartesian Product of multiple arrays. Used for generating exhaustive routing signatures.

---

## Utilities

### JSON (json)

Safe JSON interaction without `try/catch`.

- `safeParse<T>(str: string): SafeResult<T>`: Returns `[Error, Result]` tuple.
- `safeStringify(val: any): SafeResult<string>`: Deterministic stringification.

### Packages (pkg)

- `findPackageRoot(startDir)`: Recursively discovers the nearest `package.json`.
- `readPackageJson(dir)`: Safe extraction of package version and metadata.

### Casting (cast)

- `asBoolean(val)`: Robust coercion for CLI flags (handles "true", "1", "on").
- `asNumber(val, default?)`: Safe numeric coercion with fallbacks.
