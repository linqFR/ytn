import type { tsGateResult, tsWFOnMapKey } from "./gate.types.js";

type tsWFIssues = Record<string, unknown>;

export type tsWFToolSendFn<D extends unknown = unknown> = (
  data: D,
) => tsGateResult<any>;

/** @type {Record<string, (data: unknown) => unknown>} tsWFSendTools */
export type tsWFSendTools = Record<string, tsWFToolSendFn>;

/** @type {Object} tsWFTools */
export type tsWFTools = {
  issues: tsWFIssues;
  send: tsWFSendTools;
};

/**
 * @type IWFStepTools
 * @description Injected tools for the gate function.
 */
export interface IWFStepTools<TOnKeys extends tsWFOnMapKey = never> {
  /** Shared issues record for the current execution context. */
  issues: tsWFIssues;
  send: {
    /** Signal de fin par défaut */
    end: tsWFToolSendFn;
  } & {
    [K in TOnKeys]: tsWFToolSendFn;
  };
}
