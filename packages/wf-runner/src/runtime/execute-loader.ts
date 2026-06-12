import * as fs from "node:fs";
import * as path from "node:path";
import { execute } from "./execute.js";
import { type tsWFContext } from "../core/wf-context.js";

/**
 * @function execWithFile
 * @description Loads a compiled workflow from a file and executes it.
 * Supports .json and .js/.ts (ESM) formats.
 * 
 * @param {string} filePath - Absolute or relative path to the compiled workflow.
 * @param {any} input - Initial data.
 * @param {Partial<tsWFContext>} [opts] - Runtime configuration overrides.
 * @returns {Promise<any>} The final workflow result.
 */
export async function execWithFile(
  filePath: string,
  input: any,
  opts?: Partial<tsWFContext>
): Promise<any> {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);

  let processedWF: any;

  if (absolutePath.endsWith(".json")) {
    const raw = fs.readFileSync(absolutePath, "utf-8");
    processedWF = JSON.parse(raw);
  } else {
    // Dynamic import for JS/TS exports
    const module = await import(absolutePath);
    processedWF = module.workflow || module.default || module;
  }

  return execute(processedWF, input, opts);
}
