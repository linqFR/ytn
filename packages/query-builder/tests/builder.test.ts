import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { QueryBuilder } from '../src/index.js';

describe('QueryBuilder - Fixes and New Features', () => {

  describe('1. search() method - Parameter unification', () => {
    it('should generate a WHERE clause with the named parameter @search_term', () => {
      const sql = QueryBuilder.table('articles')
        .search(['title', 'content'])
        .build();

      expect(sql).toContain('WHERE (title LIKE @search_term OR content LIKE @search_term)');
      expect(sql).not.toContain('?'); // Verifies absence of positional parameters
    });

    it("should correctly combine search with other named WHERE conditions", () => {
      const sql = QueryBuilder.table('articles')
        .search(['title'])
        .where(['status'])
        .build();

      expect(sql).toContain('WHERE (title LIKE @search_term) AND status = @status');
    });
  });

  describe("2. clone() method - State isolation", () => {
    it("should create an independent instance without mutating the original", () => {
      const baseQuery = QueryBuilder.table('users').where(['is_active']);
      
      // Clone and modify the clone
      const clonedQuery = baseQuery.clone().limit(10).offset(20);
      
      const baseSql = baseQuery.build();
      const clonedSql = clonedQuery.build();

      // The base query must remain intact
      expect(baseSql).toBe('SELECT * FROM users WHERE is_active = @is_active');
      
      // The clone must contain the new clauses
      expect(clonedSql).toBe('SELECT * FROM users WHERE is_active = @is_active LIMIT 10 OFFSET 20');
    });

    it('should isolate modifications of internal arrays (Deep/Shallow copy)', () => {
      const baseQuery = QueryBuilder.table('logs').select(['id']);
      const clone = baseQuery.clone();

      clone.select(['id', 'message']); // Modifies the clone's fields
      clone.where(['level']); // Adds a condition to the clone

      expect(baseQuery.build()).toBe('SELECT id FROM logs');
      expect(clone.build()).toBe('SELECT id, message FROM logs WHERE level = @level');
    });
  });

  describe('3. DDL Engine - Primary Key Generation', () => {
    it('should generate a PRIMARY KEY clause for a simple key (string)', () => {
      const schema = z.object({
        custom_id: z.string(),
        name: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('categories', schema, {
        primaryKey: 'custom_id'
      });

      expect(sql).toContain('PRIMARY KEY (custom_id)');
      expect(sql).not.toContain('PRIMARY KEY (c,u,s,t,o,m,_,i,d)'); // Ensures string is not iterated as an array
    });

    it('should continue to support composite primary keys (array)', () => {
      const schema = z.object({
        tenant_id: z.string(),
        user_id: z.string(),
        role: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('tenant_users', schema, {
        primaryKey: ['tenant_id', 'user_id']
      });

      expect(sql).toContain('PRIMARY KEY (tenant_id, user_id)');
    });

    it('should correctly deduce the primary key by convention (id)', () => {
      const schema = z.object({
        id: z.string(),
        email: z.string()
      });

      const sql = QueryBuilder.createTableFromZod('accounts', schema);

      expect(sql).toContain('PRIMARY KEY (id)');
    });
  });

});
