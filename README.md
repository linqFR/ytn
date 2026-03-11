# YTN 🚀

A modern, high-performance monorepo for SQL utilities and workflow management.

## 📦 Project Structure

This monorepo uses **npm workspaces** and is designed for maximum clarity and speed.

- **`@ytn/qb`** (`packages/query_builder`): A type-safe SQL Query Builder focused on performance and predictability.

## 🛠 Tech Stack

- **Runtime**: Node.js (>=24.0.0)
- **Language**: TypeScript (ES2022)
- **Module System**: Pure ESM (`type: module`)
- **Build Tool**: [tsup](https://tsup.egoist.dev/) for clean, noise-free distributions.

## 🚀 Getting Started

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

## 📜 Development Philosophy

- **Zero Noise**: The `dist` folders are kept clean (no sourcemaps or chunks in production builds).
- **TypeScript First**: Strict typing and `NodeNext` module resolution for modern ecosystem compatibility.
- **JSDoc documentation**: All public APIs are fully documented for an optimal IDE experience.

## 📄 License

This project is licensed under the **MIT License**.
