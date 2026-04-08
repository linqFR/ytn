import { isZodDefault, isZodOptional, unwrapZodDeep } from "@ytn/shared/zod/zod-reflection.js";
import { z } from "zod";
import { Introspector } from "./introspection.js";
import { DDLOptions } from "./types.js";

/**
 * @class DDLEngine
 * @description DDL Generation Engine.
 * Responsible for generating SQL statements for schema management (tables, indexes, drops).
 * Fully refactored to use the @shared reflection layer for Zod V4 compliance.
 */
export class DDLEngine {
  /**
   * @function dropTable
   * @description Generates a `DROP TABLE IF EXISTS` statement.
   * @param {string} tableName - Name of the table to drop.
   * @returns {string} Compiled SQL.
   */
  public static dropTable(tableName: string): string {
    return `DROP TABLE IF EXISTS ${tableName};`;
  }

  /**
   * @function createTableFromZod
   * @description Generates a `CREATE TABLE IF NOT EXISTS` statement by introspecting a Zod schema.
   * Uses the Zod v4 Public API for deep unwrapping and metadata extraction.
   *
   * @param {string} tableName - Name of the table to create.
   * @param {z.ZodType} schema - The schema to introspect.
   * @param {DDLOptions} [options={}] - Manual overrides and configuration.
   *
   * @returns {string} Compiled SQL DDL.
   */
  public static createTableFromZod(
    tableName: string,
    schema: z.ZodType,
    options: DDLOptions = {},
  ): string {
    const shape = Introspector.getSchemaShape(schema);

    if (!shape) {
      throw new Error(
        `createTableFromZod requires a ZodObject (or a wrapper pointing to one).`,
      );
    }

    let pk = options.primaryKey;
    const fks = options.foreignKeys || {};
    const defaults = options.defaults || {};
    const uniques = options.unique || [];
    const columnDefs: string[] = [];

    Object.entries(shape).forEach(([key, schemaItem]) => {
      let type = "TEXT";
      let constraints = "";

      const meta = Introspector.getColumnMeta(schemaItem);
      const isOptional =
        isZodOptional(schemaItem) ||
        isZodDefault(schemaItem);
      const isUniqueFromDoc =
        meta.unique || (Array.isArray(uniques) && uniques.includes(key));

      // Authoritative V4 Type Reflection (No local _zod access, delegation to @shared)
      const unwrapped = unwrapZodDeep(schemaItem);
      const internals = unwrapped._zod?.def;
      const baseType = internals?.type;

      if (baseType === "number") {
        const checks = internals.checks || [];
        const isInt = checks.some(
          (c:any) =>
            ("isInt" in c && c.isInt === true) ||
            ("format" in c &&
              ["int32", "uint32", "safeint"].includes(c.format as string)),
        );
        type = isInt ? "INTEGER" : "REAL";
      } else if (baseType === "boolean") {
        type = "BOOLEAN";
      } else if (baseType === "date") {
        type = "DATETIME";
      }

      // Final PK determination
      if (!pk && (meta.pk || meta.pkauto)) pk = key;

      if (typeof pk === "string" && key === pk) {
        constraints += meta.pkauto
          ? " PRIMARY KEY AUTOINCREMENT"
          : " PRIMARY KEY";
      } else {
        if (isUniqueFromDoc) constraints += " UNIQUE";
        const defValue = defaults[key] || meta.defaultValue || meta.default;
        if (defValue !== undefined) {
          constraints += ` DEFAULT ${defValue}`;
        } else if (!isOptional) {
          constraints += " NOT NULL";
        }
      }

      if (meta.fk) fks[key] = meta.fk;

      columnDefs.push(`${key} ${type}${constraints}`);
    });

    if (!pk) {
      pk = Introspector.getPrimaryKey(shape) || undefined;
    }

    // Build Constraints Clauses (Standard SQL)
    Object.entries(fks).forEach(([col, ref]) => {
      if (typeof ref === "string") {
        columnDefs.push(`FOREIGN KEY (${col}) REFERENCES ${ref}`);
      } else {
        let fkStr = `FOREIGN KEY (${col}) REFERENCES ${ref.table}(${ref.col})`;
        if (ref.onDelete) fkStr += ` ON DELETE ${ref.onDelete}`;
        if (ref.onUpdate) fkStr += ` ON UPDATE ${ref.onUpdate}`;
        columnDefs.push(fkStr);
      }
    });

    if (Array.isArray(pk) && pk.length > 0) {
      columnDefs.push(`PRIMARY KEY (${pk.join(", ")})`);
    } else if (typeof pk === "string") {
      columnDefs.push(`PRIMARY KEY (${pk})`);
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(
      ",\n  ",
    )}\n);`;
  }
}
