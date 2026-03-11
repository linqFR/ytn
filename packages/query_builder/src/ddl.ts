import { z } from 'zod';
import { Introspector } from './introspection.js';
import { DDLOptions } from './types.js';

/**
 * @class DDLEngine
 * @description DDL Generation Engine.
 * Responsible for generating SQL statements for schema management (tables, indexes, drops).
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
     * @param {z.ZodTypeAny} schema - Zod schema (typically ZodObject, but handles wrappers/pipes).
     * @param {DDLOptions} [options={}] - Manual overrides and configuration.
     * 
     * @returns {string} Compiled SQL DDL.
     */
    public static createTableFromZod(
        tableName: string,
        schema: z.ZodTypeAny,
        options: DDLOptions = {}
    ): string {
        const shape = Introspector.getSchemaShape(schema);

        if (!shape) {
            const typeName = (schema as any).type || (schema as any)._def?.typeName;
            throw new Error(`createTableFromZod requires a ZodObject (or a wrapper pointing to one). Got: ${typeName}`);
        }

        let pk = options.primaryKey;
        const fks = options.foreignKeys || {};
        const defaults = options.defaults || {};
        const uniques = options.unique || [];
        const columnDefs: string[] = [];

        Object.entries(shape).forEach(([key, schemaItem]: [string, any]) => {
            let type = 'TEXT';
            let constraints = '';
            let isOptional = false;

            let current = schemaItem;
            const getMeta = (s: any) => (typeof s?.meta === 'function' ? s.meta() : null) || {};
            let meta = getMeta(current);
            let isPkFromDoc = meta.pk === true;
            let isUniqueFromDoc = meta.unique === true || (Array.isArray(uniques) && uniques.includes(key));

            while (current) {
                const t = current.type;
                const m = getMeta(current);
                if (m.pk) isPkFromDoc = true;
                if (m.unique) isUniqueFromDoc = true;

                if (t === 'optional' || t === 'nullable' || t === 'default' || t === 'catch' || t === 'promise' || t === 'lazy') {
                    if (t === 'optional') isOptional = true;
                    current = typeof current.unwrap === 'function' ? current.unwrap() : current;
                    continue;
                }

                if (current.in && current.out) {
                    current = current.in;
                    continue;
                }
                break;
            }

            if (!current) return;

            const baseType = current.type;
            if (baseType === 'number') {
                const def = current._zod?.def || current.def || {};
                const checks = def.checks || current.checks || [];
                const isInt = checks.some((c: any) => 
                    c.kind === 'int' || 
                    c.type === 'int' || 
                    (c.def?.check === 'number_format' && ['int32', 'uint32', 'safeint'].includes(c.def?.format)) ||
                    (c.kind === 'number_format' && ['int32', 'uint32', 'safeint'].includes(c.format))
                );
                type = isInt ? 'INTEGER' : 'REAL';
            } else if (baseType === 'boolean') {
                type = 'BOOLEAN';
            } else if (baseType === 'date') {
                type = 'DATETIME';
            }

            if (!pk && isPkFromDoc) pk = key;

            if (typeof pk === 'string' && key === pk) {
                constraints += (type === 'INTEGER') ? ' PRIMARY KEY AUTOINCREMENT' : ' PRIMARY KEY';
            } else {
                if (isUniqueFromDoc) constraints += ' UNIQUE';
                const defValue = defaults[key] || meta.defaultValue || meta.default;
                if (defValue !== undefined) {
                    constraints += ` DEFAULT ${defValue}`;
                } else if (!isOptional) {
                    constraints += ' NOT NULL';
                }
            }

            if (meta.fk) {
                fks[key] = meta.fk;
            }

            columnDefs.push(`${key} ${type}${constraints}`);
        });

        if (!pk) {
            pk = Introspector.getPrimaryKey(shape) || undefined;
        }

        Object.entries(fks).forEach(([col, ref]) => {
            if (typeof ref === 'string') {
                columnDefs.push(`FOREIGN KEY (${col}) REFERENCES ${ref}`);
            } else {
                let fkStr = `FOREIGN KEY (${col}) REFERENCES ${ref.table}(${ref.col})`;
                if (ref.onDelete) fkStr += ` ON DELETE ${ref.onDelete}`;
                columnDefs.push(fkStr);
            }
        });

        if (Array.isArray(pk) && pk.length > 0) {
            columnDefs.push(`PRIMARY KEY (${pk.join(', ')})`);
        }

        return `CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${columnDefs.join(',\n  ')}\n);`;
    }
}
