# Adding a New MCP Tool — @ytrynot/gov-mcp

How-to guide for maintainers. Walks through every file you need to touch to add a new MCP tool to the governance server, with a concrete end-to-end example.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Step 1 — Define the Input Schema](#step-1--define-the-input-schema)
- [Step 2 — Write the SQL Query](#step-2--write-the-sql-query)
- [Step 3 — Write the Handler Function](#step-3--write-the-handler-function)
- [Step 4 — Register the Tool](#step-4--register-the-tool)
- [Step 5 — Build and Test](#step-5--build-and-test)
- [Checklist](#checklist)

---

## Architecture Overview

The package uses a centralized tool registry. Adding a tool touches four files, each with a single responsibility:

```
tool-inputs.ts  →  queries/*.ts  →  tools/read.ts (or write.ts)  →  definitions/tools.ts
     schema           SQL              handler                        registry entry
```

| File | What you add | Purpose |
|------|-------------|---------|
| `src/schemas/tool-inputs.ts` | A DNA schema (`xxxInput`) | Validates input, carries `.meta()` for help/docs |
| `src/queries/*.ts` | A prepared statement | Compiles SQL via `@ytrynot/qb` |
| `src/types/queries.ts` | The statement name in `IQueries` | Type-safety for the query store |
| `src/tools/read.ts` or `write.ts` | An exported handler function | Validates input, runs the query, returns `ok()`/`err()` |
| `src/definitions/tools.ts` | One entry in `toolList` | Registers the tool with the MCP server |

No other files need updating. The server, help system, signature generator, and metadata all derive from `toolList`.

---

## Step 1 — Define the Input Schema

In `src/schemas/tool-inputs.ts`, define a DNA schema for the tool's input parameters. Use `dna.strictObject()` so unknown fields are rejected. Attach `.meta()` with `title`, `description`, `usage`, and `category` — these power the `help` tool output.

```ts
import { dna } from "@ytrynot/dna";
import { entityIdSchema } from "./constants.js"; // reuse shared schemas

export const getDecisionInput = dna.strictObject({
  id: entityIdSchema.describe("Decision ID (e.g. DEC-0001)"),
}).meta({
  title: "GetDecisionInput",
  description: "Get a single decision by ID, including its status history.",
  usage: "Get a single decision with full details and status history.",
  category: CATEGORY.read,
  returns: "{ decision: tsDecisionRow, history: tsStatusHistoryRow[], scopes: tsEntityScopeRow[] }",
});
```

**Key points:**

- **`dna.strictObject()`** — rejects unknown fields at validation time. Never use `dna.object()` for tool inputs.
- **`.describe()`** on each field — surfaces in the auto-generated `Parameters:` block of `help`.
- **`.meta()`** — `description` is the short one-liner shown in `tools/list`; `usage` is the detailed prose shown in `help`; `category` is a `CATEGORY.*` object (`id`, `read`, `search`, `write`, `reports`, `system`) controlling which section of `help` the tool appears under.
- **Reuse shared schemas** — `nanoidSchema`, `entityIdSchema`, `decisionStatusSchema`, etc. are already defined at the top of the file.

---

## Step 2 — Write the SQL Query

Queries are pre-compiled prepared statements built with `@ytrynot/qb`. Each table cluster has its own file in `src/queries/`.

### 2a. Add the statement to `IQueries`

In `src/types/queries.ts`, add the new statement name:

```ts
export interface IQueries {
  // ... existing statements ...
  getDecisionById: IStatement<tsDecisionRow>;
}
```

`IStatement<T>` is the prepared-statement type, where `T` is the row type returned by the query.

### 2b. Compile the query

In the appropriate queries file (e.g. `src/queries/decisions.ts` for decision-related queries), add the prepared statement:

```ts
import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileDecisionQueries(db: GovDb): Pick<IQueries,
  | "getDecisionById"
  | "getDecisionBySeq"
  // ... other statement names ...
> {
  const t = tables;
  const d = t.decisions.names;
  return {
    getDecisionById: db.prepare(t.decisions.getById),
    // ... other statements ...
  };
}
```

**Key points:**

- **`tables.xxx.req`** — the query builder request object for the table. Use `.select()`, `.where()`, `.orderBy()`, `.limit()` to build queries.
- **`db.prepare(sql)`** — compiles the SQL string into a prepared statement.
- **`t.xxx.getById`** — some tables have pre-built queries in `definitions/schema.ts` for common operations.
- **Enums in queries** — use `ENUM.byKey.valueName` (e.g. `ACTION_STATUS.byKey.pending`) to interpolate enum values into SQL. Never use bare `ACTION_STATUS.pending` — the enum object no longer has direct properties.

---

## Step 3 — Write the Handler Function

Handlers live in `src/tools/read.ts` (read-only), `src/tools/write.ts` (mutations), or `src/tools/reports.ts` (report generation). Each handler follows the same pattern:

```ts
import { dna } from "@ytrynot/dna";
import { err, ok } from "./results.js";
import * as S from "../schemas/tool-inputs.js";
import type { IToolCtx, IToolResult } from "../types/types.ts";

export function getDecision(
  ctx: IToolCtx,
  input: dna.infer<typeof S.getDecisionInput>,
): IToolResult {
  // 1. Validate input
  const res = S.getDecisionInput.safeParse(input);
  if (!res.success) {
    const messages = res.errors.map((e) => `${e.message} at ${e.path}`);
    return err(`Validation failed:\n${messages.join("\n")}`);
  }

  // 2. Run the query
  const row = ctx.queries.getDecisionById.get({ id: input.id });
  if (!row) return err(`Decision ${input.id} not found`);

  // 3. Return structured result
  const history = ctx.queries.getStatusHistory.all({ entity_type: "decision", entity_id: input.id });
  return ok(`Decision ${input.id}`, { decision: row, history });
}
```

**Key points:**

- **`dna.infer<typeof S.xxxInput>`** — the TypeScript type inferred from the DNA schema. Use it as the `input` parameter type.
- **`safeParse`** — validates the input. On failure, return `err()` with the validation messages.
- **`ctx.queries.xxx`** — access the pre-compiled query. `.get()` for single-row, `.all()` for multiple rows.
- **`ok(text, structured)`** — returns a successful result. `text` is a human-readable summary; `structured` is the machine-readable payload that becomes `structuredContent` in the MCP response.
- **`err(text)`** — returns an error result with `isError: true`.
- **Tools without input** — the handler signature omits `input`, but the registry entry still carries an empty `dna.object({})` schema (see `get_handoff` or `export_dump`).

---

## Step 4 — Register the Tool

In `src/definitions/tools.ts`, add one entry to the `toolDefs` record — the key is the tool name:

```ts
const toolDefs = {
  // ... existing tools ...

  get_decision: { handler: read.getDecision, schema: S.getDecisionInput },
};
```

**That's it.** `toolList` is derived from `toolDefs` (`Object.entries` → `{ name, args, handler, category }`), and `server.ts` iterates it to register every tool with the MCP server. The help system, signature generator, and metadata all derive from this list.

**Key points:**

- **the record key** — the MCP tool name (snake_case). This is what agents call.
- **`schema`** — the DNA schema from Step 1.
- **`handler`** — the function from Step 3.
- **`category`** — not written on the entry; it is read from the schema's `.meta()` (`category: CATEGORY.*`) when `toolList` is derived.

### Aliases

To register the same handler under a different name (e.g. `register_me` as an alias for `register_writer`), clone the shared schema and override the doc fields in its `.meta()`:

```ts
register_me: {
  handler: write.registerWriter,
  schema: S.registerWriterInput.meta({
    description: "Alias for register_writer. Register yourself as a writer and receive a nanoid token.",
    usage: "Alias for register_writer. See register_writer for full documentation.",
    category: CATEGORY.id,
  }),
},
```

### The `help` tool

The `help` tool is special — its `args` schema includes a `dna.enum()` of all other tool names, built dynamically from `toolList`. It is added to `toolList` automatically at the end of `definitions/tools.ts`. You never need to touch it.

---

## Step 5 — Build and Test

```powershell
npm.cmd run build -w @ytrynot/gov-mcp
npm.cmd test -w @ytrynot/gov-mcp
```

The build compiles TypeScript and generates `.d.ts` files. The test suite runs 270 tests across 18 files. If the build or tests fail, fix the errors before committing.

### Writing tests for a new tool

Add a test in `tests/` that exercises the tool through the MCP protocol (preferred) or directly via the handler function. See `tests/mcp-protocol.test.ts` for examples of end-to-end MCP testing, or `tests/integration.test.ts` for direct handler testing.

---

## Checklist

Before considering a new tool complete, verify:

- [ ] **Schema defined** in `src/schemas/tool-inputs.ts` with `.meta()` (title, description, usage, category)
- [ ] **Query compiled** in the appropriate `src/queries/*.ts` file
- [ ] **Statement added** to `IQueries` in `src/types/queries.ts`
- [ ] **Handler exported** from `src/tools/read.ts`, `write.ts`, or `reports.ts`
- [ ] **Registry entry added** to `toolList` in `src/definitions/tools.ts`
- [ ] **Build passes** — `npm.cmd run build -w @ytrynot/gov-mcp`
- [ ] **Tests pass** — `npm.cmd test -w @ytrynot/gov-mcp`
- [ ] **Test written** for the new tool's behavior
- [ ] **Enum values accessed via `.byKey`** — never use bare `ENUM.value` in queries or handlers
