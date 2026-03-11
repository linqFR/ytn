import { QueryMode, JoinDefinition, OrderByDefinition, WhereDefinition, WhereInDefinition, CaseBranch, WindowDefinition } from './types.js';

/**
 * @class Builder
 * @description Fluent DML Query Builder for constructing SQL queries.
 * Supports SELECT, INSERT, UPDATE, DELETE, UPSERT, and COUNT operations.
 */
export class Builder {
    private _table: string;
    private _mode: QueryMode = 'SELECT';
    private _fields: string[] = ['*'];
    private _rawFunctionFields: string[] = [];
    private _whereFields: WhereDefinition[] = [];
    private _whereColumnFields: { col1: string, col2: string }[] = [];
    private _whereLiteralFields: { col: string, value: string }[] = [];
    private _whereRawFields: string[] = [];
    private _updateFields: string[] = [];
    private _conflictTargets: string[] = [];
    private _limit: number | null = null;
    private _searchFields: string[] = [];
    private _orderBy: OrderByDefinition[] = [];
    private _joins: JoinDefinition[] = [];
    private _groupBy: string[] = [];
    private _offset: number | null = null;
    private _whereInFields: WhereInDefinition[] = [];
    private _indexName: string = '';
    private _indexColumns: string[] = [];
    private _ifNotExists: boolean = false;
    private _tableAlias: string | null = null;

    /**
     * @constructor
     * @param {string} table - The table name. Can include an alias (e.g., "users u").
     */
    constructor(table: string) {
        const parts = table.split(' ');
        if (parts.length > 1) {
            this._table = parts[0];
            this._tableAlias = parts[1];
        } else {
            this._table = table;
        }
    }

    /**
     * @function select
     * @description Configure the query to retrieve specific columns.
     * @param {string[]} [fields=['*']] - Columns to select.
     * @returns {this} The current Builder instance for chaining.
     * @usage `.select(['id', 'name'])`
     * @impact Changes mode to 'SELECT'.
     */
    public select(fields: string[] = ['*']): this {
        this._mode = 'SELECT';
        this._fields = fields;
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
        this._mode = 'COUNT';
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
        this._mode = 'INSERT';
        this._fields = fields;
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
        this._mode = 'UPDATE';
        this._updateFields = fields;
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
        this._mode = 'DELETE';
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
        this._mode = 'UPSERT';
        this._fields = fields;
        this._conflictTargets = conflictTargets;
        this._updateFields = fields.filter(f => !conflictTargets.includes(f));
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
        this._whereFields = [...this._whereFields, ...fields];
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
        this._whereColumnFields.push({ col1, col2 });
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
        this._whereLiteralFields.push({ col, value });
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
        this._whereInFields.push({ col, target });
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
        this._whereRawFields.push(condition);
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
        this._mode = 'CREATE_INDEX';
        this._indexName = indexName;
        this._indexColumns = columns;
        this._ifNotExists = true;
        return this;
    }

    /**
     * @function limit
     * @description Adds a LIMIT clause.
     * @param {number} n - Maximum number of rows to return.
     * @returns {this} The current Builder instance for chaining.
     */
    public limit(n: number): this {
        this._limit = n;
        return this;
    }

    /**
     * @function offset
     * @description Adds an OFFSET clause.
     * @param {number} n - Number of rows to skip.
     * @returns {this} The current Builder instance for chaining.
     */
    public offset(n: number): this {
        this._offset = n;
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
        this._rawFunctionFields.push(rawSql);
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
    public selectCase(alias: string, branches: CaseBranch[], elseValue?: string): this {
        const branchStrings = branches.map(b => `WHEN ${b.when} THEN ${b.then}`).join(' ');
        const sql = `CASE ${branchStrings} ${elseValue ? `ELSE ${elseValue} ` : ''}END as ${alias}`;
        this._rawFunctionFields.push(sql);
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
            parts.push(`PARTITION BY ${def.partitionBy.join(', ')}`);
        }
        if (def.orderBy && def.orderBy.length > 0) {
            const orders = def.orderBy.map(o => `${o.field} ${o.dir || 'ASC'}`).join(', ');
            parts.push(`ORDER BY ${orders}`);
        }
        const winSpec = parts.join(' ');
        this._rawFunctionFields.push(`${def.func} OVER(${winSpec}) as ${alias}`);
        return this;
    }

