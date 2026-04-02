import { z } from "zod";
import { zod } from "@shared";
import { unwrapZod } from "@shared/zod/zod-reflection.js";

/**
 * @class Introspector
 * @description Zod Introspection Engine for the Query Builder.
 */
export class Introspector {
  /**
   * @function getSchemaShape
   * @description Finds the inner ZodObject shape by using ONLY Public V4 APIs.
   *
   * @param {z.ZodType} schema - The Zod schema to inspect.
   * @returns {Record<string, z.ZodType> | null} The shape of the Zod object (Classic).
   */
  public static getSchemaShape(
    schema: any,
  ): Record<string, z.ZodType> | null {
    if (!schema) return null;

    // 1. Recursive unwrapping of basic wrappers (Optional, Nullable, Default, Readonly)
    const root = zod.reflect.unwrapZod(schema);

    // 2. Base Case: The Core Object (Physical Source for DDL)
    if (root instanceof z.ZodObject) {
      return root.shape;
    }

    // 3. V4 Pipelines: Intelligent "First Object Wins" Strategy
    if (root instanceof z.ZodPipe) {
      const inShape = Introspector.getSchemaShape(root.in);
      if (inShape) return inShape;

      // Follow output if input was not an object (e.g., standalone transform or preprocess)
      return Introspector.getSchemaShape(root.out);
    }

    // 4. Recursive/Lazy Schemas: Materialize via .unwrap()
    if (root instanceof z.ZodLazy) {
      return Introspector.getSchemaShape(root.unwrap());
    }

    return null;
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
   * Combines surface-level tags with root tags using @shared primitives.
   *
   * @param {z.ZodType} schema - The column schema to inspect.
   * @returns {Record<string, any>} Merged metadata.
   */
  public static getColumnMeta(schema: z.ZodType): Record<string, any> {
    const surface = zod.reflect.getZodMeta(schema);
    const root = zod.reflect.unwrapZod(schema);
    const rootMeta = zod.reflect.getZodMeta(root);

    return { ...rootMeta, ...surface };
  }
}
