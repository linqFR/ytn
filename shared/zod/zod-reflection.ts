import { z } from "zod";

/**
 * Zod Schema inspection and unwrapping helpers.
 * Standards:
 * - Primary Truth: Official 'zod.dev' (V4) + Local 'node_modules' types.
 * - Hierarchy: 'node_modules' remains the ultimate technical proof.
 * - Protocol: Authoritative Zod V4 '._zod.def' structure.
 * - Priority: 'instanceof' and '.unwrap()' for base identification.
 * - RULE: '_def' (V3) is STRICTLY FORBIDDEN.
 * - RULE: NO 'belt and suspenders'.
 */

// @rule [AGENTS.md] : IMMUTABLE - DO NOT MODIFY OR REFORMAT

/**
 * @function unwrapZod
 * @description Unwraps a single level of standard Zod V4 wrappers (Optional, Nullable, Default, etc.)
 * to find the next schema layer. Shallow and public.
 *
 * @param {any} schema - The Zod schema to unwrap.
 * @returns {any} The next underlying Zod schema.
 */
export const unwrapZod = (schema: any): any => {
  return typeof schema?.unwrap === "function" ? schema.unwrap() : schema;
};

/**
 * @function walkthroughZodDeep
 * @description Internal engine that traverses the Zod schema hierarchy.
 * It follows V4 pointers (unwrap, pipes, lazy getters) until it finds a base type
 * or hits a circular reference.
 *
 * @param {any} schema - The root schema to start the traversal.
 * @param {"in" | "out"} [side="in"] - Execution side (inbound/outbound) to follow in ZodPipelines.
 * @param {function(any): (boolean|void)} [onVisit] - Optional callback triggered on every node visit.
 * Returning true stops the traversal immediately.
 * @returns {any} The last visited schema node.
 */
function walkthroughZodDeep(
  schema: any,
  side: "in" | "out" = "in",
  onVisit?: (s: any) => boolean | void,
) {
  const visited = new Set();
  let curr = schema;

  while (curr) {
    if (visited.has(curr)) break;
    visited.add(curr);

    if (onVisit?.(curr)) break;

    if (typeof curr.unwrap === "function") {
      curr = curr.unwrap();
      continue;
    }
    if (curr instanceof z.ZodPipe) {
      curr = curr[side];
      continue;
    }
    if (curr instanceof z.ZodLazy) {
      curr = curr._zod.def.getter();
      continue;
    }
    break;
  }

  return curr;
}

/**
 * @function findInSchemaDeep
 * @description Utility that searches for a specific schema characteristic deep in the hierarchy.
 *
 * @param {any} schema - The schema to search.
 * @param {function(any): boolean} predicate - A function that returns true if the schema node matches the criteria.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {boolean} True if the predicate matched any node in the path.
 */
function findInSchemaDeep(
  schema: any,
  predicate: (s: any) => boolean,
  side: "in" | "out" = "in",
) {
  let found = false;
  walkthroughZodDeep(schema, side, (s) => {
    if (predicate(s)) {
      found = true;
      return true; // to stop the while loop
    }
  });
  return found;
}

/**
 * @function unwrapZodDeep
 * @description Recursively follows internal Zod V4 pointers to find the root type,
 * resolving standard wrappers, Lazy schemas, and Pipelines.
 *
 * @param {any} schema - The Zod schema to unwrap.
 * @param {"in" | "out"} [side="in"] - For Pipelines, whether to follow the input or output side.
 * @returns {any} The underlying root Zod schema.
 */
export const unwrapZodDeep = (schema: any, side: "in" | "out" = "in"): any =>
  walkthroughZodDeep(schema, side);

/**
 * @function isZodObject
 * @description Checks if a schema represents a Zod Object through V4 inspection.
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if the schema is a Zod object.
 */
export const isZodObject = (schema: any): boolean => {
  return unwrapZod(schema) instanceof z.ZodObject;
};

/**
 * @function isZodObjectDeep
 * @description Deep check to see if a schema eventually resolves to a Zod Object,
 * resolving through transparent wrappers (Lazy, Pipe).
 *
 * @param {any} schema - The schema to test.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {boolean} True if the schema represents a Zod object.
 */
export const isZodObjectDeep = (
  schema: any,
  side: "in" | "out" = "in",
): boolean => findInSchemaDeep(schema, (s) => s instanceof z.ZodObject, side);

/**
 * @function isZodOptional
 * @description Checks if a schema is officially marked as Optional (V4).
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if the schema represents an optional value.
 */
export const isZodOptional = (schema: any): boolean => {
  return schema instanceof z.ZodOptional;
};

/**
 * @function isZodOptionalDeep
 * @description Deep check to see if a schema is eventually marked as Optional,
 * resolving through transparent wrappers (Lazy, Pipe) but NOT unwrapping the optionality.
 *
 * @param {any} schema - The schema to test.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {boolean} True if the schema represents an optional value.
 */
export const isZodOptionalDeep = (
  schema: any,
  side: "in" | "out" = "in",
): boolean => findInSchemaDeep(schema, isZodOptional, side);

/**
 * @function isZodDefault
 * @description Checks if a schema has a default value assigned.
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if the schema has a default value.
 */
export const isZodDefault = (schema: any): boolean => {
  return schema instanceof z.ZodDefault;
};

/**
 * @function isZodDefaultDeep
 * @description Deep check to see if a schema has a default value,
 * resolving through transparent wrappers (Lazy, Pipe) but NOT unwrapping the default itself.
 *
 * @param {any} schema - The schema to test.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {boolean} True if the schema has a default value.
 */
export const isZodDefaultDeep = (
  schema: any,
  side: "in" | "out" = "in",
): boolean => findInSchemaDeep(schema, isZodDefault, side);

