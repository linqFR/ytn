import { QueryBuilder } from '../src/index.js';
import { TestRunner } from './infra.js';

const runner = new TestRunner('Query Construction Verification');

/**
 * Case 1: Basic SELECT and WHERE.
 */
runner.it('Basic SELECT and WHERE', () => {
    const sql = QueryBuilder.table('users', 'u')
        .select(['id', 'name'])
        .where(['id'])
        .whereRaw('active = 1')
        .build();
    
    const expected = "SELECT id, name FROM users u WHERE id = @id AND active = 1";
    runner.assertSQL(sql, expected);
});

/**
 * Case 2: Joins (Inner and Left).
 */
runner.it('Joins (Inner and Left)', () => {
    const sql = QueryBuilder.table('users', 'u')
        .select(['u.name', 'p.title'])
        .joinInner('posts p', 'u.id = p.user_id')
        .joinLeft('comments c', 'p.id = c.post_id')
        .build();
    
    runner.assertContains(sql, "INNER JOIN posts p ON u.id = p.user_id");
    runner.assertContains(sql, "LEFT JOIN comments c ON p.id = c.post_id");
});

/**
 * Case 3: Subqueries and EXISTS.
 */
runner.it('Subqueries and EXISTS', () => {
    const subquery = QueryBuilder.table('orders', 'o')
        .whereColumn('o.user_id', 'u.id')
        .asExists();
    
    const sql = QueryBuilder.table('users', 'u')
        .select(['name'])
        .whereRaw(subquery)
        .build();
    
    runner.assertContains(sql, 'WHERE EXISTS (SELECT * FROM orders o WHERE o.user_id = u.id)');
});

/**
 * Case 4: UPSERT (Conflict).
 */
runner.it('UPSERT (Conflict)', () => {
    const sql = QueryBuilder.table('settings')
        .upsert(['key', 'value'], ['key'])
        .build();
    
    runner.assertContains(sql, 'ON CONFLICT(key) DO UPDATE SET value = excluded.value');
});

runner.finish();
