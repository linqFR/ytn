import type {
  ICaseBranch,
  IJoinDefinition,
  IOnConflictConfig,
  IOrderByDefinition,
  tsQueryMode,
  tsWhereDefinition,
  IWhereInDefinition,
  IWindowDefinition,
} from "./types.js";
import { validateIdentifier } from "./ddl.js";

/**
 * @class Builder
 * @description Fluent DML Query Builder for constructing SQL queries.
 * Supports SELECT, INSERT, UPDATE, DELETE, UPSERT, and COUNT operations.
 */
export class Builder {
  #table: string;
  #mode: tsQueryMode = "SELECT";
  #fields: string[] = ["*"];
  #rawFunctionFields: string[] = [];
  #whereFields: tsWhereDefinition[] = [];
  #whereColumnFields: { col1: string; col2: string }[] = [];
  #whereLiteralFields: { col: string; value: string }[] = [];
  #whereRawFields: string[] = [];
  #updateFields: string[] = [];
  #uniqueKeys: string[] = [];
  #limit: number | null = null;
  #searchFields: string[] = [];
  #orderBy: IOrderByDefinition[] = [];
  #joins: IJoinDefinition[] = [];
  #groupBy: string[] = [];
  #offset: number | null = null;
  #whereInFields: IWhereInDefinition[] = [];
  #indexName: string = "";
  #indexColumns: string[] = [];
  #indexWhere: string | null = null;
  #ifNotExists: boolean = false;
  #tableAlias: string | null = null;
  #returningFields: string[] = [];
  #distinct: boolean = false;
  #havingFields: tsWhereDefinition[] = [];
  #onConflictConfig: IOnConflictConfig | null = null;
  #multiRowCount: number = 0;

  /**
   * @constructor
   * @param {string} table - The table name.
   * @param {string[]} [uniqueKeys] - Optional unique keys (conflict targets) for upsert auto-deduction.
   */
  constructor(table: string, uniqueKeys?: string[]) {
    this.#table = table;
    if (uniqueKeys && uniqueKeys.length > 0) {
      this.#uniqueKeys = uniqueKeys;
    }
  }

  /**
   * @function as
   * @description Sets a table alias for the query (e.g., "users u").
   * @param {string} alias - The alias name.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.as("u")`
   */
  public as(alias: string): this {
    this.#tableAlias = alias;
    return this;
  }

  /**
   * @function clone
   * @description Creates an independent copy of the current Builder instance.
   * Useful for reusing a base query (e.g., pagination with a count and a select).
   * @returns {Builder} A new Builder instance with the same state.
   */
  public clone(): Builder {
    const cloned = new Builder(this.#table, this.#uniqueKeys);
    cloned.#tableAlias = this.#tableAlias;

    cloned.#mode = this.#mode;
    cloned.#limit = this.#limit;
    cloned.#offset = this.#offset;
    cloned.#indexName = this.#indexName;
    cloned.#ifNotExists = this.#ifNotExists;

    cloned.#fields = [...this.#fields];
    cloned.#rawFunctionFields = [...this.#rawFunctionFields];
    cloned.#whereRawFields = [...this.#whereRawFields];
    cloned.#updateFields = [...this.#updateFields];
    cloned.#uniqueKeys = [...this.#uniqueKeys];
    cloned.#searchFields = [...this.#searchFields];
    cloned.#groupBy = [...this.#groupBy];
    cloned.#indexColumns = [...this.#indexColumns];
    cloned.#indexWhere = this.#indexWhere;
    cloned.#returningFields = [...this.#returningFields];
    cloned.#distinct = this.#distinct;
    cloned.#havingFields = [...this.#havingFields];
    cloned.#onConflictConfig = this.#onConflictConfig
      ? {
          ...this.#onConflictConfig,
          ...(this.#onConflictConfig.updateRaw
            ? { updateRaw: { ...this.#onConflictConfig.updateRaw } }
            : {}),
        }
      : null;
    cloned.#multiRowCount = this.#multiRowCount;

    cloned.#whereFields = this.#whereFields.map((f) =>
      typeof f === "string" ? f : { ...f },
    );
    cloned.#whereColumnFields = this.#whereColumnFields.map((f) => ({ ...f }));
    cloned.#whereLiteralFields = this.#whereLiteralFields.map((f) => ({
      ...f,
    }));
    cloned.#orderBy = this.#orderBy.map((f) => ({ ...f }));
    cloned.#joins = this.#joins.map((f) => ({ ...f }));

