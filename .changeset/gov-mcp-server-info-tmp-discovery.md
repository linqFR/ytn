---
"@ytrynot/gov-mcp": minor
---

Server publishes env vars to TMP for client discovery

- The server writes a `gov-mcp-server.json` file to the OS temp directory at startup, containing `GOVERNANCE_DB_PATH`, `GOVERNANCE_REPORTS_DIR`, and `GOVERNANCE_SERVER_SCRIPT`.
- The MCP client reads this file to resolve env vars instead of parsing MCP config files or relying on `DEVIN_PROJECT_DIR`.
- Works across IDEs (Devin, VS Code, Cursor) and platforms (Windows, Linux, macOS) without project-root detection.
