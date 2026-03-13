import { z } from 'zod';
// @ts-ignore
import { QueryBuilder } from '../dist/index.min.js';
import { TestRunner } from './infra.js';

const runner = new TestRunner('Minified Bundle Verification');

/**
 * Case 1: DDL Generation (Minified).
 */
runner.it('DDL Generation (Minified)', () => {
    const userSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().min(1)
    });

    const ddl = QueryBuilder.createTableFromZod('min_test', userSchema);
    runner.assertContains(ddl, 'PRIMARY KEY');
    runner.assertContains(ddl, 'min_test');
});

/**
 * Case 2: Query Construction (Minified).
 */
runner.it('Query Construction (Minified)', () => {
    const sql = QueryBuilder.table('items').select(['id', 'title']).where(['active']).build();
    const expected = 'SELECT id, title FROM items WHERE active = @active';
    runner.assertSQL(sql, expected);
});

runner.finish();