    cloned.#whereInFields = this.#whereInFields.map((f) => ({
      col: f.col,
      target: Array.isArray(f.target) ? [...f.target] : f.target,
    }));

    return cloned;
  }

  /**
   * @function select
   * @description Configure the query to retrieve specific columns.
   * @param {string[]} [fields=['*']] - Columns to select (array form).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.select(['id', 'name'])` or `.select('id', 'name')`
   * @impact Changes mode to 'SELECT'.
   */
  public select(fields: string[]): this;
  public select(...fields: string[]): this;
  public select(first?: string[] | string, ...rest: string[]): this {
    this.#mode = "SELECT";
    this.#fields = first === undefined
      ? ["*"]
      : Array.isArray(first)
        ? first
        : [first, ...rest];
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
   * @param {string[]} fields - The names of the columns to insert into (array form).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.insert(['level', 'message'])` or `.insert('level', 'message')`
   * @impact Changes mode to 'INSERT'.
   */
  public insert(fields: string[]): this;
  public insert(...fields: string[]): this;
  public insert(first?: string[] | string, ...rest: string[]): this {
    this.#mode = "INSERT";
    this.#fields = first === undefined
      ? []
      : Array.isArray(first)
        ? first
        : [first, ...rest];
    return this;
  }

  /**
   * @function insertMulti
   * @description Configure the query for a multi-row INSERT.
   *
   * Generates `rowCount` groups of named placeholders, indexed 0-based per row:
   * `VALUES (@col_0, @col_1), (@col_2, @col_3), ...`
   *
   * The builder does not take values — only column names. The user binds values
   * at the driver level using the generated parameter names.
   *
   * @param {string[]} fields - The names of the columns to insert.
   * @param {number} rowCount - Number of value groups (rows) to generate.
   * @returns {this} The current Builder instance for chaining.
   * @usage
   * `.insertMulti(['email', 'name'], 3)`
   * // → INSERT INTO users (email, name) VALUES (@email_0, @name_0), (@email_1, @name_1), (@email_2, @name_2)
   * @impact Changes mode to 'INSERT_MULTI'.
   * @note SQLite limits the number of bound parameters per statement (`SQLITE_MAX_VARIABLE_NUMBER`:
   *   999 in older versions, 32766 in recent ones). `fields.length * rowCount` must not exceed
   *   your driver's limit. qb does not validate this — split large batches if needed.
   */
  public insertMulti(fields: string[], rowCount: number): this {
    if (fields.length === 0)
      throw new Error("insertMulti: fields must not be empty");
    if (rowCount < 1)
      throw new Error("insertMulti: rowCount must be >= 1");
    this.#mode = "INSERT_MULTI";
    this.#fields = fields;
    this.#multiRowCount = rowCount;
    return this;
  }

  /**
   * @function insertDefaultValues
   * @description Configure the query for an INSERT with all columns set to their default values.
   * Produces `INSERT INTO table DEFAULT VALUES`.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.insertDefaultValues()`
   * @impact Changes mode to 'INSERT_DEFAULT'.
   */
  public insertDefaultValues(): this {
    this.#mode = "INSERT_DEFAULT";
    return this;
  }

  /**
   * @function update
   * @description Configure the query for updating existing rows.
   * @param {string[]} fields - The names of the columns to update (array form).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.update(['status']).where(['id'])` or `.update('status').where('id')`
   * @impact Changes mode to 'UPDATE'.
   */
  public update(fields: string[]): this;
  public update(...fields: string[]): this;
  public update(first?: string[] | string, ...rest: string[]): this {
    this.#mode = "UPDATE";
    this.#updateFields = first === undefined
      ? []
      : Array.isArray(first)
        ? first
        : [first, ...rest];
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
   * @function uniqueKeys
   * @description Sets the unique keys (conflict targets) for the builder.
   * When set, `.upsert()` can be called without explicit uniqueKeys — they are auto-deduced.
   * @param {...string[]} keys - The column names that are unique (PRIMARY KEY or UNIQUE constraints).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.uniqueKeys("email")` or `.uniqueKeys("email", "tenant_id")`
   */
  public uniqueKeys(...keys: string[]): this {
    this.#uniqueKeys = keys;
    return this;
  }

  /**
   * @function onConflict
   * @description Starts an ON CONFLICT clause (UPSERT). Returns an `OnConflictBuilder`
   * that exposes `.doNothing()` and `.doUpdate()` / `.doUpdateRaw()`.
   *
   * Must be called after `.insert()`. The conflict config is rendered in the INSERT
   * statement when `.toSQL()` is called.
   *
   * @param {string | string[]} [target] - Conflict target column(s). Omit for a bare `ON CONFLICT` (no target).
   * @param {object} [options] - Optional settings.
   * @param {string} [options.where] - Partial-index WHERE predicate on the conflict target.
   * @returns {OnConflictBuilder} A sub-builder for the conflict action.
   * @usage
   * `.insert(['email', 'name']).onConflict('email').doUpdate(['name'])`
   * `.insert(['email', 'name']).onConflict('email').doNothing()`
   * `.insert(['a', 'b']).onConflict('a', { where: 'b > 0' }).doUpdate(['b'])`
   */
  public onConflict(
    target?: string | string[],
    options?: { where?: string },
  ): OnConflictBuilder {
    const cols =
      target === undefined
        ? []
        : Array.isArray(target)
          ? target
          : [target];
    return new OnConflictBuilder(
      this,
      cols,
      options?.where,
      (config: IOnConflictConfig) => {
        if (this.#mode !== "INSERT" && this.#mode !== "INSERT_MULTI" && this.#mode !== "INSERT_DEFAULT")
          throw new Error(
            `onConflict: cannot set conflict config in mode '${this.#mode}'. Call .insert() or .insertMulti() first.`,
          );
        this.#onConflictConfig = config;
      },
    );
  }

  /**
   * @function upsert
   * @description Configure the query for UPSERT (Insert or Update on conflict).
   * Uses the `uniqueKeys` pre-configured via `.uniqueKeys()` or `defTable()` as conflict targets.
   * Update fields are auto-deduced: all fields not in uniqueKeys become `DO UPDATE SET col = excluded.col`.
   * Throws if no uniqueKeys are configured.
   *
   * For advanced ON CONFLICT control (DO NOTHING, partial index WHERE, raw expressions,
   * WHERE on DO UPDATE), use `.insert().onConflict(cols).doUpdate()/.doNothing()/.doUpdateRaw()` instead.
   *
   * @see {@link Builder#onConflict} for the full ON CONFLICT sub-builder API.
   * @param {string[]} fields - The names of the columns to insert/update. Conflict targets must be included in fields.
   * @returns {this} The current Builder instance for chaining.
   * @throws {Error} If no uniqueKeys are configured. Call `.uniqueKeys()` first or use `defTable()`.
   * @usage `.upsert(['email', 'name'])` or `.upsert('email', 'name')` (requires uniqueKeys set)
   * @impact Changes mode to 'UPSERT'.
   */
  public upsert(fields: string[]): this;
  public upsert(field: string, ...rest: string[]): this;
  public upsert(fieldsOrFirst: string[] | string, ...rest: string[]): this {
    const fields = Array.isArray(fieldsOrFirst)
      ? fieldsOrFirst
      : [fieldsOrFirst, ...rest];

    if (this.#uniqueKeys.length === 0)
      throw new Error(
        "upsert: no uniqueKeys configured. Call .uniqueKeys() first or use defTable().",
      );

    this.#mode = "UPSERT";
    this.#fields = fields;
    this.#updateFields = fields.filter((f) => !this.#uniqueKeys.includes(f));
    return this;
  }

  /**
   * @function where
   * @description Adds standard WHERE conditions.
   * @param {(string | { col: string, param: string })[]} fields - List of columns (string) or column-parameter mappings (array form).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.where(['status', { col: 'type_id', param: 'type' }])` or `.where('status')`
   */
  public where(fields: tsWhereDefinition[]): this;
  public where(...fields: tsWhereDefinition[]): this;
  public where(first?: tsWhereDefinition[] | tsWhereDefinition, ...rest: tsWhereDefinition[]): this {
    const fields = first === undefined
      ? []
      : Array.isArray(first)
        ? first
        : [first, ...rest];
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
   * @param {string[]} columns - Columns or expressions to include in the index (e.g. `['email']` or `['LOWER(name)']`).
   * @param {object} [options] - Optional settings.
   * @param {string} [options.where] - Partial-index WHERE predicate (e.g. `'active = 1'`). Must exactly match the index expression.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.createIndex('idx_user_email', ['email'])` or `.createIndex('idx_active', ['email'], { where: 'active = 1' })`
   * @impact Changes mode to 'CREATE_INDEX'.
   */
  public createIndex(
    indexName: string,
    columns: string[],
    options?: { where?: string },
  ): this {
    validateIdentifier(indexName, "createIndex");
    this.#mode = "CREATE_INDEX";
    this.#indexName = indexName;
    this.#indexColumns = columns;
    this.#ifNotExists = true;
    this.#indexWhere = options?.where ?? null;
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
    if (this.#mode === "SELECT")
      throw new Error("returning(): RETURNING is not valid in SELECT mode");
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
    branches: ICaseBranch[],
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
  public selectWindow(alias: string, def: IWindowDefinition): this {
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
   * @function distinct
   * @description Adds a DISTINCT clause to SELECT, removing duplicate rows from the result set.
   * @returns {this} The current Builder instance for chaining.
   * @usage `.select(['dept']).distinct()`
   */
  public distinct(): this {
    this.#distinct = true;
    return this;
  }

  /**
   * @function having
   * @description Adds a HAVING clause for GROUP BY filtering (on aggregates like COUNT, SUM, AVG).
   * @param {tsWhereDefinition | tsWhereDefinition[]} conditions - HAVING conditions (same shape as `.where()`).
   * @returns {this} The current Builder instance for chaining.
   * @usage `.groupBy(['user_id']).having(['COUNT(*) > 5'])`
   */
  public having(conditions: tsWhereDefinition[] | tsWhereDefinition): this;
  public having(...conditions: tsWhereDefinition[]): this;
  public having(
    first?: tsWhereDefinition[] | tsWhereDefinition,
    ...rest: tsWhereDefinition[]
  ): this {
    const conds = first === undefined
      ? []
      : Array.isArray(first)
        ? first
        : [first, ...rest];
    this.#havingFields = [...this.#havingFields, ...conds];
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
      this.#joins.push({ type, target: `(${target.toSQL()}) ${alias}`, on });
    }
    return this;
  }

  /**
   * @function asExists
   * @description Wraps the current query into an EXISTS (...) expression.
   * @returns {string} Compiled SQL.
   */
  public asExists(): string {
    return `EXISTS (${this.toSQL()})`;
  }

  /**
   * @function asNotExists
   * @description Wraps the current query into a NOT EXISTS (...) expression.
   * @returns {string} Compiled SQL.
   */
  public asNotExists(): string {
    return `NOT EXISTS (${this.toSQL()})`;
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
    additionalFilters: tsWhereDefinition[] = [],
  ): this {
    this.#mode = "SELECT";
    this.#searchFields = searchFields;
    this.#whereFields = additionalFilters;
    return this;
  }

  /**
   * @function toSQL
   * @description Compiles the current builder state into a final SQL string.
   * @returns {string} The compiled SQL query.
   * @throws {Error} If the query mode is unknown.
   */
  public toSQL(): string {
    switch (this.#mode) {
      case "SELECT": {
        const fields = this.#fields;
        const rawFields = this.#rawFunctionFields;

        const noSpecificFields =
          fields.length === 0 || (fields.length === 1 && fields[0] === "*");

        const allFields = noSpecificFields
          ? rawFields.length > 0
            ? rawFields
            : ["*"]
          : [...fields, ...rawFields];

        let sql = `SELECT ${this.#distinct ? "DISTINCT " : ""}${allFields.join(", ")} FROM ${this.#table}`;
        if (this.#tableAlias) sql += ` ${this.#tableAlias}`;
        if (this.#joins.length > 0) {
          sql += ` ${this.#joins
            .map((j) => `${j.type} JOIN ${j.target} ON ${j.on}`)
            .join(" ")}`;
        }

        sql += this.#buildWhereClause();

        if (this.#groupBy.length > 0)
          sql += ` GROUP BY ${this.#groupBy.join(", ")}`;
        if (this.#havingFields.length > 0) {
          const havingClause = this.#havingFields
            .map((f) => (typeof f === "string" ? f : `${f.col} = @${f.param}`))
            .join(" AND ");
          sql += ` HAVING ${havingClause}`;
        }
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

      case "CREATE_INDEX": {
        let sql = `CREATE INDEX ${this.#ifNotExists ? "IF NOT EXISTS " : ""}${
          this.#indexName
        } ON ${this.#table}(${this.#indexColumns.join(", ")})`;
        if (this.#indexWhere) sql += ` WHERE ${this.#indexWhere}`;
        return sql;
      }

      case "INSERT": {
        const placeholders = this.#fields.map((f) => `@${f}`).join(", ");
        let sql = `INSERT INTO ${this.#table} (${this.#fields.join(
          ", ",
        )}) VALUES (${placeholders})`;
        if (this.#onConflictConfig) {
          sql += this.#buildOnConflictClause();
        }
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }

      case "INSERT_MULTI": {
        const rows: string[] = [];
        for (let i = 0; i < this.#multiRowCount; i++) {
          const rowPlaceholders = this.#fields
            .map((f) => `@${f}_${i}`)
            .join(", ");
          rows.push(`(${rowPlaceholders})`);
        }
        let sql = `INSERT INTO ${this.#table} (${this.#fields.join(
          ", ",
        )}) VALUES ${rows.join(", ")}`;
        if (this.#onConflictConfig) {
          sql += this.#buildOnConflictClause();
        }
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }

      case "INSERT_DEFAULT": {
        let sql = `INSERT INTO ${this.#table} DEFAULT VALUES`;
        if (this.#onConflictConfig) {
          sql += this.#buildOnConflictClause();
        }
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
        const conflictTarget =
          this.#uniqueKeys.length > 0
            ? `(${this.#uniqueKeys.join(", ")})`
            : "";
        sql += ` ON CONFLICT${conflictTarget} DO UPDATE SET `;
        const setClauses = this.#updateFields.map(
          (f) => `${f} = excluded.${f}`,
        );
        sql += setClauses.join(", ");
        if (this.#returningFields.length > 0)
          sql += ` RETURNING ${this.#returningFields.join(", ")}`;
        return sql;
      }
    }
    throw new Error(`Unknown QueryBuilder mode: ${this.#mode}`);
  }

  /**
   * @function #buildOnConflictClause
   * @description Internal helper to construct the ON CONFLICT portion of an INSERT.
   * @private
   * @returns {string} The constructed ON CONFLICT clause (including leading space).
   */
  #buildOnConflictClause(): string {
    const c = this.#onConflictConfig!;
    let clause = " ON CONFLICT";
    if (c.target.length > 0) {
      clause += `(${c.target.join(", ")})`;
    }
    if (c.targetWhere) {
      clause += ` WHERE ${c.targetWhere}`;
    }
    if (c.action === "NOTHING") {
      clause += " DO NOTHING";
    } else {
      clause += " DO UPDATE SET ";
      if (c.updateRaw) {
        const sets = Object.entries(c.updateRaw).map(
          ([col, expr]) => `${col} = ${expr}`,
        );
        clause += sets.join(", ");
      } else if (c.updateFields) {
        const sets = c.updateFields.map((f) => `${f} = excluded.${f}`);
        clause += sets.join(", ");
      }
      if (c.updateWhere) {
        clause += ` WHERE ${c.updateWhere}`;
      }
    }
    return clause;
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
          ? `(${f.target.map((v) => `'${String(v).replaceAll("'", "''")}'`).join(", ")})`
          : `(${f.target.toSQL()})`;
        conditions.push(`${f.col} IN ${targetStr}`);
      });
    }

    return conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  }
}

