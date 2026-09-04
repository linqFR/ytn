import { describe, expect, it } from 'vitest';
import { QueryBuilder, type qbColumn } from '../src/index.js';

describe('Generated columns (GENERATED ALWAYS AS)', () => {
  it('emits STORED generated column', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'first_name', sqliteType: 'TEXT' },
      { name: 'last_name', sqliteType: 'TEXT' },
      {
        name: 'full_name',
        sqliteType: 'TEXT',
        generated: { expr: "first_name || ' ' || last_name", type: 'STORED' },
      },
    ];

    const sql = QueryBuilder.createTable('users', columns);

    expect(sql).toContain("full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED");
  });

  it('emits VIRTUAL generated column', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'price', sqliteType: 'REAL' },
      { name: 'qty', sqliteType: 'INTEGER' },
      {
        name: 'total',
        sqliteType: 'REAL',
        generated: { expr: 'price * qty', type: 'VIRTUAL' },
      },
    ];

    const sql = QueryBuilder.createTable('orders', columns);

    expect(sql).toContain('total REAL GENERATED ALWAYS AS (price * qty) VIRTUAL');
  });

  it('generated column skips NOT NULL and DEFAULT', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      {
        name: 'computed',
        sqliteType: 'TEXT',
        generated: { expr: "'fixed'", type: 'STORED' },
      },
    ];

    const sql = QueryBuilder.createTable('test', columns);

    expect(sql).toContain('GENERATED ALWAYS AS');
    expect(sql).not.toContain('computed TEXT NOT NULL');
    expect(sql).not.toContain('computed TEXT DEFAULT');
  });
});

describe('CREATE TEMP TABLE', () => {
  it('emits CREATE TEMP TABLE when temporary: true', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'data', sqliteType: 'TEXT' },
    ];

    const sql = QueryBuilder.createTable('temp_cache', columns, { temporary: true });

    expect(sql).toContain('CREATE TEMP TABLE IF NOT EXISTS temp_cache');
  });

  it('emits regular CREATE TABLE when temporary not set', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
    ];

    const sql = QueryBuilder.createTable('permanent', columns);

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS permanent');
    expect(sql).not.toContain('TEMP');
  });
});

describe('CREATE TABLE AS SELECT', () => {
  it('generates CREATE TABLE name AS SELECT ...', () => {
    const query = QueryBuilder.table('users')
      .select('id', 'name')
      .whereRaw('active = 1');

    const sql = QueryBuilder.createTableAs('active_users', query);

    expect(sql).toContain('CREATE TABLE active_users AS SELECT id, name FROM users WHERE active = 1');
  });

  it('validates table name', () => {
    const query = QueryBuilder.table('users').select('id');
    expect(() => QueryBuilder.createTableAs('invalid name!', query)).toThrow('invalid identifier');
  });
});

describe('EXPLAIN / EXPLAIN QUERY PLAN', () => {
  it('explain() prefixes EXPLAIN', () => {
    const sql = QueryBuilder.table('users')
      .select('id', 'name')
      .where(['status'])
      .explain();

    expect(sql).toContain('EXPLAIN SELECT id, name FROM users');
  });

  it('explainQueryPlan() prefixes EXPLAIN QUERY PLAN', () => {
    const sql = QueryBuilder.table('users')
      .select('id')
      .explainQueryPlan();

    expect(sql).toContain('EXPLAIN QUERY PLAN SELECT id FROM users');
  });
});

