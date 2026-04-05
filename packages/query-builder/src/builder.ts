import {
  QueryMode,
  JoinDefinition,
  OrderByDefinition,
  WhereDefinition,
  WhereInDefinition,
  CaseBranch,
  WindowDefinition,
} from "./types.js";

/**
 * @class Builder
 * @description Fluent DML Query Builder for constructing SQL queries.
 * Supports SELECT, INSERT, UPDATE, DELETE, UPSERT, and COUNT operations.
 */
export class Builder {
  #table: string;
  #mode: QueryMode = "SELECT";
  #fields: string[] = ["*"];
  #rawFunctionFields: string[] = [];
  #whereFields: WhereDefinition[] = [];
  #whereColumnFields: { col1: string; col2: string }[] = [];
  #whereLiteralFields: { col: string; value: string }[] = [];
  #whereRawFields: string[] = [];
  #updateFields: string[] = [];
  #conflictTargets: string[] = [];
  #limit: number | null = null;
  #searchFields: string[] = [];
  #orderBy: OrderByDefinition[] = [];
  #joins: JoinDefinition[] = [];
  #groupBy: string[] = [];
  #offset: number | null = null;
  #whereInFields: WhereInDefinition[] = [];
  #indexName: string = "";
  #indexColumns: string[] = [];
  #ifNotExists: boolean = false;
  #tableAlias: string | null = null;
  #returningFields: string[] = [];

  /**
   * @constructor
   * @param {string} table - The table name. Can include an alias (e.g., "users u").
   */
  constructor(table: string) {
    const parts = table.split(" ");
    if (parts.length > 1) {
      this.#table = parts[0];
      this.#tableAlias = parts[1];
    } else {
      this.#table = table;
    }
  }

