# YTN

A modern, high-performance monorepo for SQLite utilities and workflow management.

## Project Structure

This monorepo uses **npm workspaces** and is designed for maximum clarity and speed.

- **[@ytn/qb](./packages/query_builder)**: A type-safe SQL Query Builder focused on performance and predictability. See the [Query Builder README](./packages/query_builder/README.md) for detailed documentation.


## Tech Stack

- **Runtime**: Node.js (>=24.0.0)
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`type: module`)

## Getting Started

### Installation

```bash
npm install
```

### Build everything

```bash
npm run build
```

### Run tests

```bash
npm test
```

## License

This project is licensed under the **MIT License**.
