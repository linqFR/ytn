import { QueryBuilder } from '../src/index.js';
import { TestRunner } from './infra.js';

const runner = new TestRunner('Advanced Query Verification');

/**
 * Case 1: RETURNING Clause.
 */
runner.it('RETURNING Clause', () => {
    const sql = QueryBuilder.table('users')
        .insert(['name', 'email'])
        .returning(['id', 'created_at'])
        .build();
    
    const expected = "INSERT INTO users (name, email) VALUES (@name, @email) RETURNING id, created_at";
    runner.assertSQL(sql, expected);
});

/**
 * Case 2: UPDATE with Complex WHERE.
 */
runner.it('UPDATE with Complex WHERE', () => {
    const sql = QueryBuilder.table('posts')
        .update(['status'])
        .where(['user_id'])
        .whereIn('category', ['news', 'tech'])
        .whereRaw('published_at < CURRENT_TIMESTAMP')
        .returning(['id'])
        .build();
    
    // Order of clauses in where: search -> where -> whereColumn -> whereLiteral -> whereRaw -> whereIn
    const expected = "UPDATE posts SET status = @status WHERE user_id = @user_id AND published_at < CURRENT_TIMESTAMP AND category IN ('news', 'tech') RETURNING id";
    runner.assertSQL(sql, expected);
});

/**
 * Case 3: DELETE with whereColumn.
 */
runner.it('DELETE with whereColumn', () => {
    const sql = QueryBuilder.table('logs')
        .delete()
        .whereColumn('severity', 'threshold')
        .build();
    
    const expected = "DELETE FROM logs WHERE severity = threshold";
    runner.assertSQL(sql, expected);
});

/**
 * Case 4: UPSERT with RETURNING.
 */
runner.it('UPSERT with RETURNING', () => {
    const sql = QueryBuilder.table('counters')
        .upsert(['name', 'value'], ['name'])
        .returning(['value'])
        .build();
    
    const expected = "INSERT INTO counters (name, value) VALUES (@name, @value) ON CONFLICT(name) DO UPDATE SET value = excluded.value RETURNING value";
    runner.assertSQL(sql, expected);
});

runner.finish();
