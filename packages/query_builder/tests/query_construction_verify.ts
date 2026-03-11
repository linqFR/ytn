import { QueryBuilder } from '../src/index.js';

console.log('🏗️ Starting Query Construction Verification...');

function testSelectAndWhere() {
    console.log('\n--- Case 1: Basic SELECT and WHERE ---');
    const sql = QueryBuilder.table('users', 'u')
        .select(['id', 'name'])
        .where(['id'])
        .whereRaw('active = 1')
        .build();
    
    const expected = "SELECT id, name FROM users u WHERE id = @id AND active = 1";
    console.log('Expected:', expected);
    console.log('Result:  ', sql);

    if (sql === expected) {
        console.log('✅ Success');
    } else {
        console.error('❌ SQL mismatch');
    }
}

function testJoins() {
    console.log('\n--- Case 2: Joins (Inner and Left) ---');
    const sql = QueryBuilder.table('users', 'u')
        .select(['u.name', 'p.title'])
        .joinInner('posts p', 'u.id = p.user_id')
        .joinLeft('comments c', 'p.id = c.post_id')
        .build();
    
    const expectedInner = "INNER JOIN posts p ON u.id = p.user_id";
    const expectedLeft = "LEFT JOIN comments c ON p.id = c.post_id";

    console.log('Result SQL: ', sql);
    console.log(`- Expected: Contains "${expectedInner}", Result: ${sql.includes(expectedInner) ? '✅' : '❌'}`);
    console.log(`- Expected: Contains "${expectedLeft}",  Result: ${sql.includes(expectedLeft) ? '✅' : '❌'}`);

    if (sql.includes(expectedInner) && sql.includes(expectedLeft)) {
        console.log('✅ Success');
    } else {
        console.error('❌ JOIN SQL mismatch');
    }
}

function testNestingAndExists() {
    console.log('\n--- Case 3: Subqueries and EXISTS ---');
    const subquery = QueryBuilder.table('orders', 'o')
        .whereColumn('o.user_id', 'u.id')
        .asExists();
    
    const sql = QueryBuilder.table('users', 'u')
        .select(['name'])
        .whereRaw(subquery)
        .build();
    
    const expected = 'WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)';
    console.log('Result SQL: ', sql);
    console.log(`- Expected: Contains "${expected}", Result: ${sql.includes(expected) ? '✅' : '❌'}`);

    if (sql.includes(expected)) {
        console.log('✅ Success');
    } else {
        console.error('❌ EXISTS SQL mismatch');
    }
}

function testUpsert() {
    console.log('\n--- Case 4: UPSERT (Conflict) ---');
    const sql = QueryBuilder.table('settings')
        .upsert(['key', 'value'], ['key'])
        .build();
    
    const expected = 'ON CONFLICT(key) DO UPDATE SET value = excluded.value';
    console.log('Result SQL: ', sql);
    console.log(`- Expected: Contains "${expected}", Result: ${sql.includes(expected) ? '✅' : '❌'}`);

    if (sql.includes(expected)) {
        console.log('✅ Success');
    } else {
        console.error('❌ UPSERT SQL mismatch');
    }
}

// Run tests
testSelectAndWhere();
testJoins();
testNestingAndExists();
testUpsert();
