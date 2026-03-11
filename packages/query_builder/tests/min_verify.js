import { z } from 'zod';
// Testing the minified export path
import { QueryBuilder } from '../dist/index.min.js';

console.log('🚀 Starting Minified Bundle Verification...');

try {
    const userSchema = z.object({
        id: z.string().uuid().meta({ pk: true }),
        name: z.string().min(1)
    });

    console.log('\n--- Case 1: DDL Generation (Minified) ---');
    const ddl = QueryBuilder.createTableFromZod('min_test', userSchema);
    console.log('Result DDL:\n', ddl);
    
    if (ddl.includes('PRIMARY KEY') && ddl.includes('min_test')) {
        console.log('✅ Minified DDL Success');
    } else {
        throw new Error('Minified DDL failed validations');
    }

    console.log('\n--- Case 2: Query Construction (Minified) ---');
    const sql = QueryBuilder.table('items').select(['id', 'title']).where(['active']).build();
    console.log('Result SQL:', sql);
    
    const expected = 'SELECT id, title FROM items WHERE active = @active';
    if (sql === expected) {
        console.log('✅ Minified Query Success');
    } else {
        console.log('Expected:', expected);
        console.log('Result:  ', sql);
        throw new Error('Minified Query construction mismatch');
    }

    console.log('\n🎉 Minified bundle is fully operational.');
} catch (error) {
    console.error('\n❌ Minified Verification Failed:');
    console.error(error.message);
    process.exit(1);
}
