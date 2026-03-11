import { QueryBuilder } from '../src/index.js';

console.log('🏗️ Starting Advanced Query Verification...');

function testReturning() {
    console.log('\n--- Case 5: RETURNING Clause ---');
    const sql = QueryBuilder.table('users')
        .insert(['name', 'email'])
        .returning(['id', 'created_at'])
        .build();
    
    const expected = "INSERT INTO users (name, email) VALUES (@name, @email) RETURNING id, created_at";
    console.log('Expected:', expected);
    console.log('Result:  ', sql);

    if (sql === expected) {
        console.log('✅ Success');
    } else {
        console.error('❌ RETURNING mismatch');
    }
}

function testUpdateWithComplexWhere() {
    console.log('\n--- Case 6: UPDATE with Complex WHERE ---');
    const sql = QueryBuilder.table('posts')
        .update(['status'])
        .where(['user_id'])
        .whereIn('category', ['news', 'tech'])
        .whereRaw('published_at < CURRENT_TIMESTAMP')
        .returning(['id'])
        .build();
    
    const expected = "UPDATE posts SET status = @status WHERE user_id = @user_id AND published_at < CURRENT_TIMESTAMP AND category IN ('news', 'tech') RETURNING id";
    console.log('Expected:', expected);
    console.log('Result:  ', sql);

    if (sql === expected) {
        console.log('✅ Success');
    } else {
        console.error('❌ Complex UPDATE mismatch');
    }
}

function testDeleteWithWhereColumn() {
    console.log('\n--- Case 7: DELETE with whereColumn ---');
    const sql = QueryBuilder.table('logs')
        .delete()
        .whereColumn('severity', 'threshold')
        .build();
    
    const expected = "DELETE FROM logs WHERE severity = threshold";
    console.log('Expected:', expected);
    console.log('Result:  ', sql);

    if (sql === expected) {
        console.log('✅ Success');
    } else {
        console.error('❌ DELETE whereColumn mismatch');
    }
}

function testUpsertWithReturning() {
    console.log('\n--- Case 8: UPSERT with RETURNING ---');
    const sql = QueryBuilder.table('counters')
        .upsert(['name', 'value'], ['name'])
        .returning(['value'])
        .build();
    
    const expected = "INSERT INTO counters (name, value) VALUES (@name, @value) ON CONFLICT(name) DO UPDATE SET value = excluded.value RETURNING value";
    console.log('Expected:', expected);
    console.log('Result:  ', sql);

    if (sql === expected) {
        console.log('✅ Success');
    } else {
        console.error('❌ UPSERT RETURNING mismatch');
    }
}

// Run tests
testReturning();
testUpdateWithComplexWhere();
testDeleteWithWhereColumn();
testUpsertWithReturning();
