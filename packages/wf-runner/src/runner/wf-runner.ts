import { protectObject } from "@ytn/shared/js/guarded_object.js";
import { z } from "zod";
import { TERMINAL_STEP_ID } from "../core/constants.js";
import {
  boxedStepSchemaFactory,
  terminalStepSchema,
} from "../core/step-schema.js";
import type {
  tsParsedBoxedStep,
  tsParseOptions,
  tsBoxedStep,
  tsSchBoxedStep,
  tsWFSpec,
} from "../types/runtime.types.js";
import { tsWFStep } from "../types/step.type.js";
import { schWFDef as wfSchema } from "../core/wf-schema.js";
import { type tsValidateWorkflow } from "../editor/wf-create.type.js";
import { createWFContext, type tsWFContext } from "../core/wf-context.js";
import { gateWrapper, wrapGateResult } from "./wrappers.js";

/**
 * @class WFRunner
 * @description Agentic Workflow Runner based on Zod v4.
 */
export class WFRunner<TIn = unknown, TOut = unknown> {
  #init: string;
  #steps: tsSchBoxedStep[] = [];
  #formattersCache = new Map<string, (d: unknown) => unknown>();
  #sendProxiesCache = new Map<
    string,
    Record<string, (d: unknown) => unknown>
  >();

  #maxSteps: number;

  /**
   * @constructor
   * @param {tsWFSpec} def - The workflow graph definition.
   * @param {Partial<tsWFContext>} [opts] - Runner configuration.
   */
  public constructor(def: tsWFSpec, opts?: Partial<tsWFContext>) {
    const config = createWFContext(opts);
    this.#init = config.init;
    this.#maxSteps = config.maxSteps;

    const parsedWF = wfSchema.safeParse(def, { reportInput: true });
    if (!parsedWF.success) throw parsedWF.error;

    const wfData = parsedWF.data;

    if (!wfData[this.#init]) {
      throw new Error(
        `WFRunner: The initial step "${this.#init}" is not defined.`,
      );
    }

    for (const p in wfData) {
      this.addStep(p, wfData[p]);
    }
  }

  /**
   * @method create
   * @description Creates a new WFRunner instance with static validation of the workflow.
   *
   * @template I - The workflow specification.
   * @param {tsValidateWorkflow<I>} def - The workflow graph definition.
   * @param {Object} [opts] - Runner configuration.
   * @returns {WFRunner} A validated WFRunner instance.
   */
  public static create<I extends tsWFSpec>(
    def: tsValidateWorkflow<I>,
    opts = { init: "init", maxSteps: 20 },
  ) {
    return new WFRunner(def as tsWFSpec, opts);
  }

  private getFormatter(target: string = TERMINAL_STEP_ID) {
    let f = this.#formattersCache.get(target);
    if (!f) {
      f = (d: unknown) => wrapGateResult(d, target);
      this.#formattersCache.set(target, f);
    }
    return f;
  }

  private addStep(name: string, stepDef: tsWFStep) {
    this.#steps.push(boxedStepSchemaFactory(name, stepDef));
    return this;
  }

  private getTools = (bStep: tsParsedBoxedStep) => {
    const stepDef = bStep.__def;
    const stepId = bStep.__step;

    let sendProxy = this.#sendProxiesCache.get(stepId);
    if (!sendProxy) {
      sendProxy = new Proxy(
        {},
        {
          get: (_, signal: string) => {
            if (signal === "end") return this.getFormatter(TERMINAL_STEP_ID);
            const target = stepDef.on?.[signal];
            return this.getFormatter(target ?? TERMINAL_STEP_ID);
          },
        },
      );
      this.#sendProxiesCache.set(stepId, sendProxy);
    }

    return protectObject({
      issues: {},
      send: sendProxy as Record<string, (d: unknown) => unknown>,
    });
  };

  /**
   * @property engine
   * @description Internal engine schema used for workflow execution.
   */
  private get engine() {
    const workflow: z.ZodType<TOut, tsBoxedStep> = z.lazy(() => {
      const businessModule = z
        .discriminatedUnion(
          "__step",
          this.#steps as [tsSchBoxedStep, ...tsSchBoxedStep[]],
        )
        .transform(async (val: tsParsedBoxedStep, ctx: z.RefinementCtx) => {
          const history = val.__history ?? [];
          if (history.length >= this.#maxSteps) {
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

      return z.discriminatedUnion("__step", [businessModule, terminalModule]);
    });

    return workflow;
  }

  /**
   * @method run
   * @description Starts the execution of the workflow with given input data.
   *
   * @template TIn - Input data type.
   * @template TOut - Final output data type.
   * @param {TIn} data - Initial input data for the workflow.
   * @param {tsParseOptions} [options] - Optional Zod parse options.
   * @returns {Promise<TOut>} The result of the workflow execution.
   */
  public async run(data: TIn, options?: tsParseOptions): Promise<TOut> {
    return this.engine.parseAsync(
      { __step: this.#init, __data: data } as tsBoxedStep,
      options,
    );
  }
}
