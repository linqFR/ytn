import { z } from "zod";
import { unwrapZodDeep } from "@ytn/shared/zod/zod-reflection.js";
import { protectObject } from "@ytn/shared/js/guarded_object.js";
import type { tsGateResult } from "./gate.types.js";
import type { tsWFSendTools, tsWFTools, tsWFToolSendFn } from "./tools.type.js";

/**
 * @type tsNodeSignature
 * @description Serialized signature of a node for discovery.
 */
export type tsNodeSignature = {
  id: string;
  description: string;
  input: object;
  outputs: Record<string, object>;
};

/**
 * @type tsNodeOutputSchema
 * @description Zod V4 compliant internal type for a signal's Zod schema.
 */
type tsNodeOutputSchema = z.ZodObject<
  {
    nextStep: z.ZodLiteral<string>;
    data: z.ZodType;
  },
  z.core.$strict
>;

/**
 * @type tsGateFn
 * @description Type for the gate implementation function.
 */
type tsGateFn<
  I,
  O extends Record<string, z.ZodType> = Record<string, z.ZodType>,
> = (data: z.infer<I>, tools: $GateTools<O>) => tsGateResult;

/**
 * @type $GateTools
 * @description Type modifier to generate the strongly typed tools object from outputs.
 */
export type $GateTools<O extends Record<string, z.ZodType>> = {
  issues: z.core.$ZodIssue[];
  send: tsWFSendTools & {
    [K in keyof O & string as Lowercase<K>]: tsWFToolSendFn<z.input<O[K]>>;
  } & {
    end: tsWFToolSendFn;
  };
};

/**
 * @interface INodeDef
 * @description Contract for a workflow node definition.
 */
export interface INodeDef<
  I extends z.ZodType = z.ZodType,
  O extends Record<string, z.ZodType> = Record<string, z.ZodType>,
> {
  id: string;
  desc: string;
  input: I;
  outputs: O;
  /** Gate logic: can be sync or async. Receives validated data and injected tools. */
  gate: tsGateFn<I, O>;
}

/**
 * @function uDefineNode
 * @description Factory for creating a workflow node.
 */
export function uDefineNode<
  I extends z.ZodType,
  O extends Record<string, z.ZodType>,
>(node: INodeDef<I, O>) {
  // 1. Serialization metadata (Reflection)
  const outputSchemas: Record<string, z.ZodType> = {};
  for (const k in node.outputs) {
    outputSchemas[k] = unwrapZodDeep(node.outputs[k], "out");
  }

  // 2. Output signals union
  const schOutputs: [tsNodeOutputSchema, ...tsNodeOutputSchema[]] = [
    z.strictObject({
      nextStep: z.literal("end"),
      data: z.unknown(),
    }),
  ];

  for (const k in node.outputs) {
    const sch = node.outputs[k];
    schOutputs.push(
      z.strictObject({
        nextStep: z.literal(k),
        data: sch,
      }),
    );
  }

  const nodeFn = z.function({
    input: [
      node.input,
      z.strictObject({
        issues: z.any().array(),
        send: z.record(z.string(), z.custom<tsWFToolSendFn>()),
      }) as unknown as z.ZodType<$GateTools<O>>,
    ],
    output: z.union([z.void(), z.discriminatedUnion("nextStep", schOutputs)]),
  });

  const runtimeNode = {
    id: node.id,
    description: node.desc,
    inputSchema: node.input,
    outputSchemas,
    /** Original implementation for high-performance runtime */
    gate: node.gate,
    /** Zod-validated implementation for development/debug mode. */
    gatedev: nodeFn.implementAsync(node.gate),
    /** 
     * Signature JSON calculée à la demande.
     * Évite de ralentir le boot si la node n'est jamais inspectée (Lazy).
     */
    get signature(): tsNodeSignature {
      return {
        id: node.id,
        description: node.desc,
        input: node.input.toJSONSchema(),
        outputs: Object.fromEntries(
          Object.entries(outputSchemas).map(([k, v]) => [k, (v as any).toJSONSchema()]),
        ),
      };
    },
  };

  const protectedNode = protectObject(runtimeNode);
  return protectedNode;
}
