import { z } from 'zod';
import { QueryBuilder } from '../dist/index.js';

console.log('📦 Starting Compiled JS Verification (dist)...');

/**
 * Test case for recursive unwrapping and ZodPipe/Transform support on compiled JS.
 */
function testCompiledJS() {
    console.log('\n--- Case 1: Recursive Unwrapping (dist) ---');
    
    const Schema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().meta({ unique: true }),
    })
    .optional()
    .transform(v => v);

    try {
        const ddl = QueryBuilder.createTableFromZod('dist_table', Schema);
        console.log('Result DDL:\n', ddl);
        
        const hasPK = ddl.includes('PRIMARY KEY');
        const hasUnique = ddl.includes('UNIQUE');

        console.log(`- Expected: Contains "PRIMARY KEY", Result: ${hasPK ? '✅' : '❌'}`);
        console.log(`- Expected: Contains "UNIQUE",      Result: ${hasUnique ? '✅' : '❌'}`);

        if (hasPK && hasUnique) {
            console.log('✅ Compiled JS correctly identifies PK and Metadata');
        } else {
            console.error('❌ Compiled JS fails to identify constraints');
        }
    } catch (e) {
        console.error('❌ FAILED: ', e.message);
    }
}

/**
 * Test CRUD generation on compiled JS.
 */
function testCRUD() {
    console.log('\n--- Case 2: CRUD Generation (dist) ---');
    
    const UserSchema = z.object({
        uuid: z.string().uuid().meta({ pk: true }),
        username: z.string()
    });

    try {
        const crud = QueryBuilder.generateCRUD('users', UserSchema);
        console.log('Result Insert SQL:', crud.insert);
        
        const expectedPK = 'WHERE uuid = @uuid';
        const hasExpectedPK = crud.getById.includes(expectedPK);

        console.log(`- Expected getById fragment: "${expectedPK}", Result: ${hasExpectedPK ? '✅' : '❌'}`);

        if (hasExpectedPK) {
            console.log('✅ Compiled JS correctly identifies PK from metadata for CRUD');
        } else {
            console.error('❌ Compiled JS failed to identify PK from metadata');
        }
    } catch (e) {
        console.error('❌ FAILED: ', e.message);
    }
}

// Run tests
testCompiledJS();
testCRUD();
