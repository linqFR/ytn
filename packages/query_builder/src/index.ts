import { z } from 'zod';
import { Builder } from './builder.js';
import { DDLEngine } from './ddl.js';
import { Introspector } from './introspection.js';
import { PragmaBuilder } from './pragma.js';
import { DDLOptions } from './types.js';

/**
 * Fluent SQL Query Builder for agnostic DDL and DML generation.
 * (Unified Public Entry Point)
 */
export class QueryBuilder {
    /**
     * **Entry Point**: Start building a query for a specific table.
     * @param {string} name - Table name.
     * @param {string} [alias] - Optional table alias.
     * @returns {Builder}
     * @usage `QueryBuilder.table('users', 'u')`
     */
    public static table(name: string, alias?: string): Builder {
        return new Builder(alias ? `${name} ${alias}` : name);
    }

    /**
     * **Entry Point**: Start building SQLite PRAGMA statements.
     * @returns {PragmaBuilder}
     * @usage `QueryBuilder.pragma().foreignKeys(true).build()`
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
     * @function createTableFromZod
     * @description Generates a `CREATE TABLE IF NOT EXISTS` statement by introspecting a Zod schema.
     * Uses the Zod v4 Public API for deep unwrapping and metadata extraction.
     * 
     * @param {string} tableName - Name of the table to create.
     * @param {z.ZodTypeAny} schema - Zod schema (typically ZodObject, but handles wrappers/pipes).
     * @param {DDLOptions} [options={}] - Manual overrides and configuration.
     * 
     * @returns {string} Compiled SQL DDL.
     * @throws {Error} If the schema cannot be resolved to a ZodObject shape.
     */
    public static createTableFromZod(
        tableName: string,
        schema: z.ZodTypeAny,
        options: DDLOptions = {}
    ): string {
        return DDLEngine.createTableFromZod(tableName, schema, options);
    }

    /**
     * @function generateCRUD
     * @description Generates a standard set of CRUD SQL statements for a given Zod schema.
     * Automatically detects Primary Key (via .meta({pk:true}) or 'id'/'uuid' convention).
     */
    public static generateCRUD(tableName: string, schema: z.ZodTypeAny): Record<string, string> {
        const shape = Introspector.getSchemaShape(schema);
        if (!shape) {
            return { error: "generateCRUD requires a ZodObject" };
        }

        const keys = Object.keys(shape);
        const pk = Introspector.getPrimaryKey(shape) || 'id';
        const nonPkKeys = keys.filter(k => k !== pk);

        return {
            getAll: QueryBuilder.table(tableName).select().build(),
            getById: QueryBuilder.table(tableName).select().where([pk]).build(),
            insert: QueryBuilder.table(tableName).insert(keys).build(),
            update: QueryBuilder.table(tableName).update(nonPkKeys).where([pk]).build(),
            delete: QueryBuilder.table(tableName).delete().where([pk]).build(),
            upsert: QueryBuilder.table(tableName).upsert(keys, [pk]).build()
        };
    }
}

// Re-export types for consumers
export * from './types.js';
