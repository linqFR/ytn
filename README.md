## Packages

Each package is designed to be **lightweight**, **type-safe**, and **independent**.

| Package                                      | Purpose                   | Example                                                      |
| :------------------------------------------- | :------------------------ | :----------------------------------------------------------- |
| **[@ytn/qb](./packages/query-builder)**      | **SQLite Query Builder**  | `QB.table("users").select(["id"]).where(["active"]).build()` |
| **[@ytn/cli-to-zvo](./packages/cli-to-zvo)** | **CLI Contract & Parser** | `const { xorSchema } = cliToZod(contract);`                  |

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

#### [@ytn/cli-to-zvo](./packages/cli-to-zvo/README.md)

Define your contract once, get automated parsing and routing for free.

```typescript
import { cliToZVO } from "@ytn/cli-to-zvo";

// 1. Define the Contract
const contract = {
  name: "ytn-cli",
  description: "Deployment Tool",
  def: {
    verbose: {
      type: "boolean",
      flags: { long: "verbose", short: "v" },
      description: "Enable detailed logging",
    },
    env: { type: "string", description: "Target environment (dev/prod)" },
  },
  targets: {
    Deploy: {
      description: "Trigger a deployment",
      positionals: ["env"],
      flags: { verbose: { optional: true } },
    },
  },
};

// 2. One-line Parsing & Zod-Validation
const result = cliToZVO(contract, process.argv.slice(2));

if (result.isRoute("Deploy")) {
  console.log(`Deploying to ${result.env}...`);
  if (result.verbose) console.log("Verbose mode ON");
}
```

## Tech Stack

- **Runtime**: Node.js (>=24.0.0)
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`type: module`)

## Getting Started

### Installation

```bash
npm install
```

### Build everything

```bash
npm run build
```

### Run tests

```bash
npm test
```

## License

This project is licensed under the **MIT License**.
