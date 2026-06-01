/**
 * @deprecated
 * DNA to Zod conversion is deprecated.
 * schvalid now focuses on JSON Schema to DNA conversion only.
 * Use @ytn/dna for schema building with Zod-like syntax.
 */
import { z } from "zod";
import type { tsDna } from "./dna.type.js";

/**
 * @function dnaToZod
 * @description Converts DNA bytecode representation back to a Zod schema using iterative approach.
 * Handles flat indexed DNA format.
 *
 * @param {tsDna} dna - The DNA bytecode to convert (flat array of instructions).
 * @returns {z.ZodType} The corresponding Zod schema.
 */
export function dnaToZod(dna: tsDna): z.ZodType {
  // DNA is a flat array of instructions
  const instructions = dna as tsDna[];

  // Cache to avoid re-converting the same instruction indices
  const cache = new Map<number, z.ZodType>();

  // Stack for iterative processing
  type StackItem = {
    index: number;
    onResult: (result: z.ZodType) => void;
  };

  const stack: StackItem[] = [];
  let finalResult: z.ZodType | null = null;

  // Start from the last instruction (the root)
  const rootIndex = instructions.length - 1;
  stack.push({
    index: rootIndex,
    onResult: (result) => {
      finalResult = result;
    },
  });

  while (stack.length > 0) {
    const item = stack.pop()!;

    // Check cache
    if (cache.has(item.index)) {
      item.onResult(cache.get(item.index)!);
      continue;
    }

    const instruction = instructions[item.index];
    const opcode = instruction[0] as string;
    const args = instruction.slice(1);

    // Primitives
    if (opcode === "string") {
      const result = z.string();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "number") {
      const result = z.number();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "boolean") {
      const result = z.boolean();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "bigint") {
      const result = z.bigint();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "date") {
      const result = z.date();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "null") {
      const result = z.null();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "undefined") {
      const result = z.undefined();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "any") {
      const result = z.any();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "email") {
      const result = z.string().email();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "uuid") {
      const result = z.string().uuid();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "url") {
      const result = z.string().url();
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "literal") {
      const result = z.literal(args[0]);
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }
    if (opcode === "enum") {
      const result = z.enum(args[0]);
      cache.set(item.index, result);
      item.onResult(result);
      continue;
    }

    // Wrappers
    if (opcode === "optional") {
      const innerIndex = args[0][0] as number;
      stack.push({
        index: innerIndex,
        onResult: (childResult) => {
          const result = childResult.optional();
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }
    if (opcode === "nullable") {
      const innerIndex = args[0][0] as number;
      stack.push({
        index: innerIndex,
        onResult: (childResult) => {
          const result = childResult.nullable();
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }
    if (opcode === "default") {
      const innerIndex = args[0][0] as number;
      const defaultValue = args[1];
      stack.push({
        index: innerIndex,
        onResult: (childResult) => {
          const result = childResult.default(defaultValue);
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }

    // Containers
    if (opcode === "array") {
      const itemIndices = args[0] as number[];
      if (itemIndices.length === 0) {
        const result = z.array(z.any());
        cache.set(item.index, result);
        item.onResult(result);
        continue;
      }
      const itemIndex = itemIndices[0];
      stack.push({
        index: itemIndex,
        onResult: (childResult) => {
          const result = z.array(childResult);
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }

    // Object
    if (opcode === "object" || opcode === "strictObject" || opcode === "looseObject") {
      const propIndices = args[0] as number[];
      const shape: Record<string, z.ZodType> = {};
      let remaining = propIndices.length;

      if (remaining === 0) {
        let result: z.ZodObject<any>;
        if (opcode === "strictObject") {
          result = z.object({}).strict();
        } else if (opcode === "looseObject") {
          result = z.object({}).passthrough();
        } else {
          result = z.object({});
        }
        cache.set(item.index, result);
        item.onResult(result);
        continue;
      }

      propIndices.forEach((propIndex) => {
        stack.push({
          index: propIndex,
          onResult: (childResult) => {
            const propInstruction = instructions[propIndex];
            const propOpcode = propInstruction[0];
            if (propOpcode === "proptype") {
              const key = propInstruction[1];
              shape[key] = childResult;
            }
            remaining--;
            if (remaining === 0) {
              let result: z.ZodObject<any>;
              if (opcode === "strictObject") {
                result = z.object(shape).strict();
              } else if (opcode === "looseObject") {
                result = z.object(shape).passthrough();
              } else {
                result = z.object(shape);
              }
              cache.set(item.index, result);
              item.onResult(result);
            }
          },
        });
      });
      continue;
    }

    // Property type
    if (opcode === "proptype") {
      const key = args[0];
      const innerIndices = args[1] as number[];
      const innerIndex = innerIndices[0];
      stack.push({
        index: innerIndex,
        onResult: (childResult) => {
          cache.set(item.index, childResult);
          item.onResult(childResult);
        },
      });
      continue;
    }

    // Sequence (seq) - applies multiple operations in sequence
    if (opcode === "seq") {
      const indices = args[0] as number[];
      let remaining = indices.length;

      if (remaining === 0) {
        const result = z.any();
        cache.set(item.index, result);
        item.onResult(result);
        continue;
      }

      // Process first instruction to get base schema
      stack.push({
        index: indices[0],
        onResult: (baseResult) => {
          let currentSchema = baseResult;
          let processedCount = 1;

          // Process remaining instructions as constraints/modifiers
          for (let i = 1; i < indices.length; i++) {
            const constraintIndex = indices[i];
            const constraintInstruction = instructions[constraintIndex];
            const constraintOpcode = constraintInstruction[0];
            const constraintArgs = constraintInstruction.slice(1);

            // Apply constraint directly to current schema
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
            } else {
              // Non-constraint instruction - need to convert it
              stack.push({
                index: constraintIndex,
                onResult: (childResult) => {
                  currentSchema = childResult;
                  processedCount++;
                  if (processedCount === indices.length) {
                    cache.set(item.index, currentSchema);
                    item.onResult(currentSchema);
                  }
                },
              });
              continue; // Skip the final result setting below
            }
            processedCount++;
          }

          if (processedCount === indices.length) {
            cache.set(item.index, currentSchema);
            item.onResult(currentSchema);
          }
        },
      });
      continue;
    }

    // Applicators
    if (opcode === "anyOf") {
      const indices = args[0] as number[];
      const zodSchemas: z.ZodType[] = [];
      let remaining = indices.length;

      indices.forEach((schemaIndex, idx) => {
        stack.push({
          index: schemaIndex,
          onResult: (childResult) => {
            zodSchemas[idx] = childResult;
            remaining--;
            if (remaining === 0) {
              const result = z.union(zodSchemas as [z.ZodType, ...z.ZodType[]]);
              cache.set(item.index, result);
              item.onResult(result);
            }
          },
        });
      });
      continue;
    }

    if (opcode === "allOf") {
      const indices = args[0] as number[];
      const zodSchemas: z.ZodType[] = [];
      let remaining = indices.length;

      indices.forEach((schemaIndex, idx) => {
        stack.push({
          index: schemaIndex,
          onResult: (childResult) => {
            zodSchemas[idx] = childResult;
            remaining--;
            if (remaining === 0) {
              const result = z.and(zodSchemas[0], zodSchemas[1]);
              cache.set(item.index, result);
              item.onResult(result);
            }
          },
        });
      });
      continue;
    }

    if (opcode === "oneOf") {
      const indices = args[0] as number[];
      const zodSchemas: z.ZodType[] = [];
      let remaining = indices.length;

      indices.forEach((schemaIndex, idx) => {
        stack.push({
          index: schemaIndex,
          onResult: (childResult) => {
            zodSchemas[idx] = childResult;
            remaining--;
            if (remaining === 0) {
              const result = z.discriminatedUnion("type", zodSchemas as any);
              cache.set(item.index, result);
              item.onResult(result);
            }
          },
        });
      });
      continue;
    }

    if (opcode === "not") {
      const innerIndex = args[0];
      stack.push({
        index: innerIndex,
        onResult: (childResult) => {
          const result = childResult.refine(() => false, { message: "Should not match" });
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }

    if (opcode === "additionalProperties") {
      const target = args[0] as [number];
      const allowedKeys = args[1] as string[];
      
      stack.push({
        index: target[0],
        onResult: (childResult) => {
          // For strict mode (target -2), use .strict()
          // For allow mode (target -1), use .passthrough()
          // Otherwise use .catchall()
          let result: z.ZodType;
          if (target[0] === -2) {
            result = childResult.strict();
          } else if (target[0] === -1) {
            result = childResult.passthrough();
          } else {
            result = childResult.catchall(childResult);
          }
          cache.set(item.index, result);
          item.onResult(result);
        },
      });
      continue;
    }

    // Throw error for unsupported opcodes
    throw new Error(`Unsupported DNA opcode: ${opcode}`);
  }

  return finalResult!;
}
