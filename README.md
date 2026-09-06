# @ytrynot (whY Try Not)

[![CI](https://github.com/linqFR/ytn/actions/workflows/ci.yml/badge.svg)](https://github.com/linqFR/ytn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


## Why

AI agents carry their workflows in context memory, eating tokens and attention. @ytrynot means  to build and provide portable, js-compilable tools that agents can use and build themselves — offloading logic from their context to dedicated skills, so workflows run as tools rather than living in the agent's head.

## Packages

Each package is designed to be **lightweight**, **type-safe**, and **independent**.

|                                 Package |     Name     | Purpose                   | Example                                                      |
| --------------------------------------: | :----------: | :------------------------ | :----------------------------------------------------------- |
| **[@ytrynot/qb](./packages/query-builder)** | QueryBuilder | **SQLite Query Builder**  | `QB.table("users").select(["id"]).where(["active"]).toSQL()` |
| **[@ytrynot/dna](./packages/dna)** | DNA | **Schema Builder** | `const schema = dna.string().min(5); const dna = schema.toDna();` |
| **[@ytrynot/schvalid](./packages/schvalid)** | Schvalid | **JSON Schema Processing** | `const dna = jschemaToDna(schema); const validate = validator(dna);` |
| **[@ytrynot/cli](./packages/cli)** | CLI | **DNA-validated CLI Factory & Router** | `const contract = createContract({ routes }); const result = execute(contract, argv);` |
| **[@ytrynot/gov-mcp](./packages/gov-mcp)** | Gov MCP | **Inter-agent Governance MCP Server** | `npx @ytrynot/gov-mcp` |

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

#### [@ytrynot/cli](./packages/cli/README.md)

DNA-validated CLI router with 5-layer architecture, Maranget decision-tree routing, automatic help generation, and AOT compilation to standalone JS.

```typescript
import { dna } from "@ytrynot/dna";
import { createContract, execute, compile } from "@ytrynot/cli";

// Define routes as DNA schemas — routing, validation, and help all derive from this
const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional(),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const contract = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute],
  cli: { positionals: ["cmd", "files"] },
});

// Layer 1: sync routing + validation
const result = execute(contract, ["build", "a.ts", "b.ts"]);
// → { success: true, route: "build", payload: { cmd: "build", files: ["a.ts", "b.ts"] } }

// AOT: compile to standalone JS — no DNA runtime at call time
const parser = compile(contract);
const aot = parser(["build", "a.ts"]); // same result, no @ytrynot/dna needed
```

#### [@ytrynot/gov-mcp](./packages/gov-mcp/README.md)

Inter-agent governance MCP server — track decisions, actions, ideas, problems, and specs shared across multiple AI agents via the Model Context Protocol.

```bash
# Install and start the MCP server (stdio transport)
npx @ytrynot/gov-mcp
```

```json
// Add to your MCP client config (Claude Code, Devin, Cursor, etc.)
{
  "mcpServers": {
    "gov-mcp": {
      "command": "npx",
      "args": ["-y", "@ytrynot/gov-mcp"]
    }
  }
}
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
npm install @ytrynot/cli
npm install @ytrynot/gov-mcp
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

# Example for CLI
npm run build -w @ytrynot/cli
npm test -w @ytrynot/cli

# Example for Gov MCP
npm run build -w @ytrynot/gov-mcp
npm test -w @ytrynot/gov-mcp
```

## Agent Skills

This repo ships a [skill.md](./skills/ytn/SKILL.md) compatible with the [Agent Skills](https://agentskills.io) standard. Install it into your AI coding agent (Claude Code, Cursor, Codex, Windsurf, Devin...) so it knows how to use the ytn packages:

```bash
npx skills add linqFR/ytn
```

## Contributing

Contributions are welcome. If you want to help — bug reports, feature ideas, docs, tests, or new packages — open an issue or a PR on [GitHub](https://github.com/linqFR/ytn).

## License

This project is licensed under the **MIT License**.
