# cli-to-zvo (@ytn/czvo)

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-v4%20Compatible-darkred.svg)](https://zod.dev/)
[![Tests](https://img.shields.io/badge/Tests-87%2F87%20Passed-brightgreen.svg)](#)

> Transform your command line arguments into **Zod-Validated Objects (ZVO)** with a single **String DSL** or **pico API** Contract.

`cli-to-zvo` is a robust library for building type-safe Command Line Interfaces. In **Version 1.1 (Hybrid)**, it introduces an **Automated Routing Engine** that instantly maps user inputs to the right command, giving you the best of both worlds: a simple, string-based DSL for quick setups, or the full power of native Zod schemas for complex validation.

## Features

- **Hybrid Contract**: Mix simple string types (e.g., `"filepath"`) with custom Zod schemas using the `pico` API.
- **Fail-Fast Validation**: Your CLI contract is validated upon instantiation to catch configuration errors early.
- **Smart O(1) Routing**: Instantly matches your inputs to the correct subcommand, regardless of how many routes you have.
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
import { createContract, pico } from "@ytn/czvo/editor.js";
import { execute } from "@ytn/czvo";

// 1. Define the Contract (using String DSL or pico API)
// Use createContract to compile your configuration into a reactive engine.
const contract = createContract({
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
  // 2. Global Catch-all (optional)
  fallbacks: {
    help: { verbose: "boolean" },
  },
  // 3. Global Engine Options (optional)
  options: {
    onlyAllowedValues: false, // If true, restricts inputs for literal/enum fields at the entry level (fail-fast) (default: true)
    allowNegative: false, // If true, Allows explicitly setting boolean options to false by prefixing the option name with --no- (default: false)
  },
});

// 4. Parse and Validate
// execute() returns an OSafeResult (Zod-compatible success/error object)
const result = execute(contract, process.argv.slice(2));

if (result.success) {
  const { route, data } = result.data;
  if (route === "dl") {
    console.log(`Downloading ${data.url}...`);
    if (data.verbose) console.log("Verbose mode ON");
  }
} else {
  console.error("Validation failed:", result.error.issues);
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

```typescript
cli: {
  positionals: ["command"],
  flags: {
    output: { short: "o", type: "string", desc: "Output file" },
    force: { short: "f", type: "boolean", desc: "Force overwrite" },
  }
}
```

- **`fallbacks`**: (Optional) Record of targets used as catch-all routes when no primary target matches.
- **`options`**: (Optional) Global configuration for the engine:
  - `onlyAllowedValues`: If `true`, the engine performs an early validation on fields that use `pico.literal()` or `pico.enum()`. If the user input doesn't match a known value for that specific CLI argument, it fails immediately at the parser level. (Default: `false`).
  - `allowNegative`: If `true`, the CLI parser enables support for Node's native negatable flags (e.g., `--no-verbose`). Boolean flags can then be explicitly set to `false` by the user. (Default: `false`).

### 2. Physical Targets (`targets`)

This section maps CLI inputs to validated TypeScript objects. Each target key (e.g., `dl`, `info`) represents a "Route".

#### A. Routing & Discriminants

If a target uses a positional argument with a **Literal** value (e.g., `cmd: pico.literal("install")`), the router uses it as a discriminant to identify the route.

#### B. Types: DSL vs pico API

Each field in a target can use a simple **DSL string** or the **pico API**.

- **DSL Strings**: Smart strings like `"url"`, `"filepath"`, `"email"`, or unions `"string | number"`.
- **pico API**: A "sealed" and **immutable** version of Zod for CLI use.

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
> 💡 _For a deep dive into how `pico` handles `node:util.parseArgs` edge cases, see the [pico-zod technical reference](./src/pico-zod/README.md)._

---

## Routing Intelligence

Unlike traditional CLI routers that iterate through definitions sequentially (**O(n)**), `cli-to-zvo` uses a **high-performance Bitmask Signature engine**.

### How it Works

1. **Bitmask Compilation**: During contract creation, each CLI argument (positional or flag) is assigned a unique bit (`1 << n`).
2. **State Calculation**: At runtime, the engine calculates a single numeric bitmask representing exactly which arguments were provided by the user.
3. **O(1) Resolution**: This bitmask serves as a primary key. If multiple targets share the same bitmask, the engine performs a "Literal Jump"—matching specific values (like subcommands) to find the correct route.
4. **Zod V4 Jumping**: Once identified, the engine jumps directly to the corresponding Zod schema for full validation.

### Key Benefits

- **Lightning Fast**: Route identification happens in constant time (**O(1)**), regardless of whether you have 5 or 500 routes.
- **Order Independent**: Since bits don't care about order, your interface remains robust even if users swap flags and positionals.
- **Deterministic**: No complex regex or ambiguous matching. The bitmask logic ensures that each input set maps to a single, predictable target.

> [!IMPORTANT] > **Scalability Note**: The current bitmask engine is limited to **31 unique CLI arguments** (total flags + positionals across all targets). To ensure bitwise safety, the compiler will **aggressively reject** any contract exceeding this limit before runtime.

### ✅ Routing Do's

- **Use Literals as Subcommands**: When using a shared positional (like `cmd`), use `pico.literal("install")` in your targets. This acts as a clear discriminant.
- **Clean Naming**: Keep your `cli` field names (positionals & flags) unique to avoid shadowing.

### ❌ Routing Don'ts

- **Ambiguous Signatures**: Avoid having two targets that accept the exact same number of positionals and flag types without using a literal discriminant.
  - _What happens?_: The engine doesn't fail, but it falls back to a sequential `z.union` for that specific branch. The first target whose schema validates successfully will be returned, losing the O(1) performance benefit for those targets.
- **Type Conflicts**: Don't define a flag as a `boolean` in the `cli` block but expect to parse it as a `string` in your `targets`.
  - _What happens?_: The Zod schema of the target will fail to validate the parsed value (e.g., trying to parse a `boolean` as a `string`), resulting in a clear Zod validation error for the user at runtime.
- **Excessive Complexity**: Don't define more than **31 unique arguments** (total of all positionals and flags) in your `cli` block.
  - _What happens?_: The contract will fail to instantiate, throwing a configuration error mentioning the 31-argument limit.

---

## Global Flags & Patterns

Since `cli-to-zvo` uses a deterministic routing engine, "Global Flags" can be implemented using two distinct patterns:

### 1. Global Catch-alls (using `fallbacks`)

For flags that trigger a global action (like `--help` or `--version`), define a dedicated target in the `fallbacks` block.

- **Logic**: Fallbacks are evaluated if no primary target matches. If `-h` or `--help` is present, it will create a unique bitmask signature that can be caught by the fallback.

```typescript
const contract = {
  cli: { flags: { help: { short: "h", type: "boolean" } } },
  targets: {
    /* your specific routes */
  },
  fallbacks: {
    help: { help: "boolean" },
  },
};
```

### 2. Common Shared Flags (using Composition)

For flags that modify the behavior of multiple commands (like `--verbose`), use standard JavaScript object composition.

- **Logic**: Including the flag in all (or some) targets ensures they stay in sync with the CLI parser while maintaining O(1) routing performance for that specific combination.

```typescript
const common = { verbose: "boolean?" };

const contract = {
  targets: {
    dl: { ...common, url: "string" },
    info: { ...common, id: "number" },
  },
};
```

---

## Technical Mapping

`cli-to-zvo` ensures that your CLI parser and your Zod schemas are always in sync:

| CLI `type`  | Zod Expectation                                | Behavior                                          |
| :---------- | :--------------------------------------------- | :------------------------------------------------ |
| `"boolean"` | `pico.boolean()`                               | Switch flag. Consumes **0** extra arguments.      |
| `"string"`  | `pico.bool()`                                  | Boolean option. Consumes **1** argument (`true`). |
| `"string"`  | `pico.string()`, `pico.number()`, `pico.url()` | Valued option. Consumes **1** argument.           |
| `"string"`  | `pico.stringList()`, `pico.numList()`          | CSV splitting. Consumes **1** argument.           |

---

## Advanced Usage

### Manual Access

You can use `createContract` to get access to the underlying tools (schemas, bitmask router, etc.):

```typescript
import { createContract } from "@ytn/czvo/editor.js";
import { execute } from "@ytn/czvo";

const contract = createContract(config);
const { zvoSchema, parsingArgs } = contract;

// zvoSchema is a pure Zod schema representing the entire routing logic
const result = zvoSchema.safeParse({ url: "...", quality: "1080" });
```

### High-Level Launcher

For most applications, use `launchCzvo` to handle routing and error reporting automatically:

```typescript
import { createContract } from "@ytn/czvo/editor.js";
import { launchCzvo } from "@ytn/czvo/launcher.js";

const contract = createContract(config);

const handlers = {
  dl: async (data) => {
    console.log("Processing download...", data);
  },
  error: (err) => {
    console.error("Custom error handler:", err);
  }
};

// Automatically parses process.argv and calls the right handler
await launchCzvo(contract, handlers);
```

### Help Generation

```typescript
import { createContract } from "@ytn/czvo/editor.js";
import { buildHelp } from "@ytn/czvo/core.js";

const contract = createContract(config);
const helpData = buildHelp(contract);
// Returns structured metadata for help display.
```

---

## License

MIT
