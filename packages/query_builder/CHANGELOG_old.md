# Changelog

All notable changes to the `QueryBuilder` project will be documented in this file.

## [1.2.0] - 2026-03-11

### Added in 1.2.0

- **Modular Architecture**: Split the monolithic builder into specialized modules (`introspection`, `ddl`, `builder`) for better maintainability.
- **tsup Bundling**: Integrated `tsup` for high-performance bundling and dual-format (ESM/CJS) support.
- **Minified Bundle**: Added an optimized `index.min.js` (~9KB) accessible via `query_builder/min`.
- **Enhanced Test Suite**: New verification layers for distribution artifacts and minified bundles.

### Changed in 1.2.0

- Refactored project structure into a clean `src/` directory.
- Updated build pipeline to use `tsup` instead of raw `tsc`.

## [1.1.0] - 2026-01-27

### Added in 1.1.0

- **Zod 4 Native Support**: Seamless introspection for Zod 4 schemas (supporting `.def.type` and `.meta()`).
- **Metadata-Driven DDL**: `createTableFromZod` now officially supports `.meta()` for defining constraints:
  - `pk`: Primary Key
  - `unique`: Unique constraint
  - `fk`: Foreign Key (supports `{ table, col, onDelete }`)
  - `defaultValue`: Column default value.

### Fixed in 1.1.0

- Improved `QueryBuilder` introspection to be "dual-track" (Zod 3 and Zod 4 compatible).
- [REFORM] Factorized introspection logic into a private static helper to ensure consistency across all DDL/CRUD methods.
- [CLEANUP] Removed redundant internal state variables (`_field`, `_conflictTarget`).
- [DOCS] **100% JSDoc Coverage**: Every public method now includes detailed documentation, usage examples, and `@throws` tags for better IDE integration.
- Fixed path resolution for database initialization using `import.meta.url`.

## [1.0.0] - 2026-01-21

### Added in 1.0.0

- Extracted as a standalone NPM package.

## [2026-01-21]

### Documentation (2026-01-21)

- Added JSDocs for explicit join methods (`joinLeft`, `joinInner`, `joinRight`).

## [2026-01-17]

### Fixed (2026-01-17)

- Removed auto-sanitization to respect agnostic design principle.

### Added (2026-01-17)

- Support for `{ col: string, param: string }` in filters to allow manual handling of driver-specific constraints (e.g., SQLite dot prohibition).

## [2026-01-04]

### Added (2026-01-04)

- Zod Schema Integration for DDL generation.
