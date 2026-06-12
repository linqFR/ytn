import { createWorkflow } from "../editor/wf-create.js";
import { type tsWFSpec } from "../types/runtime.types.js";
import { type tsValidateWorkflow } from "../editor/wf-create.type.js";
import { serializeToExportedObject, serializeToFile, type IExportedWorkflow } from "./exporter.js";

/**
 * @function compileWorkflow
 * @description Validates and compiles a workflow into a serializable object.
 * 
 * @param {tsWFSpec} wf - The raw workflow specification.
 * @returns {IExportedWorkflow} The compiled workflow metadata.
 */
export function compileWorkflow<I extends tsWFSpec>(
  wf: tsValidateWorkflow<I>
): IExportedWorkflow {
  const processed = createWorkflow(wf);
  return serializeToExportedObject(processed);
}

/**
 * @function compileWorkflowToFile
 * @description Compiles a workflow and writes it to a file.
 * 
 * @param {tsWFSpec} wf - The raw workflow specification.
 * @param {string} outPath - Destination file path.
 */
export function compileWorkflowToFile<I extends tsWFSpec>(
  wf: tsValidateWorkflow<I>,
  outPath: string
): void {
  const processed = createWorkflow(wf);
  serializeToFile(processed, outPath);
}
