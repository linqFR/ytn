# AGENTS.md (Package: @ytn/czvo)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**.

## Naming Standards Enforcement

This package follows the global naming standards. Refer to the examples below for specific implementations within this codebase.

### 1. Runtime Validation (Zod)

- **Examples**: `ContractSchema`, `FlagSchema`.

### 2. Input Data Structures (`I*`)

- **Examples**: `IContract`, `IContractDef`, `IContractTarget`.

### 3. Output Data Structures (`O*`)

- **Examples**: `OHelpData`, `OHelpArg`, `OHelpCase`.

### 4. Type Modifiers Functions (`$*`)

- **Examples**: `$RequireAtLeastOne<T>`, `$Without<T, U>`, `$XOR<T, U>`, `$EnhancedContract<T>`.

### 5. Simple TypeScript Type Aliases (`ts*`)

- **Example**: `export type tsContractAny = IContract<string>;`.
