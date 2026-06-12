import { z } from "zod";
import { schWFDef } from "./wf-schema.js";
import { schWFTools, schWFGateFn, schGateOutput } from "./gate-schema.js";
import { vmCodec } from "./wfconfig.js";
import { schWFStepString } from "./step-schema.js";
import type { tsWFStep } from "../types/step.type.js";
// import type { tsStep, tsWFSpec } from "../types/runtime.types.js";

/**
 * @function fnCodec
 * @description transform a gate function into a z.Zodfunction and brand it for discrimination.
 */
export const fnCodec = z.codec(
  schWFGateFn,
  z.instanceof(Function).refine((v: any) => v.__branded === true),
  {
    decode: (fn: any) => {
      const wrapped = z
        .function({
          input: [z.any(), schWFTools.optional()],
          output: schGateOutput,
        })
        .implementAsync(fn);
      Object.defineProperty(wrapped, "__branded", {
        value: true,
        enumerable: false,
      });
      return wrapped;
    },
    encode: (fn: any) => {
      if (!fn.__branded) {
        Object.defineProperty(fn, "__branded", {
          value: true,
          enumerable: false,
        });
      }
      return fn;
    },
  },
);

/**
 * @function strZFnCodec
 * @description Transforms between a serialized string (raw) and a branded function (logic).
 */
export const strZFnCodec = z.codec(
  z.string(),
  z.instanceof(Function).refine((v: any) => v.__branded === true),
  {
    decode: (str) => {
      const fn = vmCodec.decode(str);
      return fnCodec.decode(fn);
    },
    encode: (fn) => {
      return vmCodec.encode(fn as any);
    },
  },
);

/**
 * @function wfCodec
 * @description The ultimate AOT engine.
 * Encodes a living Zod Engine/Spec into a serialized AOT version and vice versa.
 */
export const wfCodec = z.codec(
  z.record(z.string(), schWFStepString),
  schWFDef,
  {
    decode: (aot: any) => {
      const live: any = {};
      for (const k in aot) {
        live[k] = {
          schema: aot[k].schema,
          on: aot[k].on,
          gate: strZFnCodec.decode(aot[k].gate),
        } as tsWFStep;
      }
      return live;
    },
    encode: (live: any) => {
      const aot: any = {};
      for (const k in live) {
        aot[k] = {
          schema: live[k].schema,
          on: live[k].on,
          gate: strZFnCodec.encode(live[k].gate),
        };
      }
      return aot;
    },
  },
);
