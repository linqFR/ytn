import { describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index.js';

describe('Compound SELECT (UNION / UNION ALL / INTERSECT / EXCEPT)', () => {

  describe('Static factories', () => {
    it('QueryBuilder.unionAll combines 3 queries', () => {
      const q1 = QueryBuilder.table('actions').select('id', 'title').whereRaw("to_test = 1");
      const q2 = QueryBuilder.table('problems').select('id', 'title').whereRaw("to_test = 1");
      const q3 = QueryBuilder.table('ideas').select('id', 'title').whereRaw("to_test = 1");

      const sql = QueryBuilder.unionAll(q1, q2, q3).toSQL();

      expect(sql).toContain('SELECT id, title FROM actions WHERE to_test = 1');
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain('SELECT id, title FROM problems WHERE to_test = 1');
      expect(sql).toContain('SELECT id, title FROM ideas WHERE to_test = 1');
      expect(sql.split('UNION ALL').length).toBe(3); // 2 UNION ALLs joining 3 parts
    });

    it('QueryBuilder.union combines 2 queries', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.union(q1, q2).toSQL();

      expect(sql).toContain('UNION');
      expect(sql).not.toContain('UNION ALL');
    });

    it('QueryBuilder.intersect combines 2 queries', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.intersect(q1, q2).toSQL();

      expect(sql).toContain('INTERSECT');
    });

    it('QueryBuilder.except combines 2 queries', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.except(q1, q2).toSQL();

      expect(sql).toContain('EXCEPT');
    });

    it('throws if fewer than 2 builders', () => {
      const q1 = QueryBuilder.table('a').select('id');
      expect(() => QueryBuilder.unionAll(q1)).toThrow('at least 2');
    });
  });

  describe('Instance methods', () => {
    it('.unionAll(other) creates compound', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = q1.unionAll(q2).toSQL();

      expect(sql).toContain('UNION ALL');
    });

    it('.unionAll chain: a.unionAll(b).unionAll(c)', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');
      const q3 = QueryBuilder.table('c').select('id');

      const sql = q1.unionAll(q2).unionAll(q3).toSQL();

      expect(sql.split('UNION ALL').length).toBe(3);
    });

    it('.union(other) creates compound with UNION', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = q1.union(q2).toSQL();

      expect(sql).toContain('UNION');
      expect(sql).not.toContain('UNION ALL');
    });

    it('.intersect(other) creates compound with INTERSECT', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = q1.intersect(q2).toSQL();

      expect(sql).toContain('INTERSECT');
    });

    it('.except(other) creates compound with EXCEPT', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = q1.except(q2).toSQL();

      expect(sql).toContain('EXCEPT');
    });
  });

  describe('ORDER BY and LIMIT on compound', () => {
    it('orderBy applies to the compound', () => {
      const q1 = QueryBuilder.table('a').select('id', 'type');
      const q2 = QueryBuilder.table('b').select('id', 'type');

      const sql = QueryBuilder.unionAll(q1, q2).orderBy('type', 'ASC').toSQL();

      expect(sql).toMatch(/ORDER BY type ASC$/);
    });

    it('orderByRaw applies to the compound', () => {
      const q1 = QueryBuilder.table('a').select('id', 'priority');
      const q2 = QueryBuilder.table('b').select('id', 'priority');

      const sql = QueryBuilder.unionAll(q1, q2)
        .orderByRaw("CASE priority WHEN 'P0' THEN 0 ELSE 1 END")
        .toSQL();

      expect(sql).toContain("ORDER BY CASE priority WHEN 'P0' THEN 0 ELSE 1 END");
    });

    it('limit applies to the compound', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.unionAll(q1, q2).limit(50).toSQL();

      expect(sql).toMatch(/LIMIT 50$/);
    });

    it('offset applies to the compound', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.unionAll(q1, q2).limit(10).offset(5).toSQL();

      expect(sql).toContain('LIMIT 10');
      expect(sql).toContain('OFFSET 5');
    });
  });

  describe('Guards — invalid operations on compound', () => {
    const compound = () =>
      QueryBuilder.unionAll(
        QueryBuilder.table('a').select('id'),
        QueryBuilder.table('b').select('id'),
      );

    it('throws on .where()', () => {
      expect(() => compound().where(['status'])).toThrow('cannot be used on a compound query');
    });

    it('throws on .whereRaw()', () => {
      expect(() => compound().whereRaw('status = 1')).toThrow('cannot be used on a compound query');
    });

    it('throws on .whereIn()', () => {
      expect(() => compound().whereIn('id', ['1', '2'])).toThrow('cannot be used on a compound query');
    });

    it('throws on .joinInner()', () => {
      expect(() => compound().joinInner('c', 'a.id = c.id')).toThrow('cannot be used on a compound query');
    });

    it('throws on .insert()', () => {
      expect(() => compound().insert('a', 'b')).toThrow('cannot be used on a compound query');
    });

    it('throws on .update()', () => {
      expect(() => compound().update('status')).toThrow('cannot be used on a compound query');
    });

    it('throws on .delete()', () => {
      expect(() => compound().delete()).toThrow('cannot be used on a compound query');
    });

    it('throws on .select()', () => {
      expect(() => compound().select('id')).toThrow('cannot be used on a compound query');
    });

    it('throws on .groupBy()', () => {
      expect(() => compound().groupBy(['type'])).toThrow('cannot be used on a compound query');
    });

    it('throws on .having()', () => {
      expect(() => compound().having('COUNT(*) > 5')).toThrow('cannot be used on a compound query');
    });

    it('throws on .distinct()', () => {
      expect(() => compound().distinct()).toThrow('cannot be used on a compound query');
    });

    it('throws on .count()', () => {
      expect(() => compound().count()).toThrow('cannot be used on a compound query');
    });
  });

  describe('clone() preserves compound state', () => {
    it('clone copies compoundParts and compoundOp', () => {
      const q1 = QueryBuilder.table('a').select('id');
      const q2 = QueryBuilder.table('b').select('id');
      const original = QueryBuilder.unionAll(q1, q2).orderBy('id', 'ASC');

      const cloned = original.clone();

      expect(cloned.toSQL()).toBe(original.toSQL());
    });
  });
});

