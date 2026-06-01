/**
 * @deprecated
 * DNA to Zod conversion is deprecated.
 * schvalid now focuses on JSON Schema to DNA conversion only.
 * Use @ytn/dna for schema building with Zod-like syntax.
 */
import { z } from "zod";
import type { tsDna } from "./dna.type.js";

/**
 * @function dnaToZodIterative
 * @description Converts DNA bytecode back to Zod schema using true iterative stack approach.
 * This version uses a simple stack without closures for better performance.
 *
 * @param {tsDna} dna - The DNA bytecode (flat array of instructions).
 * @returns {z.ZodType} The corresponding Zod schema.
 */
export function dnaToZodIterative(dna: tsDna): z.ZodType {
  const instructions = dna as tsDna[];
  const cache = new Map<number, z.ZodType>();
  
  // Parent registry: child index -> set of parent indices waiting for it
  const parentRegistry = new Map<number, Set<number>>();
  // Child ready set: which children have been processed
  const childReady = new Set<number>();

  // Stack frame: [index]
  const stack: number[] = [];

  // Helper to register a parent waiting for a child
  const registerDep = (parent: number, child: number) => {
    if (!parentRegistry.has(child)) {
      parentRegistry.set(child, new Set());
    }
    parentRegistry.get(child)!.add(parent);
  };

  // Helper to mark child as ready in registry
  const markChildReady = (child: number) => {
    childReady.add(child);
    // Re-queue all parents waiting for this child
    const parents = parentRegistry.get(child);
    if (parents) {
      for (const parent of parents) {
        stack.push(parent);
      }
    }
  };

  // Helper to check if parent's dependencies are ready
  const areDepsReady = (depIndices: number[]): boolean => {
    return depIndices.every((i) => childReady.has(i));
  };

  // Start from the last instruction (the root)
  stack.push(instructions.length - 1);

  while (stack.length > 0) {
    const index = stack.pop()!;

    // If already cached, skip
    if (cache.has(index)) {
      continue;
    }

    const instruction = instructions[index];
    const opcode = instruction[0] as string;
    const args = instruction.slice(1);

    // Primitives - can be resolved immediately
    if (opcode === "string") {
      cache.set(index, z.string());
      markChildReady(index);
      continue;
    }
    if (opcode === "number") {
      cache.set(index, z.number());
      markChildReady(index);
      continue;
    }
    if (opcode === "boolean") {
      cache.set(index, z.boolean());
      markChildReady(index);
      continue;
    }
    if (opcode === "bigint") {
      cache.set(index, z.bigint());
      markChildReady(index);
      continue;
    }
    if (opcode === "date") {
      cache.set(index, z.date());
      markChildReady(index);
      continue;
    }
    if (opcode === "null") {
      cache.set(index, z.null());
      markChildReady(index);
      continue;
    }
    if (opcode === "undefined") {
      cache.set(index, z.undefined());
      markChildReady(index);
      continue;
    }
    if (opcode === "any") {
      cache.set(index, z.any());
      markChildReady(index);
      continue;
    }
    if (opcode === "email") {
      cache.set(index, z.string().email());
      markChildReady(index);
      continue;
    }
    if (opcode === "uuid") {
      cache.set(index, z.string().uuid());
      markChildReady(index);
      continue;
    }
    if (opcode === "url") {
      cache.set(index, z.string().url());
      markChildReady(index);
      continue;
    }
    if (opcode === "literal") {
      cache.set(index, z.literal(args[0]));
      markChildReady(index);
      continue;
    }
    if (opcode === "enum") {
      cache.set(index, z.enum(args[0]));
      markChildReady(index);
      continue;
    }

    // Constraints - cache the value for seq
    if (
      opcode === "minLength" ||
      opcode === "maxLength" ||
      opcode === "eqLength" ||
      opcode === "pattern" ||
      opcode === "minimum" ||
      opcode === "maximum" ||
      opcode === "exclusiveMinimum" ||
      opcode === "exclusiveMaximum" ||
      opcode === "multipleOf" ||
      opcode === "integer"
    ) {
      cache.set(index, instruction);
      markChildReady(index);
      continue;
    }

    // Wrappers - need child first
    if (opcode === "optional") {
      const innerIndex = args[0][0] as number;
      registerDep(index, innerIndex);
      if (childReady.has(innerIndex)) {
        cache.set(index, cache.get(innerIndex)!.optional());
        markChildReady(index);
      } else {
        stack.push(innerIndex);
      }
      continue;
    }
    if (opcode === "nullable") {
      const innerIndex = args[0][0] as number;
      registerDep(index, innerIndex);
      if (childReady.has(innerIndex)) {
        cache.set(index, cache.get(innerIndex)!.nullable());
        markChildReady(index);
      } else {
        stack.push(innerIndex);
      }
      continue;
    }
    if (opcode === "default") {
      const innerIndex = args[0][0] as number;
      const defaultValue = args[1];
      registerDep(index, innerIndex);
      if (childReady.has(innerIndex)) {
        cache.set(index, cache.get(innerIndex)!.default(defaultValue));
        markChildReady(index);
      } else {
        stack.push(innerIndex);
      }
      continue;
    }

    // Containers
    if (opcode === "array") {
      const itemIndices = args[0] as number[];
      if (itemIndices.length === 0) {
        cache.set(index, z.array(z.any()));
        markChildReady(index);
        continue;
      }
      const itemIndex = itemIndices[0];
      registerDep(index, itemIndex);
      if (childReady.has(itemIndex)) {
        cache.set(index, z.array(cache.get(itemIndex)!));
        markChildReady(index);
      } else {
        stack.push(itemIndex);
      }
      continue;
    }

    if (opcode === "tuple") {
      const itemIndices = args[0] as number[];
      for (const itemIdx of itemIndices) {
        registerDep(index, itemIdx);
      }
      if (areDepsReady(itemIndices)) {
        const itemSchemas = itemIndices.map((idx) => cache.get(idx)!);
        cache.set(index, z.tuple(itemSchemas as any));
        markChildReady(index);
      } else {
        for (const itemIdx of itemIndices) {
          if (!childReady.has(itemIdx)) {
            stack.push(itemIdx);
          }
        }
      }
      continue;
    }

    // Objects
    if (opcode === "strictObject" || opcode === "looseObject" || opcode === "object") {
      const propIndices = args[0] as number[];
      const valueIndices: number[] = [];
      for (const propIdx of propIndices) {
        const propInstruction = instructions[propIdx];
        const valueIdx = (propInstruction[2] as number[])[0];
        valueIndices.push(valueIdx);
        registerDep(index, valueIdx);
      }
      if (areDepsReady(valueIndices)) {
        const shape: Record<string, z.ZodType> = {};
        for (let i = 0; i < propIndices.length; i++) {
          const propIdx = propIndices[i];
          const propInstruction = instructions[propIdx];
          const key = propInstruction[1] as string;
          const valueIdx = valueIndices[i];
          shape[key] = cache.get(valueIdx)!;
        }
        if (opcode === "strictObject") {
          cache.set(index, z.object(shape).strict());
        } else if (opcode === "looseObject") {
          cache.set(index, z.object(shape).passthrough());
        } else {
          cache.set(index, z.object(shape));
        }
        markChildReady(index);
      } else {
        for (const valueIdx of valueIndices) {
          if (!childReady.has(valueIdx)) {
            stack.push(valueIdx);
          }
        }
      }
      continue;
    }

    // Sequences
    if (opcode === "seq") {
      const constraintIndices = args[0] as number[];
      for (const constraintIdx of constraintIndices) {
        registerDep(index, constraintIdx);
      }
      if (areDepsReady(constraintIndices)) {
        const baseSchema = cache.get(constraintIndices[0])!;
        let currentSchema = baseSchema;
        for (let j = 1; j < constraintIndices.length; j++) {
          const constraintIdx = constraintIndices[j];
          const constraintInstruction = instructions[constraintIdx];
          const constraintOpcode = constraintInstruction[0] as string;
          const constraintArgs = constraintInstruction.slice(1);

          if (constraintOpcode === "minLength") {
            currentSchema = (currentSchema as z.ZodString).min(constraintArgs[0]);
          } else if (constraintOpcode === "maxLength") {
            currentSchema = (currentSchema as z.ZodString).max(constraintArgs[0]);
          } else if (constraintOpcode === "eqLength") {
            currentSchema = (currentSchema as z.ZodString).length(constraintArgs[0]);
          } else if (constraintOpcode === "pattern") {
            currentSchema = (currentSchema as z.ZodString).regex(new RegExp(constraintArgs[0]));
          } else if (constraintOpcode === "minimum") {
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
        cache.set(index, currentSchema);
        markChildReady(index);
      } else {
        for (const constraintIdx of constraintIndices) {
          if (!childReady.has(constraintIdx)) {
            stack.push(constraintIdx);
          }
        }
      }
      continue;
    }

    if (opcode === "proptype") {
      const valueIdx = args[1][0] as number;
      registerDep(index, valueIdx);
      if (childReady.has(valueIdx)) {
        cache.set(index, cache.get(valueIdx)!);
        markChildReady(index);
      } else {
        stack.push(valueIdx);
      }
      continue;
    }

    if (opcode === "additionalProperties") {
      const target = args[0] as [number];
      registerDep(index, target[0]);
      if (childReady.has(target[0])) {
        const innerSchema = cache.get(target[0])!;
        let result: z.ZodType;
        if (target[0] === -2) {
          result = innerSchema.strict();
        } else if (target[0] === -1) {
          result = innerSchema.passthrough();
        } else {
          result = innerSchema.catchall(innerSchema);
        }
        cache.set(index, result);
        markChildReady(index);
      } else {
        stack.push(target[0]);
      }
      continue;
    }

    throw new Error(`Unknown opcode: ${opcode}`);
  }

  return cache.get(instructions.length - 1)!;
}
