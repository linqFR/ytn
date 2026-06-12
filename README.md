# @ytn

## Packages

Each package is designed to be **lightweight**, **type-safe**, and **independent**.

|                                 Package |     Name     | Purpose                   | Example                                                      |
| --------------------------------------: | :----------: | :------------------------ | :----------------------------------------------------------- |
| **[@ytn/qb](./packages/query-builder)** | QueryBuilder | **SQLite Query Builder**  | `QB.table("users").select(["id"]).where(["active"]).build()` |
|  **[@ytn/czvo](./packages/cli-to-zvo)** |  Cli-to-Zvo  | **CLI Contract & Parser** | `const result = execute(contract, args);`                    |
| **[@ytn/dna](./packages/dna)** | DNA | **Schema Builder** | `const schema = dna.string().min(5); const dna = schema.toDna();` |
| **[@ytn/schvalid](./packages/schvalid)** | Schvalid | **JSON Schema Processing** | `const dna = jschemaToDna(schema); const validate = validator(dna);` |

---

### Quick Previews

#### [@ytn/qb](./packages/query-builder/README.md)

Generate secure SQL strings from fluent API or Zod schemas.

```typescript
import { QueryBuilder as QB } from "@ytn/qb";

// Simple selection
const sql = QB.table("users", "u")
  .select(["u.id", "u.name"])
  .where(["u.active"])
  .orderBy("u.created_at", "DESC")
  .build();
```

#### [@ytn/czvo](./packages/cli-to-zvo/README.md)

Define your contract once, get automated parsing and routing for free.

```typescript
import { createContract, pico } from "@ytn/czvo/editor.js"
import { execute } from "@ytn/czvo";

// 1. Define the Contract
const contract = createContract({
  name: "ytn-cli",
  description: "Deployment Tool",
  cli: {
    positionals: ["env"],
    flags: {
      verbose: { short: "v", type: "boolean", desc: "Enable logging" },
    },
  },
  targets: {
    deploy: {
      env: pico.string(), // pico
      verbose: "boolean", // DSL
    },
  },
});

// 2. One-line Parsing & Zod-Validation
const result = execute(contract, process.argv.slice(2));

if (result.success) {
  const { route, data } = result.data;
  if (route === "deploy") {
    console.log(`Deploying to ${data.env}...`);
    if (data.verbose) console.log("Verbose mode ON");
  }
}
```

#### [@ytn/dna](./packages/dna/README.md)

DNA-based schema builder with Zod-like syntax and native DNA bytecode serialization.

```typescript
import { dna } from "@ytn/dna";

const schema = dna.string().min(5).max(10);
const dna = schema.toDna();
// Returns: ["s", [5, 10, null, null], {}]
```

#### [@ytn/schvalid](./packages/schvalid/README.md)

Convert JSON Schema to high-performance DNA bytecode for ultra-fast validation.

```typescript
import { jschemaToDna, validator, parser } from "@ytn/schvalid";

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
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`type: module`)

## Getting Started

### 1. Installation

#### For your own project

```bash
npm install @ytn/qb
npm install @ytn/czvo
npm install @ytn/dna
npm install @ytn/schvalid
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
# Build all @ytn/* packages
npm run build

# Run tests for all packages
npm test
```

### 3. Targeting Packages

To work on a specific package, use the `--workspace` flag:

```bash
# Example for Query Builder
npm run build -w @ytn/qb
npm test -w @ytn/qb

# Example for CLI Contract & Parser
npm run build -w @ytn/czvo
npm test -w @ytn/czvo

# Example for DNA
npm run build -w @ytn/dna
npm test -w @ytn/dna

# Example for Schvalid
npm run build -w @ytn/schvalid
npm test -w @ytn/schvalid
```

## License

This project is licensed under the **MIT License**.
