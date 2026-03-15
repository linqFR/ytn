import { describe, it, expect } from 'vitest';
import { QueryBuilder } from '../src/index.js';

describe('Advanced Query Verification', () => {
    /**
     * Case 1: RETURNING Clause.
     */
    it('RETURNING Clause', () => {
        const sql = QueryBuilder.table('users')
            .insert(['name', 'email'])
            .returning(['id', 'created_at'])
            .build();
        
        const expected = "INSERT INTO users (name, email) VALUES (@name, @email) RETURNING id, created_at";
        expect(sql.trim()).toBe(expected.trim());
    });

    /**
     * Case 2: UPDATE with Complex WHERE.
     */
    it('UPDATE with Complex WHERE', () => {
        const sql = QueryBuilder.table('posts')
            .update(['status'])
            .where(['user_id'])
            .whereIn('category', ['news', 'tech'])
            .whereRaw('published_at < CURRENT_TIMESTAMP')
            .returning(['id'])
            .build();
        
        // Order of clauses in where: search -> where -> whereColumn -> whereLiteral -> whereRaw -> whereIn
        const expected = "UPDATE posts SET status = @status WHERE user_id = @user_id AND published_at < CURRENT_TIMESTAMP AND category IN ('news', 'tech') RETURNING id";
        expect(sql.trim()).toBe(expected.trim());
    });

    /**
     * Case 3: DELETE with whereColumn.
     */
    it('DELETE with whereColumn', () => {
        const sql = QueryBuilder.table('logs')
            .delete()
            .whereColumn('severity', 'threshold')
            .build();
        
        const expected = "DELETE FROM logs WHERE severity = threshold";
        expect(sql.trim()).toBe(expected.trim());
    });

    /**
     * Case 4: UPSERT with RETURNING.
     */
    it('UPSERT with RETURNING', () => {
        const sql = QueryBuilder.table('counters')
            .upsert(['name', 'value'], ['name'])
            .returning(['value'])
            .build();
        
        const expected = "INSERT INTO counters (name, value) VALUES (@name, @value) ON CONFLICT(name) DO UPDATE SET value = excluded.value RETURNING value";
        expect(sql.trim()).toBe(expected.trim());
    });
});
