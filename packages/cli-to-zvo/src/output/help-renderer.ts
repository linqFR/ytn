import { ZodError } from "zod";
import { OHelpArg, OHelpData } from "../types/contract.types.js";

/**
 * @class HelpRenderer
 * @description Lazy renderer for CLI help and error messages.
 * Decouples the UI presentation from the Zod validation logic.
 */
export class HelpRenderer {
  constructor(private readonly data: OHelpData) {}

  /**
   * Renders the global CLI help screen.
   */
  public renderGlobalHelp(): string {
    const lines: string[] = [
      `\n${this.data.name} - ${this.data.description}`,
      `\nUSAGE:`,
    ];

    if (this.data.usage_cases.length > 0) {
      this.data.usage_cases.forEach(
        (c: { command: string; description: string }) => {
          lines.push(`  $ ${c.command}`);
          if (c.description) lines.push(`    ${c.description}`);
        },
      );
    }

    if (this.data.arguments.length > 0) {
      lines.push(`\nOPTIONS & ARGUMENTS:`);
      this.data.arguments.forEach((arg: OHelpArg) => {
        const namePart = arg.usages
          ? arg.usages.join(", ")
          : `<${arg.arg_name || arg.name}>`;
        lines.push(`  ${namePart.padEnd(25)} ${arg.description} [${arg.type}]`);
      });
    }

    lines.push(`\nUse '--help' for detailed information.`);
    return lines.join("\n");
  }

  /**
   * Translates a ZodError into a human-readable CLI advice.
   * @param error The ZodError to format.
   * @returns A friendly error message.
   */
  public formatZodError(error: ZodError): string {
    const issues = error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `'${issue.path.join(".")}' ` : "";
      return `  - ${path}${issue.message}`;
    });

    return `\nError: Invalid arguments:\n${issues.join(
      "\n",
    )}\n\nRun with '--help' to see correct usage.`;
  }
}

/**
 * @function formatUserError
 * @description Static helper to format various error types for the CLI.
 */
export function formatUserError(error: unknown, helpData?: OHelpData): string {
  if (error instanceof ZodError) {
    return new HelpRenderer(helpData!).formatZodError(error);
  }
  return error instanceof Error ? error.message : String(error);
}
