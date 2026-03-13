import { z } from 'zod';
// @ts-ignore
import { QueryBuilder } from '../dist/index.js';
import { TestRunner } from './infra.js';

const runner = new TestRunner('Compiled JS Verification (dist)');

/**
 * Case 1: Recursive Unwrapping and ZodPipe/Transform support on compiled JS.
 */
runner.it('Recursive Unwrapping (dist)', () => {
    const Schema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().meta({ unique: true }),
    })
    .optional()
    .transform(v => v);

    const ddl = QueryBuilder.createTableFromZod('dist_table', Schema);
    runner.assertContains(ddl, 'PRIMARY KEY');
    runner.assertContains(ddl, 'UNIQUE');
});

/**
 * Case 2: CRUD Generation (dist)
 */
runner.it('CRUD Generation (dist)', () => {
    const UserSchema = z.object({
        uuid: z.string().uuid().meta({ pk: true }),
        username: z.string()
    });

    const crud = QueryBuilder.generateCRUD('users', UserSchema);
    const expectedPK = 'WHERE uuid = @uuid';
    runner.assertContains(crud.getById, expectedPK);
});

runner.finish();
