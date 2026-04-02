# AGENTS.md (Package: @ytn/qb)

> [!IMPORTANT]
> This package MUST comply with the **[Global AGENTS.md](../../AGENTS.md)**. Use this file ONLY for instructions specific to the Query Builder.

---

## 🏛️ Core Architecture

The codebase is strictly modularized under `src/`. Avoid re-merging logic into single files.

- **`src/types.ts`**: Unified interfaces and internal definitions (JoinDefinition, WhereDefinition, etc.). Use these to keep the API clear and maintainable.
- **`src/introspection.ts`**: The "Recursive Unwrapping Engine". **CRITICAL**: This is the only module that should handle Zod schema decomposition using the v4 Public API.
- **`src/ddl.ts`**: Translates schema shapes into SQL table structures.
- **`src/builder.ts`**: The Fluent DML Builder. Focuses on SQL string construction with strict preservation of validated syntax.
- **`src/index.ts`**: The public entry point (facade).

---

## 📖 Documentation & Lore

- **`README.md`**: Public-facing usage, installation, and general overview.
- **`docs/zod_v4/`**: Technical deep-dives into Zod v4 compliance.
  - `docs/zod_v4/research_notes.md`: Detailed analysis of Zod v4 architectural changes (Core vs Classic) and the specific internal mappings found during development.
  - `docs/zod_v4/compliance_critique.md`: Final audit of the v1.2.0 modular engine, confirming the 100% removal of internal `_def` dependencies.
  - `docs/zod_v4/v3_legacy_disposal.md`: **CRITICAL: READ THIS FIRST.** A complete list of deprecated Zod v3 patterns (like `typeName`, `innerType`, and structural hacking) that MUST be forgotten to avoid corrupting the v4 architecture.
- **`docs/refactoring_walkthrough.md`**: Step-by-step record of the transition from the monolithic `query_builder.ts` to the modular `src/` architecture, including verification results.
- **`docs/git_automation_guide.md`**: Vital procedures for SSH/PAT Git connections and a manifesto on AI-driven automation via Antigravity, including custom workflows in `.agents/workflows`.

---

## 🌐 Source of Truth (Zod v4)

If you have a doubt about a Zod type, do not guess and do not look at Zod 3 legacy tutorials.

1. **Official Docs**: [zod.dev](https://zod.dev) (The definitive reference).
2. **Local Types**: Check `node_modules/zod/lib/index.d.ts`. This is the absolute truth for the current version.
3. **Official GitHub**: [colinhacks/zod](https://github.com/colinhacks/zod) (Switch to v4/main branches).
4. **Recursive Engine**: Study `src/introspection.ts` in this project. It is the reference implementation for deep-unwrapping.

---

## Build & Distribution Details

In addition to global build rules, this package requires:

- **Minification**: Keep a separate minified bundle (`index.min.js`) for production environments.
- **tsup Configuration**: Must use `treeshake: false` in the base configuration to prevent stripping JSDoc comments.
- **Zero Noise**: Disable `sourceMap` and `declarationMap` in standard builds to keep the `dist` directory clean.
- **Automated DTS**: Type declarations (`.d.ts`) must be automatically generated.

---

## 🧪 Testing Workflow

Always run the full suite before submitting changes. "It builds" is not enough.

- **`tests/v4_compliance_verify.ts`**: Verifies that the recursive engine correctly unwraps diverse Zod v4 patterns.
- **`tests/dist_verify.js` / `tests/min_verify.js`**: Verifies that the compiled artifacts (standard and minified) are functionally operational in a plain Node.js environment.
- **Use `run_tests.bat`**: Orchestrates the entire suite (Source + Bundle + Minified).

---

> “Maintain the engine, respect the schema, and never choose the easy path over the right one.”
