import {
  getZodDefaultValue,
  getZodDef,
  getZodMetaDeep,
  getZodNumberFormat,
  getZodShapeDeep,
  isZodDefault,
  isZodNullable,
  isZodOptional,
  unwrapZodDeep,
} from "@ytrynot/shared/zod/zod-reflection.js";
import { z } from "zod";
import type {
  qbColumn,
  ISchemaIntrospector,
  tsSqliteType,
  tsDefaultValue,
} from "../types.js";

/**
 * @class ZodIntrospector
 * @description Zod v4 introspector implementing ISchemaIntrospector.
 * Uses the shared reflection layer (getZodShapeDeep, getZodMetaDeep, unwrapZodDeep)
 * to extract a neutral qbColumn[] from a Zod schema.
 */
export class ZodIntrospector implements ISchemaIntrospector<z.ZodType> {
  /**
   * @function getColumns
   * @description Extracts column shapes from a Zod schema.
   * @param {z.ZodType} schema - The Zod schema (typically ZodObject, handles wrappers/pipes).
   * @returns {qbColumn[] | null} Column shapes, or null if not a ZodObject.
   */
  getColumns(schema: z.ZodType): qbColumn[] | null {
    const shape = getZodShapeDeep(schema);
    if (!shape) return null;

    return Object.entries(shape).map(([key, schemaItem]) => {
      const meta = getZodMetaDeep(schemaItem);
      const optional = isZodOptional(schemaItem) || isZodDefault(schemaItem) || isZodNullable(schemaItem);
      const unwrapped = unwrapZodDeep(schemaItem);
      const baseType = getZodDef(unwrapped)?.type;

      const sqliteType = mapZodTypeToSqlite(baseType, unwrapped);

      const zodDefault = getZodDefaultValue(schemaItem);
      const hasDefault = zodDefault !== undefined;
      const defaultValue = zodDefault !== undefined
        ? tagDefault(baseType, zodDefault)
        : undefined;

      return {
        name: key,
        sqliteType,
        optional,
        hasDefault,
        defaultValue,
        pkauto: meta.pkauto === true,
        unique: meta.unique === true,
        fk: meta.fk,
        meta,
      };
    });
  }

  /**
   * @function getPrimaryKey
   * @description Detects the primary key column from a Zod schema by inspecting
   * metadata (`.meta({ pk: true })` or `.meta({ pkauto: true })`) and standard
   * conventions (id, uuid).
   * @param {z.ZodType} schema - The Zod schema.
   * @returns {string | null} The primary key column name, or null.
   */
  getPrimaryKey(schema: z.ZodType): string | null {
    const shape = getZodShapeDeep(schema);
    if (!shape) return null;

    for (const [key, schemaItem] of Object.entries(shape)) {
      const meta = getZodMetaDeep(schemaItem);
      if (meta.pk || meta.pkauto) return key;
    }

    const keys = Object.keys(shape);
    if (keys.includes("id")) return "id";
    if (keys.includes("uuid")) return "uuid";
    return null;
  }
}

/**
 * @function mapZodTypeToSqlite
 * @description Maps a Zod base type to a SQLite column type.
 * @param {string | undefined} baseType - The Zod base type name (from def.type).
 * @param {z.ZodType} schema - The unwrapped Zod schema (for format detection via instanceof).
 * @returns {tsSqliteType} The SQLite type.
 */
function mapZodTypeToSqlite(baseType: string | undefined, schema: z.ZodType): tsSqliteType {
  if (baseType === "number") {
    // z.int() creates a ZodNumberFormat; z.number().int() (legacy) adds a number_format check.
    // getZodNumberFormat handles both paths and returns the format string.
    const format = getZodNumberFormat(schema);
    if (format && ["int32", "uint32", "safeint"].includes(format)) {
      return "INTEGER";
    }
    return "REAL";
  }
  if (baseType === "boolean") return "BOOLEAN";
  if (baseType === "date") return "DATETIME";
  if (baseType === "bigint") return "INTEGER";
  if (baseType === "buffer" || baseType === "instanceof") return "BLOB";
  return "TEXT";
}

/** Shared singleton instance. */
export const zodIntrospector = new ZodIntrospector();

/**
 * @function tagDefault
 * @description Maps a Zod base type + default value to a tagged `tsDefaultValue`.
 * @param {string | undefined} baseType - The Zod base type name (from def.type).
 * @param {unknown} value - The resolved default value.
 * @returns {tsDefaultValue} The tagged default value.
 */
function tagDefault(baseType: string | undefined, value: unknown): tsDefaultValue {
  if (baseType === "string") return { string: value as string };
  if (baseType === "number" || baseType === "bigint") return { number: value as number };
  if (baseType === "boolean") return { boolean: value as boolean };
  if (baseType === "date") return { date: value as Date };
  // Fallback: treat as raw SQL string
  return { raw: String(value) };
}
