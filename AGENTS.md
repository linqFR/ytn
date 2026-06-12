# AGENTS.md (Global)

> [!IMPORTANT] > **ABSOLUTE RULES**:

- A QUESTION IS A QUESTION IS A QUESTION and REQUIRES AN ANSWER, NOT AN ACTION.
- **NO PROACTIVE ACTION ON QUESTIONS**: When a USER request is a question, you MUST provide a purely conceptual or informative response. You may create a **new** demonstration file to illustrate your proposal, but you must NEVER modify existing project code without prior validation and explicit approval.
- NEVER ERASE ENTIRE BLOCKS OF TEXT TO REWRITE THEM ELSEWHERE WITHOUT EXPLICIT PRIOR APPROVAL. Provide only minimal code changes. Do not rewrite unchanged blocks.
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
    - **`._def`** (Zod V3) is strictly forbidden; **`._zod`** (Zod V4) is the truth for internal reflection (See **Internal Reflection Priority** in the Zod section).

  - **Deprecation Policy**: Always check if a function, variable, or method is **deprecated**. If so, proactively update it to the modern alternative defined by the Primary Truth.

---

This is a monorepo for the **YTN project**, maintained by **linqFR**. It contains independent, lightweight, and type-safe TypeScript packages.

### Main Packages

- **`@ytn/qb`** (`packages/query-builder`): A fluent SQLite query builder with Zod integration.
- **`@ytn/czvo`** (`packages/cli-to-zvo`): A CLI contract definition and routing engine.
- **`@ytn/wf`** (`packages/wf-runner`): A high-performance workflow router.

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
- **Language**: TypeScript 6.0 (ES2025)
- **Module System**: Pure ESM (`"type": "module"`)
- **Package Manager**: `npm` with workspaces
- **TypeScript Configuration** in order to comply with `Zod V4`:
  - **Strict Mode**: Mandatory (**`strict: true`** in `tsconfig.json`).
  - **Resolution**: **`NodeNext`** for both module and moduleResolution.
  - **Interoperability**: **`verbatimModuleSyntax: true`** is mandatory to ensure clear ESM/CJS boundaries and compatibility.
  - **Metadata**: Use **`declarationMap: true`** and **`sourceMap: true`** for public packages to ensure a premium developer experience (Go To Definition).

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

### 0. Package-Specific Instructions (MANDATORY)

- **ALWAYS Read Package AGENTS.md First**: Before working on any package, you MUST read the package-specific `AGENTS.md` file located in that package's directory (e.g., `packages/query-builder/AGENTS.md`).
- **Precedence Rule**: Package-specific AGENTS.md instructions take precedence over global instructions when there is a conflict.
- **Global Foundation**: The global AGENTS.md (this file) provides the foundation. Package-specific files build upon it with package-specific context.

### 1. Surgical Edits & Formatting

- **NEVER MODIFY FORMATTING OR LAYOUT.**
- **NO UNSOLICITED MODIFICATIONS TO COMMENTS.**
- Be surgical: modify only the logical code or necessary typing, point by point, respecting surrounding text and whitespace.
- **NO JSON.stringify FORMATTING**: NEVER use `JSON.stringify(obj, null, 2)` for console output. It is unreadable. Use `console.dir(obj, { depth: null })` or `console.log(JSON.stringify(obj))` directly for better readability.

### 2. Documentation, JSDocs & READMEs

- **README.md vs AGENTS.md**:
  - README.md files are for humans (quick starts, high-level overview). They should be descriptive and rich with examples while remaining focused on usage. **Conciseness is good, but never at the expense of necessary documentation. Always include a Table of Contents for readability.**
  - AGENTS.md files contain the technical context and strict instructions that agents need.
- **English Language Requirement**: All READMEs, HOWTOs, AGENTS.md files, as well as JSDocs and inline code comments MUST ALWAYS be written in **English**.
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
  - `I*`: Interfaces/Types for Input/Config data (e.g., `IContract`). Defines the entry shape.
  - `O*`: Interfaces/Types for Output/Result data (e.g., `OResult`). Defines the resulting shape.
  - `$*`: Type-modifiers / active functional types (e.g., `$KebabToCamel<S>`). Internal type algebra and logic.
  - `ts*`: Simple **static** type aliases (e.g., `tsContractIN`). Represents a fixed structure without complex logic.
  - `u*`: High-level exported **Utility** function to type correctly a complex object (e.g., `uDefineWf`). Final tools for the developer.

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

