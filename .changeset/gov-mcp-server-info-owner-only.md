---
"@ytrynot/gov-mcp": patch
---

Server discovery file written owner-only (CWE-377)

- `gov-mcp-server.json` (the TMP discovery descriptor read by hook clients) is now written with mode `0600` and re-tightened via `chmodSync` on overwrite — it is no longer world-readable on shared temp dirs. Readers are same-user sibling processes, so owner-only is sufficient.
