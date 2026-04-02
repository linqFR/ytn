# AGENTS.md (Global)

> [!IMPORTANT] > **ABSOLUTE RULES**:

- A QUESTION IS A QUESTION IS A QUESTION and REQUIRES AN ANSWER, NOT AN ACTION.
- NEVER ERASE ENTIRE BLOCKS OF TEXT TO REWRITE THEM ELSEWHERE WITHOUT EXPLICIT PRIOR APPROVAL.
- NEVER CHANGE THE DOCUMENT STRUCTURE OR MOVE/SUMMARIZE EXISTING PARAGRAPHS OR CODE WITHOUT EXPLICIT PRIOR APPROVAL.
- **NEVER PERFORM ANY OPTIMIZATIONS WITHOUT PRIOR VALIDATION AND APPROVAL.**

AGENTS MUST ONLY INSERT OR APPEND NEW INSTRUCTIONS.

---

## Primary Truth (Source of Truth)

- **Verification is Mandatory**: AI internal knowledge is considered **obsolete** by default. No API pattern or library behavior can be assumed from training data.
- **Hierarchy of Truth**:

  1. **Official Documentation**: Always check the live website (e.g., **`https://zod.dev`**) for the most current API.
  2. **Local `node_modules`**: The TypeScript definitions (`.d.ts`) within this project are the ultimate technical proof of the available API.

  - **Zod v4 Protocol**:
    - The internal structure of Zod V4 (specifically using **`._zod`**) is only authoritative because it is proven by the `node_modules` types.
    - **`._def`** (Zod V3) is strictly forbidden; **`._zod`** (Zod V4) is the truth for internal reflection.

- **Deprecation Policy**: Always check if a function, variable, or method is **deprecated**. If so, proactively update it to the modern alternative defined by the Primary Truth.

---

This is a monorepo for the **YTN project**, maintained by **linqFR**. It contains independent, lightweight, and type-safe TypeScript packages.

### Main Packages

- **`@ytn/qb`** (`packages/query-builder`): A fluent SQLite query builder with Zod integration.
- **`@ytn/czvo`** (`packages/cli-to-zvo`): A CLI contract definition and routing engine.
- **`@ytn/wf-router`** (`packages/wf-router`): A high-performance workflow router.

### Monorepo Structure

- `packages/*`: Individual public packages.
- `shared/*`: Internal shared utilities or types.
- `sandbox/*`: Global temporary or experimental code.
- `docs/*`: Global project documentation.

**Note**: Each package may also contain its own `sandbox/` and `docs/` directories for package-specific experiments and technical deep-dives.

**Precedence**: The `AGENTS.md` file closest to the active workspace takes precedence. Always prioritize local package instructions over global ones in case of conflict.

---

## Environment & Tech Stack

- **Runtime**: Node.js (>=24.0.0)
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`"type": "module"`)
- **Package Manager**: `npm` with workspaces
- **TypeScript Configuration** in order to comply with `Zod V4`:
  - **Strict Mode**: Mandatory (**`strict: true`** in `tsconfig.json`).
  - **Resolution**: **`NodeNext`** for both module and moduleResolution.

### Windows Specifics