- **Framework**: **Vitest 4** (Pure ESM)
- **Rule**: All new features or bug fixes MUST include corresponding tests. The entire suite must pass before finalizing.
- **Type Testing**: For complex DSLs and type-modifiers, ALWAYS include type-regression tests using **`expectTypeOf`** or **`assertType`**.
- **Typecheck Command**: To validate type assertions during tests, use **`npm.cmd test -- --typecheck`**.

---

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

#### Internal Reflection Priority (EXCLUSIVE)

- **Rule of Singularity**: **NEVER** use 'belt and suspenders' logic. Do not mix both `instanceof` and property-based identification (`_zod`, `~standard`) in a single conditional.
- **Priority 1: `instanceof` (Identification)**:
  - ALWAYS use standard `instanceof z.Zod*` for base type identification. If it matches, it is the Only Truth.
- **Priority 2: `._zod` (Data Access & Fallback)**:
  - Use the `._zod` buffer ONLY if `instanceof` is insufficient to access specific V4 internal data (e.g., Lazy getters).
  - Use property checks (`_zod` in v) ONLY if `instanceof` is definitively proven insufficient for identification (e.g., library version mismatches).

**Forbidden Example**: `if (v instanceof z.ZodType || "_zod" in v)` -> **STRICTLY FORBIDDEN**.

#### Common V4 Patterns (Informative)

- **Top-level Validation**: Use `z.email()`, `z.uuid()`, `z.url()` instead of method chaining.
- **Top-level Objects**: Favor **`z.strictObject()`** or **`z.looseObject()`** over `.strict()` or `.loose()` method calls.
- **No `.passthrough()`**: The method `.passthrough()` is deprecated in V4; always use **`.loose()`** or **`z.looseObject()`**.
- **Error Customization**: Use the `{ error: ... }` parameter instead of the deprecated `{ message: ... }`. `invalid_type_error` and `required_error` are removed.
- **Interface**: Can use `z.infer<schema>` for object schemas for better TypeScript optional property handling.
- **JSON Schema**: Use the native `.toJSONSchema()` method.

### Shared Toolbox (The "linqFR" way)

All access to global utilities MUST use the namespaces defined in `@ytn/shared`:

- **Private Status**: `@ytn/shared` is a **strictly private** toolbox. It will NEVER be published to npm.
- **Mandatory Inlining**: Because it handles internal logic and is not published, it MUST always be inlined into the `dist/` of public packages using `noExternal: ["@ytn/shared"]` in `tsup`. This ensures public packages remain standalone.
- **Dependency Type**: To ensure it NEVER appears as a runtime requirement for end-users, `@ytn/shared` MUST be declared in **`devDependencies`**, never in `dependencies`.
- `safe.*`: Deterministic error management (`[err, res]`).
- `lockobj.*`: Data integrity protection (Lockable Proxies).
- `fsops.*`: Secure and deterministic I/O primitives.
- `ts.*`: Global types and modifiers (`Branded`, `ValidJSON`, `Awaitable`).

#### Robustness Standards (SafeMode)

- **Failure return**: Favor returning a `SafeResult` (tuple `[err, res]`) for fallible functions or critical business orchestration instead of throwing exceptions.
- **Failfast**: Use `Bouncers` (`failfastBouncer`) for linear orchestration to avoid nested `if (err)` cascades.
- **Immutability**: Every "Tool" or "Context" object injected into an engine MUST be protected by `lockobj.protectObject` to ensure no mutations occur within user-defined layers.

---

### TypeScript 6.0+ Protocol

#### Native API First (Performance & Standard)

- **Regex**: ALWAYS use `RegExp.escape(str)` for escaping. NEVER write manual regex escapes.
- **Maps**: Use `map.getOrInsert(key, default)` or `map.getOrInsertComputed(key, () => ...)` for lazy initialization.
- **Temporal**: Prefer the `Temporal` API for new date/time logic over the legacy `Date` object (requires Node 20+).

#### Module Resolution & Paths

- **NO `baseUrl`**: This option is deprecated. Use explicit `paths` mappings in `tsconfig.json`.
- **Subpath Imports**: Favor `#/*` syntax for internal package aliases, compatible with `nodenext`.
- **Explicit Types**: Always ensure `"types": ["node"]` (or other required globals) is present in `tsconfig.json` since TS 6.0 defaults to an empty array `[]`.

#### DSL & Inferred Contexts

- **this-less Inference**: You can safely use method shorthand `name(args) { ... }` in object literal DSLs (like `@ytn/wf`) if `this` is not required; TS 6.0 inference is now stable for these "this-less" functions, unlike previous versions where they were often inferred as `unknown`.
