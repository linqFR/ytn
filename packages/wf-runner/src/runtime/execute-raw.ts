import { serializeToExportedObject } from "../compiler/exporter.js";
import { execute } from "./execute.js";
import { type tsWFContext } from "../core/wf-context.js";
import type { tsWFSpec } from "../types/runtime.types.js";

/**
 * @function executeRaw
 * @description Direct execution of a raw DSL workflow specification.
 * It performs an internal compilation to AOT format before execution.
 * Useful for development and dynamic workflows.
 * 
 * @param {tsWFSpec} wf - The raw workflow specification (DSL).
 * @param {any} input - Initial data.
 * @param {Partial<tsWFContext>} [opts] - Runtime configuration overrides.
 * @returns {Promise<any>} The final workflow result.
 */
export async function executeRaw(
  wf: tsWFSpec,
  input: any,
  opts?: Partial<tsWFContext>
): Promise<any> {
  // 1. Compile to AOT metadata (strips functions and serializes gates via codecs)
  const processed = serializeToExportedObject(wf);

  // 2. Execute the processed metadata
  return execute(processed, input, opts);
}
