---
name: ytn
description: Use the ytn package ecosystem — @ytrynot/dna (Zod-like schema builder + DNA bytecode runtime), @ytrynot/schvalid (JSON Schema to DNA compiler), @ytrynot/qb (fluent SQLite query builder), @ytrynot/cli (DNA-validated CLI router with AOT). Use when the user wants to validate data, define schemas, build SQL queries, create a CLI, or compile JSON Schema to standalone validators.
license: MIT
metadata:
  author: linqFR
  version: "1.0"
  repo: https://github.com/linqFR/ytn
---

# ytn — Package Usage Guide

ytn (whY Try Not) provides portable, JS-compilable TypeScript packages for schema validation, SQL generation, and CLI routing. All packages are pure ESM, strict TypeScript, zero external dependencies where possible.

## Packages at a Glance

| Package | npm | Install | Use when |
|---------|-----|---------|----------|
| `@ytrynot/dna` | `@ytrynot/dna` | `npm install @ytrynot/dna` | You need Zod-like schema validation with serializable bytecode or standalone compiled validators |
| `@ytrynot/schvalid` | `@ytrynot/schvalid` | `npm install @ytrynot/schvalid` | You have a JSON Schema 2020-12 and want ultra-fast validation |
| `@ytrynot/qb` | `@ytrynot/qb` | `npm install @ytrynot/qb` | You need to build SQLite SQL strings from a fluent API or Zod/DNA schema |
| `@ytrynot/cli` | `@ytrynot/cli` | `npm install @ytrynot/cli` | You need a CLI router with DNA-validated routes, auto-help, and AOT compilation |

---

## @ytrynot/dna — Schema Builder + DNA Runtime

### Install

```bash
npm install @ytrynot/dna
```

### Define a schema (Zod-like fluent API)

```typescript
import { dna } from "@ytrynot/dna";

const user = dna.object({
  name: dna.string().min(2),
  email: dna.string().email(),
  age: dna.number().int().min(0).optional(),
  role: dna.enum(["admin", "user"]).default("user"),
});

type User = dna.infer<typeof user>;
// { name: string; email: string; age?: number; role: "admin" | "user" }
```

### Validate / parse

```typescript
// Boolean validation (fast, fail-fast)
user.validate({ name: "John", email: "john@test.com" }); // true

// Safe parse (no throw)
const result = user.safeParse({ name: "J", email: "bad" });
// { success: false, errors: [...] }

// Parse (throws on error)
const data = user.parse({ name: "John", email: "john@test.com" });
```

### Compile to standalone JS (no runtime needed)

```typescript
import { dna, validator, parser } from "@ytrynot/dna";

const schema = dna.object({ name: dna.string().min(2), age: dna.number() });
const bytecode = schema.toDna(); // serializable DNA bytecode

// Compile once, reuse the function
const validate = validator(bytecode);
validate({ name: "John", age: 30 }); // true

const parse = parser(bytecode);
parse({ name: "John", age: 30 }); // { success: true, data: { name: "John", age: 30 } }
```

### Object modes

```typescript
dna.object({ name: dna.string() })               // standard — strips unknown keys
dna.strictObject({ name: dna.string() })          // strict — rejects unknown keys
dna.looseObject({ name: dna.string() })           // loose — passes unknown keys through
```

### Common schema types

