import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { QueryBuilder } from '../src/index.js';

describe('Zod v4 Compliance Verification', () => {
    /**
     * Case 1: Recursive Unwrapping and ZodPipe/Transform support.
     */
    it('Recursive Unwrapping (Wrapped ZodObject)', () => {
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
        expect(ddl).toContain('PRIMARY KEY');
        expect(ddl).toContain('UNIQUE');
    });

    /**
     * Case 2: Lazy and Default/Catch wrapping.
     */
    it('Exotic Wrappers (Lazy, Default, Catch)', () => {
        const Base = z.object({
            id: z.number().int().meta({ pk: true }),
            data: z.string().default('empty'),
        });

        const LazySchema = z.lazy(() => Base).catch({ id: 0, data: 'error' });

        const ddl = QueryBuilder.createTableFromZod('lazy_table', LazySchema);
        expect(ddl).toContain('PRIMARY KEY');
    });

    /**
     * Case 3: v4-style integer detection.
     */
    it('v4-style Integer Detection', () => {
        const IntSchema = z.object({
            count: z.number().int(),
            safe_count: z.number().safe(), // In v4 core, safe is int
        });

        const ddl = QueryBuilder.createTableFromZod('int_table', IntSchema);
        expect(ddl).toContain('count INTEGER');
    });

    /**
     * Case 4: Metadata on Wrapped Fields.
     */
    it('Metadata on Wrapped Fields', () => {
        const MetaSchema = z.object({
            tag: z.string().meta({ unique: true }).optional().nullable(),
        });

        const ddl = QueryBuilder.createTableFromZod('meta_table', MetaSchema);
        expect(ddl).toContain('UNIQUE');
    });

    /**
     * Case 5: Pipeline / Multi-Pipe Support.
     */
    it('Pipeline / Multi-Pipe Support', () => {
        const TargetSchema = z.object({
            id: z.string().uuid().meta({ pk: true }),
            val: z.number(),
        });

        const PipelineSchema = z.string()
            .transform(s => JSON.parse(s))
            .pipe(TargetSchema);

        const ddl = QueryBuilder.createTableFromZod('pipe_table', PipelineSchema);
        expect(ddl).toContain('PRIMARY KEY');
    });

    /**
     * Case 6: Foreign Key Integrity (ON DELETE/UPDATE).
     */
    it('Foreign Key Integrity (ON DELETE/UPDATE)', () => {
        const FKSchema = z.object({
            user_id: z.string().meta({ 
                fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' } 
            }),
        });

        const ddl = QueryBuilder.createTableFromZod('fk_table', FKSchema);
        expect(ddl).toContain('ON DELETE CASCADE');
        expect(ddl).toContain('ON UPDATE RESTRICT');
    });

    /**
     * Case 7: Primary Key XOR Logic (pk vs pkauto).
     */
    it('Explicit PK (pk vs pkauto)', () => {
        const StandardPK = z.string().meta({ pk: true });
        const AutoPK = z.number().int().meta({ pkauto: true });

        const ddlStandard = QueryBuilder.createTableFromZod('std', z.object({ id: StandardPK }));
        expect(ddlStandard).toContain('PRIMARY KEY');
        expect(ddlStandard).not.toContain('AUTOINCREMENT');

        const ddlAuto = QueryBuilder.createTableFromZod('aut', z.object({ id: AutoPK }));
        expect(ddlAuto).toContain('PRIMARY KEY AUTOINCREMENT');
    });
});
