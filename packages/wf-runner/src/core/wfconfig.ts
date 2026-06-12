import { vmCodecFactory } from "@ytn/shared/zod/vm-codecs.js";
import type { tsVMSandbox } from "@ytn/shared/js/vm-ops.js";
import { z } from "zod";
import type { tsWFStep } from "../types/step.type.js";

/**
 * Global sandbox context injection for the rehydrated Gates (vmCodec)
 */
export const wfSandbox: tsVMSandbox = {
  console,
  z, // Available inside instantiated step gates
};

/**
 * Pre-configured codec using the workflow sandbox configuration
 */
export const vmCodec = vmCodecFactory<tsWFStep["gate"]>(wfSandbox);
