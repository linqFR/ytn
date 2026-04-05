import { describe, expect, it } from 'vitest';
import { z } from 'zod';
// @ts-ignore
import { QueryBuilder } from '../dist/index.min.js';

describe('Minified Bundle Verification', () => {
    /**
     * Case 1: DDL Generation (Minified).
     */
    it('DDL Generation (Minified)', () => {
        const userSchema = z.object({
            id: z.string().uuid().meta({ pk: true }),
            name: z.string().min(1)
        });

        const ddl = QueryBuilder.createTableFromZod('min_test', userSchema);
        expect(ddl).toContain('PRIMARY KEY');
        expect(ddl).toContain('min_test');
    });

    /**
     * Case 2: Query Construction (Minified).
     */
    it('Query Construction (Minified)', () => {
        const sql = QueryBuilder.table('items').select(['id', 'title']).where(['active']).build();
        const expected = 'SELECT id, title FROM items WHERE active = @active';
        expect(sql.trim()).toBe(expected.trim());
    });
});
