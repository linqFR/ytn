import type { DnaType } from "@ytrynot/dna";
import { z } from "zod";
import { Builder, OnConflictBuilder } from "./builder.js";
import { DDLEngine, validateIdentifier } from "./ddl.js";
import { DnaIntrospector } from "./dna/introspector.js";
import { PragmaBuilder } from "./pragma.js";
import type { qbColumn, qbTable, qbTableOptions, TableDef } from "./types.js";
import { ZodIntrospector } from "./zod/introspector.js";

/**
 * Fluent SQL Query Builder for agnostic DDL and DML generation.
 * (Unified Public Entry Point)
 *
 * Supports two schema introspectors:
 * - Zod v4 (via `defTable` / `reqCreateTable`)
 * - DNA (via `defTable` / `reqCreateTable`)
 *
 * `defTable(name, def).req` returns a schema-aware Builder with uniqueKeys pre-configured,
 * enabling auto-deduction of conflict targets for upsert without explicit uniqueKeys.
 */
export class QueryBuilder {
  // Internal introspector singletons
  static #zod = new ZodIntrospector();
  static #dna = new DnaIntrospector();

  /**
   * **Entry Point**: Start building a query for a specific table.
   * @param {string} name - Table name.
   * @param {string} [alias] - Optional table alias.
   * @returns {Builder}
   * @usage `QueryBuilder.table('users', 'u')`
   */
  public static table(name: string, uniqueKeys?: string[]): Builder {
    return new Builder(name, uniqueKeys);
  }

  /**
   * **Entry Point**: Start building SQLite PRAGMA statements.
   * @returns {PragmaBuilder}
   * @usage `QueryBuilder.pragma().foreignKeys(true).toSQL()`
   */
  public static pragma(): PragmaBuilder {
    return new PragmaBuilder();
  }

  /**
   * @function enableForeignKeys
   * @description Shortcut to generate the SQLite PRAGMA to enable foreign key enforcement.
   * @returns {string} `PRAGMA foreign_keys = ON;`
   * @usage `QueryBuilder.enableForeignKeys()`
   */
  public static enableForeignKeys(): string {
    return "PRAGMA foreign_keys = ON;";
  }

  /**
   * @function dropTable
   * @description Generates a DROP TABLE IF EXISTS statement.
   * @param {string} tableName - Target table.
   * @returns {string} Compiled SQL query.
   * @usage `QueryBuilder.dropTable('users')`
   */
  public static dropTable(tableName: string): string {
    return DDLEngine.dropTable(tableName);
  }

  /**
   * @function dropIndex
   * @description Generates a `DROP INDEX IF EXISTS` statement.
   * @param {string} indexName - Name of the index to drop.
   * @returns {string} Compiled SQL.
   * @usage `QueryBuilder.dropIndex('idx_users_email')` → `DROP INDEX IF EXISTS idx_users_email;`
   */
  public static dropIndex(indexName: string): string {
    validateIdentifier(indexName, "dropIndex");
    return `DROP INDEX IF EXISTS ${indexName};`;
  }

  /**
   * @function createTable
   * @description Generates a `CREATE TABLE IF NOT EXISTS` statement from manually-constructed
   * column definitions. This is the schema-agnostic DDL path — no Zod or DNA schema required.
   * Use this when you need fine-grained control over column definitions or when you don't
   * have a validation schema.
   *
   * @param {string} tableName - Name of the table to create.
   * @param {qbTable} columns - Column definitions (manually constructed).
   * @param {qbTableOptions} [options={}] - Manual overrides (primaryKey, foreignKeys, defaults, unique).
   *
   * @returns {string} Compiled SQL DDL.
   *
   * @example
   * ```ts
   * import { QueryBuilder, type qbTable } from "@ytrynot/qb";
   *
   * const columns: qbTable = [
   *   { name: "id", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { pk: true } },
   *   { name: "email", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { unique: true } },
   * ];
   * const ddl = QueryBuilder.createTable("users", columns);
   * ```
   */
  public static createTable(
    tableName: string,
    columns: qbTable,
    options: qbTableOptions = {},
  ): string {
    return DDLEngine.createTable(tableName, columns, options);
  }

  /**
   * @function reqCreateTable
   * @description Shortcut for `defTable(name, def, options).createTable` — returns only the DDL string.
   * @param {string} tableName - Target table name.
   * @param {z.ZodTypeAny | DnaType | qbColumn[]} def - Schema definition (Zod, DNA, or manual columns).
   * @param {qbTableOptions} [options={}] - Manual overrides for DDL.
   * @returns {string} Compiled SQL DDL.
   * @throws {TypeError} If `def` is not a Zod schema, DNA schema, or `qbColumn[]`.
   * @throws {Error} If the schema cannot be resolved to an object shape.
   */
  public static reqCreateTable(
    tableName: string,
    def: z.ZodTypeAny | DnaType | qbColumn[],
    options: qbTableOptions = {},
  ): string {
    return QueryBuilder.defTable(tableName, def, options).createTable;
  }

