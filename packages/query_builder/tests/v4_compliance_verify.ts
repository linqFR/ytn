import { z } from 'zod';
import { QueryBuilder } from '../src/index.js';

console.log('🚀 Starting Zod v4 Compliance Verification...');

/**
 * Test case for recursive unwrapping and ZodPipe/Transform support.
 */
function testRecursiveUnwrapping() {
    console.log('\n--- Case 1: Recursive Unwrapping (Wrapped ZodObject) ---');
    
    // An object wrapped in multiple layers
    const ComplexSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().meta({ unique: true }),
    })
    .optional()
    .nullable()
    .readonly()
    .transform(v => v); // This creates a ZodPipe in v4

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('complex_table', ComplexSchema);
        console.log('Result DDL:\n', ddl);
        
        const hasPK = ddl.includes('PRIMARY KEY');
        const hasUnique = ddl.includes('UNIQUE');

        console.log(`- Expected: Contains "PRIMARY KEY", Result: ${hasPK ? '✅' : '❌'}`);
        console.log(`- Expected: Contains "UNIQUE",      Result: ${hasUnique ? '✅' : '❌'}`);

        if (!hasPK) console.error('❌ Missing PRIMARY KEY');
        if (!hasUnique) console.error('❌ Missing UNIQUE');
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Case for Lazy and Default/Catch wrapping.
 */
function testExoticWrappers() {
    console.log('\n--- Case 2: Exotic Wrappers (Lazy, Default, Catch) ---');

    const Base = z.object({
        id: z.number().int().meta({ pk: true }),
        data: z.string().default('empty'),
    });

    const LazySchema = z.lazy(() => Base).catch({ id: 0, data: 'error' });

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('lazy_table', LazySchema);
        const hasPK = ddl.includes('PRIMARY KEY');

        console.log('Result DDL fragment context: id TEXT PRIMARY KEY');
        console.log(`- Expected: Contains "PRIMARY KEY", Result: ${hasPK ? '✅' : '❌'}`);

        if (hasPK) {
            console.log('✅ Successfully reached inner PK through Lazy/Catch');
        } else {
            console.error('❌ Failed to reach inner PK');
        }
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Test case for v4-style integer detection.
 */
function testIntegerDetection() {
    console.log('\n--- Case 3: v4-style Integer Detection ---');
    
    const IntSchema = z.object({
        count: z.number().int(),
        safe_count: z.number().safe(), // In v4 core, safe is int
    });

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('int_table', IntSchema);
        console.log('Result DDL:\n', ddl);
        
        const countMatch = ddl.match(/count\s+(INTEGER|INT)/i);
        const resultType = countMatch ? countMatch[1] : 'NOT FOUND';

        console.log(`- Expected: count type to be "INTEGER", Result: "${resultType}" ${resultType === 'INTEGER' ? '✅' : '❌'}`);

        if (resultType !== 'INTEGER') {
            console.error('❌ count is NOT INTEGER');
        }
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Test case for metadata extraction from wrapped fields.
 */
function testWrappedFieldMeta() {
    console.log('\n--- Case 4: Metadata on Wrapped Fields ---');
    
    const MetaSchema = z.object({
        tag: z.string().meta({ unique: true }).optional().nullable(),
    });

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('meta_table', MetaSchema);
        console.log('Result DDL:\n', ddl);
        
        const hasUnique = ddl.includes('UNIQUE');
        console.log(`- Expected: Contains "UNIQUE", Result: ${hasUnique ? '✅' : '❌'}`);

        if (hasUnique) {
            console.log('✅ UNIQUE constraint found on wrapped field');
        } else {
            console.error('❌ UNIQUE constraint NOT found');
        }
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Test case for Multi-Pipe / Pipeline support.
 */
function testPipelineSupport() {
    console.log('\n--- Case 5: Pipeline / Multi-Pipe Support ---');

    const TargetSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        val: z.number(),
    });

    const PipelineSchema = z.string()
        .transform(s => JSON.parse(s))
        .pipe(TargetSchema);

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('pipe_table', PipelineSchema);
        const hasPK = ddl.includes('PRIMARY KEY');

        console.log(`- Expected: Contains "PRIMARY KEY", Result: ${hasPK ? '✅' : '❌'}`);

        if (hasPK) {
            console.log('✅ Successfully identified TargetSchema through pipeline');
        } else {
            console.error('❌ Failed to find PK in piped schema');
        }
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Test case for Foreign Key Integrity (ON DELETE/UPDATE).
 */
function testForeignKeyIntegrity() {
    console.log('\n--- Case 6: Foreign Key Integrity (ON DELETE/UPDATE) ---');

    const FKSchema = z.object({
        user_id: z.string().meta({ 
            fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' } 
        }),
    });

    try {
        const ddl = (QueryBuilder as any).createTableFromZod('fk_table', FKSchema);
        console.log('Result DDL:\n', ddl);

        const hasOnDelete = ddl.includes('ON DELETE CASCADE');
        const hasOnUpdate = ddl.includes('ON UPDATE RESTRICT');

        console.log(`- Expected: Contains "ON DELETE CASCADE",  Result: ${hasOnDelete ? '✅' : '❌'}`);
        console.log(`- Expected: Contains "ON UPDATE RESTRICT", Result: ${hasOnUpdate ? '✅' : '❌'}`);

        if (hasOnDelete && hasOnUpdate) {
            console.log('✅ Foreign Key integrity actions correctly generated');
        } else {
            console.error('❌ MISSING integrity actions in DDL');
        }
    } catch (e: any) {
        console.error('❌ FAILED: ', e.message);
    }
}

// Run tests
testRecursiveUnwrapping();
testExoticWrappers();
testIntegerDetection();
testWrappedFieldMeta();
testPipelineSupport();
testForeignKeyIntegrity();
