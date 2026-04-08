import { catchAsyncFn } from "@ytn/shared/safe/safemode.js";
import { execute } from "../runtime/execute.js";
import { buildHelp } from "../output/help-builder.js";
import { printHelp } from "../output/help-printer.js";
import type { IProcessedContract } from "../types/contract.types.js";

/**
 * @type tsHandler
 * @description Action handler for a specific ZVO target.
 */

type tsHandlerFn = (data: any) => void | Promise<void>;
export type tsHandler = {
  error?: tsHandlerFn;
  [x: string]: tsHandlerFn | undefined;
};

/**
 * @function launchCzvo
 * @description The universal Command Launcher for CZVO.
 * It uses the local CZVO engine to parse arguments and dispatch to the correct handler.
 * @template I - The contract type.
 */
export async function launchCzvo(
  processedContract: IProcessedContract,
  handlers: tsHandler,
  args?: string[],
): Promise<void> {
  const result = execute(processedContract, args);

  if (!result.success) {
    if (handlers.error) {
      await handlers.error(result.error);
    } else {
      // Default error handling
      printHelp(buildHelp(processedContract));
      console.error("[CZVO] Execution Error:", result.error);
      process.exit(1);
    }
    return;
  }

  const response = result.data;

  const handler = handlers[response.route];

  if (handler) {
    const [err] = await catchAsyncFn(handler)(response.data);
    if (err) {
      printHelp(buildHelp(processedContract, response.route));
    }
  }
}
