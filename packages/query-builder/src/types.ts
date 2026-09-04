/**
 * @interface IForeignKeyDefinition
 * @description Defines a foreign key constraint.
 */
export interface IForeignKeyDefinition {
  /** Target table name. */
  table: string;
  /** Target column name in the foreign table. */
  col: string;
  /** Referential integrity action on row deletion. */
  onDelete?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
  /** Referential integrity action on row update. */
  onUpdate?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
}

/**
 * @interface IUniqueConstraint
 * @description Defines a composite UNIQUE constraint at the table level.
 */
export interface IUniqueConstraint {
  /** Columns that together must be unique. */
  columns: string[];
  /** Optional constraint name (SQLite ignores names but they're useful for documentation). */
  name?: string;
}

/**
 * @interface qbTableOptions
 * @description Configuration options for Data Definition Language (DDL) generation.
 */
export interface qbTableOptions {
  /** Override for the primary key (string or composite array). */
  primaryKey?: string | string[];
  /** Map of columns to their foreign key definitions. */
  foreignKeys?: Record<string, string | IForeignKeyDefinition>;
  /** Map of columns to their default SQL values. */
  defaults?: Record<string, string>;
  /** List of columns that must have a UNIQUE constraint (single-column). */
  unique?: string[];
  /** Composite UNIQUE constraints (multi-column). */
  uniqueConstraints?: IUniqueConstraint[];
  /** Table-level CHECK constraints (e.g. `["age >= 18", "status IN ('active', 'inactive')"]`). */
  checks?: string[];
}

/**
 * @interface IOnConflictConfig
 * @description Internal configuration for ON CONFLICT clauses, set by the
 * `OnConflictBuilder` sub-builder returned by `.onConflict()`.
 */
export interface IOnConflictConfig {
  /** Conflict target columns (empty array = no target, bare ON CONFLICT). */
  target: string[];
  /** Optional partial-index WHERE predicate on the conflict target. */
  targetWhere?: string;
  /** Conflict action: DO NOTHING or DO UPDATE. */
  action: "NOTHING" | "UPDATE";
  /** Columns to update with `excluded.col` (auto-generated). Used when action is UPDATE. */
  updateFields?: string[];
  /** Manual SET expressions: `{ col: "expr" }` → `col = expr`. Overrides updateFields when present. */
  updateRaw?: Record<string, string>;
  /** Optional WHERE predicate on the DO UPDATE SET clause. */
  updateWhere?: string;
}

/**
 * @type tsQueryMode
 * @description Supported SQL operation modes for the Builder.
 */
export type tsQueryMode =
  | "SELECT"
  | "INSERT"
  | "INSERT_MULTI"
  | "INSERT_DEFAULT"
  | "UPDATE"
  | "DELETE"
  | "UPSERT"
  | "COUNT"
  | "CREATE_INDEX";

/**
 * @interface IJoinDefinition
 * @description Internal structure for SQL JOIN clauses.
 */
export interface IJoinDefinition {
  /** Type of join (e.g., 'INNER', 'LEFT', 'RIGHT'). */
  type: string;
  /** Table name or compiled subquery string. */
  target: string;
  /** The ON join condition. */
  on: string;
}

/**
 * @interface IOrderByDefinition
 * @description Internal structure for SQL ORDER BY clauses.
 */
export interface IOrderByDefinition {
  /** Column name to sort by. */
  field: string;
  /** Sort direction. */
  dir: "ASC" | "DESC";
}

/**
 * @type tsWhereDefinition
 * @description Definition for standard WHERE conditions.
 * - string: column name (defaults to 'col = @col')
 * - object: map column to a specific parameter name.
 */
export type tsWhereDefinition =
  | string
  | {
      /** The database column name. */
      col: string;
      /** The parameter name in the query. */
      param: string;
    };

/**
 * @interface IWhereInDefinition
 * @description Structure for WHERE IN clauses.
 */
export interface IWhereInDefinition {
  /** The database column name. */
  col: string;
  /** List of literal values or a subquery Builder. */
  target: string[] | import("./builder.js").Builder;
}

/**
 * @interface ICaseBranch
 * @description Represents a single branch in a CASE WHEN expression.
 */
export interface ICaseBranch {
  /** The condition after WHEN. */
  when: string;
  /** The result after THEN. */
  then: string;
}

/**
 * @interface IWindowDefinition
 * @description Configuration for Window Functions (OVER clause).
 */
export interface IWindowDefinition {
  /** The function call (e.g., 'ROW_NUMBER()'). */
  func: string;
  /** Optional columns for the PARTITION BY clause. */
  partitionBy?: string[];
  /** Optional ordering within the window. */
  orderBy?: IOrderByDefinition[];
}

/**
 * @type tsSqliteType
 * @description SQLite column types supported by the DDL generator.
 */
export type tsSqliteType = "TEXT" | "INTEGER" | "REAL" | "BOOLEAN" | "DATETIME" | "BLOB";

