import type { IUniqueConstraint, qbColumn, qbTableOptions } from "./types.js";
import { resolveDefault } from "./sql-literal.js";

/**
 * @function validateIdentifier
 * @description Validates that a string is a safe SQL identifier (table, index, constraint name).
 * Prevents accidental SQL injection through identifiers containing semicolons, spaces, or special chars.
 * Allows: letters, digits, underscores. Must start with letter or underscore.
 * @param {string} name - The identifier to validate.
 * @param {string} context - Method name for error message (e.g. "dropTable", "dropIndex").
 * @throws {Error} If the identifier is empty or contains invalid characters.
 */
export function validateIdentifier(name: string, context: string): void {
  if (!name || name.length === 0)
    throw new Error(`${context}: name must not be empty`);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new Error(
      `${context}: invalid identifier '${name}'. Only letters, digits, and underscores are allowed (must start with letter or underscore).`,
    );
}

/**
 * @class DDLEngine
 * @description DDL Generation Engine.
 * Responsible for generating SQL statements for schema management (tables, indexes, drops).
 * Schema-agnostic: works on neutral qbColumn[] produced by introspectors
 * (Zod or DNA), avoiding duplication of SQL generation logic.
 */
export class DDLEngine {
  /**
   * @function dropTable
   * @description Generates a `DROP TABLE IF EXISTS` statement.
   * @param {string} tableName - Name of the table to drop.
   * @returns {string} Compiled SQL.
   */
  public static dropTable(tableName: string): string {
    validateIdentifier(tableName, "dropTable");
    return `DROP TABLE IF EXISTS ${tableName};`;
  }

  /**
   * @function createTable
   * @description Generates a `CREATE TABLE IF NOT EXISTS` statement from neutral column shapes.
   *
   * @param {string} tableName - Name of the table to create.
   * @param {qbColumn[]} columns - Neutral column shapes (from any introspector).
   * @param {qbTableOptions} [options={}] - Manual overrides and configuration.
   *
   * @returns {string} Compiled SQL DDL.
   */
  public static createTable(
    tableName: string,
    columns: qbColumn[],
    options: qbTableOptions = {},
  ): string {
    let pk = options.primaryKey;
    const fks: Record<string, string | import("./types.js").IForeignKeyDefinition> = {
      ...options.foreignKeys,
    };
    const defaults = options.defaults ?? {};
    const uniques = options.unique ?? [];
    const columnDefs: string[] = [];

    // Infer PK before the loop so inline PRIMARY KEY works in all cases
    // (meta.pk, pkauto, and convention-based id/uuid inference).
    if (!pk) {
      for (const col of columns) {
        if (col.meta?.pk || col.pkauto) { pk = col.name; break; }
      }
      if (!pk) {
        const names = columns.map((c) => c.name);
        if (names.includes("id")) pk = "id";
        else if (names.includes("uuid")) pk = "uuid";
      }
    }

    for (const col of columns) {
      const { name, sqliteType, optional, meta } = col;
      let constraints = "";

      const isUniqueFromDoc =
        col.unique || (Array.isArray(uniques) && uniques.includes(name));

      if (typeof pk === "string" && name === pk) {
        constraints += col.pkauto
          ? " PRIMARY KEY AUTOINCREMENT"
          : " PRIMARY KEY";
      } else {
        if (isUniqueFromDoc) constraints += " UNIQUE";
        const defValue = defaults[name] ?? resolveDefault(col.defaultValue);
        if (defValue !== undefined) {
          constraints += ` DEFAULT ${defValue}`;
        } else if (!optional) {
          constraints += " NOT NULL";
        }
      }

      if (col.fk) fks[name] = col.fk;

      // Column-level CHECK constraint
      if (col.check) constraints += ` CHECK (${col.check})`;

      columnDefs.push(`${name} ${sqliteType}${constraints}`);
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

    // Table-level PRIMARY KEY only for composite keys (array).
    // Single-column PK is already declared inline on the column.
    if (Array.isArray(pk) && pk.length > 0) {
      columnDefs.push(`PRIMARY KEY (${pk.join(", ")})`);
    }

    // Composite UNIQUE constraints (multi-column)
    if (options.uniqueConstraints) {
      for (const uc of options.uniqueConstraints) {
        if (uc.columns.length === 0) continue;
        const namePrefix = uc.name ? `CONSTRAINT ${uc.name} ` : "";
        columnDefs.push(`${namePrefix}UNIQUE (${uc.columns.join(", ")})`);
      }
    }

    // Table-level CHECK constraints
    if (options.checks) {
      for (const check of options.checks) {
        if (check.length === 0) continue;
        columnDefs.push(`CHECK (${check})`);
      }
    }

    return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(
      ",\n  ",
    )}\n);`;
  }
}
