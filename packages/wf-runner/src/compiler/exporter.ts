import * as fs from "node:fs";
import { type tsWFSpec } from "../types/runtime.types.js";
import { wfCodec } from "../core/wf-codec.js";

/**
 * @type IExportedWorkflow
 * @description A serializable version of the compiled workflow metadata.
 */
export type IExportedWorkflow = {
  /** The workflow structure (metadata only). */
  steps: any;
  /** Compiled metadata like cycle analysis, etc. */
  metadata: {
    hasCycles: boolean;
    stepCount: number;
  };
};

/**
 * @function serializeToExportedObject
 * @description Transforms a raw workflow into a plain JavaScript object using wfCodec.
 * 
 * @param {tsWFSpec} wf - The workflow specification.
 * @returns {IExportedWorkflow} A serializable plain object.
 */
export function serializeToExportedObject(wf: tsWFSpec): IExportedWorkflow {
  return {
    steps: wfCodec.encode(wf as any),
    metadata: {
      hasCycles: false,
      stepCount: Object.keys(wf).length,
    },
  };
}

/**
 * @function serializeToFile
 * @description Saves the serialized workflow metadata to a local file.
 * 
 * @param {tsWFSpec} wf - The workflow specification.
 * @param {string} filePath - Path to the destination file.
 */
export function serializeToFile(wf: tsWFSpec, filePath: string): void {
  const json = JSON.stringify(serializeToExportedObject(wf), null, 2);

  if (filePath.endsWith(".ts") || filePath.endsWith(".js")) {
    const code = `/** @type {import("@ytn/wf").IExportedWorkflow} */\nexport const workflow = ${json};`;
    fs.writeFileSync(filePath, code, "utf8");
  } else {
    fs.writeFileSync(filePath, json, "utf8");
  }
}
