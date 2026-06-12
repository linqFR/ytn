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
  onDelete?: "CASCADE" | "SET NULL" | "RESTRICT";
  /** Referential integrity action on row update. */
  onUpdate?: "CASCADE" | "SET NULL" | "RESTRICT";
}

/**
 * @interface IDDLOptions
 * @description Configuration options for Data Definition Language (DDL) generation.
 */
export interface IDDLOptions {
  /** Override for the primary key (string or composite array). */
  primaryKey?: string | string[];
  /** Map of columns to their foreign key definitions. */
  foreignKeys?: Record<string, string | IForeignKeyDefinition>;
  /** Map of columns to their default SQL values. */
  defaults?: Record<string, string>;
  /** List of columns that must have a UNIQUE constraint. */
  unique?: string[];
}

/**
 * @type tsQueryMode
 * @description Supported SQL operation modes for the Builder.
 */
export type tsQueryMode =
  | "SELECT"
  | "INSERT"
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
  /** Table name or compiled subquery. */
  target: string | any;
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
  target: string[] | any;
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
