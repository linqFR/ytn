# Contributing to YTN

First off, thank you for considering contributing to YTN! It's people like you who make the open-source community such an amazing place to learn, inspire, and create.

## Monorepo Overview

YTN is a monorepo containing several independent TypeScript packages:

- `@ytn/qb`: SQLite Query Builder.
- `@ytn/czvo`: CLI to Zod-Validated Objects.
- `@ytn/wf`: Workflow Router.
- `@ytn/shared`: Internal shared toolbox (Private).

## Development Workflow

### Prerequisites

- Node.js >= 24.0.0
- npm (native workspaces)

### Getting Started

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Build all packages: `npm run build`.
4. Run tests: `npm test`.

### Making Changes

1. Create a new branch: `git checkout -b feature/my-new-feature`.
2. Make your changes in the relevant package under `packages/*`.
3. Add tests for your changes.
4. Ensure all tests pass: `npm test`.
5. **Add a changeset**: Run `npm run change` to document your changes for versioning.
6. Commit and push your changes.

## Coding Standards

- Use **TypeScript** with strict mode.
- Use **Pure ESM** (import/export).
- Follow the JSDoc requirements: every public method and export must be documented.
- Strict Zod v4.

## Reporting Bugs

Please use the **Issue Templates** to report bugs. Include:

- Steps to reproduce.
- Expected behavior.
- Environment details (Node version, OS).

## Pull Request Process

1. Ensure the CI passes (Build and Test).
2. Include a descriptive title: `[package-name] Short summary`.
3. Link to any related issues.
4. Wait for a maintainer review.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
