# @ytn

## Packages

Each package is designed to be **lightweight**, **type-safe**, and **independent**.

|                                 Package |     Name     | Purpose                   | Example                                                      |
| --------------------------------------: | :----------: | :------------------------ | :----------------------------------------------------------- |
| **[@ytn/qb](./packages/query-builder)** | QueryBuilder | **SQLite Query Builder**  | `QB.table("users").select(["id"]).where(["active"]).build()` |
|  **[@ytn/czvo](./packages/cli-to-zvo)** |  Cli-to-Zvo  | **CLI Contract & Parser** | `const result = cliToZVO(contract);`                         |

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
import { cliToZVO, pico } from "@ytn/czvo";

// 1. Define the Contract
const contract = {
  name: "ytn-cli",
  description: "Deployment Tool",
  cli: {
    positionals: ["env"],
    flags: {
      verbose: {
        short: "v",
        type: "boolean",
        desc: "Enable detailed logging",
        intercept: true,
      },
    },
  },
  targets: {
    deploy: {
      env: pico.string(), // pico
      verbose: "boolean", // DSL
    },
  },
};

// 2. One-line Parsing & Zod-Validation
const result = cliToZVO(contract, process.argv.slice(2));

if (result.route === "deploy") {
  console.log(`Deploying to ${result.data.env}...`);
  if (result.data.verbose) console.log("Verbose mode ON");
}
```

## Tech Stack

- **Runtime**: Node.js (>=24.0.0)
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`type: module`)

## Getting Started

### 1. Installation

#### For your own project

```bash
npm install @ytn/qb
npm install @ytn/czvo
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
```

## License

This project is licensed under the **MIT License**.