describe('CTE (WITH / WITH RECURSIVE)', () => {

  describe('Non-recursive CTE', () => {
    it('.with(name, builder) prepends WITH clause', () => {
      const cte = QueryBuilder.table('users')
        .select('id', 'name')
        .whereRaw('active = 1');

      const sql = QueryBuilder.table('active_users')
        .with('active_users', cte)
        .select('*')
        .toSQL();

      expect(sql).toContain('WITH active_users AS (SELECT id, name FROM users WHERE active = 1)');
      expect(sql).toContain('SELECT * FROM active_users');
      expect(sql).not.toContain('RECURSIVE');
    });

    it('.with(name, string) accepts raw SQL', () => {
      const sql = QueryBuilder.table('cte_result')
        .with('cte_result', 'SELECT 1 AS val')
        .select('*')
        .toSQL();

      expect(sql).toContain('WITH cte_result AS (SELECT 1 AS val)');
    });

    it('multiple .with() chain', () => {
      const cte1 = QueryBuilder.table('users').select('id').whereRaw('active = 1');
      const cte2 = QueryBuilder.table('orders').select('user_id').whereRaw('total > 100');

      const sql = QueryBuilder.table('active_users')
        .with('active_users', cte1)
        .with('big_orders', cte2)
        .select('*')
        .toSQL();

      expect(sql).toContain('WITH active_users AS (');
      expect(sql).toContain(', big_orders AS (');
    });
  });

  describe('Recursive CTE', () => {
    it('.withRecursive emits WITH RECURSIVE', () => {
      const seed = QueryBuilder.table('nodes')
        .select('id', 'parent')
        .whereRaw('parent IS NULL');
      const recur = QueryBuilder.table('nodes n')
        .select('n.id', 'n.parent')
        .joinInner('tree', 'n.parent = tree.id');

      const sql = QueryBuilder.table('tree')
        .withRecursive('tree', seed.unionAll(recur))
        .select('*')
        .toSQL();

      expect(sql).toContain('WITH RECURSIVE tree AS (');
      expect(sql).toContain('SELECT id, parent FROM nodes WHERE parent IS NULL');
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain('SELECT n.id, n.parent FROM nodes n INNER JOIN tree ON n.parent = tree.id');
      expect(sql).toContain('SELECT * FROM tree');
    });

    it('mixed recursive + non-recursive CTEs emit WITH RECURSIVE', () => {
      const cte1 = QueryBuilder.table('a').select('id');
      const cte2 = QueryBuilder.table('b').select('id');

      const sql = QueryBuilder.table('result')
        .with('simple_cte', cte1)
        .withRecursive('recursive_cte', cte2)
        .select('*')
        .toSQL();

      expect(sql).toContain('WITH RECURSIVE');
      expect(sql).toContain('simple_cte AS (');
      expect(sql).toContain('recursive_cte AS (');
    });
  });

  describe('CTE + compound combination', () => {
    it('CTE prefix on a compound query', () => {
      const cte = QueryBuilder.table('source').select('id', 'type').whereRaw('active = 1');
      const q1 = QueryBuilder.table('cte_result').select('id', 'type');
      const q2 = QueryBuilder.table('other').select('id', 'type');

      const sql = QueryBuilder.table('cte_result')
        .with('cte_result', cte)
        .select('id', 'type')
        .unionAll(q2)
        .orderBy('type')
        .toSQL();

      expect(sql).toContain('WITH cte_result AS (');
      expect(sql).toContain('UNION ALL');
      expect(sql).toContain('ORDER BY type ASC');
    });
  });

  describe('clone() preserves CTE state', () => {
    it('clone copies cteParts and cteRecursive', () => {
      const cte = QueryBuilder.table('users').select('id').whereRaw('active = 1');
      const original = QueryBuilder.table('active_users')
        .with('active_users', cte)
        .select('*');

      const cloned = original.clone();

      expect(cloned.toSQL()).toBe(original.toSQL());
    });

    it('clone copies recursive flag', () => {
      const cte = QueryBuilder.table('a').select('id');
      const original = QueryBuilder.table('result')
        .withRecursive('result', cte)
        .select('*');

      const cloned = original.clone();

      expect(cloned.toSQL()).toBe(original.toSQL());
      expect(cloned.toSQL()).toContain('WITH RECURSIVE');
    });
  });
});
