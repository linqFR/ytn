import { parseArgs } from "node:util";
import { argv } from "node:process";
import type { IProcessedContract } from "./contract.js";

export function execute(
  processed: IProcessedContract,
  args: string[] = argv.slice(2),
): unknown {
  const raw = parseArgs({
    args,
    options: processed.parsingArgs.options,
    allowPositionals: processed.parsingArgs.allowPositionals,
    allowNegative: processed.parsingArgs.allowNegative,
    strict: processed.parsingArgs.strict,
  });

  const input: Record<string, unknown> = { ...raw.values };
  for (let i = 0; i < processed.parsingArgs.positionals.length; i++) {
    input[processed.parsingArgs.positionals[i]] = raw.positionals[i];
  }

  return processed.validator.safeParse(input);
}
