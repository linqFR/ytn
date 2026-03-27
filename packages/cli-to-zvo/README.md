# cli-to-zvo (@ytn/czvo)

> Transform your command line arguments into **Zod-Validated Objects (ZVO)** with a single **String DSL** or **pico API** Contract.

`cli-to-zvo` is a robust library for building type-safe Command Line Interfaces. In **Version 1.1 (Hybrid)**, it introduces an **Automated Routing Engine** that instantly maps user inputs to the right command, giving you the best of both worlds: a simple, string-based DSL for quick setups, or the full power of native Zod schemas for complex validation.

## Features

- **Hybrid Contract**: Mix simple string types (e.g., `"filepath"`) with custom Zod schemas using the `pico` API.
- **Fail-Fast Validation**: Your CLI contract is validated upon instantiation to catch configuration errors early.
- **Smart O(1) Routing**: Instantly matches your inputs to the correct subcommand, regardless of how many routes you have.
- **Interceptor Flags**: Support for global flags (like `--verbose` or `--help`) that work across all subcommands.
- **Pure Zod Output**: Every target is compiled into a pure Zod schema for deep validation.
- **Rich Help Data**: Generates structured metadata for easy help screen formatting.

---

## Installation

```bash
npm install @ytn/czvo
```

---

## Quick Start

```typescript
import { cliToZVO, pico } from "@ytn/czvo";

// 1. Define the Contract (using String DSL or pico API)
import { type tsContract } from "@ytn/czvo";

const contract: tsContract = {
  name: "ytn",
  description: "YouTube Downloader",
  cli: {
    positionals: ["url"],
    flags: {
      quality: { short: "q", type: "string", desc: "Video quality (144-2160)" },
      verbose: {
        short: "v",
        type: "boolean",
        desc: "Enable logging",
        intercept: true,
      },
    },
  },
  targets: {
    dl: {
      url: "url", // Simple String DSL
      quality: pico.number().optional(), // pico API (for complex logic)
      verbose: "boolean", // Simple String DSL
    },
  },
};

// 2. Parse and Validate
const result = cliToZVO(contract, process.argv.slice(2));

if (result.route === "dl") {
  console.log(`Downloading ${result.data.url}...`);
  if (result.data.verbose) console.log("Verbose mode ON");
}
```

## Defining a Contract

A contract consists of two main parts: `cli` (The CLI interface) and `targets` (The business logic objects).

### 1. CLI Interface (`cli`)

This section defines how `node:util.parseArgs` should interpret your command line.

- **`positionals`**: An ordered array of names for positional arguments.
- **`flags`**: A record of flag names to their configuration:
  - `short`: Single character short flag (e.g., `"v"` for `-v`).
  - `type`: `"string"` (consumes 1 argument) or `"boolean"` (consumes 0 arguments).
  - `desc`: Description for the help screen.
  - `intercept`: (Optional) If `true`, this flag stays available globally and doesn't trigger target mismatch errors.

```typescript
cli: {
  positionals: ["command"],
  flags: {
    output: { short: "o", type: "string", desc: "Output file" },
    force: { short: "f", type: "boolean", desc: "Force overwrite" },
  }
}
```

### 2. Physical Targets (`targets`)

This section maps CLI inputs to validated TypeScript objects. Each target key (e.g., `dl`, `info`) represents a "Route".

#### A. Routing & Discriminants

If a target uses a positional argument with a **Literal** value (e.g., `cmd: pico.literal("install")`), the router uses it as a discriminant to identify the route.

#### B. Types: DSL vs pico API

Each field in a target can use a simple **DSL string** or the **pico API**.

- **DSL Strings**: Smart strings like `"url"`, `"filepath"`, `"email"`, or unions `"string | number"`.
- **pico API**: A "sealed" version of Zod for CLI use.

```typescript
targets: {
  setup: {
    command: pico.literal("init"), // Discriminant for 'setup' route
    path: "filepath",              // DSL string
    options: pico.numList(),       // pico API
  }
}
```

## pico API Reference

`pico` provides specialized validators optimized for CLI coercion.

### Extensions & Overrides

