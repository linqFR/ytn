# cli-to-zvo (@ytn/czvo)

> Transform your command line arguments into **Zod-Validated Objects (ZVO)** with a single String or DSL Contract.

`cli-to-zvo` is a robust library for building type-safe Command Line Interfaces. In **Version 1.1 (Hybrid)**, it bridges the gap between a simple text-based DSL and the full power of native Zod schemas.

## Features

- **Hybrid Contract**: Mix simple string types (e.g., `"filepath"`) with custom Zod schemas using the `CZVO` API.
- **Fail-Fast Validation**: Your CLI contract is validated upon instantiation to catch configuration errors early.
- **Smart Routing (XOR)**: Automatically routes inputs to the correct subcommand using a secure XOR system.
- **Pure Zod Output**: The `.enhanced` getter provides a pure Zod schema for manual use (e.g., `safeParse`).
- **Rich Help Data**: Generates structured metadata for easy help screen formatting.

---

## Installation

```bash
npm install @ytn/czvo
```

---

## Quick Start

```typescript
import { contractDef, cliToZVO } from "@ytn/czvo";

// 1. Define the Contract
const cli = contractDef({
  name: "ytn",
  description: "YouTube Downloader",
  def: {
    url: { type: "url", description: "Video URL", arg_name: "video_url" },
    quality: {
      type: "number",
      description: "Video quality (144-2160)",
      flags: { long: "quality", short: "q" },
    },
  },
  targets: {
    dl: {
      description: "Download a video",
      positionals: ["url"],
      flags: { quality: { optional: true } },
    },
  },
});

// 2. Parse and Validate
const result = cliToZVO(cli, process.argv.slice(2));

if (result.isRoute("dl")) {
  console.log(
    `Downloading ${result.url} at ${result.quality || "highest"} quality...`,
  );
}
```

## Defining a Contract

A contract is defined using `contractDef()`. It consists of two main parts: `def` (Global definitions) and `targets` (Subcommands).

### 1. Global Definitions (`def`)

Each entry in `def` can use two types of definitions:

#### A. String DSL (Simple)

Ideal for standard types and simple unions. Your IDE will provide smart autocompletion for all **Atomic Types** (e.g., `"filepath"`, `"email"`, `"dateISO"`).

```typescript
def: {
  age: { type: "number", description: "User age" },
  output: { type: "filepath | url", description: "Target destination" },
  created_at: { type: "dateISO", description: "Creation date (ISO 8601)" }
}
```

#### B. CZVO API (Advanced)

Use `CZVO` to leverage full Zod validation and custom logic.

```typescript
import { CZVO } from "@ytn/czvo";

def: {
  username: {
    type: CZVO.string().min(3).max(20).trim(),
    description: "System username"
  },
  tags: {
    type: CZVO.list(CZVO.string().regex(/^[a-z]+$/)),
    description: "Comma-separated lowercase tags"
  }
}
```

## CZVO API Reference

`CZVO` is a "sealed" version of Zod, optimized for CLI use. It includes all standard Zod types plus powerful CLI-specific extensions.

### Extensions & Overrides

| Group           | Method(s)                                            | Description                                                      |
| :-------------- | :--------------------------------------------------- | :--------------------------------------------------------------- |
| **Primitives**  | `date()`, `number()`, `boolean()`, `bigint()`        | Coerces input strings to native JS objects (Date, Number, etc.). |
| **ISO Formats** | `dateISO()`, `datetime()`, `time()`, `duration()`    | Validates strict ISO 8601 strings (returns `string`).            |
| **Network**     | `url()`, `email()`, `ipv4()`, `ipv6()`, `hostname()` | Specialized network string validators.                           |
| **Identifiers** | `uuid()`, `cuid()`, `cuid2()`, `ulid()`, `nanoid()`  | Common ID format validators.                                     |
| **Encodings**   | `json()`, `jsonl()`, `base64()`, `hex()`, `jwt()`    | Data structure and encoding validators.                          |
| **Collections** | `list(item)`, `set(item)`, `tuple(...items)`         | Parses comma-separated strings into collections.                 |
| **Custom**      | `zod(schema)`, `decJSON(schema)`, `xor(...)`         | Bridges raw Zod schemas into the CLI coercion layer.             |
| **Misc**        | `filepath()`, `file()`, `emoji()`                    | Utilities for local files and specialized strings.               |

> **Note on Dates**: `CZVO.date()` returns a **JS Date Object** (coerced), while `CZVO.dateISO()` returns a **Validated String**.

## Contract Structure

### `def` Object

| Property      | Type                    | Description                                     |
| :------------ | :---------------------- | :---------------------------------------------- |
| `type`        | `string` or `CZVO-Type` | The validation rule (DSL or CZVO).              |
| `description` | `string`                | Explanation for the help screen.                |
| `arg_name`    | `string?`               | Placeholder for help (e.g. `<video_url>`).      |
| `flags`       | `{ long, short }?`      | Long (`--quality`) and short (`-q`) flag names. |
| `map`         | `{}` or `undefined`     | Optional value mapping (e.g. `{"high": 1080}`). |

### `targets` Object

Defines subcommands (use `"default"` for a CLI without subcommands).

| Property      | Type                | Description                       |
| :------------ | :------------------ | :-------------------------------- |
| `positionals` | `string[]`          | Ordered list of keys from `def`.  |
| `flags`       | `{}` or `undefined` | Keys from `def` allowed as flags. |

**Flag configuration:**

- `true` / `false`: Required/Forbidden flag.
- `{ optional: true }`: Makes the flag optional.
- `string[]`: Constraints the flag to specific values (enum).

---

## Advanced Usage

### Manual Zod Access

If you need the "translated" contract (where all types are pure Zod schemas) for custom integration, use the `.enhanced` property:

```typescript
const cli = contractDef(myContract);
const translatedContract = cli.enhanced;

// Each definition type is now a pure ZodType
const ageSchema = translatedContract.def.age.type;
const res = ageSchema.safeParse("25");
```

### Help Generation

```typescript
const helpData = cli.help();
// Returns structured data: { name, description, usage_cases, arguments }
```

---

## License

MIT
