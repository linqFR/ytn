import { describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index.js';
import {
  drivers,
  schemaSources,
  type DbDriver,
} from './e2e-helpers.js';

// ─── E2E Lifecycle Suite ────────────────────────────────────────────
// Tests the full CRUD lifecycle (PRAGMA → CREATE → INSERT → SELECT →
// UPDATE → UPSERT → DELETE → DROP) against both drivers and both
// schema sources (Zod + DNA).

for (const driver of drivers) {
  for (const source of schemaSources) {
    describe(`E2E Lifecycle — ${driver.name} — ${source.name}`, () => {
      it('PRAGMA → CREATE → INSERT → SELECT → UPDATE → UPSERT → DELETE → DROP', () => {
        const db = driver.make();

        // ── PRAGMA setup ────────────────────────────────────────────
        const pragmaSql = QueryBuilder.pragma()
          .foreignKeys(true)
          .busyTimeout(5000)
          .toSQL();
        expect(() => db.exec(pragmaSql)).not.toThrow();

        // Verify foreign_keys pragma took effect
        const fkRow = db.prepare('PRAGMA foreign_keys').get() as {
          foreign_keys?: number;
        };
        expect(Number(fkRow?.foreign_keys ?? 0)).toBe(1);

        // ── CREATE TABLE ────────────────────────────────────────────
        const userCrud = source.userCrud();
        expect(() => db.exec(userCrud.createTable)).not.toThrow();

        // ── CREATE INDEX ────────────────────────────────────────────
        const indexSql = QueryBuilder.table('users')
          .createIndex('idx_users_email', ['email'])
          .toSQL();
        expect(() => db.exec(indexSql)).not.toThrow();

        // ── INSERT ──────────────────────────────────────────────────
        const insertStmt = db.prepare(userCrud.insert);
        insertStmt.run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'alice@test.com',
          name: 'Alice',
          age: 30,
          score: 95.5,
          bio: 'Hello',
        });
        insertStmt.run({
          id: '22222222-2222-2222-2222-222222222222',
          email: 'bob@test.com',
          name: 'Bob',
          age: 25,
          score: 80.0,
          bio: null,
        });
        insertStmt.run({
          id: '33333333-3333-3333-3333-333333333333',
          email: 'carol@test.com',
          name: 'Carol',
          age: 28,
          score: 88.3,
          bio: 'Developer',
        });

        // ── SELECT: getAll ──────────────────────────────────────────
        const allRows = db.prepare(userCrud.getAll).all();
        expect(allRows).toHaveLength(3);
        expect(allRows[0]).toHaveProperty('email');
        expect(allRows[0]).toHaveProperty('name');

        // ── SELECT: getById ─────────────────────────────────────────
        const one = db.prepare(userCrud.getById).get({
          id: '11111111-1111-1111-1111-111111111111',
        });
        expect(one).toBeDefined();
        expect(one!.name).toBe('Alice');
        expect(one!.age).toBe(30);

        // ── SELECT: custom columns + WHERE ──────────────────────────
        const customSelect = QueryBuilder.table('users')
          .select(['name', 'email'])
          .where(['age'])
          .toSQL();
        const filtered = db.prepare(customSelect).all({ age: 25 });
        expect(filtered).toHaveLength(1);
        expect(filtered[0]!.name).toBe('Bob');
        expect(filtered[0]).not.toHaveProperty('age');

        // ── SELECT: ORDER BY + LIMIT + OFFSET ───────────────────────
        const paged = QueryBuilder.table('users')
          .select(['name'])
          .orderBy('age', 'DESC')
          .limit(2)
          .offset(0)
          .toSQL();
        const pagedRows = db.prepare(paged).all();
        expect(pagedRows).toHaveLength(2);
        expect(pagedRows[0]!.name).toBe('Alice'); // age 30, highest first
        expect(pagedRows[1]!.name).toBe('Carol'); // age 28

        // ── COUNT ───────────────────────────────────────────────────
        const countSql = QueryBuilder.table('users').count().toSQL();
        const countRow = db.prepare(countSql).get() as { count?: number };
        expect(Number(countRow?.count ?? 0)).toBe(3);

        // ── UPDATE ──────────────────────────────────────────────────
        db.prepare(userCrud.update).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'alice.updated@test.com',
          name: 'Alice Updated',
          age: 31,
          score: 99.9,
          bio: 'Updated bio',
        });
        const updated = db.prepare(userCrud.getById).get({
          id: '11111111-1111-1111-1111-111111111111',
        });
        expect(updated!.name).toBe('Alice Updated');
        expect(updated!.age).toBe(31);
        expect(updated!.score).toBe(99.9);

        // ── UPSERT (overwrite on PK conflict) ───────────────────────
        const upsertStmt = db.prepare(userCrud.upsert);
        // Overwrite Bob's row via upsert
        upsertStmt.run({
          id: '22222222-2222-2222-2222-222222222222',
          email: 'bob.upserted@test.com',
          name: 'Bob Upserted',
          age: 26,
          score: 85.0,
          bio: 'Upserted bio',
        });
        const upserted = db.prepare(userCrud.getById).get({
          id: '22222222-2222-2222-2222-222222222222',
        });
        expect(upserted!.name).toBe('Bob Upserted');
        expect(upserted!.email).toBe('bob.upserted@test.com');

        // Upsert a brand-new row (no conflict → insert)
        upsertStmt.run({
          id: '44444444-4444-4444-4444-444444444444',
          email: 'dave@test.com',
          name: 'Dave',
          age: 40,
          score: 70.0,
          bio: null,
        });
        const allAfterUpsert = db.prepare(userCrud.getAll).all();
        expect(allAfterUpsert).toHaveLength(4);

        // ── DELETE ──────────────────────────────────────────────────
        db.prepare(userCrud.delete).run({
          id: '44444444-4444-4444-4444-444444444444',
        });
        const afterDelete = db.prepare(userCrud.getAll).all();
        expect(afterDelete).toHaveLength(3);
        const deleted = db.prepare(userCrud.getById).get({
          id: '44444444-4444-4444-4444-444444444444',
        });
        expect(deleted).toBeUndefined();

        // ── DROP TABLE ──────────────────────────────────────────────
        const dropSql = QueryBuilder.dropTable('users');
        expect(() => db.exec(dropSql)).not.toThrow();
        // Table should no longer exist — selecting should throw
        expect(() => db.prepare(userCrud.getAll).all()).toThrow();

        db.close();
      });

      it('FK CASCADE: deleting parent removes children', () => {
        const db = driver.make();
        db.exec('PRAGMA foreign_keys = ON');

        const userCrud = source.userCrud();
        const orderCrud = source.orderCrud();

        db.exec(userCrud.createTable);
        db.exec(orderCrud.createTable);

        db.prepare(userCrud.insert).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'parent@test.com',
          name: 'Parent',
          age: 50,
          score: 100.0,
          bio: null,
        });
        db.prepare(orderCrud.insert).run({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          user_id: '11111111-1111-1111-1111-111111111111',
          total: 42.5,
          status: 'shipped',
        });
        db.prepare(orderCrud.insert).run({
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          user_id: '11111111-1111-1111-1111-111111111111',
          total: 17.0,
          status: 'pending',
        });

        // Verify children exist
        const childrenBefore = db.prepare(orderCrud.getAll).all();
        expect(childrenBefore).toHaveLength(2);

        // Delete parent → children should cascade
        db.prepare(userCrud.delete).run({
          id: '11111111-1111-1111-1111-111111111111',
        });
        const childrenAfter = db.prepare(orderCrud.getAll).all();
        expect(childrenAfter).toHaveLength(0);

        db.close();
      });

      it('DEFAULT value: omitted column gets the schema default', () => {
        const db = driver.make();
        db.exec('PRAGMA foreign_keys = ON');

        const userCrud = source.userCrud();
        const orderCrud = source.orderCrud();

        db.exec(userCrud.createTable);
        db.exec(orderCrud.createTable);

        // Insert parent
        db.prepare(userCrud.insert).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'parent@test.com',
          name: 'Parent',
          age: 40,
          score: 50.0,
          bio: null,
        });

        // Insert order WITHOUT status — should default to 'pending'
        const insertNoStatus = QueryBuilder.table('orders')
          .insert(['id', 'user_id', 'total'])
          .toSQL();
        db.prepare(insertNoStatus).run({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          user_id: '11111111-1111-1111-1111-111111111111',
          total: 99.0,
        });

        const order = db.prepare(orderCrud.getById).get({
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        });
        expect(order).toBeDefined();
        expect(order!.status).toBe('pending');

        db.close();
      });

      it('UNIQUE constraint: duplicate email is rejected', () => {
        const db = driver.make();
        const userCrud = source.userCrud();
        db.exec(userCrud.createTable);

        db.prepare(userCrud.insert).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'unique@test.com',
          name: 'First',
          age: 20,
          score: 50.0,
          bio: null,
        });

        // Second insert with same email should throw
        expect(() =>
          db.prepare(userCrud.insert).run({
            id: '22222222-2222-2222-2222-222222222222',
            email: 'unique@test.com',
            name: 'Second',
            age: 22,
            score: 60.0,
            bio: null,
          }),
        ).toThrow();

        db.close();
      });

      it('Nullable column: NULL and non-NULL values round-trip correctly', () => {
        const db = driver.make();
        const userCrud = source.userCrud();
        db.exec(userCrud.createTable);

        // Insert with NULL bio
        db.prepare(userCrud.insert).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'null-bio@test.com',
          name: 'NullBio',
          age: 20,
          score: 50.0,
          bio: null,
        });

        // Insert with non-NULL bio
        db.prepare(userCrud.insert).run({
          id: '22222222-2222-2222-2222-222222222222',
          email: 'has-bio@test.com',
          name: 'HasBio',
          age: 22,
          score: 60.0,
          bio: 'My biography',
        });

        const row1 = db.prepare(userCrud.getById).get({
          id: '11111111-1111-1111-1111-111111111111',
        });
        expect(row1!.bio).toBeNull();

        const row2 = db.prepare(userCrud.getById).get({
          id: '22222222-2222-2222-2222-222222222222',
        });
        expect(row2!.bio).toBe('My biography');

        db.close();
      });

      it('INSERT with RETURNING clause returns inserted row', () => {
        const db = driver.make();
        const userCrud = source.userCrud();
        db.exec(userCrud.createTable);

        const insertReturning = QueryBuilder.table('users')
          .insert(['id', 'email', 'name', 'age', 'score', 'bio'])
          .returning(['id', 'name'])
          .toSQL();

        const result = db.prepare(insertReturning).get({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'returning@test.com',
          name: 'ReturnTest',
          age: 35,
          score: 77.7,
          bio: null,
        });
        expect(result).toBeDefined();
        expect(result!.name).toBe('ReturnTest');
        expect(result!.id).toBe('11111111-1111-1111-1111-111111111111');

        db.close();
      });

      it('WHERE IN clause filters correctly', () => {
        const db = driver.make();
        const userCrud = source.userCrud();
        db.exec(userCrud.createTable);

        const ids = [
          '11111111-1111-1111-1111-111111111111',
          '22222222-2222-2222-2222-222222222222',
          '33333333-3333-3333-3333-333333333333',
        ];
        for (let i = 0; i < ids.length; i++) {
          db.prepare(userCrud.insert).run({
            id: ids[i],
            email: `user${i}@test.com`,
            name: `User${i}`,
            age: 20 + i,
            score: 50.0 + i,
            bio: null,
          });
        }

        const whereInSql = QueryBuilder.table('users')
          .select(['name'])
          .whereIn('id', [ids[0], ids[2]])
          .toSQL();
        const rows = db.prepare(whereInSql).all();
        expect(rows).toHaveLength(2);
        const names = rows.map((r) => r.name);
        expect(names).toContain('User0');
        expect(names).toContain('User2');
        expect(names).not.toContain('User1');

        db.close();
      });

      it('DROP TABLE IF EXISTS is idempotent', () => {
        const db = driver.make();

        // Drop a non-existent table — should not throw
        const dropSql = QueryBuilder.dropTable('nonexistent');
        expect(() => db.exec(dropSql)).not.toThrow();

        // Create then drop then drop again
        const userCrud = source.userCrud();
        db.exec(userCrud.createTable);
        expect(() => db.exec(dropSql)).not.toThrow(); // not this table, but fine
        expect(() => db.exec(QueryBuilder.dropTable('users'))).not.toThrow();
        expect(() => db.exec(QueryBuilder.dropTable('users'))).not.toThrow();

        db.close();
      });
    });
  }
}
