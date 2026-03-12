import { z } from 'zod';
import { QueryBuilder } from '../src/index.js';
import { TestRunner } from './infra.js';

const runner = new TestRunner('Zod v4 Compliance Verification');

/**
 * Case 1: Recursive Unwrapping and ZodPipe/Transform support.
 */
runner.it('Recursive Unwrapping (Wrapped ZodObject)', () => {
    // An object wrapped in multiple layers
    const ComplexSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().meta({ unique: true }),
    })
    .optional()
    .nullable()
    .readonly()
    .transform(v => v); // This creates a ZodPipe in v4

    const ddl = QueryBuilder.createTableFromZod('complex_table', ComplexSchema);
    runner.assertContains(ddl, 'PRIMARY KEY');
    runner.assertContains(ddl, 'UNIQUE');
});

/**
 * Case 2: Lazy and Default/Catch wrapping.
 */
runner.it('Exotic Wrappers (Lazy, Default, Catch)', () => {
    const Base = z.object({
        id: z.number().int().meta({ pk: true }),
        data: z.string().default('empty'),
    });

    const LazySchema = z.lazy(() => Base).catch({ id: 0, data: 'error' });

    const ddl = QueryBuilder.createTableFromZod('lazy_table', LazySchema);
    runner.assertContains(ddl, 'PRIMARY KEY');
});

/**
 * Case 3: v4-style integer detection.
 */
runner.it('v4-style Integer Detection', () => {
    const IntSchema = z.object({
        count: z.number().int(),
        safe_count: z.number().safe(), // In v4 core, safe is int
    });

    const ddl = QueryBuilder.createTableFromZod('int_table', IntSchema);
    runner.assertContains(ddl, 'count INTEGER');
});

/**
 * Case 4: Metadata on Wrapped Fields.
 */
runner.it('Metadata on Wrapped Fields', () => {
    const MetaSchema = z.object({
        tag: z.string().meta({ unique: true }).optional().nullable(),
    });

    const ddl = QueryBuilder.createTableFromZod('meta_table', MetaSchema);
    runner.assertContains(ddl, 'UNIQUE');
});

/**
 * Case 5: Pipeline / Multi-Pipe Support.
 */
runner.it('Pipeline / Multi-Pipe Support', () => {
    const TargetSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        val: z.number(),
    });

    const PipelineSchema = z.string()
        .transform(s => JSON.parse(s))
        .pipe(TargetSchema);

    const ddl = QueryBuilder.createTableFromZod('pipe_table', PipelineSchema);
    runner.assertContains(ddl, 'PRIMARY KEY');
});

/**
 * Case 6: Foreign Key Integrity (ON DELETE/UPDATE).
 */
runner.it('Foreign Key Integrity (ON DELETE/UPDATE)', () => {
    const FKSchema = z.object({
        user_id: z.string().meta({ 
            fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' } 
        }),
    });

    const ddl = QueryBuilder.createTableFromZod('fk_table', FKSchema);
    runner.assertContains(ddl, 'ON DELETE CASCADE');
    runner.assertContains(ddl, 'ON UPDATE RESTRICT');
});

/**
 * Case 7: Primary Key XOR Logic (pk vs pkauto).
 */
runner.it('Explicit PK (pk vs pkauto)', () => {
    const StandardPK = z.string().meta({ pk: true });
    const AutoPK = z.number().int().meta({ pkauto: true });

    const ddlStandard = QueryBuilder.createTableFromZod('std', z.object({ id: StandardPK }));
    runner.assertContains(ddlStandard, 'PRIMARY KEY');
    if (ddlStandard.includes('AUTOINCREMENT')) {
        throw new Error('Should NOT contain AUTOINCREMENT for TEXT pk');
    }

    const ddlAuto = QueryBuilder.createTableFromZod('aut', z.object({ id: AutoPK }));
    runner.assertContains(ddlAuto, 'PRIMARY KEY AUTOINCREMENT');
});

runner.finish();
