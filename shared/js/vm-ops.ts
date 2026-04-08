import vm from "node:vm";
import { tsSafeResult, safeResultErr, safeResultOk } from "../safe/safemode.js";

/** @type {Record<string, unknown>} tsVMSandbox */
export type tsVMSandbox = Record<string, unknown>;

/**
 * @interface IVMOptions
 * @description Standard configuration options for the Virtual Machine execution environment.
 *
 * @property {number} [timeout] - Maximum execution time in milliseconds before the script is terminated. Defaults to 1000ms.
 * @property {boolean} [displayErrors] - If true, execution errors will be printed to the standard output.
 */
export interface IVMOptions {
  /** Execution timeout in milliseconds. Defaults to 1000ms. */
  timeout?: number;
  /** Whether to display errors in the console. */
  displayErrors?: boolean;
}

/**
 * @function createContext
 * @description Alias to 'vm.createContext' for consistency in the vms toolbox.
 */
export const createContext = (sandbox: tsVMSandbox = {}): vm.Context =>
  vm.createContext(sandbox);

/**
 * @function safeRunVM
 * @description [Safe Mode] Executes a JavaScript string or function expression in a strictly isolated VM context.
 * Leverages 'vm.createContext' to prevent cross-context leakage and 'vm.runInContext' for deterministic execution.
 *
 * @template T - The expected return type for the result of the executed code.
 * @param {string} code - The raw source code or function string to execute.
 * @param {Record<string, unknown>} [sandbox={}] - Memory object to be branded as the new global context (injected tools/variables).
 * @param {IVMOptions} [options={ timeout: 1000 }] - Security and performance configurations.
 * @returns {tsSafeResult<T>} A deterministic SafeResult tuple [err, res]. Returns an error if rehydration fails, or if code execution exceeds timeout.
 */
export function safeRunVM<T = any>(
  code: string,
  sandbox: tsVMSandbox = {},
  options: IVMOptions = { timeout: 1000 },
): tsSafeResult<T, any> {
  try {
    const context = vm.createContext(sandbox);
    // Wrap in parentheses to ensure function expressions (like arrows) are parsed correctly as values
    const res = vm.runInContext(`(${code})`, context, options);
    return safeResultOk(res as T);
  } catch (err: any) {
    return safeResultErr(err);
  }
}

/**
 * @function safeRunInContext
 * @description [Safe Mode] Executes code in an existing VM context. Optimized for repeated runs with the same sandbox.
 *
 * @param {string} code - The code to execute.
 * @param {vm.Context} context - The pre-created VM context.
 * @param {IVMOptions} [options] - Execution options.
 * @returns {tsSafeResult<T>} The result of the execution.
 */
export function safeRunInContext<T = any>(
  code: string,
  context: vm.Context,
  options: IVMOptions = { timeout: 1000 },
): tsSafeResult<T, any> {
  try {
    const res = vm.runInContext(`(${code})`, context, options);
    return safeResultOk(res as T);
  } catch (err: any) {
    return safeResultErr(err);
  }
}