  /**
   * @function clone
   * @description Creates an independent copy of the current Builder instance.
   * Useful for reusing a base query (e.g., pagination with a count and a select).
   * @returns {Builder} A new Builder instance with the same state.
   */
  public clone(): Builder {
    const tableName = this.#tableAlias ? `${this.#table} ${this.#tableAlias}` : this.#table;
    const cloned = new Builder(tableName);

    cloned.#mode = this.#mode;
    cloned.#limit = this.#limit;
    cloned.#offset = this.#offset;
    cloned.#indexName = this.#indexName;
    cloned.#ifNotExists = this.#ifNotExists;

    cloned.#fields = [...this.#fields];
    cloned.#rawFunctionFields = [...this.#rawFunctionFields];
    cloned.#whereRawFields = [...this.#whereRawFields];
    cloned.#updateFields = [...this.#updateFields];
    cloned.#conflictTargets = [...this.#conflictTargets];
    cloned.#searchFields = [...this.#searchFields];
    cloned.#groupBy = [...this.#groupBy];
    cloned.#indexColumns = [...this.#indexColumns];
    cloned.#returningFields = [...this.#returningFields];

    cloned.#whereFields = this.#whereFields.map(f => typeof f === 'string' ? f : { ...f });
    cloned.#whereColumnFields = this.#whereColumnFields.map(f => ({ ...f }));
    cloned.#whereLiteralFields = this.#whereLiteralFields.map(f => ({ ...f }));
    cloned.#orderBy = this.#orderBy.map(f => ({ ...f }));
    cloned.#joins = this.#joins.map(f => ({ ...f }));

    cloned.#whereInFields = this.#whereInFields.map(f => ({
      col: f.col,
      target: Array.isArray(f.target) ? [...f.target] : f.target,
    }));

    return cloned;
  }

  /**
   * @function select
   * @description Configure the query to retrieve specific columns.
   * @param {string[]} [fields=['*']] - Columns to select.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.select(['id', 'name'])`
   * @impact Changes mode to 'SELECT'.
   */
  public select(fields: string[] = ["*"]): this {
    this.#mode = "SELECT";
    this.#fields = fields;
    return this;
  }

  /**
   * @function count
   * @description Configure the query to perform a SELECT COUNT(*) operation.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.count()`
   * @impact Changes mode to 'COUNT'.
   */
  public count(): this {
    this.#mode = "COUNT";
    return this;
  }

  /**
   * @function insert
   * @description Configure the query for inserting new rows.
   * @param {string[]} fields - The names of the columns to insert into.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.insert(['level', 'message'])`
   * @impact Changes mode to 'INSERT'.
   */
  public insert(fields: string[]): this {
    this.#mode = "INSERT";
    this.#fields = fields;
    return this;
  }

  /**
   * @function update
   * @description Configure the query for updating existing rows.
   * @param {string[]} fields - The names of the columns to update.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.update(['status']).where(['id'])`
   * @impact Changes mode to 'UPDATE'.
   */
  public update(fields: string[]): this {
    this.#mode = "UPDATE";
    this.#updateFields = fields;
    return this;
  }

  /**
   * @function delete
   * @description Configure the query for row deletion.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.delete().where(['expired'])`
   * @impact Changes mode to 'DELETE'.
   */
  public delete(): this {
    this.#mode = "DELETE";
    return this;
  }

  /**
   * @function upsert
   * @description Configure the query for UPSERT (Insert or Update on conflict).
   * @param {string[]} fields - The names of the columns to insert/update.
   * @param {string[]} conflictTargets - The names of the columns that trigger the conflict.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.upsert(['email', 'name'], ['email'])`
   * @impact Changes mode to 'UPSERT'.
   */
  public upsert(fields: string[], conflictTargets: string[]): this {
    this.#mode = "UPSERT";
    this.#fields = fields;
    this.#conflictTargets = conflictTargets;
    this.#updateFields = fields.filter((f) => !conflictTargets.includes(f));
    return this;
  }

  /**
   * @function where
   * @description Adds standard WHERE conditions.
   * @param {(string | { col: string, param: string })[]} fields - List of columns (string) or column-parameter mappings.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.where(['status', { col: 'type_id', param: 'type' }])`
   */
  public where(fields: WhereDefinition[]): this {
    this.#whereFields = [...this.#whereFields, ...fields];
    return this;
  }

  /**
   * @function whereColumn
   * @description Adds a WHERE condition comparing two columns.
   * @param {string} col1 - The first column name.
   * @param {string} col2 - The second column name.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.whereColumn('updated_at', 'created_at')`
   */
  public whereColumn(col1: string, col2: string): this {
    this.#whereColumnFields.push({ col1, col2 });
    return this;
  }

  /**
   * @function whereLiteral
   * @description Adds a WHERE condition with a literal SQL value.
   * @param {string} col - The column name.
   * @param {string} value - The literal SQL value (e.g., "'active'", "CURRENT_TIMESTAMP").
   * @returns {this} The current Builder instance for chaining.
   * @usage `.whereLiteral('status', "'deleted'")`
   */
  public whereLiteral(col: string, value: string): this {
    this.#whereLiteralFields.push({ col, value });
    return this;
  }

  /**
   * @function whereIn
   * @description Adds a WHERE IN clause.
   * @param {string} col - The column name.
   * @param {string[] | Builder} target - List of values or a subquery Builder.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.whereIn('id', ['1', '2'])` or `.whereIn('id', subquery)`
   */
  public whereIn(col: string, target: string[] | Builder): this {
    this.#whereInFields.push({ col, target });
    return this;
  }

  /**
   * @function whereRaw
   * @description Adds a raw SQL WHERE condition.
   * @param {string} condition - The raw SQL condition.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.whereRaw("json_extract(meta, '$.id') = '123'")`
   */
  public whereRaw(condition: string): this {
    this.#whereRawFields.push(condition);
    return this;
  }

  /**
   * @function createIndex
   * @description Configure the query to create an index.
   * @param {string} indexName - Name of the index.
   * @param {string[]} columns - Columns to include in the index.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.createIndex('idx_user_email', ['email'])`
   * @impact Changes mode to 'CREATE_INDEX'.
   */
  public createIndex(indexName: string, columns: string[]): this {
    this.#mode = "CREATE_INDEX";
    this.#indexName = indexName;
    this.#indexColumns = columns;
    this.#ifNotExists = true;
    return this;
  }

  /**
   * @function limit
   * @description Adds a LIMIT clause.
   * @param {number} n - Maximum number of rows to return.
   * @returns {this} The current Builder instance for chaining.
   */
  public limit(n: number): this {
    this.#limit = n;
    return this;
  }

  /**
   * @function offset
   * @description Adds an OFFSET clause.
   * @param {number} n - Number of rows to skip.
   * @returns {this} The current Builder instance for chaining.
   */
  public offset(n: number): this {
    this.#offset = n;
    return this;
  }

  /**
   * @function returning
   * @description Adds a RETURNING clause (SQLite 3.35+).
   * @param {string[]} [fields=['*']] - Columns to return.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.insert(['name']).returning(['id'])`
   */
  public returning(fields: string[] = ["*"]): this {
    this.#returningFields = fields;
    return this;
  }

  /**
   * @function selectRaw
   * @description Adds a raw SQL expression to the SELECT clause.
   * @param {string} rawSql - The raw SQL expression.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.selectRaw('COUNT(*) as total')`
   */
  public selectRaw(rawSql: string): this {
    this.#rawFunctionFields.push(rawSql);
    return this;
  }

  /**
   * @function selectCase
   * @description Adds a CASE WHEN SQL expression to the SELECT clause.
   * @param {string} alias - Alias for the resulting column.
   * @param {{ when: string, then: string }[]} branches - list of WHEN conditions and THEN results.
   * @param {string} [elseValue] - Optional ELSE result.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.selectCase('status_label', [{ when: 'status = 1', then: "'Active'" }])`
   */
  public selectCase(
    alias: string,
    branches: CaseBranch[],
    elseValue?: string,
  ): this {
    const branchStrings = branches
      .map((b) => `WHEN ${b.when} THEN ${b.then}`)
      .join(" ");
    const sql = `CASE ${branchStrings} ${
      elseValue ? `ELSE ${elseValue} ` : ""
    }END as ${alias}`;
    this.#rawFunctionFields.push(sql);
    return this;
  }

  /**
   * @function selectWindow
   * @description Adds a Window Function (OVER clause) to the SELECT clause.
   * @param {string} alias - Alias for the resulting column.
   * @param {Object} def - Window definition.
   * @param {string} def.func - Window function (e.g., 'ROW_NUMBER()').
   * @param {string[]} [def.partitionBy] - Optional PARTITION BY columns.
   * @param {Object[]} [def.orderBy] - Optional ORDER BY configuration.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.selectWindow('row_num', { func: 'ROW_NUMBER()', partitionBy: ['dept'] })`
   */
  public selectWindow(alias: string, def: WindowDefinition): this {
    const parts: string[] = [];
    if (def.partitionBy && def.partitionBy.length > 0) {
      parts.push(`PARTITION BY ${def.partitionBy.join(", ")}`);
    }
    if (def.orderBy && def.orderBy.length > 0) {
      const orders = def.orderBy
        .map((o) => `${o.field} ${o.dir || "ASC"}`)
        .join(", ");
      parts.push(`ORDER BY ${orders}`);
    }
    const winSpec = parts.join(" ");
    this.#rawFunctionFields.push(`${def.func} OVER(${winSpec}) as ${alias}`);
    return this;
  }

  /**
   * @function orderBy
   * @description Adds an ORDER BY clause.
   * @param {string} field - Column name to sort by.
   * @param {'ASC' | 'DESC'} [dir='ASC'] - Sort direction.
   * @returns {this} The current Builder instance for chaining.
   */
  public orderBy(field: string, dir: "ASC" | "DESC" = "ASC"): this {
    this.#orderBy.push({ field, dir });
    return this;
  }

  /**
   * @function groupBy
   * @description Adds a GROUP BY clause.
   * @param {string[]} fields - Column names to group by.
   * @returns {this} The current Builder instance for chaining.
   */
  public groupBy(fields: string[]): this {
    this.#groupBy = fields;
    return this;
  }

  /**
   * @function joinLeft
   * @description Adds a LEFT JOIN clause.
   * @param {string | Builder} target - Table name or subquery Builder.
   * @param {string} onOrAlias - ON condition (string) or subquery Alias.
   * @param {string} [onCondition] - ON condition if first param is a Builder.
   * @returns {this} The current Builder instance for chaining.
   */
  public joinLeft(
    target: string | Builder,
    onOrAlias: string,
    onCondition?: string,
  ): this {
    return this.#addJoin("LEFT", target, onOrAlias, onCondition);
  }

  /**
   * @function joinInner
   * @description Adds an INNER JOIN clause.
   * @param {string | Builder} target - Table name or subquery Builder.
   * @param {string} onOrAlias - ON condition (string) or subquery Alias.
   * @param {string} [onCondition] - ON condition if first param is a Builder.
   * @returns {this} The current Builder instance for chaining.
   */
  public joinInner(
    target: string | Builder,
    onOrAlias: string,
    onCondition?: string,
  ): this {
    return this.#addJoin("INNER", target, onOrAlias, onCondition);
  }

  /**
   * @function joinRight
   * @description Adds a RIGHT JOIN clause.
   * @param {string | Builder} target - Table name or subquery Builder.
   * @param {string} onOrAlias - ON condition (string) or subquery Alias.
   * @param {string} [onCondition] - ON condition if first param is a Builder.
   * @returns {this} The current Builder instance for chaining.
   */
  public joinRight(
    target: string | Builder,
    onOrAlias: string,
    onCondition?: string,
  ): this {
    return this.#addJoin("RIGHT", target, onOrAlias, onCondition);
  }

  #addJoin(
    type: string,
    target: string | Builder,
    arg2: string,
    arg3?: string,
  ): this {
    if (typeof target === "string") {
      this.#joins.push({ type, target, on: arg2 });
    } else {
      const alias = arg2;
      const on = arg3!;
      this.#joins.push({ type, target: `(${target.build()}) ${alias}`, on });
    }
    return this;
  }

  /**
   * @function asExists
   * @description Wraps the current query into an EXISTS (...) expression.
   * @returns {string} Compiled SQL.
   */
  public asExists(): string {
    return `EXISTS (${this.build()})`;
  }

  /**
   * @function asNotExists
   * @description Wraps the current query into a NOT EXISTS (...) expression.
   * @returns {string} Compiled SQL.
   */
  public asNotExists(): string {
    return `NOT EXISTS (${this.build()})`;
  }

  /**
   * @function search
   * @description Configures a SELECT query with LIKE filters across multiple columns.
   * @param {string[]} searchFields - Columns to search in.
   * @param {(string | { col: string, param: string })[]} [additionalFilters=[]] - Additional WHERE conditions.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.search(['name', 'email'])` -> nécessite de passer `{ search_term: '%valeur%' }` à l'exécution.
   * @impact Changes mode to 'SELECT'.
   */
  public search(
    searchFields: string[],
    additionalFilters: WhereDefinition[] = [],
  ): this {
    this.#mode = "SELECT";
    this.#searchFields = searchFields;
    this.#whereFields = additionalFilters;
    return this;
  }

  /**
   * @function build
   * @description Compiles the current builder state into a final SQL string.
   * @returns {string} The compiled SQL query.
   * @throws {Error} If the query mode is unknown.
   */
  public build(): string {
    switch (this.#mode) {
      case "SELECT": {
        // let allFields = [...this.#fields, ...this.#rawFunctionFields];
        // if (
        //   this.#fields.length === 1 &&
        //   this.#fields[0] === "*" &&
        //   this.#rawFunctionFields.length > 0
        // ) {
        //   allFields = this.#rawFunctionFields;
        // } else if (
        //   this.#fields.length === 0 &&
        //   this.#rawFunctionFields.length > 0
        // ) {
        //   allFields = this.#rawFunctionFields;
        // } else if (
        //   this.#fields.length === 0 &&
        //   this.#rawFunctionFields.length === 0
        // ) {
        //   allFields = ["*"];
        // }

        const fields = this.#fields;
        const rawFields = this.#rawFunctionFields;

        const noSpecificFields =
          fields.length === 0 || (fields.length === 1 && fields[0] === "*");

        const allFields = noSpecificFields
          ? rawFields.length > 0
            ? rawFields
            : ["*"]
          : [...fields, ...rawFields];

        let sql = `SELECT ${allFields.join(", ")} FROM ${this.#table}`;
        if (this.#tableAlias) sql += ` ${this.#tableAlias}`;
        if (this.#joins.length > 0) {
          sql += ` ${this.#joins
            .map((j) => `${j.type} JOIN ${j.target} ON ${j.on}`)
            .join(" ")}`;
        }

        sql += this.#buildWhereClause();

        if (this.#groupBy.length > 0)
          sql += ` GROUP BY ${this.#groupBy.join(", ")}`;
        if (this.#orderBy.length > 0) {
          sql += ` ORDER BY ${this.#orderBy
            .map((o) => `${o.field} ${o.dir}`)
            .join(", ")}`;
        }
        if (this.#limit) sql += ` LIMIT ${this.#limit}`;
        if (this.#offset) sql += ` OFFSET ${this.#offset}`;
        return sql;
      }

      case "COUNT": {
        let sql = `SELECT COUNT(*) as count FROM ${this.#table}`;
        if (this.#joins.length > 0) {
          sql += ` ${this.#joins
            .map((j) => `${j.type} JOIN ${j.target} ON ${j.on}`)
            .join(" ")}`;
        }
        sql += this.#buildWhereClause();
        return sql;
      }

      case "CREATE_INDEX":
        return `CREATE INDEX ${this.#ifNotExists ? "IF NOT EXISTS " : ""}${
          this.#indexName
        } ON ${this.#table}(${this.#indexColumns.join(", ")})`;

      case "INSERT": {
        const placeholders = this.#fields.map((f) => `@${f}`).join(", ");
        let sql = `INSERT INTO ${this.#table} (${this.#fields.join(
          ", ",
        )}) VALUES (${placeholders})`;
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }

      case "UPDATE": {
        const sets = this.#updateFields.map((f) => `${f} = @${f}`).join(", ");
        let sql = `UPDATE ${this.#table} SET ${sets}`;
        sql += this.#buildWhereClause();
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }

      case "DELETE": {
        let sql = `DELETE FROM ${this.#table}`;
        sql += this.#buildWhereClause();
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }

      case "UPSERT": {
        const uCols = this.#fields.join(", ");
        const uVals = this.#fields.map((f) => `@${f}`).join(", ");
        let sql = `INSERT INTO ${this.#table} (${uCols}) VALUES (${uVals})`;
        if (this.#conflictTargets.length > 0) {
          sql += ` ON CONFLICT(${this.#conflictTargets.join(
            ", ",
          )}) DO UPDATE SET `;
          const setClauses = this.#updateFields.map(
            (f) => `${f} = excluded.${f}`,
          );
          sql += setClauses.join(", ");
        }
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }
    }
    throw new Error(`Unknown QueryBuilder mode: ${this.#mode}`);
  }

  /**
   * @function #buildWhereClause
   * @description Internal helper to construct the WHERE portion of queries.
   * @private
   * @returns {string} The constructed WHERE clause (including leading space).
   */
  #buildWhereClause(): string {
    const conditions: string[] = [];

    if (this.#searchFields.length > 0) {
      const orClause = this.#searchFields
        .map((f) => `${f} LIKE @search_term`)
        .join(" OR ");
      conditions.push(`(${orClause})`);
    }

    if (this.#whereFields.length > 0) {
      const andClause = this.#whereFields
        .map((f) => {
          if (typeof f === "string") return `${f} = @${f}`;
          return `${f.col} = @${f.param}`;
        })
        .join(" AND ");
      conditions.push(andClause);
    }

    if (this.#whereColumnFields.length > 0) {
      const colClause = this.#whereColumnFields
        .map((f) => `${f.col1} = ${f.col2}`)
        .join(" AND ");
      conditions.push(colClause);
    }

    if (this.#whereLiteralFields.length > 0) {
      const litClause = this.#whereLiteralFields
        .map((f) => `${f.col} = ${f.value}`)
        .join(" AND ");
      conditions.push(litClause);
    }

    if (this.#whereRawFields.length > 0) {
      conditions.push(this.#whereRawFields.join(" AND "));
    }

    if (this.#whereInFields.length > 0) {
      this.#whereInFields.forEach((f) => {
        const targetStr = Array.isArray(f.target)
          ? `(${f.target.map((v) => `'${v}'`).join(", ")})`
          : `(${f.target.build()})`;
        conditions.push(`${f.col} IN ${targetStr}`);
      });
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  }

  /**
   * @function buildUpsertStatement
   * @description Static-like utility to build a raw UPSERT SQL string.
   * @param {string[]} fields - Columns to insert.
   * @param {string} conflictTarget - Conflict target (single column).
   * @param {string[]} updateFields - Columns to update on conflict.
   * @returns {string} Compiled SQL.
   */
  public buildUpsertStatement(
    fields: string[],
    conflictTarget: string,
    updateFields: string[],
  ): string {
    const placeholders = fields.map((f) => `@${f}`).join(", ");
    const updates = updateFields.map((f) => `${f} = excluded.${f}`).join(", ");
    return `INSERT INTO ${this.#table} (${fields.join(
      ", ",
    )}) VALUES (${placeholders}) ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updates}`;
  }

  /**
   * @function insertIgnore
   * @description Builds an INSERT OR IGNORE (ON CONFLICT DO NOTHING) SQL string.
   * @param {string[]} fields - Columns to insert.
   * @param {string[]} conflictTargets - Conflict targets.
   * @returns {string} Compiled SQL.
   */
  public insertIgnore(fields: string[], conflictTargets: string[]): string {
    const placeholders = fields.map((f) => `@${f}`).join(", ");
    return `INSERT INTO ${this.#table} (${fields.join(
      ", ",
    )}) VALUES (${placeholders}) ON CONFLICT(${conflictTargets.join(
      ", ",
    )}) DO NOTHING`;
  }
}