/**
 * @type tsDefaultValue
 * @description Default value for a column, accepting two signatures:
 * - **Tagged**: `{ [type]: value }` — the DDL engine knows the type and quotes
 *   automatically into a SQL literal.
 *   - `{ string: "pending" }` → `DEFAULT 'pending'`
 *   - `{ number: 42 }` → `DEFAULT 42`
 *   - `{ boolean: true }` → `DEFAULT TRUE`
 *   - `{ date: new Date("2024-01-01") }` → `DEFAULT '2024-01-01T00:00:00.000Z'`
 *   - `{ raw: "CURRENT_TIMESTAMP" }` → `DEFAULT CURRENT_TIMESTAMP` (escape hatch)
 * - **Direct**: `value` (string or number) — passes through `.toString()`,
 *   treated as raw SQL. The user provides the complete literal.
 *   - `"CURRENT_TIMESTAMP"` → `CURRENT_TIMESTAMP`
 *   - `42` → `42`
 *   - `"'user'"` → `'user'` (user supplies the quotes)
 *
 * Introspectors (Zod, DNA) always produce the tagged form since they know the
 * schema type. Manual `qbColumn` definitions may use either form.
 */
export type tsDefaultValue =
  | { string: string }
  | { number: number }
  | { boolean: boolean }
  | { date: Date }
  | { raw: string }
  | string
  | number;


/**
 * @type qbTable
 * @description Public alias for `qbColumn[]` — the column array passed to
 * `QueryBuilder.createTable()`.
*/
export type qbTable = qbColumn[];

/**
 * @interface qbColumn
 * @description Neutral column representation produced by schema introspectors
 * (Zod or DNA). Consumed by the DDL engine to generate CREATE TABLE statements.
 * This abstraction avoids duplicating SQL generation logic per schema library.
 * Public column definition for the schema-agnostic DDL path
 * (`QueryBuilder.createTable()`). Maps internally to `qbColumn`.
 * Use this when you don't have a Zod or DNA schema and want to define
 * a table directly with column shapes.
 *
 * @example
 * ```ts
 * import { QueryBuilder, type qbColumn } from "@ytrynot/qb";
 *
 * const columns: qbColumn[] = [
 *   { name: "id", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { pk: true } },
 *   { name: "email", sqliteType: "TEXT", optional: false, hasDefault: false, meta: { unique: true } },
 * ];
 * const ddl = QueryBuilder.createTable("users", columns);
 * ```
 */
export interface qbColumn {
  /** Column name. */
  name: string;
  /** SQLite type mapped from the source schema type. */
  sqliteType: tsSqliteType;
  /** Whether the column is optional (NOT NULL omitted). Defaults to `false`. */
  optional?: boolean;
  /** Whether the column has a default value (DEFAULT clause emitted). Defaults to `false`. */
  hasDefault?: boolean;
  /** Default value (tagged or direct) when `hasDefault` is true. See `tsDefaultValue`. */
  defaultValue?: tsDefaultValue;
  /** Whether the column is an auto-increment primary key. */
  pkauto?: boolean;
  /** Whether the column is marked as UNIQUE. */
  unique?: boolean;
  /** Foreign key reference, if any. */
  fk?: string | IForeignKeyDefinition;
  /** Column-level CHECK constraint (e.g. `"age >= 0"`). */
  check?: string;
  /** Raw metadata bag from the source schema (for advanced overrides). Defaults to `{}`. */
  meta?: Record<string, unknown>;
}

/**
 * @interface ISchemaIntrospector
 * @description Contract for schema introspectors. Each adapter (Zod, DNA)
 * implements this to produce a neutral qbColumn[] from its native schema.
 */
export interface ISchemaIntrospector<S = unknown> {
  /** Extract the column shapes from a schema. Returns null if not an object schema. */
  getColumns(schema: S): qbColumn[] | null;
  /** Detect the primary key column name from a schema. Returns null if none. */
  getPrimaryKey(schema: S): string | null;
}

/**
 * @interface TableDef
 * @description Return type of `QueryBuilder.defTable()`.
 * Contains pre-built generic SQL statements (DDL + DML) and a `req` getter
 * that returns a fresh Builder pre-configured with the table name and uniqueKeys.
 */
export interface TableDef {
  /** DDL: CREATE TABLE IF NOT EXISTS statement. */
  createTable: string;
  /** DML: SELECT * FROM <table>. */
  getAll: string;
  /** DML: SELECT * FROM <table> WHERE <pk> = @<pk>. */
  getById: string;
  /** DML: INSERT INTO <table> (...) VALUES (...). */
  insert: string;
  /** DML: UPDATE <table> SET ... WHERE <pk> = @<pk>. */
  update: string;
  /** DML: DELETE FROM <table> WHERE <pk> = @<pk>. */
  delete: string;
  /** DML: INSERT ... ON CONFLICT(<uniqueKeys>) DO UPDATE SET .... */
  upsert: string;
  /** Returns a fresh Builder pre-configured with the table name and uniqueKeys for custom queries. */
  readonly req: import("./builder.js").Builder;
  /** Alias for `req`. */
  readonly q: import("./builder.js").Builder;
}
