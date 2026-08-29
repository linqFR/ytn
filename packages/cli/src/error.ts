import type { tsCliErrorInput } from "./types/contract.types.js";

/**
 * Formats CLI errors into a human-readable string.
 *
 * Phase 1: passthrough. Each error is formatted as
 * `"Error: <message> at <path>"` (or just `"Error: <message>"`
 * if the path is empty). Multiple errors are joined with newlines.
 *
 * @param errors - DNA parser errors (`{ message, path }`)
 * @returns Formatted error string
 */
export function formatCliError(errors: tsCliErrorInput[]): string {
  return errors
    .map((e) => {
      const msg = e.message ?? "Unknown error";
      const pathStr = typeof e.path === "string" ? e.path : "";
      const path = pathStr ? ` at ${pathStr}` : "";
      return `Error: ${msg}${path}`;
    })
    .join("\n");
}