```typescript
dna.string().min(1).max(100).email().uuid().url().regex(/^[a-z]+$/)
dna.number().int().positive().negative().min(0).max(100).multipleOf(2)
dna.boolean()
dna.date()
dna.bigint()
dna.literal("active")
dna.enum(["a", "b", "c"])
dna.array(dna.string()).min(1).max(10).nonempty()
dna.object({ ... })
dna.tuple([dna.string(), dna.number()])
dna.union([dna.string(), dna.number()])
dna.discriminatedUnion("type", [shapeA, shapeB])
dna.record(dna.string(), dna.boolean())
dna.map(dna.string(), dna.string())
dna.set(dna.string())
dna.optional()    // dna.string().optional()
dna.nullable()    // dna.string().nullable()
dna.default("fallback")
dna.catch("fallback")
dna.preprocess((v) => Number(v), dna.number())
dna.coerce.number().parse("123")  // 123
dna.instanceof(UserClass)
dna.templateLiteral(["https://", dna.string(), ".", dna.enum(["com", "net"])])
dna.function().input([dna.string()]).output(dna.number()).implement((s) => s.length)
dna.lazy(() => dna.object({ children: dna.array(recursiveSchema) }))
dna.brand<"MyBrand">()
```

### Refinements

```typescript
dna.string().refine((s) => s.length > 3, "Too short");
dna.array(dna.string()).superRefine((val, ctx) => {
  if (val.length > 10) ctx.addIssue({ code: "too_big", maximum: 10, message: "Too many" });
});
```

### Transforms + pipe

```typescript
const schema = dna.string().transform((s) => s.length).pipe(dna.number());
schema.parse("hello"); // 5
```

### Recursion

```typescript
// Pattern 1: dna.lazy()
const TreeSchema: DnaLazy<Tree> = dna.lazy(() =>
  dna.object({ value: dna.number(), children: dna.array(TreeSchema) })
);

// Pattern 2: object getters (self-reference)
const NodeSchema = dna.object({
  value: dna.number(),
  get children() { return dna.array(NodeSchema); },
});
```

### Metadata

```typescript
const field = dna.string().meta({ title: "Email", description: "User email" });
const field2 = dna.string().describe("User's full name");
```

### Further reading

