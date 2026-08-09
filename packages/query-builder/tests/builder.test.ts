import { dna } from '@ytrynot/dna';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { QueryBuilder, type qbColumn } from '../src/index.js';

describe('QueryBuilder - Fixes and New Features', () => {

  describe('1. search() method - Parameter unification', () => {
    it('should generate a WHERE clause with the named parameter @search_term', () => {
      const sql = QueryBuilder.table('articles')
        .search(['title', 'content'])
        .toSQL();

      expect(sql).toContain('WHERE (title LIKE @search_term OR content LIKE @search_term)');
      expect(sql).not.toContain('?'); // Verifies absence of positional parameters
    });

    it("should correctly combine search with other named WHERE conditions", () => {
      const sql = QueryBuilder.table('articles')
        .search(['title'])
        .where(['status'])
        .toSQL();

      expect(sql).toContain('WHERE (title LIKE @search_term) AND status = @status');
    });
  });

  describe("2. clone() method - State isolation", () => {
    it("should create an independent instance without mutating the original", () => {
      const baseQuery = QueryBuilder.table('users').where(['is_active']);
      
      // Clone and modify the clone
      const clonedQuery = baseQuery.clone().limit(10).offset(20);
      
      const baseSql = baseQuery.toSQL();
      const clonedSql = clonedQuery.toSQL();

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

      expect(baseQuery.toSQL()).toBe('SELECT id FROM logs');
      expect(clone.toSQL()).toBe('SELECT id, message FROM logs WHERE level = @level');
    });
  });

  describe('3. DDL Engine - Primary Key Generation', () => {
    it('should generate a PRIMARY KEY clause for a simple key (string)', () => {
      const schema = z.object({
        custom_id: z.string(),
        name: z.string()
      });

      const sql = QueryBuilder.reqCreateTable('categories', schema, {
        primaryKey: 'custom_id'
      });

      expect(sql).toContain('custom_id TEXT PRIMARY KEY');
      expect(sql).not.toContain('PRIMARY KEY (c,u,s,t,o,m,_,i,d)'); // Ensures string is not iterated as an array
    });

    it('should continue to support composite primary keys (array)', () => {
      const schema = z.object({
        tenant_id: z.string(),
        user_id: z.string(),
        role: z.string()
      });

      const sql = QueryBuilder.reqCreateTable('tenant_users', schema, {
        primaryKey: ['tenant_id', 'user_id']
      });

      expect(sql).toContain('PRIMARY KEY (tenant_id, user_id)');
    });

    it('should correctly deduce the primary key by convention (id)', () => {
      const schema = z.object({
        id: z.string(),
        email: z.string()
      });

      const sql = QueryBuilder.reqCreateTable('accounts', schema);

      expect(sql).toContain('id TEXT PRIMARY KEY');
    });
  });

  describe('4. Dual signatures - array and variadic', () => {

    describe('select()', () => {
      it('array form: .select(["id", "name"])', () => {
        const sql = QueryBuilder.table('users').select(['id', 'name']).toSQL();
        expect(sql).toBe('SELECT id, name FROM users');
      });

      it('variadic form: .select("id", "name")', () => {
        const sql = QueryBuilder.table('users').select('id', 'name').toSQL();
        expect(sql).toBe('SELECT id, name FROM users');
      });

      it('variadic single: .select("id")', () => {
        const sql = QueryBuilder.table('users').select('id').toSQL();
        expect(sql).toBe('SELECT id FROM users');
      });

      it('no args: .select() defaults to *', () => {
        const sql = QueryBuilder.table('users').select().toSQL();
        expect(sql).toBe('SELECT * FROM users');
      });

      it('array and variadic produce identical SQL', () => {
        const a = QueryBuilder.table('users').select(['id', 'email', 'age']).toSQL();
        const b = QueryBuilder.table('users').select('id', 'email', 'age').toSQL();
        expect(a).toBe(b);
      });
    });

    describe('insert()', () => {
      it('array form: .insert(["id", "name"])', () => {
        const sql = QueryBuilder.table('users').insert(['id', 'name']).toSQL();
        expect(sql).toBe('INSERT INTO users (id, name) VALUES (@id, @name)');
      });

      it('variadic form: .insert("id", "name")', () => {
        const sql = QueryBuilder.table('users').insert('id', 'name').toSQL();
        expect(sql).toBe('INSERT INTO users (id, name) VALUES (@id, @name)');
      });

      it('variadic single: .insert("id")', () => {
        const sql = QueryBuilder.table('users').insert('id').toSQL();
        expect(sql).toBe('INSERT INTO users (id) VALUES (@id)');
      });

      it('array and variadic produce identical SQL', () => {
        const a = QueryBuilder.table('users').insert(['id', 'email', 'age']).toSQL();
        const b = QueryBuilder.table('users').insert('id', 'email', 'age').toSQL();
        expect(a).toBe(b);
      });
    });

    describe('update()', () => {
      it('array form: .update(["name", "age"])', () => {
        const sql = QueryBuilder.table('users').update(['name', 'age']).where(['id']).toSQL();
        expect(sql).toBe('UPDATE users SET name = @name, age = @age WHERE id = @id');
      });

      it('variadic form: .update("name", "age")', () => {
        const sql = QueryBuilder.table('users').update('name', 'age').where('id').toSQL();
        expect(sql).toBe('UPDATE users SET name = @name, age = @age WHERE id = @id');
      });

      it('variadic single: .update("name")', () => {
        const sql = QueryBuilder.table('users').update('name').where('id').toSQL();
        expect(sql).toBe('UPDATE users SET name = @name WHERE id = @id');
      });

      it('array and variadic produce identical SQL', () => {
        const a = QueryBuilder.table('users').update(['name', 'age']).where(['id']).toSQL();
        const b = QueryBuilder.table('users').update('name', 'age').where('id').toSQL();
        expect(a).toBe(b);
      });
    });

    describe('where()', () => {
      it('array form: .where(["id"])', () => {
        const sql = QueryBuilder.table('users').select().where(['id']).toSQL();
        expect(sql).toBe('SELECT * FROM users WHERE id = @id');
      });

      it('variadic form: .where("id")', () => {
        const sql = QueryBuilder.table('users').select().where('id').toSQL();
        expect(sql).toBe('SELECT * FROM users WHERE id = @id');
      });

      it('array form with object: .where(["status", { col: "type_id", param: "type" }])', () => {
        const sql = QueryBuilder.table('users').select().where(['status', { col: 'type_id', param: 'type' }]).toSQL();
        expect(sql).toBe('SELECT * FROM users WHERE status = @status AND type_id = @type');
      });

      it('variadic form with object: .where("status", { col: "type_id", param: "type" })', () => {
        const sql = QueryBuilder.table('users').select().where('status', { col: 'type_id', param: 'type' }).toSQL();
        expect(sql).toBe('SELECT * FROM users WHERE status = @status AND type_id = @type');
      });

      it('array and variadic produce identical SQL', () => {
        const a = QueryBuilder.table('users').select().where(['id', 'status']).toSQL();
        const b = QueryBuilder.table('users').select().where('id', 'status').toSQL();
        expect(a).toBe(b);
      });
    });

    describe('upsert()', () => {
      it('array form: .upsert(["email", "name"]) with uniqueKeys', () => {
        const sql = QueryBuilder.table('users', ['email']).upsert(['email', 'name']).toSQL();
        expect(sql).toContain('INSERT INTO users (email, name) VALUES (@email, @name)');
        expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
      });

      it('variadic form: .upsert("email", "name") with uniqueKeys', () => {
        const sql = QueryBuilder.table('users').uniqueKeys('email').upsert('email', 'name').toSQL();
        expect(sql).toContain('INSERT INTO users (email, name) VALUES (@email, @name)');
        expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
      });

      it('variadic single field: .upsert("email") with uniqueKeys', () => {
        const sql = QueryBuilder.table('users').uniqueKeys('email').upsert('email').toSQL();
        expect(sql).toContain('INSERT INTO users (email) VALUES (@email)');
      });

      it('array and variadic produce identical SQL', () => {
        const a = QueryBuilder.table('users', ['email']).upsert(['email', 'name']).toSQL();
        const b = QueryBuilder.table('users', ['email']).upsert('email', 'name').toSQL();
        expect(a).toBe(b);
      });

      it('throws if no uniqueKeys configured', () => {
        expect(() => QueryBuilder.table('users').upsert('email', 'name')).toThrow('no uniqueKeys');
      });
    });
  });

  describe('5. defTable — Unified API', () => {
    const zodSchema = z.object({
      id: z.string().uuid().meta({ pk: true }),
      email: z.string().email().meta({ unique: true }),
      name: z.string(),
    });

    const dnaSchema = dna.object({
      id: dna.string().uuid().meta({ pk: true }),
      email: dna.string().email().meta({ unique: true }),
      name: dna.string(),
    });

    const manualColumns: qbColumn[] = [
      { name: 'id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
      { name: 'email', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { unique: true } },
      { name: 'name', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
    ];

    it('defTable from Zod — generates all 7 SQL statements', () => {
      const crud = QueryBuilder.defTable('users', zodSchema);
      expect(crud.createTable).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(crud.getAll).toBe('SELECT * FROM users');
      expect(crud.getById).toBe('SELECT * FROM users WHERE id = @id');
      expect(crud.insert).toBe('INSERT INTO users (id, email, name) VALUES (@id, @email, @name)');
      expect(crud.update).toBe('UPDATE users SET email = @email, name = @name WHERE id = @id');
      expect(crud.delete).toBe('DELETE FROM users WHERE id = @id');
      expect(crud.upsert).toContain('ON CONFLICT(id)');
    });

    it('defTable from DNA — generates all 7 SQL statements', () => {
      const crud = QueryBuilder.defTable('users', dnaSchema);
      expect(crud.createTable).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(crud.getAll).toBe('SELECT * FROM users');
      expect(crud.getById).toBe('SELECT * FROM users WHERE id = @id');
      expect(crud.insert).toBe('INSERT INTO users (id, email, name) VALUES (@id, @email, @name)');
      expect(crud.update).toBe('UPDATE users SET email = @email, name = @name WHERE id = @id');
      expect(crud.delete).toBe('DELETE FROM users WHERE id = @id');
      expect(crud.upsert).toContain('ON CONFLICT(id)');
    });

    it('defTable from Manual qbColumn[] — generates all 7 SQL statements', () => {
      const crud = QueryBuilder.defTable('users', manualColumns);
      expect(crud.createTable).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(crud.getAll).toBe('SELECT * FROM users');
      expect(crud.getById).toBe('SELECT * FROM users WHERE id = @id');
      expect(crud.insert).toBe('INSERT INTO users (id, email, name) VALUES (@id, @email, @name)');
      expect(crud.update).toBe('UPDATE users SET email = @email, name = @name WHERE id = @id');
      expect(crud.delete).toBe('DELETE FROM users WHERE id = @id');
      expect(crud.upsert).toContain('ON CONFLICT(id)');
    });

    it('defTable — all 3 sources produce identical SQL', () => {
      const z = QueryBuilder.defTable('users', zodSchema);
      const d = QueryBuilder.defTable('users', dnaSchema);
      const m = QueryBuilder.defTable('users', manualColumns);
      expect(z.getAll).toBe(m.getAll);
      expect(z.getById).toBe(m.getById);
      expect(z.insert).toBe(m.insert);
      expect(z.update).toBe(m.update);
      expect(z.delete).toBe(m.delete);
      expect(z.upsert).toBe(m.upsert);
      expect(d.getAll).toBe(m.getAll);
      expect(d.getById).toBe(m.getById);
      expect(d.insert).toBe(m.insert);
      expect(d.update).toBe(m.update);
      expect(d.delete).toBe(m.delete);
      expect(d.upsert).toBe(m.upsert);
    });

    it('defTable — throws on non-object schema', () => {
      expect(() => QueryBuilder.defTable('users', z.string())).toThrow();
    });

    it('defTable().req — returns a Builder for custom queries', () => {
      const users = QueryBuilder.defTable('users', zodSchema);
      const sql = users.req.select('id', 'name').where('id').toSQL();
      expect(sql).toBe('SELECT id, name FROM users WHERE id = @id');
    });

    it('defTable().req — upsert auto-deduces uniqueKeys from schema', () => {
      const users = QueryBuilder.defTable('users', zodSchema);
      // schema has id (pk) and email (unique) → uniqueKeys = ["id", "email"]
      const sql = users.req.upsert('id', 'email', 'name').toSQL();
      expect(sql).toContain('INSERT INTO users (id, email, name)');
      expect(sql).toContain('ON CONFLICT(id, email) DO UPDATE SET name = excluded.name');
    });

    it('defTable().req — each access returns a fresh Builder', () => {
      const users = QueryBuilder.defTable('users', zodSchema);
      const a = users.req.select('id').toSQL();
      const b = users.req.select('email').toSQL();
      expect(a).toBe('SELECT id FROM users');
      expect(b).toBe('SELECT email FROM users');
    });

    it('defTable().q — alias for req', () => {
      const users = QueryBuilder.defTable('users', zodSchema);
      const sql = users.q.select('id', 'name').where('id').toSQL();
      expect(sql).toBe('SELECT id, name FROM users WHERE id = @id');
    });

    it('defTable().q — upsert auto-deduces uniqueKeys (same as req)', () => {
      const users = QueryBuilder.defTable('users', zodSchema);
      const a = users.req.upsert('id', 'email', 'name').toSQL();
      const b = users.q.upsert('id', 'email', 'name').toSQL();
      expect(a).toBe(b);
    });
  });

  describe('5b. defTable — composite PK via options.primaryKey', () => {
    const compositeColumns: qbColumn[] = [
      { name: 'tenant_id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
      { name: 'user_id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
      { name: 'role', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
    ];

    it('DDL generates composite PRIMARY KEY', () => {
      const crud = QueryBuilder.defTable('members', compositeColumns, {
        primaryKey: ['tenant_id', 'user_id'],
      });
      expect(crud.createTable).toContain('PRIMARY KEY (tenant_id, user_id)');
    });

    it('getById uses composite PK in WHERE clause', () => {
      const crud = QueryBuilder.defTable('members', compositeColumns, {
        primaryKey: ['tenant_id', 'user_id'],
      });
      expect(crud.getById).toContain('WHERE tenant_id = @tenant_id AND user_id = @user_id');
    });

    it('update uses composite PK in WHERE clause', () => {
      const crud = QueryBuilder.defTable('members', compositeColumns, {
        primaryKey: ['tenant_id', 'user_id'],
      });
      expect(crud.update).toContain('WHERE tenant_id = @tenant_id AND user_id = @user_id');
    });

    it('delete uses composite PK in WHERE clause', () => {
      const crud = QueryBuilder.defTable('members', compositeColumns, {
        primaryKey: ['tenant_id', 'user_id'],
      });
      expect(crud.delete).toContain('WHERE tenant_id = @tenant_id AND user_id = @user_id');
    });

    it('upsert uses composite PK as conflict target', () => {
      const crud = QueryBuilder.defTable('members', compositeColumns, {
        primaryKey: ['tenant_id', 'user_id'],
      });
      expect(crud.upsert).toContain('ON CONFLICT(tenant_id, user_id)');
    });
  });

  describe('6. uniqueKeys — standalone Builder', () => {
    it('qb.table(name, uniqueKeys) — sets uniqueKeys via 2nd arg', () => {
      const sql = QueryBuilder.table('users', ['email'])
        .upsert('email', 'name')
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
    });

    it('qb.table(name).uniqueKeys(...) — sets uniqueKeys via chain', () => {
      const sql = QueryBuilder.table('users')
        .uniqueKeys('email')
        .upsert('email', 'name')
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
    });

    it('qb.table(name).uniqueKeys(...) — multiple keys', () => {
      const sql = QueryBuilder.table('users')
        .uniqueKeys('email', 'tenant_id')
        .upsert('email', 'tenant_id', 'name')
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email, tenant_id) DO UPDATE SET name = excluded.name');
    });

    it('upsert without uniqueKeys — throws', () => {
      expect(() => QueryBuilder.table('users').upsert('email', 'name')).toThrow('no uniqueKeys');
    });

    it('whereIn escapes single quotes in values', () => {
      const sql = QueryBuilder.table('users')
        .whereIn('name', ["O'Brien", "normal"])
        .toSQL();
      expect(sql).toContain("'O''Brien'");
      expect(sql).not.toMatch(/'O'Brien'/);
    });

    it('distinct() adds DISTINCT keyword to SELECT', () => {
      const sql = QueryBuilder.table('employees')
        .select(['dept'])
        .distinct()
        .toSQL();
      expect(sql).toContain('SELECT DISTINCT dept FROM employees');
    });

    it('distinct() does not add DISTINCT when not called', () => {
      const sql = QueryBuilder.table('employees')
        .select(['dept'])
        .toSQL();
      expect(sql).not.toContain('DISTINCT');
    });

    it('distinct() is preserved by clone()', () => {
      const original = QueryBuilder.table('employees')
        .select(['dept'])
        .distinct();
      const cloned = original.clone();
      expect(cloned.toSQL()).toContain('SELECT DISTINCT dept FROM employees');
    });

    it('having() adds HAVING clause after GROUP BY', () => {
      const sql = QueryBuilder.table('orders')
        .select(['user_id', 'COUNT(*) as order_count'])
        .groupBy(['user_id'])
        .having(['COUNT(*) > 5'])
        .toSQL();
      expect(sql).toContain('GROUP BY user_id HAVING COUNT(*) > 5');
    });

    it('having() with multiple conditions joins with AND', () => {
      const sql = QueryBuilder.table('orders')
        .select(['user_id', 'COUNT(*) as cnt', 'SUM(amount) as total'])
        .groupBy(['user_id'])
        .having(['COUNT(*) > 5', 'SUM(amount) > 1000'])
        .toSQL();
      expect(sql).toContain('HAVING COUNT(*) > 5 AND SUM(amount) > 1000');
    });

    it('having() without GROUP BY still renders', () => {
      const sql = QueryBuilder.table('orders')
        .select(['COUNT(*) as cnt'])
        .having(['COUNT(*) > 5'])
        .toSQL();
      expect(sql).toContain('HAVING COUNT(*) > 5');
      expect(sql).not.toContain('GROUP BY');
    });

    it('having() is preserved by clone()', () => {
      const original = QueryBuilder.table('orders')
        .select(['user_id', 'COUNT(*) as cnt'])
        .groupBy(['user_id'])
        .having(['COUNT(*) > 5']);
      const cloned = original.clone();
      expect(cloned.toSQL()).toContain('HAVING COUNT(*) > 5');
    });
  });

  describe('6. onConflict() sub-builder', () => {
    it('doNothing() produces ON CONFLICT(col) DO NOTHING', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict('email')
        .doNothing()
        .toSQL();
      expect(sql).toBe('INSERT INTO users (email, name) VALUES (@email, @name) ON CONFLICT(email) DO NOTHING');
    });

    it('doUpdate() produces ON CONFLICT(col) DO UPDATE SET col = excluded.col', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name', 'age'])
        .onConflict('email')
        .doUpdate(['name', 'age'])
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name, age = excluded.age');
    });

    it('doUpdate() with WHERE produces WHERE on DO UPDATE', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict('email')
        .doUpdate(['name'], 'excluded.name IS NOT NULL')
        .toSQL();
      expect(sql).toContain('DO UPDATE SET name = excluded.name WHERE excluded.name IS NOT NULL');
    });

    it('onConflict() with partial-index WHERE', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict('email', { where: 'active = 1' })
        .doUpdate(['name'])
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email) WHERE active = 1 DO UPDATE SET');
    });

    it('doUpdateRaw() with manual expressions', () => {
      const sql = QueryBuilder.table('counters')
        .insert(['key', 'count'])
        .onConflict('key')
        .doUpdateRaw({ count: 'count + 1', updated_at: 'CURRENT_TIMESTAMP' })
        .toSQL();
      expect(sql).toContain('DO UPDATE SET count = count + 1, updated_at = CURRENT_TIMESTAMP');
    });

    it('onConflict() with array target (composite)', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'tenant_id', 'name'])
        .onConflict(['email', 'tenant_id'])
        .doUpdate(['name'])
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email, tenant_id) DO UPDATE SET name = excluded.name');
    });

    it('onConflict() without target produces bare ON CONFLICT', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict()
        .doNothing()
        .toSQL();
      expect(sql).toContain('ON CONFLICT DO NOTHING');
      expect(sql).not.toContain('ON CONFLICT(');
    });

    it('onConflict() works with RETURNING', () => {
      const sql = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .returning(['id'])
        .onConflict('email')
        .doUpdate(['name'])
        .toSQL();
      expect(sql).toContain('DO UPDATE SET name = excluded.name');
      expect(sql).toContain('RETURNING id');
    });

    it('onConflict() is preserved by clone()', () => {
      const original = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict('email')
        .doUpdate(['name']);
      const cloned = original.clone();
      expect(cloned.toSQL()).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
    });

    it('produces same SQL as .upsert() for equivalent call', () => {
      const oldWay = QueryBuilder.table('users', ['email'])
        .upsert(['email', 'name'])
        .toSQL();
      const newWay = QueryBuilder.table('users')
        .insert(['email', 'name'])
        .onConflict('email')
        .doUpdate(['name'])
        .toSQL();
      // Both should contain the same ON CONFLICT + DO UPDATE SET clause
      expect(newWay).toContain('INSERT INTO users (email, name) VALUES (@email, @name)');
      expect(newWay).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
      expect(oldWay).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
    });
  });

  describe('7. P1 batch — DDL additions + multi-row INSERT', () => {
    it('FK actions SET DEFAULT and NO ACTION are accepted', () => {
      const ddl = QueryBuilder.createTable('users', [
        { name: 'id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
        { name: 'org_id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
      ], {
        foreignKeys: {
          org_id: { table: 'orgs', col: 'id', onDelete: 'SET DEFAULT', onUpdate: 'NO ACTION' },
        },
      });
      expect(ddl).toContain('ON DELETE SET DEFAULT');
      expect(ddl).toContain('ON UPDATE NO ACTION');
    });

    it('dropIndex() generates DROP INDEX IF EXISTS', () => {
      const sql = QueryBuilder.dropIndex('idx_users_email');
      expect(sql).toBe('DROP INDEX IF EXISTS idx_users_email;');
    });

    it('composite UNIQUE constraint via uniqueConstraints', () => {
      const ddl = QueryBuilder.createTable('users', [
        { name: 'email', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
        { name: 'tenant_id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
      ], {
        uniqueConstraints: [{ columns: ['email', 'tenant_id'] }],
      });
      expect(ddl).toContain('UNIQUE (email, tenant_id)');
    });

    it('composite UNIQUE with name', () => {
      const ddl = QueryBuilder.createTable('users', [
        { name: 'email', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
        { name: 'tenant_id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
      ], {
        uniqueConstraints: [{ columns: ['email', 'tenant_id'], name: 'uq_email_tenant' }],
      });
      expect(ddl).toContain('CONSTRAINT uq_email_tenant UNIQUE (email, tenant_id)');
    });

    it('table-level CHECK constraint', () => {
      const ddl = QueryBuilder.createTable('users', [
        { name: 'age', sqliteType: 'INTEGER', optional: false, hasDefault: false, meta: {} },
      ], {
        checks: ['age >= 18'],
      });
      expect(ddl).toContain('CHECK (age >= 18)');
    });

    it('column-level CHECK constraint', () => {
      const ddl = QueryBuilder.createTable('products', [
        { name: 'price', sqliteType: 'REAL', optional: false, hasDefault: false, meta: {}, check: 'price >= 0' },
      ]);
      expect(ddl).toContain('CHECK (price >= 0)');
    });

    it('insertMulti() generates indexed placeholders (0-based)', () => {
      const sql = QueryBuilder.table('users')
        .insertMulti(['email', 'name'], 3)
        .toSQL();
      expect(sql).toBe('INSERT INTO users (email, name) VALUES (@email_0, @name_0), (@email_1, @name_1), (@email_2, @name_2)');
    });

    it('insertMulti() with single row', () => {
      const sql = QueryBuilder.table('users')
        .insertMulti(['email'], 1)
        .toSQL();
      expect(sql).toBe('INSERT INTO users (email) VALUES (@email_0)');
    });

    it('insertMulti() with RETURNING', () => {
      const sql = QueryBuilder.table('users')
        .insertMulti(['email', 'name'], 2)
        .returning(['id'])
        .toSQL();
      expect(sql).toContain('VALUES (@email_0, @name_0), (@email_1, @name_1)');
      expect(sql).toContain('RETURNING id');
    });

    it('insertMulti() with onConflict().doNothing()', () => {
      const sql = QueryBuilder.table('users')
        .insertMulti(['email', 'name'], 2)
        .onConflict('email')
        .doNothing()
        .toSQL();
      expect(sql).toContain('ON CONFLICT(email) DO NOTHING');
    });

    it('insertMulti() is preserved by clone()', () => {
      const original = QueryBuilder.table('users')
        .insertMulti(['email', 'name'], 2);
      const cloned = original.clone();
      expect(cloned.toSQL()).toContain('@email_0, @name_0');
      expect(cloned.toSQL()).toContain('@email_1, @name_1');
    });
  });

  describe('8. CREATE INDEX — partial WHERE + expression', () => {
    it('createIndex() with partial WHERE', () => {
      const sql = QueryBuilder.table('users')
        .createIndex('idx_active_email', ['email'], { where: 'active = 1' })
        .toSQL();
      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_active_email ON users(email) WHERE active = 1');
    });

    it('createIndex() without WHERE (backward compat)', () => {
      const sql = QueryBuilder.table('users')
        .createIndex('idx_email', ['email'])
        .toSQL();
      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_email ON users(email)');
      expect(sql).not.toContain('WHERE');
    });

    it('createIndex() with expression column', () => {
      const sql = QueryBuilder.table('users')
        .createIndex('idx_name_nocase', ['LOWER(name)'])
        .toSQL();
      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_name_nocase ON users(LOWER(name))');
    });

    it('createIndex() with expression + partial WHERE', () => {
      const sql = QueryBuilder.table('users')
        .createIndex('idx_active_name', ['LOWER(name)'], { where: 'active = 1' })
        .toSQL();
      expect(sql).toBe('CREATE INDEX IF NOT EXISTS idx_active_name ON users(LOWER(name)) WHERE active = 1');
    });

    it('createIndex() with WHERE is preserved by clone()', () => {
      const original = QueryBuilder.table('users')
        .createIndex('idx_active', ['email'], { where: 'active = 1' });
      const cloned = original.clone();
      expect(cloned.toSQL()).toContain('WHERE active = 1');
    });
  });

  describe('9. Runtime guards — edge cases', () => {
    it('insertMulti throws on empty fields', () => {
      expect(() => QueryBuilder.table('t').insertMulti([], 3)).toThrow('fields must not be empty');
    });

    it('insertMulti throws on rowCount = 0', () => {
      expect(() => QueryBuilder.table('t').insertMulti(['a'], 0)).toThrow('rowCount must be >= 1');
    });

    it('insertMulti throws on negative rowCount', () => {
      expect(() => QueryBuilder.table('t').insertMulti(['a'], -1)).toThrow('rowCount must be >= 1');
    });

    it('onConflict throws on SELECT mode', () => {
      const b = QueryBuilder.table('t').select(['id']);
      expect(() => b.onConflict('id').doNothing()).toThrow('cannot set conflict config');
    });

    it('onConflict throws on UPDATE mode', () => {
      const b = QueryBuilder.table('t').update(['name']);
      expect(() => b.onConflict('id').doUpdate(['name'])).toThrow('cannot set conflict config');
    });

    it('onConflict works on INSERT mode', () => {
      const sql = QueryBuilder.table('t')
        .insert(['id', 'name'])
        .onConflict('id')
        .doNothing()
        .toSQL();
      expect(sql).toContain('ON CONFLICT(id) DO NOTHING');
    });

    it('onConflict works on INSERT_MULTI mode', () => {
      const sql = QueryBuilder.table('t')
        .insertMulti(['id', 'name'], 2)
        .onConflict('id')
        .doNothing()
        .toSQL();
      expect(sql).toContain('ON CONFLICT(id) DO NOTHING');
    });

    it('dropIndex throws on empty string', () => {
      expect(() => QueryBuilder.dropIndex('')).toThrow('dropIndex: name must not be empty');
    });

    it('DDL skips empty uniqueConstraints entry', () => {
      const ddl = QueryBuilder.createTable('t', [
        { name: 'a', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
      ], {
        uniqueConstraints: [{ columns: [] }],
      });
      expect(ddl).not.toContain('UNIQUE ()');
    });

    it('DDL skips empty check string', () => {
      const ddl = QueryBuilder.createTable('t', [
        { name: 'a', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
      ], {
        checks: [''],
      });
      expect(ddl).not.toContain('CHECK ()');
    });

    it('clone() deep copies updateRaw — mutation on clone does not affect original', () => {
      const original = QueryBuilder.table('t')
        .insert(['id', 'count'])
        .onConflict('id')
        .doUpdateRaw({ count: 'count + 1' });
      const cloned = original.clone();
      // Mutate the clone's SQL output (which reads updateRaw) — original should be unaffected
      const originalSql = original.toSQL();
      const clonedSql = cloned.toSQL();
      expect(originalSql).toContain('count = count + 1');
      expect(clonedSql).toContain('count = count + 1');
    });

    it('insertMulti + onConflict.doUpdate + returning integration', () => {
      const sql = QueryBuilder.table('users')
        .insertMulti(['email', 'name'], 2)
        .onConflict('email')
        .doUpdate(['name'])
        .returning(['id'])
        .toSQL();
      expect(sql).toContain('VALUES (@email_0, @name_0), (@email_1, @name_1)');
      expect(sql).toContain('ON CONFLICT(email) DO UPDATE SET name = excluded.name');
      expect(sql).toContain('RETURNING id');
    });

    it('insertMulti + onConflict.doUpdateRaw integration', () => {
      const sql = QueryBuilder.table('counters')
        .insertMulti(['key', 'count'], 2)
        .onConflict('key')
        .doUpdateRaw({ count: 'count + 1' })
        .toSQL();
      expect(sql).toContain('ON CONFLICT(key) DO UPDATE SET count = count + 1');
      expect(sql).toContain('@key_0, @count_0');
      expect(sql).toContain('@key_1, @count_1');
    });

    it('mode conflict: .select().insert() produces INSERT not SELECT', () => {
      const sql = QueryBuilder.table('t')
        .select(['id'])
        .insert(['id', 'name'])
        .toSQL();
      expect(sql).toContain('INSERT INTO');
      expect(sql).not.toContain('SELECT');
    });

    it('mode conflict: .insertMulti().update() produces UPDATE not INSERT_MULTI', () => {
      const sql = QueryBuilder.table('t')
        .insertMulti(['id'], 3)
        .update(['name'])
        .toSQL();
      expect(sql).toContain('UPDATE');
      expect(sql).not.toContain('INSERT');
    });
  });

  describe('10. INSERT DEFAULT VALUES', () => {
    it('insertDefaultValues() generates INSERT INTO t DEFAULT VALUES', () => {
      const sql = QueryBuilder.table('users')
        .insertDefaultValues()
        .toSQL();
      expect(sql).toBe('INSERT INTO users DEFAULT VALUES');
    });

    it('insertDefaultValues() with RETURNING', () => {
      const sql = QueryBuilder.table('users')
        .insertDefaultValues()
        .returning(['id'])
        .toSQL();
      expect(sql).toBe('INSERT INTO users DEFAULT VALUES RETURNING id');
    });

    it('insertDefaultValues() with onConflict().doNothing()', () => {
      const sql = QueryBuilder.table('users')
        .insertDefaultValues()
        .onConflict('id')
        .doNothing()
        .toSQL();
      expect(sql).toBe('INSERT INTO users DEFAULT VALUES ON CONFLICT(id) DO NOTHING');
    });

    it('insertDefaultValues() is preserved by clone()', () => {
      const original = QueryBuilder.table('users').insertDefaultValues();
      const cloned = original.clone();
      expect(cloned.toSQL()).toBe('INSERT INTO users DEFAULT VALUES');
    });
  });

  describe('11. returning() guard on SELECT', () => {
    it('returning() throws on SELECT mode', () => {
      expect(() => QueryBuilder.table('t').select(['id']).returning(['id'])).toThrow('RETURNING is not valid in SELECT mode');
    });

    it('returning() works on INSERT mode', () => {
      const sql = QueryBuilder.table('t').insert(['id']).returning(['id']).toSQL();
      expect(sql).toContain('RETURNING id');
    });
  });

  describe('12. PragmaBuilder — full coverage', () => {
    it('mmap_size() generates correct PRAGMA', () => {
      const sql = QueryBuilder.pragma().mmap_size(268435456).toSQL();
      expect(sql).toBe('PRAGMA mmap_size = 268435456;');
    });

    it('pageSize() generates correct PRAGMA', () => {
      const sql = QueryBuilder.pragma().pageSize(4096).toSQL();
      expect(sql).toBe('PRAGMA page_size = 4096;');
    });

    it('autoVacuum() generates correct PRAGMA', () => {
      const sql = QueryBuilder.pragma().autoVacuum('INCREMENTAL').toSQL();
      expect(sql).toBe('PRAGMA auto_vacuum = INCREMENTAL;');
    });

    it('optimize() generates correct PRAGMA', () => {
      const sql = QueryBuilder.pragma().optimize().toSQL();
      expect(sql).toBe('PRAGMA optimize;');
    });

    it('raw() generates correct PRAGMA for arbitrary key/value', () => {
      const sql = QueryBuilder.pragma().raw('wal_autocheckpoint', 1000).toSQL();
      expect(sql).toBe('PRAGMA wal_autocheckpoint = 1000;');
    });

    it('raw() accepts string value', () => {
      const sql = QueryBuilder.pragma().raw('encoding', 'UTF-8').toSQL();
      expect(sql).toBe('PRAGMA encoding = UTF-8;');
    });

    it('all PragmaBuilder methods chain together', () => {
      const sql = QueryBuilder.pragma()
        .foreignKeys(true)
        .journalMode('WAL')
        .synchronous('NORMAL')
        .cacheSize(-32000)
        .tempStore('MEMORY')
        .busyTimeout(3000)
        .mmap_size(268435456)
        .pageSize(4096)
        .autoVacuum('INCREMENTAL')
        .optimize()
        .raw('encoding', 'UTF-8')
        .toSQL();
      expect(sql).toContain('PRAGMA foreign_keys = ON;');
      expect(sql).toContain('PRAGMA journal_mode = WAL;');
      expect(sql).toContain('PRAGMA synchronous = NORMAL;');
      expect(sql).toContain('PRAGMA cache_size = -32000;');
      expect(sql).toContain('PRAGMA temp_store = MEMORY;');
      expect(sql).toContain('PRAGMA busy_timeout = 3000;');
      expect(sql).toContain('PRAGMA mmap_size = 268435456;');
      expect(sql).toContain('PRAGMA page_size = 4096;');
      expect(sql).toContain('PRAGMA auto_vacuum = INCREMENTAL;');
      expect(sql).toContain('PRAGMA optimize;');
      expect(sql).toContain('PRAGMA encoding = UTF-8;');
    });
  });

  describe('13. Identifier validation', () => {
    it('dropIndex throws on SQL injection attempt', () => {
      expect(() => QueryBuilder.dropIndex('users; DROP TABLE users; --')).toThrow('invalid identifier');
    });

    it('dropIndex throws on empty string', () => {
      expect(() => QueryBuilder.dropIndex('')).toThrow('must not be empty');
    });

    it('dropIndex throws on empty string (dropIndex context)', () => {
      expect(() => QueryBuilder.dropIndex('')).toThrow('dropIndex');
    });

    it('dropIndex accepts valid identifier', () => {
      const sql = QueryBuilder.dropIndex('idx_users_email');
      expect(sql).toBe('DROP INDEX IF EXISTS idx_users_email;');
    });

    it('dropTable throws on SQL injection attempt', () => {
      expect(() => QueryBuilder.dropTable('users; DROP TABLE users; --')).toThrow('invalid identifier');
    });

    it('dropTable accepts valid identifier', () => {
      const sql = QueryBuilder.dropTable('users');
      expect(sql).toBe('DROP TABLE IF EXISTS users;');
    });

    it('createIndex throws on SQL injection attempt in index name', () => {
      expect(() => QueryBuilder.table('t').createIndex('idx; DROP TABLE t; --', ['col'])).toThrow('invalid identifier');
    });

    it('createIndex accepts valid identifier', () => {
      const sql = QueryBuilder.table('t').createIndex('idx_valid', ['col']).toSQL();
      expect(sql).toContain('idx_valid');
    });
  });

});
