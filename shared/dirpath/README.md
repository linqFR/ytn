# @ytn/shared/dirpath

Normalized path handling and deterministic, failure-transparent I/O operations. This package provides safeguards against cross-platform directory issues (Windows/Linux) and silent I/O failures.

## Table of Contents

- [Path Normalization (pathops)](#path-normalization-pathops)
- [Safe I/O (fsops)](#safe-io-fsops)
  - [Async: readSafe, writeSafe](#async-readsafe-writesafe)
  - [Sync: readSyncSafe, writeSyncSafe](#sync-readsyncsafe-writesyncsafe)
- [Recursive Operations](#recursive-operations)

---

## Path Normalization (`pathops`)

In the **YTN** monorepo, we enforce **Forward Slashes (/)** for all paths in code and configuration. Node.js handles this correctly even on Windows.

> [!CAUTION]
> Always use `pathops` to normalize paths before persisting them or using them for comparisons.

```typescript
import * as pathops from "@ytn/shared/dirpath/path-ops.js";

const clean = pathops.normalize("src\\core/module.ts"); // "src/core/module.ts"
const abs = pathops.resolveToRoot("shared"); // Absolute path to the toolbox
```

---

## Safe I/O (`fsops`)

We avoid `fs.readFileSync` because it throws and halts the process. Instead, `fsops` returns a `SafeResult`.

### Async: `readSafe`, `writeSafe`

Uses `fs.promises` under the hood.

```typescript
import * as fsops from "@ytn/shared/dirpath/fs-ops.js";

// 1. Read asynchronously
const [err, content] = await fsops.readSafe("config.json");

// 2. Handle failure gracefully
if (err) return tools.send.error(err);

// 3. Process
console.log(content);
```

### Sync: `readSyncSafe`, `writeSyncSafe`

Deterministic wrappers for blocking operations. Recommended only for CLI startups or bootstrapping.

---

## Recursive Operations

### `copyDeep(src, dest, overwrite?)`

Performs a recursive copy of a directory or file.

### `removeDeep(target)`

Forcefully deletes a directory or file (like `rm -rf`).
