/**
 * @ytrynot/cli — Error formatting.
 *
 * `formatCliError()` transforms DNA parser errors into a CLI-readable
 * string. Phase 1: passthrough (DEC-0018) — `CliError = DnaError`,
 * the errors pass through with minimal formatting (message + path).
 * A more readable CLI-specific format will come in a later phase.
 *
 * @module @ytrynot/cli/error
 */

import type { CliError } from "./types/contract.types.js";

/**
 * Formats CLI errors into a human-readable string.
 *
 * Phase 1: passthrough (DEC-0018). Each error is formatted as
 * `"Error: <message> at <path>"` (or just `"Error: <message>"`
 * if the path is empty). Multiple errors are joined with newlines.
 *
 * @param errors - DNA parser errors (`{ message, path, input }`)
 * @returns Formatted error string
 */
export function formatCliError(errors: CliError[]): string {
  return errors
    .map((e) => {
      const msg = e.message ?? "Unknown error";
      const pathStr = typeof e.path === "string" ? e.path : "";
      const path = pathStr ? ` at ${pathStr}` : "";
      return `Error: ${msg}${path}`;
    })
    .join("\n");
}
