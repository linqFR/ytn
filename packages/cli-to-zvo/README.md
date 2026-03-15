# cli-to-zvo (@ytn/cli-to-zvo)

> Transform your command line arguments into typed and validated Zod-Validated Objects (ZVO).

`cli-to-zvo` is a lightweight library designed to simplify the creation of robust command-line interfaces (CLI). It allows you to define a single **CLI Contract** that serves as the source of truth for argument parsing, data validation, and automated help generation.

## ✨ Features

- **Schema-First**: Define your CLI structure once, use it everywhere.
- **Zod Validation**: Leverage the full power of Zod to validate your inputs.
- **Smart Routing**: Automatically identify which command or sub-command was called (using a XOR system).
- **Invisible Metadata**: Your validated objects carry routing information (`route`, `isRoute`) that doesn't pollute your business data.
- **Automatic Help**: Generates a data structure ready to display clear user help.

## 🚀 Installation

```bash
npm install @ytn/cli-to-zvo
# or via pnpm / yarn
```

> [!NOTE]
> This library requires `zod` as a peer-dependency.

## 🛠️ How-to Guide

The workflow with `cli-to-zvo` breaks down into 4 simple steps.

### 1. Define the CLI Contract

The contract describes your argument types (`def`) and your target commands (`targets`).

```typescript
import { CliContractSchema } from "@ytn/cli-to-zvo";

const contract: CliContractSchema = {
  name: "my-tool",
  description: "A great command-line tool",
  def: {
    input_file: {
      type: "filepath",
      description: "Path to the source file",
      arg_name: "path",
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose mode",
      flags: { long: "verbose", short: "v" },
    },
  },
  targets: {
    Analyze: {
      description: "Analyzes the specified file",
      positionals: ["input_file"],
      flags: {
        verbose: { optional: true },
      },
    },
  },
};
```

### 2. Generate Parser and Schemas

Use `cliToZod` to transform your contract into actionable tools.

```typescript
import { cliToZod } from "@ytn/cli-to-zvo";

const { parsingArgs, xorSchema, router, help } = cliToZod(contract);

// parsingArgs: contains config for Node.js util.parseArgs
// xorSchema: the global Zod schema to validate and route the result
// router: the xorGate instance for robust routing checks
// help: structure ready for generating help output (--help)
```

### 3. Parse Raw Arguments

Use the native `node:util` module to extract arguments, then map them using `createParseArgsObject`.

```typescript
import { parseArgs } from "node:util";
import { createParseArgsObject } from "@ytn/cli-to-zvo";

const rawArgs = parseArgs({
  args: process.argv.slice(2),
  options: parsingArgs.options,
  allowPositionals: true,
});

const mappedArgs = createParseArgsObject(parsingArgs).parse(rawArgs);
```

### 4. Validate and Route

Pass the mapped object to the `xorSchema` to get a validated and "marked" object.

```typescript
const result = xorSchema.parse(mappedArgs);

if (result.isRoute("analyze")) {
  console.log(`Analyzing file: ${result.input_file}`);
  if (result.verbose) console.log("Verbose mode enabled!");
}

// result.route also contains the name of the matched target ('analyze')
```

## 📖 API Reference

### `cliToZod(contract)`

The main entry point. Returns an object containing:

- `parsingArgs`: Configuration for `util.parseArgs`.
- `xorSchema`: A Zod Union (XOR) schema for all defined targets.
- `targetSchemas`: A dictionary of individual Zod schemas per target.
- `router`: The `xorGate` instance used for robust routing validation.

### Defining the Contract (`CliContractSchema`)

#### 1. Global Definitions (`def`)

The `def` object defines all possible arguments (flags and positionals) used across your commands.

```typescript
def: {
  [key: string]: {
    type: string;           // See "Supported Types" below
    description: string;    // Used for help generation
    arg_name?: string;      // Placeholder name for help output (e.g., <path>)
    flags?: {
      long: string;         // e.g., "verbose"
      short: string;        // e.g., "v"
    };
    map?: Record<string, string>; // Optional value mapping (e.g., { "y": "true" })
  }
}
```

#### 2. Target Commands (`targets`)

The `targets` object defines your CLI's available commands/subcommands.

```typescript
targets: {
  [targetName: string]: {
    caseName: string;       // Human-readable name for this case
    description: string;    // Brief info for help output
    positionals?: string[]; // List of keys from `def` to use as positional args
    flags?: Record<string,  // List of keys from `def` to use as flags
      string[] |            // Enum: restrict flag to specific values
      { optional: true } |  // Optionality
      string | number | boolean | null // Default value
    >;
  }
}
```

### Supported Types (for `def.type`)

- `string`: Standard text.
- `number`: Coerced number.
- `boolean`: Coerced boolean.
- `filepath` / `url`: Path or URL validated strings.
- `list`: Comma-separated values (parsed into an array).
- `json` / `jsonl`: Single or newline-separated JSON objects.
- `type1 | type2`: Simple union (e.g., `number | boolean`).
- `tuple([...types])`: Fixed-size array with specific types.

### Routing Management

Every object returned by `xorSchema.parse()` features:

- `.route`: The name of the matched target (non-enumerable, doesn't show up in `JSON.stringify`).
- `.isRoute(name)`: A convenient property to check the active route.

```typescript
const { xorSchema, router } = cliToZod(contract);
const result = xorSchema.parse(data);

// 1. Local check (convenient, but lost if you spread the object)
if (result.isRoute("analyze")) { ... }

// 2. Global check (robust, works even after {...result})
const spread = { ...result };
if (router.isRoute(spread, "analyze")) { ... }
```

## 🏗️ Architecture Rationale: Zod-Validated Objects

The strength of `cli-to-zvo` lies in its **XOR Gate**. Unlike a standard Zod union, our XOR gate injects a unique `Symbol` and non-enumerable properties into the result.

This ensures that routing information:

1. **Survives spreads**: `{...data}` retains the Symbol marking.
2. **Doesn't pollute your data**: No visible `_type` or `kind` keys by default.