- **Shell**: Use **PowerShell** for all commands. Avoid using `sh` or `bash` scripts unless they are ran through a compatibility layer.
- **Command Suffixes**: ALWAYS use **`npm.cmd`** and **`npx.cmd`** explicitly on Windows to ensure correct path resolution.
- **Paths**: Use standard forward slashes `/` in code and configuration (Node.js handles this). Use backslashes `\` ONLY when interacting directly with Windows-native CLI tools if required.
- **Line Endings**: The project uses **LF**. Ensure your editor is configured to use LF.
- **Execution Policy**: If you encounter script permission errors, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

## Global Commands

- **Install dependencies**: `npm.cmd install`
- **Build all packages**: `npm.cmd run build` (uses workspaces)
- **Run all tests**: `npm.cmd test` (uses workspaces)
- **Work on a specific package**: Use `-w` or `--workspace` flag.
  - Example: `npm.cmd test -w @ytn/qb`
  - Example: `npm.cmd run build -w @ytn/czvo`

---

## Instructions for Agents (CRITICAL)

### 1. Surgical Edits & Formatting

- **NEVER MODIFY FORMATTING OR LAYOUT.**
- **NO UNSOLICITED MODIFICATIONS TO COMMENTS.**
- Be surgical: modify only the logical code or necessary typing, point by point, respecting surrounding text and whitespace.

### 2. Documentation, JSDocs & READMEs

- **README.md vs AGENTS.md**:
  - README.md files are for humans (quick starts, high-level overview). They should be descriptive and rich with examples while remaining focused on usage. **Conciseness is good, but never at the expense of necessary documentation. Always include a Table of Contents for readability.**
  - AGENTS.md files contain the technical context and strict instructions that agents need.
- **JSDoc is Code**: Every public method, class, and exported type MUST be documented with comprehensive JSDocs.
- **Preserve JSDocs**: Ensure build tools (like `tsup`) are configured to preserve JSDocs in the output.

### 3. Sandbox Usage

- To test a function, a variable result, or a constant, the Agent **MUST** use the `./sandbox/` directory (either global or package-specific).

### 4. Common Pitfalls

#### Overall

- **Command resolution**: On Windows, forgetting the `.cmd` suffix on `npm`/`npx` often leads to execution failures.
- **Unapproved Optimizations**: Erasing, moving, or summarizing existing project instructions without prior validation violates the primary mandate.

#### Attention points specific to used Packages / Mode Modules

- **Zod Internals**: Attempting or refering to access `_def` or `ZodEffect` remains a frequent source of breakage.

---

## Code Editing

### Code Style & Conventions

#### File Naming Standards & imports

- **Pure ESM**: Always use `.ts` or `.js` with ESM syntax. No CommonJS.
- **Imports**: Use explicit file extensions in imports if required by the environment, though `tsup` handles them during build.

#### TypeScript Conventions & Namings

- **Type Safety**: Prefer strict TS typing.

- **Imports**: Use explicit file extensions in imports if required by the environment.
- **Naming Standards - ONLY for Typescript**:
  - `I*`: Interfaces/Types for Input/Config data (e.g., `IContract`).
  - `O*`: Interfaces/Types for Output/Result data (e.g., `OResult`).
  - `$*`: Type-modifiers/active generic functions (e.g., `$Without<T, U>`).
  - `ts*`: Simple static type aliases (e.g., `tsContractAny`).

#### Zod Schema Namings

Reminder: Use Zod V4 exclusively.

- `*Schema` or `sch*`: Suffix for Zod validation objects (e.g., `UserSchema` or `schUser`).

### Quality & Integrity

- **No "Cheating" with Linters**: Do not use `markdownlint-disable` or `@ts-ignore` to hide architectural debt.
- **Syntax Preservation**: During refactorings, the resulting SQL output MUST be strictly identical to the validated string-based versions (matching keywords, case, and spacing).
- **Agnostic SQL**: The builder targets Generic SQL. Avoid dialect-specific syntax unless handled via configurable adaptors.
- **Forbidden Files**: Never commit or modify files listed in `.gitignore`. Specifically, any `.env`, secret, or sensitive credential MUST remain local.

---

## Testing Guidelines

- **Framework**: `vitest`
- **Rule**: All new features or bug fixes MUST include corresponding tests. The entire suite must pass before finalizing.

## Commits & Versions

- **Versioning**: We use **Changesets**. If you make changes that require a version bump, run `npx.cmd changeset` to create a markdown file in the `.changeset` directory.
- **PR Title Format**: `[<project_name>] <Title>` (e.g., `[@ytn/qb] Fix recursive unwrapping of ZodOptional`).

---

## Specifics about mode packages and modules used

### Zod v4

- Zod Website : [zod V4](https://zod.dev)

#### "Public API First" (NO ZOD INTERNALS)

- **NO `_def`**: Never access V3 internal buffers.
- **`._zod` is Truth**: Use the `._zod` V4 buffer for internal reflection and inspection as established in the workspace.
- **Use `.unwrap()`**: For `ZodOptional`, `ZodNullable`, `ZodDefault`, etc., use the official `.unwrap()` method.
- **Handle Pipelines**: Use `.in` and `.out` for transforms/validations.
- **Metadata**: Use the public `.meta()` getter.

#### Internal Reflection Priority

- **Priority 1: `instanceof`**: Use standard `instanceof z.Zod*` for base type identification (Object, Optional, etc.).
- **Priority 2: `._zod`**: Use the `._zod` buffer as the authoritative internal fallback for V4-specific attributes (type, out, etc.) if `instanceof` is insufficient.
- **NEVER** use 'belt and suspenders' logic (don't mix both in a single conditional if one is sufficient).

#### Common V4 Patterns (Informative)

- **Top-level Validation**: Use `z.email()`, `z.uuid()`, `z.url()` instead of method chaining.
- **Top-level Objects**: Favor **`z.strictObject()`** or **`z.looseObject()`** over `.strict()` or `.loose()` method calls.
- **No `.passthrough()`**: The method `.passthrough()` is deprecated in V4; always use **`.loose()`** or **`z.looseObject()`**.
- **Interface**: Use `z.interface()` for object schemas for better TypeScript optional property handling.
- **JSON Schema**: Use the native `.toJSONSchema()` method.

### Shared Toolbox (The "linqFR" way)

All access to global utilities MUST use the namespaces defined in `@ytn/shared`:

- `safe.*`: Deterministic error management (`[err, res]`).
- `lockobj.*`: Data integrity protection (Lockable Proxies).
- `fsops.*`: Secure and deterministic I/O primitives.
- `ts.*`: Global types and modifiers (`Branded`, `ValidJSON`, `Awaitable`).

#### Robustness Standards (SafeMode)

- **Failure return**: Favor returning a `SafeResult` (tuple `[err, res]`) for fallible functions or critical business orchestration instead of throwing exceptions.
- **Failfast**: Use `Bouncers` (`failfastBouncer`) for linear orchestration to avoid nested `if (err)` cascades.
- **Immutability**: Every "Tool" or "Context" object injected into an engine MUST be protected by `lockobj.protectObject` to ensure no mutations occur within user-defined layers.

---
