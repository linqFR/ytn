import { describe, expect, it } from 'vitest';
import { z } from 'zod';
// @ts-ignore
import { QueryBuilder } from '../dist/index.js';

describe('Compiled JS Verification (dist)', () => {
    /**
     * Case 1: Recursive Unwrapping and ZodPipe/Transform support on compiled JS.
     */
    it('Recursive Unwrapping (dist)', () => {
        const Schema = z.object({
            id: z.string().uuid().meta({ pk: true }),
            name: z.string().meta({ unique: true }),
        })
        .optional()
        .transform(v => v);

        const ddl = QueryBuilder.createTableFromZod('dist_table', Schema);
        expect(ddl).toContain('PRIMARY KEY');
        expect(ddl).toContain('UNIQUE');
    });

    /**
     * Case 2: CRUD Generation (dist)
     */
    it('CRUD Generation (dist)', () => {
        const UserSchema = z.object({
            uuid: z.string().uuid().meta({ pk: true }),
            username: z.string()
        });

        const crud = QueryBuilder.generateCRUD('users', UserSchema);
        const expectedPK = 'WHERE uuid = @uuid';
        expect(crud.getById).toContain(expectedPK);
    });
});