/**
 * @class OnConflictBuilder
 * @description Sub-builder returned by `Builder.onConflict()`.
 * Exposes `.doNothing()` and `.doUpdate()` / `.doUpdateRaw()` to complete
 * the ON CONFLICT clause. Each method returns the parent `Builder` for chaining.
 *
 * The conflict config is injected into the parent `Builder` via a closure
 * captured at construction time — no public setter is exposed on `Builder`.
 */
export class OnConflictBuilder {
  #parent: Builder;
  #target: string[];
  #targetWhere?: string;
  #setter: (config: IOnConflictConfig) => void;

  /**
   * @constructor
   * @param {Builder} parent - The parent Builder instance.
   * @param {string[]} target - Conflict target columns (empty = bare ON CONFLICT).
   * @param {string} [targetWhere] - Optional partial-index WHERE predicate.
   * @param {(config: IOnConflictConfig) => void} setter - Closure that sets the config on the parent's private field.
   */
  constructor(
    parent: Builder,
    target: string[],
    targetWhere: string | undefined,
    setter: (config: IOnConflictConfig) => void,
  ) {
    this.#parent = parent;
    this.#target = target;
    this.#targetWhere = targetWhere;
    this.#setter = setter;
  }

  /**
   * @function doNothing
   * @description Sets the conflict action to DO NOTHING.
   * @returns {Builder} The parent Builder for chaining.
   * @usage `.onConflict('email').doNothing()`
   */
  public doNothing(): Builder {
    this.#setter({
      target: this.#target,
      targetWhere: this.#targetWhere,
      action: "NOTHING",
    });
    return this.#parent;
  }

  /**
   * @function doUpdate
   * @description Sets the conflict action to DO UPDATE SET with auto-generated `excluded.col` references.
   * @param {string[]} fields - Columns to update (each becomes `col = excluded.col`).
   * @param {string} [where] - Optional WHERE predicate on the DO UPDATE clause.
   * @returns {Builder} The parent Builder for chaining.
   * @usage `.onConflict('email').doUpdate(['name'])`
   */
  public doUpdate(fields: string[], where?: string): Builder {
    this.#setter({
      target: this.#target,
      targetWhere: this.#targetWhere,
      action: "UPDATE",
      updateFields: fields,
      updateWhere: where,
    });
    return this.#parent;
  }

  /**
   * @function doUpdateRaw
   * @description Sets the conflict action to DO UPDATE SET with manual expressions.
   * @param {Record<string, string>} sets - Map of column → SQL expression (e.g. `{ count: 'count + 1' }`).
   * @param {string} [where] - Optional WHERE predicate on the DO UPDATE clause.
   * @returns {Builder} The parent Builder for chaining.
   * @usage `.onConflict('email').doUpdateRaw({ updated_at: 'CURRENT_TIMESTAMP', count: 'count + 1' })`
   */
  public doUpdateRaw(sets: Record<string, string>, where?: string): Builder {
    this.#setter({
      target: this.#target,
      targetWhere: this.#targetWhere,
      action: "UPDATE",
      updateRaw: sets,
      updateWhere: where,
    });
    return this.#parent;
  }
}
