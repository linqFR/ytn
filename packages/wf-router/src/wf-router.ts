import { z } from "zod";
import { lockobj } from "@shared";
import { TERMINAL_STEP_ID } from "./core/constants.js";
import {
  wfSchema,
  boxedStepSchemaFactory,
  terminalStepSchema,
} from "./core/schemas.js";
import { gateWrapper, wrapGateResult } from "./wrappers.js";
import type {
  tsWFSpec,
  tsStep,
  tsSchBoxedStep,
  ParsedBoxedStep,
  ParseOptions,
} from "./core/types.js";

/**
 * @class WFRouter
 * @description Agentic Workflow Router based on Zod v4.
 */
export class WFRouter<TIn = any, TOut = any> {
  private init: string;
  private steps: tsSchBoxedStep[] = [];
  private formattersCache = new Map<string, (d: any) => any>();
  private sendProxiesCache = new Map<string, Record<string, (d: any) => any>>();

  private maxSteps: number;

  /**
   * @constructor
   * @param {tsWFSpec} def - The workflow graph definition.
   * @param {Object} opts - Router configuration.
   */
  public constructor(def: tsWFSpec, opts = { init: "init", maxSteps: 20 }) {
    this.init = opts.init;
    this.maxSteps = opts.maxSteps;

    const parsedWF = wfSchema.safeParse(def, { reportInput: true });
    if (!parsedWF.success) throw parsedWF.error;

    if (!def[this.init]) {
      throw new Error(
        `WFRouter: The initial step "${this.init}" is not defined.`,
      );
    }

    for (const p in def) this.addStep(p, def[p]);
  }

  private getFormatter(target: string = TERMINAL_STEP_ID) {
    let f = this.formattersCache.get(target);
    if (!f) {
      f = (d: any) => wrapGateResult(d, target);
      this.formattersCache.set(target, f);
    }
    return f;
  }

  private addStep(name: string, stepDef: tsStep) {
    this.steps.push(boxedStepSchemaFactory(name, stepDef));
    return this;
  }

  private getTools = (bStep: ParsedBoxedStep) => {
    const stepDef = bStep.__def;
    const stepId = bStep.__step;

    let sendProxy = this.sendProxiesCache.get(stepId);
    if (!sendProxy) {
      sendProxy = new Proxy(
        {},
        {
          get: (_, signal: string) => {
            if (signal === "end") return this.getFormatter(TERMINAL_STEP_ID);
            const target = stepDef.on?.[signal];
            return target ? this.getFormatter(target) : undefined;
          },
        },
      );
      this.sendProxiesCache.set(stepId, sendProxy);
    }

    return lockobj.protectObject({
      issues: {},
      send: sendProxy as Record<string, (d: any) => any>,
    });
  };

  /** Internal engine schema. */
  private get engine(): z.ZodType<TOut, any, any> {
    const workflow: z.ZodType<TOut, any, any> = z.lazy(() => {
      const businessModule = z
        .discriminatedUnion("__step", this.steps as any)
        .transform(async (val: any, ctx: z.RefinementCtx) => {
          const history = val.__history ?? [];
          if (history.length >= this.maxSteps) {
            ctx.issues.push({
              code: "custom",
              message: `Execution limit reached.`,
              path: [...history],
              input: val,
            });
            return {
              __step: TERMINAL_STEP_ID,
              __data: val.__data,
              __history: history,
            };
          }
          return await gateWrapper(this.getTools)(val, ctx);
        })
        .pipe(workflow);

      const terminalModule = terminalStepSchema.transform(
        (v) => v.__data as TOut,
      );

      return z.discriminatedUnion("__step", [
        businessModule as any,
        terminalModule as any,
      ]);
    });

    return workflow;
  }

  public async run(data: TIn, options?: ParseOptions): Promise<TOut> {
    return this.engine.parseAsync({ __step: this.init, __data: data }, options);
  }
}
