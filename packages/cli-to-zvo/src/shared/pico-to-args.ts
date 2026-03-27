import { type tsPico, picoTypetoZod } from "../pico-zod/index.js";

/**
 * @function contrat_types_to_args_types
 * @description Determines the CLI argument type (string or boolean) from a Pico type.
 * This is the single source of truth for mapping Zod/DSL schemas to node:util parseArgs types.
 *
 * @param {Pico} type - The Pico definition (DSL string or Sealed schema).
 * @param {boolean} [isFlag=false] - Whether the argument is used as a flag.
 * @returns {"string" | "boolean"} - The type compatible with node:util parseArgs.
 */
export const contrat_type_to_arg_type = (
  type: tsPico,
  isFlag: boolean = false,
): "string" | "boolean" => {
  // 1. If it's not a flag (then it is a positional), node:util.parseArgs always treats it as a string.
  if (!isFlag) {
    return "string";
  }

  // 2. If it's a flag, we use an empirical test to distinguish between:
  // - A "boolean" flag (switch): only accepts true/false.
  // - A "string" flag (valued option): accepts arbitrary non-boolean data.
  const schema = picoTypetoZod(type);

  // OnlyBools is expected to be:
  // pico.bool = false
  // pico.stringbool = false
  // pico.string = false
  // pico.number = false
  // pico.boolean = true
  //

  const acceptsOnlyBools =
    schema.safeParse(true).success &&
    schema.safeParse(false).success &&
    !schema.safeParse("true").success &&
    !schema.safeParse("abc").success &&
    !schema.safeParse("123").success &&
    !schema.safeParse("0").success;

  return acceptsOnlyBools ? "boolean" : "string";
};
