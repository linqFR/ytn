# @shared (Toolbox)

Centralized, lightweight, and type-safe utilities for the ytrynot monorepo. This toolbox is shared across all internal packages to ensure logic consistency and high performance.

## Design Philosophy

- **SafeMode First**: Favoring `SafeResult` tuples `[error, result]` over exceptions.
- **V4 Authoritative**: Strict adherence to Zod V4 standards and internal reflection.
- **Agnostic & Pure**: Zero external dependencies (except Zod) for maximum portability.

## Table of Contents

- [Quick Start](#quick-start-example)
- [Best Practices: Direct Imports](#best-practices-direct-imports)
- [Namespaces](#namespaces)
  - [JavaScript (js)](./js/README.md)
  - [Zod Reflection (zod)](./zod/README.md)
  - [Safe Orchestration (safe)](./safe/README.md)
  - [Filesystem and Paths (dirpath)](./dirpath/README.md)
  - [Templates and YAML (template)](./template/README.md)
  - [Global Types (types)](./types/README.md)
  - [Regex (regex)](#regex)
  - [CLI (cli)](#cli)
  - [Polyfill (polyfill)](#polyfill)

---

## Namespaces

### Regex

Regex validation utilities — check if a string is a valid ECMAScript regex pattern.

```typescript
import { isValidRegex } from "@ytrynot/shared/regex/is-valid-regex.js";

isValidRegex("^[a-z]+$"); // true
isValidRegex("[invalid", "u"); // false
```

### CLI

AOT compiler launcher — boots a compiled CLI standalone bundle with `parseArgs` and path resolution.

```typescript
import { createAotLauncher } from "@ytrynot/shared/cli/aot-launcher.js";
```

### Polyfill

Forward-compatible polyfills for upcoming ECMAScript standards.

- `Map.prototype.getOrInsert` / `getOrInsertComputed` (Stage 2026 baseline)

```typescript
import "@ytrynot/shared/polyfill/map-ext.js";

const map = new Map<string, number>();
map.getOrInsert("key", 42); // 42 (inserted)
map.getOrInsert("key", 99); // 42 (already present)
```

## Best Practices: Direct Imports

While a barrel file exists at `@ytrynot/shared/index.js` for convenience, we highly recommend using **Direct Imports**.

> [!TIP] > **Performance Booster**: Importing directly from the atomic file ensures the smallest possible bundle size and optimal tree-shaking.

**Avoid (Barrel Import):**

```typescript
import { vms } from "@ytrynot/shared/index.js"; // This might pull unnecessary code.
```

**Prefer (Direct Import):**

```typescript
import { safeRunVM } from "@ytrynot/shared/js/vm-ops.js";
import { unwrapZodDeep } from "@ytrynot/shared/zod/zod-reflection.js";
```

---

## Quick Start Example

```typescript
import { safeRunVM } from "@ytrynot/shared/js/vm-ops.js";
import { getFnUndeclared } from "@ytrynot/shared/js/fn-reflect.js";

const code = " (data) => db.save(data) ";

// 1. Reflect upon dependencies
const globals = getFnUndeclared(code); // ["db"]

// 2. Run in isolated VM
const [err, res] = safeRunVM(code, { db: myDbInstance });
```