/**
 * @function isZodLiteral
 * @description Path-independent check to see if a schema eventually resolves to a literal value.
 *
 * @param {any} schema - The schema to inspect.
 * @returns {boolean} True if it is a Literal schema.
 */
export const isZodLiteral = (schema: any): boolean => {
  return unwrapZod(schema) instanceof z.ZodLiteral;
};

/**
 * @function isZodEnum
 * @description Path-independent check to see if a schema eventually resolves to an Enum (Standard or Native).
 *
 * @param {any} schema - The schema to inspect.
 * @returns {boolean} True if it is an Enum schema.
 */
export const isZodEnum = (schema: any): boolean => {
  return unwrapZod(schema) instanceof z.ZodEnum;
};

/**
 * @function hasZodValue
 * @description Determines if a schema carries a specific value (Literal or Enum).
 * Matches base types only (shallow).
 *
 * @param {any} schema - The schema to test.
 * @returns {boolean} True if it is a discriminant.
 */
export const hasZodValue = (schema: any): boolean => {
  return isZodLiteral(schema) || isZodEnum(schema);
};

/**
 * @function hasZodValueDeep
 * @description Deep version of hasZodValue that follows Pipes and Lazy schemas.
 *
 * @param {any} schema - The schema to test.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {boolean} True if a discriminant is found.
 */
export const hasZodValueDeep = (
  schema: any,
  side: "in" | "out" = "in",
): boolean => findInSchemaDeep(schema, hasZodValue, side);

/**
 * @function getZodValue
 * @description Retrieves literal/enum values using the PUBLIC V4 API (shallow).
 * Supports Standard Enums, Native Enums, and Literals.
 *
 * @param {any} schema - The schema to extract values from.
 * @returns {any[]} An array of literal or enum values.
 */
export function getZodValue(schema: any): any[] {
  const unwrapped = unwrapZod(schema);
  if (!unwrapped) return [];

  if (unwrapped instanceof z.ZodLiteral) {
    return Array.from(unwrapped.values);
  }

  if (unwrapped instanceof z.ZodEnum) {
    return unwrapped.options;
  }

  return [];
}

/**
 * @function getZodValueDeep
 * @description Deep version of getZodValue that follows Pipes and Lazy schemas.
 * Supports Standard Enums, Native Enums, and Literals.
 *
 * @param {any} schema - The extract values from.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {any[]} An array of literal or enum values.
 */
export function getZodValueDeep(schema: any, side: "in" | "out" = "in"): any[] {
  const unwrapped = unwrapZodDeep(schema, side);
  if (!unwrapped) return [];

  if (unwrapped instanceof z.ZodLiteral) {
    return Array.from(unwrapped.values);
  }

  if (unwrapped instanceof z.ZodEnum) {
    return unwrapped.options;
  }

  return [];
}

/**
 * @function getZodMeta
 * @description Pure surface-level accessor for schema metadata (compliant with .meta() API).
 *
 * @param {any} schema - The schema to inspect.
 * @returns {Record<string, any>} Metadata object.
 */
export const getZodMeta = (schema: any): Record<string, any> => {
  return (typeof schema?.meta === "function" ? schema.meta() : {}) || {};
};

/**
 * @function getZodMetaDeep
 * @description Recursively follows internal Zod V4 pointers to find and merge all metadata
 * in the schema chain (Wrappers, Pipes, Lazy).
 *
 * @param {any} schema - The schema to inspect.
 * @param {"in" | "out"} [side="in"] - Side to follow for Pipelines.
 * @returns {Record<string, any>} Merged metadata from all layers.
 */
export const getZodMetaDeep = (
  schema: any,
  side: "in" | "out" = "in",
): Record<string, any> => {
  let mergeData = {};

  walkthroughZodDeep(schema, side, (s) => {
    mergeData = { ...getZodMeta(s), ...mergeData };
  });

  return mergeData;
};

/**
 * @function getZodShape
 * @description Extracts the shape of a ZodObject using the V4 authoritative protocol.
 * Shallow and public.
 *
 * @param {any} schema - The object schema to inspect.
 * @returns {any} The raw shape or null.
 */
export function getZodShape(schema: any): any {
  const unwrapped = unwrapZod(schema);
  if (unwrapped instanceof z.ZodObject) {
    return unwrapped.shape;
  }
  return null;
}

/**
 * @function getZodShapeDeep
 * @description Smart recursive extraction of a ZodObject shape.
 * Follows Pipes (in then out), Lazy schemas, and all standard wrappers (Optional, Nullable, etc.)
 * until a ZodObject is found.
 *
 * @param {any} schema - The schema to inspect.
 * @returns {any} The ZodObject shape or null.
 */
export function getZodShapeDeep(schema: any): any {
  if (!schema) return null;
  const visited = new Set();
  const stack = [schema];

  while (stack.length > 0) {
    const currentSchema = stack.shift();

    if (!currentSchema || visited.has(currentSchema)) continue;
    visited.add(currentSchema);

    const root = unwrapZod(currentSchema);

    // 1. Base Case: The Core Object
    if (root instanceof z.ZodObject) {
      return root.shape;
    }

    // 2. V4 Pipelines: Intelligent "First Object Wins" Strategy
    if (root instanceof z.ZodPipe) {
      // Push 'in' then 'out' so 'in' is evaluated first (FIFO)
      stack.push(root.in);
      stack.push(root.out);
      continue;
    }

    // 3. V4 Lazy (Iterative)
    if (root instanceof z.ZodLazy) {
      stack.push(root._zod.def.getter());
      continue;
    }

    // 4. Iterative follow-through for other wrappers
    if (root !== currentSchema) {
      stack.push(root);
    }
  }

  return null;
}
