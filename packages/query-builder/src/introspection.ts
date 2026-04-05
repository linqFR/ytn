import { z } from "zod";
import { getZodMeta, getZodMetaDeep, getZodShapeDeep, unwrapZod, unwrapZodDeep } from "@shared/zod/zod-reflection.js";

/**
 * @class Introspector
 * @description Zod Introspection Engine for the Query Builder.
 */
export class Introspector {
  /**
   * @function getSchemaShape
   * @description Finds the inner ZodObject shape by using the authoritative shared Deep extraction.
   *
   * @param {z.ZodType} schema - The Zod schema to inspect.
   * @returns {Record<string, z.ZodType> | null} The shape of the Zod object (Classic).
   */
  public static getSchemaShape(
    schema: any,
  ): Record<string, z.ZodType> | null {
    return getZodShapeDeep(schema);
  }

  /**
   * @function getPrimaryKey
   * @description Detects the Primary Key for a given schema shape by inspecting metadata and standard conventions.
   *
   * @param {z.core.$ZodShape} shape - The shape of the ZodObject.
   * @returns {string | null} The key name of the primary key.
   */
  public static getPrimaryKey(shape: Record<string, z.ZodType>): string | null {
    for (const [key, schemaItem] of Object.entries(shape)) {
      const meta = Introspector.getColumnMeta(schemaItem);
      if (meta.pk || meta.pkauto) return key;
    }

    const keys = Object.keys(shape);
    if (keys.includes("id")) return "id";
    if (keys.includes("uuid")) return "uuid";
    return null;
  }

  /**
   * @function getColumnMeta
   * @description Public accessor to column-specific metadata.
   * Aggregates all metadata found in the schema chain (including wraps and pipes).
   *
   * @param {z.ZodType} schema - The column schema to inspect.
   * @returns {Record<string, any>} Merged metadata.
   */
  public static getColumnMeta(schema: z.ZodType): Record<string, any> {
    return getZodMetaDeep(schema);
  }
}
