import {z} from "zod";
import { isPureObject, catchAsyncFn, protectObject } from "../../toolbox/dist/index.js";
import { pushGateIssue } from "./zod-issues.js";

/**
 * @typedef {Object} ParseOptions
 * @description Native Zod parsing options for async execution.
 */
type ParseOptions = Parameters<z.ZodTypeAny["parseAsync"]>[1];

/* -------------------------------------------------------------------------- */
/*                                CORE SCHEMAS                                */
/* -------------------------------------------------------------------------- */

/**
 * @constant schStep
 * @description Zod schema for a single workflow step definition.
 */
const schStep = z.object({
  /** The Zod schema to validate inputs for this specific step. */
  schema: z.any(),
  /** Mapping of logical signals to target step IDs. */
  on: z.record(z.string(), z.string()).nullable().optional(),
  /** The functional logic (gate) to execute for this step. */
  gate: z.custom<(data: any, tools?: any) => any>(
    (f) => typeof f === "function",
  ),
});

/** @typedef {z.infer<typeof schStep>} tsStep */
type tsStep = z.infer<typeof schStep>;

/**
 * @constant schWF
 * @description Zod schema for the entire workflow specification.
 * Performs graph integrity checks (cycle detection, terminal exit presence).
 */
const schWF = z.record(z.string(), schStep).superRefine((val, ctx) => {
  const allKeys = Object.keys(val);

  const seen = new Set<string>();
  for (const key of allKeys) {
    const low = key.toLowerCase();
    if (seen.has(low)) {
      ctx.issues.push({
        code: "invalid_value",
        input: key,
        values: allKeys,
        path: [key],
        message: `Duplicate Step ID found (case-insensitive collision): "${key}".`,
      });
    }
    seen.add(low);
  }

  // Graph Integrity: Verify that all transitions target existing steps.
  let hasExit = false;
  for (const p in val) {
    const step = val[p];
    if (!step.on || Object.keys(step.on).length === 0) {
      hasExit = true;
    } else {
      for (const onp in step.on) {
        const ref = step.on[onp];
        const isfound = allKeys.some((v) => v === ref);
        if (!isfound)
          ctx.issues.push({
            code: "invalid_value",
            input: ref,
            values: allKeys,
            path: [p, "on", onp],
            message: `${p}.on.${onp} = ${ref} is not related to any step.`,
          });
      }
    }
  }

  if (!hasExit) {
    ctx.issues.push({
      code: "custom",
      input: val,
      message:
        "Workflow must have at least one terminal exit (step without 'on' transitions).",
      path: [],
    } as any);
  }
});

/** @typedef {Record<string, any>} tsWFSpec */
type tsWFSpec = Record<string, any>;

/** @typedef {Object} tsBoxedStep */
type tsBoxedStep = {
  [x: string]: unknown;
  __step: string;
  __data: unknown;
};

/** @typedef {Object} ParsedBoxedStep */
export type ParsedBoxedStep = {
  __step: string;
  __data: unknown;
  __def: tsStep;
};

type tsBoxedStepDefHist = ParsedBoxedStep & { __history: string[] };
type tsBoxedStepHist = tsBoxedStep & { __history: string[] };

/**
 * @typedef {z.ZodType<ParsedBoxedStep, any, any>} tsSchBoxedStep
 * @description Public type for individual step schemas.
 */
type tsSchBoxedStep = z.ZodType<ParsedBoxedStep, any, any>;

/**
 * @function schBoxedStep
 * @description Factory for creating a boxed step validator.
 * @param {string} stepId - The unique identifier for the step.
 * @param {tsStep} def - The step definition.
 */
const schBoxedStep = (stepId: string, def: tsStep): tsSchBoxedStep => {
  return z
    .object({
      __step: z.literal(stepId),
      __data: (def.schema as z.ZodTypeAny) ?? z.any(),
    })
    .transform((v) => ({ ...v, __def: def })) as unknown as tsSchBoxedStep;
};

/* -------------------------------------------------------------------------- */
/*                               TERMINAL LOGIC                               */
/* -------------------------------------------------------------------------- */

const TERMINAL_STEP_ID = "__terminal__" as const;

/** Schema for the terminal exit point. */
const teminalStep = z.object({
  __step: z.literal(TERMINAL_STEP_ID),
  __data: z.any(),
  __history: z.string().array(),
});

/* -------------------------------------------------------------------------- */
/*                               WRAPPERS                                     */
/* -------------------------------------------------------------------------- */

/** Hidden Symbol to mark valid gate results and prevent tampering. */
const sGateResult = Symbol("GateResult");

/**
 * @function wrapGateResult
 * @description Wraps gate output into a standard transition signal.
 */
function wrapGateResult(data: any, nextStep: string = TERMINAL_STEP_ID) {
  return { nextStep, data, [sGateResult]: true };
}
wrapGateResult.is = (res: any) => isPureObject(res) && res[sGateResult];

/**
 * @typedef {Function} GateWrapperFn
 * @description Type for the gate execution wrapper function.
 */
type GateWrapperFn = (
  bStep: tsBoxedStepHist | tsBoxedStep,
  ctx: z.RefinementCtx,
) => Promise<tsBoxedStepHist>;

/**
 * @function gateWrapper
 * @description Orchestrates the safe execution of a step's gate function.
 * Handles async execution, exception catching, and issue reporting.
 */
const gateWrapper =
  (toolsFactoryFn: (bStep: tsBoxedStepDefHist) => any): GateWrapperFn =>
  async (bStep: tsBoxedStepHist | tsBoxedStep, ctx: z.RefinementCtx) => {
    const {
      __step,
      __data,
      __def,
      __history = [] as string[],
    } = bStep as tsBoxedStepDefHist;
    const newhist = [...__history, __step];

    const zFn = catchAsyncFn(__def.gate);
    const [err, res] = await zFn(
      __data,
      toolsFactoryFn(bStep as tsBoxedStepDefHist),
    );
    if (err) pushGateIssue(ctx, __data, [...newhist]);

    //checked Result
    const cRes = wrapGateResult.is(res) ? res : wrapGateResult(res);

    return {
      __step: cRes.nextStep,
      __data: cRes.data,
      __history: newhist,
    } as tsBoxedStepHist;
  };

/* -------------------------------------------------------------------------- */
/*                                WF ROUTER                                   */
/* -------------------------------------------------------------------------- */

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

    const parsedWF = schWF.safeParse(def, { reportInput: true });
    if (!parsedWF.success) throw parsedWF.error;

    if (!def[this.init]) {
      throw new Error(`WFRouter: The initial step "${this.init}" is not defined.`);
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
    this.steps.push(schBoxedStep(name, stepDef));
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

    return protectObject({
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
            } as any);
            return { __step: TERMINAL_STEP_ID, __data: val.__data, __history: history };
          }
          return await gateWrapper(this.getTools)(val, ctx);
        })
        .pipe(workflow);

      const terminalModule = teminalStep.transform((v) => v.__data as TOut);

      return z.discriminatedUnion("__step", [businessModule as any, terminalModule as any]);
    });

    return workflow;
  }

  public async run(data: TIn, options?: ParseOptions): Promise<TOut> {
    return this.engine.parseAsync({ __step: this.init, __data: data }, options);
  }
}
