---
trigger: always_on
---
# **Sandbox-only Scratch and Log Files**

THESE RULES ARE CRITICAL.

## Where exploration and log files belong

- **Always place scratch, log, and exploration artifacts inside a `sandbox/` directory.**
  - Global scratch: `./sandbox/`
  - Package scratch: `packages/<pkg>/sandbox/`

- **Never create `.log`, `.txt`, `.json`, `.md`, or other temporary exploration files outside `sandbox/`**.
  - Forbidden locations: `src/`, `tests/`, `docs/`, the repo root, or any other non-`sandbox` directory.
  - The only allowed exception is the `inter-session-mailbox` rule's files: `mailbox/mailbox*.md` and `packages/<pkg>/mailbox/mailbox*.md`.

## Allowed patterns

- Use `packages/<pkg>/sandbox/mine.ts` or `packages/<pkg>/sandbox/mine.log` for quick experiments and diagnostics.
- When logging is needed, prefer in-memory inspection first: `console.dir(obj, { depth: null })` or `console.log(JSON.stringify(obj))`.
- If a file is required, its path must contain `sandbox/` or be a `mailbox/mailbox-*.md` file (at root or under `packages/<pkg>/mailbox/`).

## Exceptions

The following `mailbox/` directories are the only allowed exceptions to the `sandbox/` rule. They may only contain the `inter-session-mailbox` rule's files:

- `mailbox/` at the repo root for cross-package topics
- `packages/<pkg>/mailbox/` for package-scoped topics

Each may only contain:

- `mailbox/mailbox-YYYY-MM-DD.md` daily files
- `mailbox/mailbox.md` archive

These are not scratch files and must not be deleted or cleaned up.

## Cleanup

- Remove scratch and log files from `sandbox/` as soon as they are no longer needed.
- Do not leave generated `.log`, `.txt`, `.json`, or `.md` files behind at the end of a session.
- This cleanup does not apply to `mailbox/mailbox-*.md` files.
