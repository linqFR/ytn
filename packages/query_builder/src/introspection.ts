import { z } from 'zod';

/**
 * @class Introspector
 * @description Zod Introspection Engine.
 * Provides official Public API based extraction of shapes and metadata from Zod schemas.
 */
export class Introspector {
    /**
     * @function getSchemaShape
     * @description Recursively unwraps a Zod schema using official Public APIs to find the inner ZodObject shape.
     * Handles: ZodOptional, ZodNullable, ZodDefault, ZodReadonly, ZodCatch, ZodLazy, and ZodPipe (Pipelines/Transforms).
     * @param {z.ZodTypeAny} schema - Any Zod schema to inspect.
     * @returns {z.ZodRawShape | null} The raw shape if an object is found, otherwise null.
     */
    public static getSchemaShape(schema: z.ZodTypeAny): z.ZodRawShape | null {
        let current: any = schema;
        const seen = new Set();

        while (current && !seen.has(current)) {
            seen.add(current);
            const type = current.type;

            if (type === 'object') {
                return current.shape;
            }

            if (typeof current.unwrap === 'function') {
                current = current.unwrap();
                continue;
            }

            if (current.in && current.out) {
                const inShape = Introspector.getSchemaShape(current.in);
                if (inShape) return inShape;
                const outShape = Introspector.getSchemaShape(current.out);
                if (outShape) return outShape;
                break;
            }

            break;
        }

        return null;
    }

    /**
     * @function getPrimaryKey
     * @description Detects the Primary Key for a given schema shape.
     * Priority: 
     * 1. Official Zod v4 Metadata: `.meta({ pk: true })`
     * 2. Convention: Field named 'id' or 'uuid'.
     * @param {z.ZodRawShape} shape - The shape of the ZodObject to inspect.
     * @returns {string | null} The field name of the primary key, or null.
     */
    public static getPrimaryKey(shape: z.ZodRawShape): string | null {
        const getMeta = (s: any) => (typeof s?.meta === 'function' ? s.meta() : null) || {};
        
        for (const [key, schemaItem] of Object.entries(shape)) {
            let current: any = schemaItem;
            while (current) {
                if (getMeta(current).pk) return key;
                if (typeof current.unwrap === 'function') {
                    current = current.unwrap();
                    continue;
                }
                if (current.in && current.out) {
                    current = current.in;
                    continue;
                }
                break;
            }
        }

        const keys = Object.keys(shape);
        if (keys.includes('id')) return 'id';
        if (keys.includes('uuid')) return 'uuid';
        return null;
    }
}
