/**
 * @ytrynot/cli — Help generation.
 *
 * `buildHelp()` generates help text from the DNA contract metadata
 * (`.meta().description` on routes and fields). `printHelp()` is
 * a convenience wrapper that logs the help text.
 *
 * Help is generated from:
 * - `DnaObject.shape.cmd` → `DnaLiteral.value` for the command name
 * - `cliUnion.toParseArgsConfig().options` for flag `type` and `multiple`
 * - Flags filtered per-route via `key in shape` (excludes flags from
 *   other routes)
 * - `\x00ID` excluded from help output
 * - `.meta().description` on routes and fields provides help text
 * - `.meta().cli.hidden` marks routes hidden from general help
 */

import { DnaLiteral } from "@ytrynot/dna/core";
import type { IProcessedContract } from "./types/contract.types.js";
import { getCliMeta } from "./contract.js";
import { ROUTE_ID_KEY } from "./routeId.js";

/**
 * Builds help text from a processed contract.
 *
 * @param processed - The processed contract
 * @param forCommand - If provided, shows only that command's help
 *   (used by `cli build --help` → preprocessor routes to `help` →
 *   `help build` → `buildHelp("build")`)
 * @returns Help text string
 */
export function buildHelp(processed: IProcessedContract, forCommand?: string): string {
  const lines: string[] = [
    `Usage: ${processed.name} <command> [options]`,
    "",
    `${processed.description}`,
    "",
    "Commands:",
  ];
  const config = processed.cliUnion.toParseArgsConfig();
  const posNames = processed.cliUnion.positionals;

  for (const route of processed.routes) {
    const shape = route.shape;
    const cmdSchema = shape.cmd;
    const cmdValue = cmdSchema instanceof DnaLiteral ? cmdSchema.value : undefined;
    if (!cmdValue) continue;
    if (forCommand && forCommand !== cmdValue) continue;
    const routeMeta = route.meta();
    const cliMeta = getCliMeta(route);
    // hidden: "cmd" or "all" → exclude from Commands section
    if (cliMeta?.hidden && (cliMeta.hidden === "cmd" || cliMeta.hidden === "all") && !forCommand) continue;
    const desc = routeMeta.description ?? "";
    lines.push(`  ${String(cmdValue).padEnd(10)} ${desc}`);
    for (const [key, opt] of Object.entries(config.options)) {
      if (posNames.includes(key) || key === ROUTE_ID_KEY) continue;
      const fieldSchema = shape[key];
      if (!fieldSchema) continue;
      const flagMeta = fieldSchema.meta();
      const flagDesc = flagMeta.description ?? "";
      const type = opt?.type === "boolean" ? "" : ` <${opt?.type ?? "string"}>`;
      const multi = opt?.multiple ? "..." : "";
      lines.push(`    --${key}${type}${multi}${flagDesc ? "  " + flagDesc : ""}`);
    }
  }

  if (!forCommand) {
    lines.push("", "Options:", "  --help     Show this help", "  --version  Show version");
  }
  return lines.join("\n");
}

/**
 * Prints help text to stdout.
 *
 * Convenience wrapper around `buildHelp()` + `console.log()`.
 *
 * @param processed - The processed contract
 * @param forCommand - If provided, shows only that command's help
 */
export function printHelp(processed: IProcessedContract, forCommand?: string): void {
  console.log(buildHelp(processed, forCommand));
}
