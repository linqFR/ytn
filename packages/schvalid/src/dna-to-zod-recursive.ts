/**
 * @deprecated
 * DNA to Zod conversion is deprecated.
 * schvalid now focuses on JSON Schema to DNA conversion only.
 * Use @ytn/dna for schema building with Zod-like syntax.
 */
import { z } from "zod";
import type { tsDna } from "./dna.type.js";

/**
 * @function dnaToZodRecursive
 * @description Converts DNA bytecode back to Zod schema using recursive approach.
 * This is a performance test version to compare against the iterative stack-based version.
 *
 * @param {tsDna} dna - The DNA bytecode (flat array of instructions).
 * @param {number} index - The index of the instruction to process (defaults to last/root).
 * @returns {z.ZodType} The corresponding Zod schema.
 */
export function dnaToZodRecursive(dna: tsDna, index?: number): z.ZodType {
  const instructions = dna as tsDna[];
  const idx = index ?? instructions.length - 1;
  const instruction = instructions[idx];
  const opcode = instruction[0] as string;
  const args = instruction.slice(1);

  // Primitives
  if (opcode === "string") return z.string();
  if (opcode === "number") return z.number();
  if (opcode === "boolean") return z.boolean();
  if (opcode === "bigint") return z.bigint();
  if (opcode === "date") return z.date();
  if (opcode === "null") return z.null();
  if (opcode === "undefined") return z.undefined();
  if (opcode === "any") return z.any();
  if (opcode === "email") return z.string().email();
  if (opcode === "uuid") return z.string().uuid();
  if (opcode === "url") return z.string().url();
  if (opcode === "literal") return z.literal(args[0]);
  if (opcode === "enum") return z.enum(args[0]);

  // Wrappers
  if (opcode === "optional") {
    const innerIndex = args[0][0] as number;
    return dnaToZodRecursive(dna, innerIndex).optional();
  }
  if (opcode === "nullable") {
    const innerIndex = args[0][0] as number;
    return dnaToZodRecursive(dna, innerIndex).nullable();
  }
  if (opcode === "default") {
    const innerIndex = args[0][0] as number;
    const defaultValue = args[1];
    return dnaToZodRecursive(dna, innerIndex).default(defaultValue);
  }

  // Containers
  if (opcode === "array") {
    const itemIndices = args[0] as number[];
    if (itemIndices.length === 0) return z.array(z.any());
    const itemSchema = dnaToZodRecursive(dna, itemIndices[0]);
    return z.array(itemSchema);
  }

  if (opcode === "tuple") {
    const itemIndices = args[0] as number[];
    const itemSchemas = itemIndices.map((i) => dnaToZodRecursive(dna, i));
    return z.tuple(itemSchemas as any);
  }

  // Objects
  if (opcode === "strictObject") {
    const propIndices = args[0] as number[];
    const shape: Record<string, z.ZodType> = {};
    for (const propIdx of propIndices) {
      const propInstruction = instructions[propIdx];
      const key = propInstruction[1] as string;
      const valueIdx = (propInstruction[2] as number[])[0];
      shape[key] = dnaToZodRecursive(dna, valueIdx);
    }
    return z.object(shape).strict();
  }

  if (opcode === "looseObject") {
    const propIndices = args[0] as number[];
    const shape: Record<string, z.ZodType> = {};
    for (const propIdx of propIndices) {
      const propInstruction = instructions[propIdx];
      const key = propInstruction[1] as string;
      const valueIdx = (propInstruction[2] as number[])[0];
      shape[key] = dnaToZodRecursive(dna, valueIdx);
    }
    return z.object(shape).passthrough();
  }

  if (opcode === "object") {
    const propIndices = args[0] as number[];
    const shape: Record<string, z.ZodType> = {};
    for (const propIdx of propIndices) {
      const propInstruction = instructions[propIdx];
      const key = propInstruction[1] as string;
      const valueIdx = (propInstruction[2] as number[])[0];
      shape[key] = dnaToZodRecursive(dna, valueIdx);
    }
    return z.object(shape);
  }

  // Sequences
  if (opcode === "seq") {
    const constraintIndices = args[0] as number[];
    // First index is the base type
    const baseSchema = dnaToZodRecursive(dna, constraintIndices[0]);
    
    // Apply constraints
    let currentSchema = baseSchema;
    for (let i = 1; i < constraintIndices.length; i++) {
      const constraintIdx = constraintIndices[i];
      const constraintInstruction = instructions[constraintIdx];
      const constraintOpcode = constraintInstruction[0] as string;
      const constraintArgs = constraintInstruction.slice(1);

      // String constraints
      if (constraintOpcode === "minLength") {
        currentSchema = (currentSchema as z.ZodString).min(constraintArgs[0]);
      } else if (constraintOpcode === "maxLength") {
        currentSchema = (currentSchema as z.ZodString).max(constraintArgs[0]);
      } else if (constraintOpcode === "eqLength") {
        currentSchema = (currentSchema as z.ZodString).length(constraintArgs[0]);
      } else if (constraintOpcode === "pattern") {
        currentSchema = (currentSchema as z.ZodString).regex(new RegExp(constraintArgs[0]));
      }
      // Number constraints
      else if (constraintOpcode === "minimum") {
        currentSchema = (currentSchema as z.ZodNumber).min(constraintArgs[0]);
      } else if (constraintOpcode === "maximum") {
        currentSchema = (currentSchema as z.ZodNumber).max(constraintArgs[0]);
      } else if (constraintOpcode === "exclusiveMinimum") {
        currentSchema = (currentSchema as z.ZodNumber).gt(constraintArgs[0]);
      } else if (constraintOpcode === "exclusiveMaximum") {
        currentSchema = (currentSchema as z.ZodNumber).lt(constraintArgs[0]);
      } else if (constraintOpcode === "multipleOf") {
        currentSchema = (currentSchema as z.ZodNumber).multipleOf(constraintArgs[0]);
      } else if (constraintOpcode === "integer") {
        currentSchema = (currentSchema as z.ZodNumber).int();
      }
    }
    return currentSchema;
  }

  if (opcode === "additionalProperties") {
    const target = args[0] as [number];
    const innerSchema = dnaToZodRecursive(dna, target[0]);
    if (target[0] === -2) {
      return innerSchema.strict();
    } else if (target[0] === -1) {
      return innerSchema.passthrough();
    } else {
      return innerSchema.catchall(innerSchema);
    }
  }

  throw new Error(`Unknown opcode: ${opcode}`);
}
