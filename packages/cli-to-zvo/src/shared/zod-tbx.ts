import { z } from "zod";

/**
 * Zod v4 Parameter Types
 */
/** @type {tsZodTupleItems} Parameter types for Zod tuple items. */
export type tsZodTupleItems = Parameters<typeof z.tuple>[0];
/** @type {tsZodUnionOptions} Parameter types for Zod union options. */
export type tsZodUnionOptions = Parameters<typeof z.union>[0];
/** @type {tsZodMetadata} Metadata structure for Zod schemas. */
export type tsZodMetadata = Parameters<z.ZodType["meta"]>[0];

export const SnakeCaseSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_]+$/, "Must be snake_case (no spaces or hyphens)")
  .brand<"tsSnakeCase">();

/**
 * @type tsSnakeCase
 * @description Branded string type for validated snake_case keys.
 */
export type tsSnakeCase = z.infer<typeof SnakeCaseSchema>;

export const KebabCaseSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Must be kebab-case (lowercase and hyphens)",
  )
  .brand<"tsKebabCase">();

/**
 * @type tsKebabCase
 * @description Branded string type for validated kebab-case keys.
 */
export type tsKebabCase = z.infer<typeof KebabCaseSchema>;

export const CamelCaseSchema = z
  .string()
  .regex(
    /^[a-z][a-zA-Z0-9]*$/,
    "Must be camelCase (starts with lowercase, alphanumeric only)",
  )
  .brand<"tsCamelCase">();

/**
 * @type tsCamelCase
 * @description Branded string type for validated camelCase keys.
 */
export type tsCamelCase = z.infer<typeof CamelCaseSchema>;

/**
 * @function kebabToCamel
 * @description Transforms a kebab-case string to camelCase.
 * @param {string} str - The kebab-case string to transform.
 * @returns {tsCamelCase} The transformed camelCase string.
 */
export const kebabToCamel = <T extends tsCamelCase>(str: string): T => {
  return str.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase()) as T;
};

/** @constant {z.ZodArray} StringArraySchema - Simple string array schema. */
export const StringArraySchema = z.string().array();

/** @type tsStringArray - Array of strings (type-only alias for clarity). */
export type tsStringArray = string[];

/**
 * @function repiped
 * @description Re-pipes a schema into a new one while preserved existing metadata.
 * @param {z.ZodType} oldSchema - The schema to copy metadata from.
 * @param {z.ZodType} targetSchema - The new schema to pipe into.
 * @returns {z.ZodPipe} A new Zod pipe with combined logic and preserved metadata.
 */
export const repiped = (oldSchema: z.ZodType, targetSchema: z.ZodType) => {
  return oldSchema.pipe(targetSchema.meta(oldSchema.meta() as tsZodMetadata));
};

/**
 * @function isZodObject
 * @description Checks if a schema represents a Zod Object, identifying it through
 * the internal V4 `_zod` property.
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if the schema is a Zod object.
 */
export const isZodObject = (schema: any): boolean => {
  return unwrapZod(schema)?._zod?.def?.type === "object";
};

/**
 * @function unwrapZod
 * @description Recursively follows internal Zod V4 pointers to find the root
 * type definition (e.g., through .optional(), .nullable(), or Pipes).
 *
 * @param {any} schema - The Zod schema to unwrap.
 * @returns {any} The underlying root Zod schema.
 */
export const unwrapZod = (schema: any): any => {
  const internals = schema?._zod;
  if (!internals) return schema;
  const type = internals.def?.type;

  // These wrappers have a direct innerType in V4
  if (
    [
      "optional",
      "nullable",
      "default",
      "readonly",
      "nonoptional",
      "catch",
      "success",
      "promise",
    ].includes(type)
  ) {
    return unwrapZod(internals.def.innerType);
  }

  // Lazy resolution
  if (type === "lazy") {
    return unwrapZod(internals.innerType || internals.def.getter());
  }

  // Pipe resolution (usually we want the input for CLI-to-ZVO)
  if (type === "pipe") {
    return unwrapZod(internals.def.in);
  }

  return schema;
};

/**
 * @function isZodOptional
 * @description Checks if a schema is officially marked as Optional in the V4 internal def.
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if the schema represents an optional value.
 */
export const isZodOptional = (schema: any): boolean => {
  return schema?._zod?.def?.type === "optional";
};

/**
 * @function isZodLiteral
 * @description Path-independent check to see if a schema eventually resolves to a literal value.
 *
 * @param {any} schema - The schema to inspect.
 * @returns {boolean} True if it is a Literal schema.
 */
export const isZodLiteral = (schema: any): boolean => {
  return unwrapZod(schema)?._zod?.def?.type === "literal";
};

/**
 * @function isZodEnum
 * @description Path-independent check to see if a schema eventually resolves to an Enum.
 *
 * @param {any} schema - The schema to inspect.
 * @returns {boolean} True if it is an Enum schema.
 */
export const isZodEnum = (schema: any): boolean => {
  return unwrapZod(schema)?._zod?.def?.type === "enum";
};

/**
 * @function hasZodValue
 * @description Determines if a schema carries a specific value (Literal or Enum)
 * that must contribute to the routing bitmask.
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if and only if the schema is a routing discriminant.
 */
export const hasZodValue = (schema: any): boolean => {
  return isZodLiteral(schema) || isZodEnum(schema);
};

/**
 * @function getZodValue
 * @description Retrieves literal/enum values using V4 bubbled values.
 * Maps null/undefined to "" for compatibility with routing signatures.
 */
export function getZodValue(schema: any): string[] {
  const values = schema?._zod?.values;
  if (values instanceof Set) {
    return Array.from(values).map((v) =>
      v === null || v === undefined ? "" : String(v),
    );
  }

  // Fallback to manual unwrap if values didn't bubble (e.g. custom types)
  const unwrapped = unwrapZod(schema);
  const type = unwrapped?._zod?.def?.type;
  if (type === "literal") return unwrapped._zod.def.values.map(String);
  if (type === "enum")
    return Object.values(unwrapped._zod.def.entries).map(String);

  return [""];
}

/**
 * @function allCombinations
 * @description Generates the Cartesian Product of multiple arrays.
 * It takes one element from each array and combines them into all possible tuples.
 *
 * @example
 * // Input: [['a', 'b'], ['1', '2']]
 * // Output: [['a', '1'], ['a', '2'], ['b', '1'], ['b', '2']]
 *
 * @remarks
 * This function is used during the contract compilation phase to generate all possible
 * routing signatures for a Target. If a Target has fields with enumerations
 * (e.g., --env=[prod, dev]), this function creates one signature per possible value
 * so the `bitRouter` can perform O(1) resolution at runtime.
 *
 * @param {...T[][]} arrays - Sets of values to combine.
 * @returns {T[][]} Every possible combination of elements.
 */
export const allCombinations = <T>(...arrays: T[][]): T[][] => {
  return arrays.reduce(
    (acc, curr) => acc.flatMap((combo) => curr.map((val) => [...combo, val])),
    [[]] as T[][],
  );
};