| Group           | Method(s)                                                                                                | Description                                                      |
| :-------------- | :------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **Primitives**  | `date()`, `number()`, `int()`, `bigint()`, `bool()`                                                      | Coerces input strings to native JS objects (Date, Number, etc.). |
| **Native**      | `boolean()`, `string()`, `null`, `undefined`                                                             | Strict types. `boolean()` is ideal for pure switch flags.        |
| **ISO Formats** | `dateISO()`, `datetime()`, `time()`, `duration()`                                                        | Validates strict ISO 8601 strings (returns `string`).            |
| **Network**     | `url()`, `email()`, `ipv4()`, `ipv6()`, `hostname()`                                                     | Specialized network string validators.                           |
| **Identifiers** | `uuid()`, `cuid()`, `cuid2()`, `ulid()`, `nanoid()`                                                      | Common ID format validators.                                     |
| **Encodings**   | `json()`, `jsonl()`, `jsonSchema()`, `base64()`, `hex()`, `jwt()`                                        | Data structure and encoding validators.                          |
| **Collections** | `tuple(...items)`                                                                                        | Parses comma-separated strings into collections.                 |
| **DSL Atomics** | `list`, `stringList`, `numList`, `boolList`                                                              | Common list formats available as DSL strings (dynamic length).   |
| **Custom**      | `zod(schema)`, `decJSON(schema)`, `decJSONL(schema)`, `or(...)`, `xor(...)`, `literal(v)`, `enum([...])` | Bridges raw Zod schemas into the CLI coercion layer.             |
| **Misc**        | `filepath()`, `file()`, `emoji()`                                                                        | Utilities for local files and specialized strings.               |

### Zod Native Modifiers

Each type returned by the API `pico` is a Zod schema (sealed) that accepts standard validation modifiers. This allows for complex constraints (min, max, regex, optional) using the familiar Zod syntax:

```typescript
targets: {
  setup: {
    // Chaining standard Zod methods
    age: pico.number().min(18).max(99),
    email: pico.string().email().optional(),
    tags: pico.stringList().max(5),
  }
}
```

Most Zod validation methods are available, but structural modifiers like `.default()` or `.transform()` are blocked to maintain CLI contract predictability.

> **Note on Collections**: `pico` collections expect comma-separated strings (e.g., `--tags "a,b,c"`). In the **DSL**, a simple comma-separated string like `"string, number"` creates a fixed-size **Tuple** `[string, number]`.
>
> **Note on Dates**: `pico.date()` returns a **JS Date Object** (coerced), while `pico.dateISO()` returns a **Validated String** (ISO format).
>
> 💡 *For a deep dive into how `pico` handles `node:util.parseArgs` edge cases, see the [pico-zod technical reference](./src/pico-zod/README.md).*

---

## Routing Intelligence

`cli-to-zvo` compiles your contract into a high-performance **Bitmask Signature**. It looks at which arguments are provided and what their values are (for discriminants) to identify the target route in constant time.

### ✅ Routing Do's

- **Use Literals as Subcommands**: When using a shared positional (like `cmd`), use `pico.literal("install")` in your targets. This acts as a clear discriminant.
- **Global Flags**: Mark common flags (like `--verbose`, `--json`) as `intercept: true` in the `cli` block so they don't interfere with route matching.
- **Clean Naming**: Keep your `cli` field names (positionals & flags) unique to avoid shadowing.

### ❌ Routing Don'ts

- **Ambiguous Signatures**: Avoid having two targets that accept the exact same number of positionals and flag types without using a literal discriminant.
- **Type Conflicts**: Don't define a flag as a `boolean` in the `cli` block but expect to parse it as a `number` in your `targets`.

---

## Technical Mapping

`cli-to-zvo` ensures that your CLI parser and your Zod schemas are always in sync:

| CLI `type`  | Zod Expectation                              | Behavior                                     |
| :---------- | :------------------------------------------- | :------------------------------------------- |
| `"boolean"` | `pico.boolean()`                             | Switch flag. Consumes **0** extra arguments. |
| `"string"`  | `pico.string()`, `pico.number()`, `pico.url` | Valued option. Consumes **1** argument.      |
| `"string"`  | `pico.stringList()`, `pico.numList()`        | CSV-to-Array. Consumes **1** argument.       |

---

## Advanced Usage

### Manual Access

You can use `cliToZod` to get access to the underlying tools (schemas, bitmask router, etc.):

```typescript
const { zvoSchema, parsingArgs } = cliToZod(contract);

// zvoSchema is a pure Zod schema representing the entire routing logic
const result = zvoSchema.parse({ url: "...", quality: "1080" });
```

### Help Generation

```typescript
import { Contract } from "@ytn/czvo";

const cli = Contract.create(contract);
const helpData = cli.help();
// Returns structured data: { name, description, usage_cases, arguments }
```

---

## License

MIT
