import type { OHelpData } from "../types/contract.types.js";

/**
 * @function printHelp
 * @description Renders the structured help data to the terminal with ANSI colors and formatting.
 *
 * @param {OHelpData} help - The structured help metadata to display.
 */
export function printHelp(help: OHelpData): void {
  const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
  const blue = (s: string) => `\x1b[34m${s}\x1b[39m`;
  const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
  const yellow = (s: string) => `\x1b[33m${s}\x1b[39m`;

  console.log(`\n${bold(help.name)}`);
  if (help.description) {
    console.log(`${help.description}\n`);
  }

  // 1. Usage cases
  console.log(bold("Usage:"));
  help.usage_cases.forEach((caseItem) => {
    console.log(`  $ ${blue(caseItem.command)}`);
    if (caseItem.description) {
      console.log(`    ${dim(caseItem.description)}`);
    }
  });

  // 2. Arguments
  if (help.arguments.length > 0) {
    console.log(`\n${bold("Arguments & Flags:")}`);

    // Calculate column widths for alignment
    const maxUsages = Math.max(
      ...help.arguments.map((a) => (a.usages?.join(", ") || "").length),
    );
    const maxType = Math.max(...help.arguments.map((a) => a.type.length));

    help.arguments.forEach((arg) => {
      const usageStr = (arg.usages?.join(", ") || "").padEnd(maxUsages + 2);
      const typeStr = yellow(arg.type.padEnd(maxType + 2));
      const desc = dim(arg.description);

      console.log(`  ${blue(usageStr)}${typeStr}${desc}`);
    });
  }
  console.log("");
}
