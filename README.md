# @ytrynot

## Packages

Each package is designed to be **lightweight**, **type-safe**, and **independent**.

|                                 Package |     Name     | Purpose                   | Example                                                      |
| --------------------------------------: | :----------: | :------------------------ | :----------------------------------------------------------- |
| **[@ytrynot/qb](./packages/query-builder)** | QueryBuilder | **SQLite Query Builder**  | `QB.table("users").select(["id"]).where(["active"]).toSQL()` |
| **[@ytrynot/dna](./packages/dna)** | DNA | **Schema Builder** | `const schema = dna.string().min(5); const dna = schema.toDna();` |
| **[@ytrynot/schvalid](./packages/schvalid)** | Schvalid | **JSON Schema Processing** | `const dna = jschemaToDna(schema); const validate = validator(dna);` |

---

### Quick Previews

#### [@ytrynot/qb](./packages/query-builder/README.md)

Generate secure SQL strings from fluent API or Zod schemas.

```typescript
import { QueryBuilder as QB } from "@ytrynot/qb";

// Simple selection
const sql = QB.table("users", "u")
  .select(["u.id", "u.name"])
  .where(["u.active"])
  .orderBy("u.created_at", "DESC")
  .toSQL();
```

#### [@ytrynot/dna](./packages/dna/README.md)

DNA-based schema builder with Zod-like syntax and native DNA bytecode serialization.

```typescript
import { dna } from "@ytrynot/dna";

const schema = dna.string().min(5).max(10);
const dna = schema.toDna();
// Returns: ["s", [5, 10, null, null], {}]
```

#### [@ytrynot/schvalid](./packages/schvalid/README.md)

Convert JSON Schema to high-performance DNA bytecode for ultra-fast validation.

```typescript
import { jschemaToDna, validator, parser } from "@ytrynot/schvalid";

const schema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 0 },
  },
};

const dna = jschemaToDna(schema);
const validate = validator(dna);
const parse = parser(dna);

validate({ name: "John", age: 30 }); // true
const result = parse({ name: "John", age: 30 });
// Returns: { success: true, data: { name: "John", age: 30 } }
```

## Tech Stack

- **Runtime**: Node.js (>=25.0.0)
- **Language**: TypeScript 6.0.3 (esnext)
- **Module System**: Pure ESM (`type: module`)

## Getting Started

### 1. Installation

#### For your own project

```bash
npm install @ytrynot/qb
npm install @ytrynot/dna
npm install @ytrynot/schvalid
```

#### For development (monorepo)

```bash
# Clone the repository
git clone git@github.com:linqFR/ytn.git
cd ytn

# Install all dependencies and setup workspaces
npm install
```

### 2. Build & Test

You can run commands for all packages using the workspace pattern:

```bash
# Build all @ytrynot/* packages
npm run build

# Run tests for all packages
npm test
```

### 3. Targeting Packages

To work on a specific package, use the `--workspace` flag:

```bash
# Example for Query Builder
npm run build -w @ytrynot/qb
npm test -w @ytrynot/qb

# Example for DNA
npm run build -w @ytrynot/dna
npm test -w @ytrynot/dna

# Example for Schvalid
npm run build -w @ytrynot/schvalid
npm test -w @ytrynot/schvalid
```

## License

This project is licensed under the **MIT License**.