    /**
     * @function orderBy
     * @description Adds an ORDER BY clause.
     * @param {string} field - Column name to sort by.
     * @param {'ASC' | 'DESC'} [dir='ASC'] - Sort direction.
     * @returns {this} The current Builder instance for chaining.
     */
    public orderBy(field: string, dir: 'ASC' | 'DESC' = 'ASC'): this {
        this._orderBy.push({ field, dir });
        return this;
    }

    /**
     * @function groupBy
     * @description Adds a GROUP BY clause.
     * @param {string[]} fields - Column names to group by.
     * @returns {this} The current Builder instance for chaining.
     */
    public groupBy(fields: string[]): this {
        this._groupBy = fields;
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
    public joinLeft(target: string | Builder, onOrAlias: string, onCondition?: string): this {
        return this._addJoin('LEFT', target, onOrAlias, onCondition);
    }

    /**
     * @function joinInner
     * @description Adds an INNER JOIN clause.
     * @param {string | Builder} target - Table name or subquery Builder.
     * @param {string} onOrAlias - ON condition (string) or subquery Alias.
     * @param {string} [onCondition] - ON condition if first param is a Builder.
     * @returns {this} The current Builder instance for chaining.
     */
    public joinInner(target: string | Builder, onOrAlias: string, onCondition?: string): this {
        return this._addJoin('INNER', target, onOrAlias, onCondition);
    }

    /**
     * @function joinRight
     * @description Adds a RIGHT JOIN clause.
     * @param {string | Builder} target - Table name or subquery Builder.
     * @param {string} onOrAlias - ON condition (string) or subquery Alias.
     * @param {string} [onCondition] - ON condition if first param is a Builder.
     * @returns {this} The current Builder instance for chaining.
     */
    public joinRight(target: string | Builder, onOrAlias: string, onCondition?: string): this {
        return this._addJoin('RIGHT', target, onOrAlias, onCondition);
    }

    private _addJoin(type: string, target: string | Builder, arg2: string, arg3?: string): this {
        if (typeof target === 'string') {
            this._joins.push({ type, target, on: arg2 });
        } else {
            const alias = arg2;
            const on = arg3!;
            this._joins.push({ type, target: `(${target.build()}) ${alias}`, on });
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
     * @impact Changes mode to 'SELECT'.
     */
    public search(searchFields: string[], additionalFilters: WhereDefinition[] = []): this {
        this._mode = 'SELECT';
        this._searchFields = searchFields;
        this._whereFields = additionalFilters;
        return this;
    }

    /**
     * @function build
     * @description Compiles the current builder state into a final SQL string.
     * @returns {string} The compiled SQL query.
     * @throws {Error} If the query mode is unknown.
     */
    public build(): string {
        switch (this._mode) {
            case 'SELECT': {
                let allFields = [...this._fields, ...this._rawFunctionFields];
                if (this._fields.length === 1 && this._fields[0] === '*' && this._rawFunctionFields.length > 0) {
                    allFields = this._rawFunctionFields;
                } else if (this._fields.length === 0 && this._rawFunctionFields.length > 0) {
                    allFields = this._rawFunctionFields;
                } else if (this._fields.length === 0 && this._rawFunctionFields.length === 0) {
                    allFields = ['*'];
                }

                let sql = `SELECT ${allFields.join(", ")} FROM ${this._table}`;
                if (this._tableAlias) sql += ` ${this._tableAlias}`;
                if (this._joins.length > 0) {
                    sql += ` ${this._joins.map(j => `${j.type} JOIN ${j.target} ON ${j.on}`).join(" ")}`;
                }

                const conditions: string[] = [];
                if (this._searchFields.length > 0) {
                    const orClause = this._searchFields.map(f => `${f} LIKE ?`).join(" OR ");
                    conditions.push(`(${orClause})`);
                }

                if (this._whereFields.length > 0) {
                    const andClause = this._whereFields.map(f => {
                        if (typeof f === 'string') return `${f} = @${f}`;
                        return `${f.col} = @${f.param}`;
                    }).join(" AND ");
                    conditions.push(andClause);
                }

                if (this._whereColumnFields.length > 0) {
                    const colClause = this._whereColumnFields.map(f => `${f.col1} = ${f.col2}`).join(" AND ");
                    conditions.push(colClause);
                }

                if (this._whereLiteralFields.length > 0) {
                    const litClause = this._whereLiteralFields.map(f => `${f.col} = ${f.value}`).join(" AND ");
                    conditions.push(litClause);
                }

                if (this._whereRawFields.length > 0) {
                    conditions.push(this._whereRawFields.join(" AND "));
                }

                if (this._whereInFields.length > 0) {
                    this._whereInFields.forEach(f => {
                        const targetStr = Array.isArray(f.target)
                            ? `(${f.target.map(v => `'${v}'`).join(", ")})`
                            : `(${f.target.build()})`;
                        conditions.push(`${f.col} IN ${targetStr}`);
                    });
                }

                if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
                if (this._groupBy.length > 0) sql += ` GROUP BY ${this._groupBy.join(", ")}`;
                if (this._orderBy.length > 0) {
                    sql += ` ORDER BY ${this._orderBy.map(o => `${o.field} ${o.dir}`).join(", ")}`;
                }
                if (this._limit) sql += ` LIMIT ${this._limit}`;
                if (this._offset) sql += ` OFFSET ${this._offset}`;
                return sql;
            }

            case 'COUNT': {
                let sql = `SELECT COUNT(*) as count FROM ${this._table}`;
                if (this._joins.length > 0) {
                    sql += ` ${this._joins.map(j => `${j.type} JOIN ${j.target} ON ${j.on}`).join(" ")}`;
                }
                const conditions: string[] = [];
                if (this._whereFields.length > 0) {
                    const andClause = this._whereFields.map(f => {
                        if (typeof f === 'string') return `${f} = @${f}`;
                        return `${f.col} = @${f.param}`;
                    }).join(" AND ");
                    conditions.push(andClause);
                }
                if (this._whereRawFields.length > 0) conditions.push(this._whereRawFields.join(" AND "));
                if (conditions.length > 0) sql += ` WHERE ${conditions.join(" AND ")}`;
                return sql;
            }

            case 'CREATE_INDEX':
                return `CREATE INDEX ${this._ifNotExists ? 'IF NOT EXISTS ' : ''}${this._indexName} ON ${this._table}(${this._indexColumns.join(', ')})`;

            case 'INSERT': {
                const placeholders = this._fields.map(f => `@${f}`).join(", ");
                return `INSERT INTO ${this._table} (${this._fields.join(", ")}) VALUES (${placeholders})`;
            }

            case 'UPDATE': {
                const sets = this._updateFields.map(f => `${f} = @${f}`).join(", ");
                const wheres = this._whereFields.map(f => {
                    if (typeof f === 'string') return `${f} = @${f}`;
                    return `${f.col} = @${f.param}`;
                }).join(" AND ");
                return `UPDATE ${this._table} SET ${sets} WHERE ${wheres}`;
            }

            case 'DELETE': {
                const delWheres = this._whereFields.map(f => {
                    if (typeof f === 'string') return `${f} = @${f}`;
                    return `${f.col} = @${f.param}`;
                }).join(" AND ");
                return `DELETE FROM ${this._table} WHERE ${delWheres}`;
            }

            case 'UPSERT': {
                const uCols = this._fields.join(', ');
                const uVals = this._fields.map(f => `@${f}`).join(', ');
                let sql = `INSERT INTO ${this._table} (${uCols}) VALUES (${uVals})`;
                if (this._conflictTargets.length > 0) {
                    sql += ` ON CONFLICT(${this._conflictTargets.join(', ')}) DO UPDATE SET `;
                    const setClauses = this._updateFields.map(f => `${f} = excluded.${f}`);
                    sql += setClauses.join(', ');
                }
                return sql;
            }
        }
        throw new Error(`Unknown QueryBuilder mode: ${this._mode}`);
    }

    /**
     * @function buildUpsertStatement
     * @description Static-like utility to build a raw UPSERT SQL string.
     * @param {string[]} fields - Columns to insert.
     * @param {string} conflictTarget - Conflict target (single column).
     * @param {string[]} updateFields - Columns to update on conflict.
     * @returns {string} Compiled SQL.
     */
    public buildUpsertStatement(fields: string[], conflictTarget: string, updateFields: string[]): string {
        const placeholders = fields.map(f => `@${f}`).join(", ");
        const updates = updateFields.map(f => `${f} = excluded.${f}`).join(", ");
        return `INSERT INTO ${this._table} (${fields.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflictTarget}) DO UPDATE SET ${updates}`;
    }

    /**
     * @function insertIgnore
     * @description Builds an INSERT OR IGNORE (ON CONFLICT DO NOTHING) SQL string.
     * @param {string[]} fields - Columns to insert.
     * @param {string[]} conflictTargets - Conflict targets.
     * @returns {string} Compiled SQL.
     */
    public insertIgnore(fields: string[], conflictTargets: string[]): string {
        const placeholders = fields.map(f => `@${f}`).join(", ");
        return `INSERT INTO ${this._table} (${fields.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${conflictTargets.join(", ")}) DO NOTHING`;
    }
}