describe('INSERT OR (ROLLBACK/ABORT/FAIL/IGNORE/REPLACE)', () => {
  it('or("REPLACE") generates INSERT OR REPLACE', () => {
    const sql = QueryBuilder.table('users')
      .insert('id', 'name')
      .or('REPLACE')
      .toSQL();

    expect(sql).toContain('INSERT OR REPLACE INTO users');
  });

  it('or("IGNORE") generates INSERT OR IGNORE', () => {
    const sql = QueryBuilder.table('users')
      .insert('id', 'name')
      .or('IGNORE')
      .toSQL();

    expect(sql).toContain('INSERT OR IGNORE INTO users');
  });

  it('or("ROLLBACK") generates INSERT OR ROLLBACK', () => {
    const sql = QueryBuilder.table('users')
      .insert('id')
      .or('ROLLBACK')
      .toSQL();

    expect(sql).toContain('INSERT OR ROLLBACK INTO users');
  });

  it('or("ABORT") generates INSERT OR ABORT', () => {
    const sql = QueryBuilder.table('users')
      .insert('id')
      .or('ABORT')
      .toSQL();

    expect(sql).toContain('INSERT OR ABORT INTO users');
  });

  it('or("FAIL") generates INSERT OR FAIL', () => {
    const sql = QueryBuilder.table('users')
      .insert('id')
      .or('FAIL')
      .toSQL();

    expect(sql).toContain('INSERT OR FAIL INTO users');
  });

  it('or() works with insertMulti', () => {
    const sql = QueryBuilder.table('users')
      .insertMulti(['id', 'name'], 2)
      .or('REPLACE')
      .toSQL();

    expect(sql).toContain('INSERT OR REPLACE INTO users');
  });

  it('or() works with insertDefaultValues', () => {
    const sql = QueryBuilder.table('users')
      .insertDefaultValues()
      .or('IGNORE')
      .toSQL();

    expect(sql).toContain('INSERT OR IGNORE INTO users DEFAULT VALUES');
  });

  it('or() throws if not in INSERT mode', () => {
    expect(() => QueryBuilder.table('users').select('id').or('REPLACE')).toThrow(
      'cannot set INSERT OR action in mode',
    );
  });

  it('no or() call produces standard INSERT INTO', () => {
    const sql = QueryBuilder.table('users')
      .insert('id', 'name')
      .toSQL();

    expect(sql).toContain('INSERT INTO users');
    expect(sql).not.toContain('INSERT OR');
  });
});

describe('UPDATE FROM (SQLite 3.33+)', () => {
  it('from() adds FROM clause to UPDATE', () => {
    const sql = QueryBuilder.table('users')
      .update('status')
      .from('orders')
      .whereRaw('users.id = orders.user_id')
      .toSQL();

    expect(sql).toContain('UPDATE users SET status = @status FROM orders');
    expect(sql).toContain('WHERE users.id = orders.user_id');
  });

  it('from() throws if not in UPDATE mode', () => {
    expect(() => QueryBuilder.table('users').select('id').from('orders')).toThrow(
      'FROM clause is only valid in UPDATE mode',
    );
  });

  it('UPDATE without from() has no FROM clause', () => {
    const sql = QueryBuilder.table('users')
      .update('status')
      .where(['id'])
      .toSQL();

    expect(sql).not.toContain('FROM');
  });
});

describe('Subquery in SET (updateRaw)', () => {
  it('updateRaw() with subquery in SET', () => {
    const sql = QueryBuilder.table('orders')
      .updateRaw({
        total: '(SELECT SUM(amount) FROM items WHERE items.order_id = orders.id)',
      })
      .where(['id'])
      .toSQL();

    expect(sql).toContain(
      'UPDATE orders SET total = (SELECT SUM(amount) FROM items WHERE items.order_id = orders.id) WHERE id = @id',
    );
  });

  it('updateRaw() with arithmetic expression', () => {
    const sql = QueryBuilder.table('counters')
      .updateRaw({ count: 'count + 1', updated_at: 'CURRENT_TIMESTAMP' })
      .where(['id'])
      .toSQL();

    expect(sql).toContain('SET count = count + 1, updated_at = CURRENT_TIMESTAMP');
  });

  it('updateRaw() overrides update() fields', () => {
    const sql = QueryBuilder.table('users')
      .update('name', 'email')
      .updateRaw({ name: "'fixed'" })
      .where(['id'])
      .toSQL();

    expect(sql).toContain("SET name = 'fixed'");
    expect(sql).not.toContain('name = @name');
  });

  it('updateRaw() sets mode to UPDATE', () => {
    const sql = QueryBuilder.table('users')
      .select('id')
      .updateRaw({ status: "'active'" })
      .where(['id'])
      .toSQL();

    expect(sql).toContain('UPDATE users SET');
  });
});

describe('clone() preserves new features', () => {
  it('clone preserves insertOrAction', () => {
    const original = QueryBuilder.table('users')
      .insert('id', 'name')
      .or('REPLACE');

    const cloned = original.clone();

    expect(cloned.toSQL()).toBe(original.toSQL());
  });

  it('clone preserves updateFromTable', () => {
    const original = QueryBuilder.table('users')
      .update('status')
      .from('orders')
      .whereRaw('users.id = orders.user_id');

    const cloned = original.clone();

    expect(cloned.toSQL()).toBe(original.toSQL());
  });

  it('clone preserves updateRawSets', () => {
    const original = QueryBuilder.table('users')
      .updateRaw({ count: 'count + 1' })
      .where(['id']);

    const cloned = original.clone();

    expect(cloned.toSQL()).toBe(original.toSQL());
  });
});