- [README](https://github.com/linqFR/ytn/tree/main/packages/dna/README.md) — full API, entry points, CLI Union, externals
- [Recipes](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/recipes.md) — 15+ copy-paste recipes (object modes, recursion, pipe, refinements, coercion, template literals, function schemas, records/maps/sets, defaults, branding, metadata)
- [Technical docs](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/technical.md) — DNA opcodes, architecture, codegen internals
- [Zod comparison](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/zod-comparison.md) — DNA vs Zod feature parity
- [Externals](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/externals.md) — externals mechanism for transforms
- [Serialization](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/serialization.md) — DNA serialization format
- [Opcode patterns](https://github.com/linqFR/ytn/tree/main/packages/dna/docs/opcode-patterns.md) — opcode usage patterns

---

## @ytrynot/schvalid — JSON Schema to DNA Compiler

### Install

```bash
npm install @ytrynot/schvalid
```

### Convert JSON Schema to DNA + validate

```typescript
import { jschemaToDna, validator, parser } from "@ytrynot/schvalid";

const jsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3 },
    age: { type: "number", minimum: 0 },
  },
  required: ["name"],
};

const dna = jschemaToDna(jsonSchema);

// Fast boolean validation
const validate = validator(dna);
validate({ name: "John", age: 30 }); // true
validate({ name: "Jo" });            // false (minLength 3)

// Full parse with error collection
const parse = parser(dna);
parse({ name: "John", age: 30 }); // { success: true, data: { name: "John", age: 30 } }
parse({ name: "Jo" });            // { success: false, errors: [...] }
```

### Compile once, validate many (builder API)

```typescript
import { schvalid } from "@ytrynot/schvalid";

const compiler = schvalid("validation");
const validate = compiler.compile(jsonSchema);
validate({ name: "John", age: 30 }); // true

// Four modes:
schvalid("validation"); // boolean validator (fail-fast)
schvalid("parser");     // parser with error collection + fresh output object
schvalid("fast");       // hybrid: validate first, parse only on failure (data === input on success)
schvalid("all");        // { validate, parse, parseFast } — all compiled once, shared instances
```

### Supported JSON Schema 2020-12 features

- Types: string, number, integer, boolean, null, object, array
- Constraints: properties, required, items, additionalProperties, minItems, maxItems, minLength, maxLength, minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, pattern, format, const, enum
- Logic: anyOf, allOf, oneOf, if/then/else, not
- OpenAPI 3.1: discriminator
- References: internal `$ref` only (no external URIs)

### Limitations

- No external `$ref` (HTTP URIs, URNs, external files)
- No custom formats (standard formats only: email, uuid, uri, etc.)
- No async validation, no `$data`, no type coercion, no default injection

### Further reading

- [README](https://github.com/linqFR/ytn/tree/main/packages/schvalid/README.md) — full API, modes, performance
- [AJV comparison](https://github.com/linqFR/ytn/tree/main/packages/schvalid/docs/ajv-comparison.md) — schvalid vs AJV feature-by-feature

---

## @ytrynot/qb — SQLite Query Builder

### Install

```bash
npm install @ytrynot/qb
# Optional peer deps for schema-driven DDL:
npm install zod        # for Zod v4 schema introspection
npm install @ytrynot/dna  # for DNA schema introspection
```

### Fluent DML queries

```typescript
import { QueryBuilder as QB } from "@ytrynot/qb";

const sql = QB.table("users", "u")
  .select(["u.id", "u.name", "u.email"])
  .where(["u.active"])
  .orderBy("u.created_at", "DESC")
  .limit(10)
  .toSQL();

// SELECT u.id, u.name, u.email FROM users AS u WHERE u.active = @active ORDER BY u.created_at DESC LIMIT 10
```

### Define a table from a Zod schema

```typescript
import { z } from "zod";
import { QueryBuilder as QB } from "@ytrynot/qb";

const UserSchema = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  name: z.string(),
  age: z.number().int(),
  created_at: z.date().optional(),
});

const users = QB.defTable("users", UserSchema);

users.createTable;
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY,
//   email TEXT UNIQUE NOT NULL,
//   name TEXT NOT NULL,
//   age INTEGER NOT NULL,
//   created_at DATETIME
// );

users.getById;  // SELECT * FROM users WHERE id = @id
users.insert;   // INSERT INTO users (id, email, name, age, created_at) VALUES (@id, @email, @name, @age, @created_at)
users.update;   // UPDATE users SET email = @email, name = @name, age = @age, created_at = @created_at WHERE id = @id
users.delete;   // DELETE FROM users WHERE id = @id
users.upsert;   // INSERT INTO users (...) VALUES (...) ON CONFLICT(id) DO UPDATE SET ...
```

### Define a table from a DNA schema

```typescript
import { dna } from "@ytrynot/dna";
import { QueryBuilder as QB } from "@ytrynot/qb";

const UserSchema = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  name: dna.string(),
  age: dna.int(),
  created_at: dna.date().optional(),
});

const users = QB.defTable("users", UserSchema);
// Same SQL output as the Zod version
```

### Custom queries via .req / .q

```typescript
users.req.select("id", "name").where("id").toSQL();
// SELECT id, name FROM users WHERE id = @id

users.req.upsert("email", "name").toSQL();
// INSERT INTO users (email, name) VALUES (@email, @name)
// ON CONFLICT(id, email) DO UPDATE SET name = excluded.name
```

### Execute with a driver

```typescript
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("app.db");
db.exec(QB.enableForeignKeys()); // PRAGMA foreign_keys = ON
db.exec(users.createTable);

const stmt = db.prepare(users.insert);
stmt.run({ id: crypto.randomUUID(), email: "a@b.com", name: "Alice", age: 30, created_at: null });
```

### Metadata keys for DDL

| Key | Effect |
|-----|--------|
| `pk: true` | `PRIMARY KEY` |
| `pkauto: true` | `PRIMARY KEY AUTOINCREMENT` |
| `unique: true` | `UNIQUE` |
| `default: value` | `DEFAULT value` |
| `fk: { table, column }` | `REFERENCES table(column)` |

### Further reading

- [Quick Start](https://github.com/linqFR/ytn/tree/main/packages/query-builder/docs/quick-start.md) — full tutorial, end-to-end CRUD
- [How-to: Queries](https://github.com/linqFR/ytn/tree/main/packages/query-builder/docs/how-to-queries.md) — SELECT, INSERT, UPDATE, DELETE, UPSERT, WHERE, JOINs, ordering, limits, pagination, text search, GROUP BY
- [How-to: DDL](https://github.com/linqFR/ytn/tree/main/packages/query-builder/docs/how-to-ddl.md) — all schema sources, metadata keys, foreign keys, indexes, composite PK
- [How-to: Advanced](https://github.com/linqFR/ytn/tree/main/packages/query-builder/docs/how-to-advanced.md) — EXISTS, CASE WHEN, subqueries, window functions, PragmaBuilder
- [Feature reference](https://github.com/linqFR/ytn/tree/main/packages/query-builder/docs/feature-reference.md) — complete method inventory, SQLite version matrix

---

## @ytrynot/cli — DNA-Validated CLI Router

### Install

```bash
npm install @ytrynot/cli
```

### Define routes as DNA schemas

```typescript
import { dna } from "@ytrynot/dna";
import { createContract, execute } from "@ytrynot/cli";

const buildRoute = dna.object({
  cmd: dna.literal("build"),
  files: dna.array(dna.string()).optional().meta({ description: "Files to build" }),
}).meta({ cli: { routeId: "build" }, description: "Build the project" });

const deployRoute = dna.object({
  cmd: dna.literal("deploy"),
  target: dna.string().optional().meta({ description: "Deployment target" }),
}).meta({ cli: { routeId: "deploy" }, description: "Deploy the project" });

const contract = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, deployRoute],
  cli: { positionals: ["cmd", "files"] },
});
```

### Run (layer 1 — sync routing + validation)

```typescript
const result = execute(contract, ["build", "a.ts", "b.ts"]);
// { success: true, route: "build", payload: { cmd: "build", files: ["a.ts", "b.ts"] } }

execute(contract, ["deploy", "--target", "prod"]);
// { success: true, route: "deploy", payload: { cmd: "deploy", target: "prod" } }

execute(contract, ["unknown"]);
// { success: false, errors: [...] }
```

### Full CLI with handlers + formatter + process.exit

```typescript
import { executeContract, cliFactory, fullCli } from "@ytrynot/cli";
import type { ts } from "@ytrynot/cli";

const handlers: ts.Handlers = {
  build: (payload) => ({ success: true, data: `Built ${payload.files?.length ?? 0} files` }),
  deploy: (payload) => ({ success: true, data: `Deployed to ${payload.target ?? "default"}` }),
};

const formatter: ts.FormatterFn = (result) => {
  if (result.success) return { exit: 0, message: String(result.data ?? "") };
  return { exit: 1, message: `Error: ${result.error}` };
};

const run = fullCli(cliFactory(executeContract(contract, handlers), formatter));
await run(); // reads process.argv.slice(2), prints, exits
```

### Add --help / --version

```typescript
const helpRoute = dna.looseObject({ cmd: dna.literal("help") })
  .catchall(dna.unknown())
  .meta({ cli: { flag: true, short: "h", routeId: "help" }, description: "Show help" });

const versionRoute = dna.looseObject({ cmd: dna.literal("version") })
  .catchall(dna.unknown())
  .meta({ cli: { flag: true, short: "v", routeId: "version" }, description: "Show version" });

const contract = createContract({
  name: "mycli",
  description: "A demo CLI",
  targets: [buildRoute, deployRoute],
  fallbacks: [helpRoute, versionRoute],
});

execute(contract, ["--help"]);    // → route: "help"
execute(contract, ["-h"]);        // → route: "help"
execute(contract, ["--version"]); // → route: "version"
```

### Boolean flags + short aliases + coercion

```typescript
const route = dna.object({
  cmd: dna.literal("build"),
  watch: dna.boolean().optional().meta({ description: "Watch for changes" }),
  output: dna.string().optional().meta({ cli: { short: "o" }, description: "Output dir" }),
  port: dna.coerce.number().optional().meta({ description: "Port number" }),
}).meta({ cli: { routeId: "build" } });

// mycli build --watch -o dist/ --port 3000
execute(contract, ["build", "--watch", "-o", "dist/", "--port", "3000"]);
// { cmd: "build", watch: true, output: "dist/", port: 3000 }
```

### AOT compilation (standalone parser, no DNA runtime at call time)

```typescript
import { compile } from "@ytrynot/cli";

const aotParser = compile(contract);
aotParser(["build", "a.ts"]);
// { success: true, route: "build", payload: { cmd: "build", files: ["a.ts"] } }
// The compiled function is standalone JS — no @ytrynot/dna needed at runtime
```

### Route requirements

Every route MUST:
1. Have `cmd: dna.literal("<name>")` — the discriminator
2. Declare `.meta({ cli: { routeId: "<name>" } })` — internal id (injected as `\x00ID`, stripped from payload)
3. Optionally declare `.meta({ description: "..." })` for help text

### Further reading

- [How to define a CLI contract](https://github.com/linqFR/ytn/tree/main/packages/cli/docs/how-to-define-a-cli-contract.md) — 12 recipes (subcommands, flags, positionals, help, aliases, coercion, hidden routes, catchall, full CLI, AOT)
- [How to use CLI in a REPL](https://github.com/linqFR/ytn/tree/main/packages/cli/docs/how-to-use-cli-in-a-repl.md)
- [Architecture](https://github.com/linqFR/ytn/tree/main/packages/cli/docs/architecture.md) — 5-layer pipeline design
- [API reference](https://github.com/linqFR/ytn/tree/main/packages/cli/docs/api-reference.md) — signatures

---

## Choosing Between Packages

| You want to... | Use |
|----------------|-----|
| Define schemas with a fluent API (like Zod) | `@ytrynot/dna` |
| Validate data against a schema | `@ytrynot/dna` (`.validate()`, `.safeParse()`) or `@ytrynot/schvalid` (from JSON Schema) |
| Compile a schema to standalone JS | `@ytrynot/dna` (`validator()`, `parser()`) or `@ytrynot/schvalid` (`schvalid().compile()`) |
| Validate against a JSON Schema 2020-12 document | `@ytrynot/schvalid` |
| Build SQLite SQL strings | `@ytrynot/qb` |
| Generate CREATE TABLE from a Zod/DNA schema | `@ytrynot/qb` (`defTable`) |
| Build a CLI with validated routes | `@ytrynot/cli` |
| Compile a CLI to standalone JS | `@ytrynot/cli` (`compile()`) |
| Serialize a schema to bytecode | `@ytrynot/dna` (`.toDna()`) |

## Version Check

The code examples and API in this skill may evolve. To check if your installed `@ytrynot/*` packages are up to date with the latest npm versions, run the bundled script:

```bash
node scripts/check-versions.mjs
```

This compares each installed package version against the npm registry and reports outdated packages. If any are outdated, update the packages and the skill:

```bash
npm install @ytrynot/dna@latest @ytrynot/schvalid@latest @ytrynot/qb@latest @ytrynot/cli@latest
npx skills update ytn
```

The documentation links above point to the `main` branch on GitHub and always reflect the latest version of the docs.

## Tech Stack Notes

- All packages: pure ESM, TypeScript strict, Node.js >= 25
- `@ytrynot/dna` and `@ytrynot/qb` support both Zod v4 and DNA schemas
- `@ytrynot/cli` uses DNA only (no Zod dependency)
- `@ytrynot/schvalid` uses DNA internally but accepts JSON Schema as input
- `@ytrynot/wf` is private (not published to npm)
