import { createWFContext, type tsWFContext } from "../core/wf-context.js";
import { rehydrateWorkflow } from "../core/rehydrate.js";
import { forgeWorkflowEngine } from "../core/forge.js";
import type { tsBoxedStep } from "../types/runtime.types.js";

/**
 * @function execute
 * @description Standard functional execution of a previously compiled workflow.
 * This is the high-performance path that skips DSL evaluation.
 * 
 * @param {any} processedWF - The compiled workflow metadata (AOT).
 * @param {any} input - Initial data to pass to the workflow.
 * @param {Partial<tsWFContext>} [opts] - Runtime configuration overrides.
 * @returns {Promise<any>} The final workflow result.
 */
export async function execute(
  processedWF: any,
  input: any,
  opts?: Partial<tsWFContext>
): Promise<any> {
  // 1. Prepare configuration
  const config = createWFContext(opts);
  
  // 2. Rehydrate the AOT metadata into a living specification
  // If the input is the full IExportedWorkflow, we take .steps
  const aotSteps = processedWF.steps || processedWF;
  const liveWF = rehydrateWorkflow(aotSteps);
  
  // 3. Forge the execution engine
  const engine = forgeWorkflowEngine(liveWF, config);
  
  // 4. Trigger execution
  return engine.parseAsync({
    __step: config.init,
    __data: input
  } as tsBoxedStep);
}