  /**
   * @function defTable
   * @description Defines a table from any schema source and generates all SQL statements (DDL + DML).
   * Automatically detects the schema type:
   * - `z.ZodTypeAny` → uses Zod v4 introspector
   * - `DnaType` → uses DNA introspector
   * - `qbColumn[]` → uses columns directly (manual)
   *
   * Automatically detects Primary Key (via `.meta({pk:true})`, `pkauto`, or 'id'/'uuid' convention).
   *
   * @param {string} tableName - Target table name.
   * @param {z.ZodTypeAny | DnaType | qbColumn[]} def - Schema definition (Zod, DNA, or manual columns).
   * @param {qbTableOptions} [options={}] - Manual overrides for DDL (primaryKey, foreignKeys, defaults, unique).
   *   For composite primary keys, pass `primaryKey: ['col1', 'col2']`. Without this option, only the first
   *   column with `meta.pk: true` is used as the PK for pre-built queries (getById, update, delete, upsert).
   * @returns {TableDef} Object with pre-built SQL statements and `req`/`q` getter for custom queries.
   * @throws {TypeError} If `def` is not a Zod schema, DNA schema, or `qbColumn[]`.
   * @throws {Error} If the schema cannot be resolved to an object shape (not a ZodObject/DnaObject or wrapper).
   *
   * @example
   * ```ts
   * // From Zod
   * const users = QueryBuilder.defTable("users", UserSchema);
   * users.createTable;  // CREATE TABLE IF NOT EXISTS users (...)
   * users.getAll;       // SELECT * FROM users
   * users.req.select("id", "name").where("id").toSQL();  // custom query
   * users.req.upsert("email", "name").toSQL();            // uniqueKeys auto-deduced
   *
   * // From DNA
   * const orders = QueryBuilder.defTable("orders", OrderSchema);
   *
   * // From manual qbColumn[]
   * const logs = QueryBuilder.defTable("logs", logColumns);
   *
   * // Composite PK (manual columns)
   * const members = QueryBuilder.defTable("members", memberColumns, {
   *   primaryKey: ["tenant_id", "user_id"],
   * });
   * members.getById;  // SELECT * FROM members WHERE tenant_id = @tenant_id AND user_id = @user_id
   * ```
   */
  public static defTable(
    tableName: string,
    def: z.ZodTypeAny | DnaType | qbColumn[],
    options: qbTableOptions = {},
  ): TableDef {
    let columns: qbColumn[];
    let pk: string | string[];

    if (Array.isArray(def)) {
      // Manual: qbColumn[]
      columns = def;
      pk = columns.find((c) => c.meta.pk || c.pkauto)?.name || "";
      if (!pk) {
        const names = columns.map((c) => c.name);
        if (names.includes("id")) pk = "id";
        else if (names.includes("uuid")) pk = "uuid";
        else pk = names[0] || "id";
      }
    } else if (def instanceof z.ZodType) {
      // Zod
      columns = QueryBuilder.#zod.getColumns(def) || [];
      if (columns.length === 0) {
        throw new Error("defTable: schema is not a ZodObject (or a wrapper pointing to one).");
      }
      pk = QueryBuilder.#zod.getPrimaryKey(def) || "id";
    } else if (typeof def === "object" && def !== null) {
      // DNA — after Array.isArray and instanceof z.ZodType checks, def is DnaType.
      // CAST: TS can't narrow the union to DnaType from typeof check alone.
      columns = QueryBuilder.#dna.getColumns(def as DnaType) || [];
      if (columns.length === 0) {
        throw new Error("defTable: schema is not a DnaObject (or a wrapper pointing to one).");
      }
      pk = QueryBuilder.#dna.getPrimaryKey(def as DnaType) || "id";
    } else {
      throw new TypeError(`defTable: expected Zod schema, DNA schema, or qbColumn[], got ${typeof def}.`);
    }

    // Override pk from options.primaryKey if provided (supports composite PK)
    if (options.primaryKey) {
      pk = options.primaryKey;
    }

    const pkCols: string[] = Array.isArray(pk) ? pk : [pk];
    const keys = columns.map((c) => c.name);
    const nonPkKeys = keys.filter((k) => !pkCols.includes(k));
    // Extract unique keys from column metadata (unique: true or pk: true or pkauto)
    const uniqueKeys = columns
      .filter((c) => c.meta.unique || c.meta.pk || c.pkauto)
      .map((c) => c.name);

    return {
      createTable: DDLEngine.createTable(tableName, columns, options),
      getAll: QueryBuilder.table(tableName).select().toSQL(),
      getById: QueryBuilder.table(tableName).select().where(pkCols).toSQL(),
      insert: QueryBuilder.table(tableName).insert(keys).toSQL(),
      update: QueryBuilder.table(tableName)
        .update(nonPkKeys)
        .where(pkCols)
        .toSQL(),
      delete: QueryBuilder.table(tableName).delete().where(pkCols).toSQL(),
      // Pre-built upsert uses PK as conflict target (SQLite requires matching constraint)
      upsert: QueryBuilder.table(tableName, pkCols).upsert(keys).toSQL(),
      get req() {
        // req returns a Builder with ALL uniqueKeys pre-configured for custom upserts
        return QueryBuilder.table(tableName, uniqueKeys);
      },
      get q() {
        return QueryBuilder.table(tableName, uniqueKeys);
      },
    };
  }
}

// Short aliases for QueryBuilder
/** Short alias for `QueryBuilder`. */
export const qb = QueryBuilder;
/** Uppercase alias for `QueryBuilder`. */
export const QB = QueryBuilder;

// Re-export types for consumers
export * from "./types.js";
// Re-export OnConflictBuilder (returned by Builder.onConflict())
export { OnConflictBuilder } from "./builder.js";

