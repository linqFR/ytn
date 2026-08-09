import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { dna } from '@ytrynot/dna';
import type { DnaType } from '@ytrynot/dna';
import { QueryBuilder } from '../src/index.js';
import type { qbColumn } from '../src/types.js';
import {
  drivers,
  schemaSources,
  userSchemaZod,
  userSchemaDna,
  ddlPaths,
  type DdlPath,
  userColumnsManual,
  orderColumnsManual,
  itemColumnsManual,
  typedColumnsManual,
  mixedColumnsManual,
  defaultsColumnsManual,
  parentColumnsManual,
  childRestrictColumnsManual,
} from './e2e-helpers.js';

// ─── E2E DDL & QB Chaining Suite ────────────────────────────────────
// Tests DDL generation via all 4 paths in parallel:
//   1. createTableFromZod
//   2. createTableFromDna
//   3. defTable().createTable
// Each DDL is executed on both drivers (node:sqlite + better-sqlite3).

for (const driver of drivers) {
  // ── DDL Feature Matrix: all 3 paths × both drivers ───────────────

  describe(`DDL Features — ${driver.name}`, () => {
    it('AUTOINCREMENT: all 3 paths produce working DDL', () => {
      const zodSchema = z.object({
        id: z.number().int().meta({ pkauto: true }),
        label: z.string(),
      });
      const dnaSchema = dna.object({
        id: dna.int().meta({ pkauto: true }),
        label: dna.string(),
      });

      for (const path of ddlPaths('items', zodSchema, dnaSchema, itemColumnsManual)) {
        const db = driver.make();
        expect(() => db.exec(path.ddl)).not.toThrow();

        const insert = QueryBuilder.table('items')
          .insert(['label'])
          .toSQL();
        const r1 = db.prepare(insert).run({ label: 'first' });
        const r2 = db.prepare(insert).run({ label: 'second' });
        expect(Number(r2.lastInsertRowid)).toBeGreaterThan(
          Number(r1.lastInsertRowid),
        );

        const rows = db.prepare('SELECT * FROM items ORDER BY id').all();
        expect(rows).toHaveLength(2);
        expect(rows[0]!.label).toBe('first');
        expect(rows[1]!.label).toBe('second');

        db.close();
      }
    });

    it('All SQLite types: all 3 paths produce working DDL', () => {
      const zodSchema = z.object({
        id: z.string().meta({ pk: true }),
        text_col: z.string(),
        int_col: z.number().int(),
        real_col: z.number(),
        bool_col: z.boolean(),
        date_col: z.date(),
      });
      const dnaSchema = dna.object({
        id: dna.string().meta({ pk: true }),
        text_col: dna.string(),
        int_col: dna.int(),
        real_col: dna.number(),
        bool_col: dna.boolean(),
        date_col: dna.date(),
      });

      for (const path of ddlPaths('typed', zodSchema, dnaSchema, typedColumnsManual)) {
        const db = driver.make();
        expect(() => db.exec(path.ddl)).not.toThrow();

        const insert = QueryBuilder.table('typed')
          .insert([
            'id',
            'text_col',
            'int_col',
            'real_col',
            'bool_col',
            'date_col',
          ])
          .toSQL();
        const testDate = '2025-01-15T10:30:00.000Z';
        db.prepare(insert).run({
          id: 't1',
          text_col: 'hello',
          int_col: 42,
          real_col: 3.14,
          bool_col: 1,
          date_col: testDate,
        });
        const row = db
          .prepare('SELECT * FROM typed WHERE id = @id')
          .get({ id: 't1' });
        expect(row).toBeDefined();
        expect(row!.text_col).toBe('hello');
        expect(row!.int_col).toBe(42);
        expect(row!.real_col).toBe(3.14);
        expect(Number(row!.bool_col)).toBe(1);
        expect(row!.date_col).toBe(testDate);

        db.close();
      }
    });

    it('FK CASCADE + RESTRICT: all 3 paths produce working DDL', () => {
      const zodParent = z.object({ id: z.string().meta({ pk: true }) });
      const dnaParent = dna.object({ id: dna.string().meta({ pk: true }) });
      const zodChild = z.object({
        id: z.string().meta({ pk: true }),
        parent_id: z.string().meta({
          fk: {
            table: 'parents',
            col: 'id',
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
        }),
      });
      const dnaChild = dna.object({
        id: dna.string().meta({ pk: true }),
        parent_id: dna.string().meta({
          fk: {
            table: 'parents',
            col: 'id',
            onDelete: 'CASCADE',
            onUpdate: 'RESTRICT',
          },
        }),
      });

      const parentPaths = ddlPaths('parents', zodParent, dnaParent, parentColumnsManual);
      const childPaths = ddlPaths('children', zodChild, dnaChild, childRestrictColumnsManual);

      // Test each parent path paired with each child path
      for (let i = 0; i < parentPaths.length; i++) {
        const db = driver.make();
        db.exec('PRAGMA foreign_keys = ON');

        expect(() => db.exec(parentPaths[i].ddl)).not.toThrow();
        expect(() => db.exec(childPaths[i].ddl)).not.toThrow();

        db.prepare(
          QueryBuilder.table('parents').insert(['id']).toSQL(),
        ).run({ id: 'p1' });
        db.prepare(
          QueryBuilder.table('children')
            .insert(['id', 'parent_id'])
            .toSQL(),
        ).run({ id: 'c1', parent_id: 'p1' });

        // ON UPDATE RESTRICT
        expect(() =>
          db
            .prepare('UPDATE parents SET id = @new WHERE id = @old')
            .run({ new: 'p2', old: 'p1' }),
        ).toThrow();

        // ON DELETE CASCADE
        db.prepare(
          QueryBuilder.table('parents').delete().where(['id']).toSQL(),
        ).run({ id: 'p1' });
        const children = db.prepare('SELECT * FROM children').all();
        expect(children).toHaveLength(0);

        db.close();
      }
    });

    it('Optional vs nullable: all 3 paths produce working DDL', () => {
      const zodSchema = z.object({
        id: z.string().meta({ pk: true }),
        required_col: z.string(),
        optional_col: z.string().optional(),
        nullable_col: z.string().nullable(),
      });
      const dnaSchema = dna.object({
        id: dna.string().meta({ pk: true }),
        required_col: dna.string(),
        optional_col: dna.string().optional(),
        nullable_col: dna.string().nullable(),
      });

      for (const path of ddlPaths('mixed', zodSchema, dnaSchema, mixedColumnsManual)) {
        const db = driver.make();
        expect(() => db.exec(path.ddl)).not.toThrow();

        // Insert with NULL optional and nullable — should succeed
        db.prepare(
          QueryBuilder.table('mixed')
            .insert(['id', 'required_col'])
            .toSQL(),
        ).run({ id: 'r1', required_col: 'present' });
        const row = db
          .prepare('SELECT * FROM mixed WHERE id = @id')
          .get({ id: 'r1' });
        expect(row).toBeDefined();
        expect(row!.optional_col).toBeNull();
        expect(row!.nullable_col).toBeNull();

        // Insert with NULL required_col — should fail (NOT NULL)
        expect(() =>
          db.prepare(
            QueryBuilder.table('mixed')
              .insert(['id', 'required_col', 'optional_col'])
              .toSQL(),
          ).run({ id: 'r2', required_col: null, optional_col: 'x' }),
        ).toThrow();

        db.close();
      }
    });

    it('DEFAULT from schema: all 3 paths produce working DDL', () => {
      const zodSchema = z.object({
        id: z.string().meta({ pk: true }),
        status: z.string().default('pending'),
        count: z.number().int().default(0),
      });
      const dnaSchema = dna.object({
        id: dna.string().meta({ pk: true }),
        status: dna.string().default('pending'),
        count: dna.int().default(0),
      });

      for (const path of ddlPaths('defaults', zodSchema, dnaSchema, defaultsColumnsManual)) {
        const db = driver.make();
        expect(() => db.exec(path.ddl)).not.toThrow();

        db.prepare(
          QueryBuilder.table('defaults').insert(['id']).toSQL(),
        ).run({ id: 'd1' });
        const row = db
          .prepare('SELECT * FROM defaults WHERE id = @id')
          .get({ id: 'd1' });
        expect(row).toBeDefined();
        expect(row!.status).toBe('pending');
        expect(row!.count).toBe(0);

        db.close();
      }
    });

    it('PRAGMA builder: multiple pragmas execute and take effect', () => {
      const db = driver.make();

      const pragmaSql = QueryBuilder.pragma()
        .foreignKeys(true)
        .busyTimeout(3000)
        .synchronous('OFF')
        .tempStore('MEMORY')
        .toSQL();

      expect(() => db.exec(pragmaSql)).not.toThrow();

      // Verify foreign_keys
      const fk = db.prepare('PRAGMA foreign_keys').get() as {
        foreign_keys?: number;
      };
      expect(Number(fk?.foreign_keys ?? 0)).toBe(1);

      // Verify busy_timeout (column name is "timeout")
      const bt = db.prepare('PRAGMA busy_timeout').get() as {
        timeout?: number;
      };
      expect(Number(bt?.timeout ?? 0)).toBe(3000);

      db.close();
    });

    it('PRAGMA builder: journalMode + cacheSize execute on real DB', () => {
      const db = driver.make();

      const pragmaSql = QueryBuilder.pragma()
        .journalMode('MEMORY')
        .cacheSize(-64000)
        .toSQL();

      expect(() => db.exec(pragmaSql)).not.toThrow();

      // journal_mode MEMORY is always accepted
      const jm = db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string };
      expect(String(jm?.journal_mode ?? '').toLowerCase()).toBe('memory');

      db.close();
    });

    it('PRAGMA builder: mmap_size + optimize execute on real DB', () => {
      const db = driver.make();

      const pragmaSql = QueryBuilder.pragma()
        .mmap_size(0)
        .optimize()
        .toSQL();

      // mmap_size=0 disables memory-mapped I/O (always valid)
      // optimize is always valid
      expect(() => db.exec(pragmaSql)).not.toThrow();

      db.close();
    });

    it('PRAGMA builder: raw() executes on real DB', () => {
      const db = driver.make();

      const pragmaSql = QueryBuilder.pragma()
        .raw('busy_timeout', 2000)
        .toSQL();

      expect(() => db.exec(pragmaSql)).not.toThrow();

      const bt = db.prepare('PRAGMA busy_timeout').get() as { timeout?: number };
      expect(Number(bt?.timeout ?? 0)).toBe(2000);

      db.close();
    });
  });

  // ── DDL Direct: createTableFrom* (per driver × schema source) ────

  for (const source of schemaSources) {
    describe(`DDL Direct — ${driver.name} — ${source.name}`, () => {
      it('createTableFrom* DDL executes on real DB', () => {
        const db = driver.make();
        db.exec('PRAGMA foreign_keys = ON');

        expect(() => db.exec(source.userDdl())).not.toThrow();
        expect(() => db.exec(source.orderDdl())).not.toThrow();

        const insertUser = QueryBuilder.table('users')
          .insert(['id', 'email', 'name', 'age', 'score', 'bio'])
          .toSQL();
        db.prepare(insertUser).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'ddl@test.com',
          name: 'DDLTest',
          age: 42,
          score: 100.0,
          bio: null,
        });
        const row = db
          .prepare('SELECT * FROM users WHERE id = @id')
          .get({ id: '11111111-1111-1111-1111-111111111111' });
        expect(row).toBeDefined();
        expect(row!.name).toBe('DDLTest');

        db.close();
      });

      it('ddl() with qbTableOptions overrides', () => {
        const db = driver.make();

        const realDdl =
          source.name === 'Zod'
            ? QueryBuilder.reqCreateTable('users', userSchemaZod, {
                unique: ['name'],
                defaults: { score: '0' },
              })
            : QueryBuilder.reqCreateTable('users', userSchemaDna, {
                unique: ['name'],
                defaults: { score: '0' },
              });

        expect(() => db.exec(realDdl)).not.toThrow();

        const insertPartial = QueryBuilder.table('users')
          .insert(['id', 'email', 'name', 'age', 'bio'])
          .toSQL();
        db.prepare(insertPartial).run({
          id: '11111111-1111-1111-1111-111111111111',
          email: 'opts@test.com',
          name: 'OptsTest',
          age: 50,
          bio: null,
        });
        const row = db
          .prepare('SELECT * FROM users WHERE id = @id')
          .get({ id: '11111111-1111-1111-1111-111111111111' });
        expect(row).toBeDefined();
        expect(row!.score).toBe(0);

        // UNIQUE on name: second insert with same name should fail
        expect(() =>
          db.prepare(insertPartial).run({
            id: '22222222-2222-2222-2222-222222222222',
            email: 'opts2@test.com',
            name: 'OptsTest',
            age: 51,
            bio: null,
          }),
        ).toThrow();

        db.close();
      });
    });
  }
}

// ─── DDL Triangular Comparison ──────────────────────────────────────
// Verifies that all 4 DDL generation paths produce strictly identical
// SQL for equivalent Zod and DNA schemas, AND that each path executes
// successfully on a real database.

describe('DDL Triangular Comparison — Zod vs DNA vs CRUD vs Manual', () => {
  // Helper: verify all DDL strings are identical + execute them
  function assertAllPathsEqualAndExec(
    table: string,
    zodSchema: z.ZodTypeAny,
    dnaSchema: DnaType,
    manualColumns?: qbColumn[],
  ): DdlPath[] {
    const paths = ddlPaths(table, zodSchema, dnaSchema, manualColumns);

    // All DDL strings must be identical
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].ddl).toBe(paths[0].ddl);
    }

    // Each path must execute on a real DB
    for (const path of paths) {
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(':memory:');
      expect(() => db.exec(path.ddl)).not.toThrow();
      db.close();
    }

    return paths;
  }

  it('users table: all 4 paths identical + executable', () => {
    assertAllPathsEqualAndExec(
      'users',
      userSchemaZod,
      userSchemaDna,
      userColumnsManual,
    );
  });

  it('orders table (FK + DEFAULT): all 4 paths identical + executable', () => {
    const orderZod = z.object({
      id: z.string().uuid().meta({ pk: true }),
      user_id: z
        .string()
        .meta({ fk: { table: 'users', col: 'id', onDelete: 'CASCADE' } }),
      total: z.number(),
      status: z.string().default('pending'),
    });
    const orderDna = dna.object({
      id: dna.string().uuid().meta({ pk: true }),
      user_id: dna
        .string()
        .meta({ fk: { table: 'users', col: 'id', onDelete: 'CASCADE' } }),
      total: dna.number(),
      status: dna.string().default('pending'),
    });

    assertAllPathsEqualAndExec(
      'orders',
      orderZod,
      orderDna,
      orderColumnsManual,
    );
  });

  it('AUTOINCREMENT table: all 4 paths identical + executable', () => {
    const zodSchema = z.object({
      id: z.number().int().meta({ pkauto: true }),
      label: z.string(),
    });
    const dnaSchema = dna.object({
      id: dna.int().meta({ pkauto: true }),
      label: dna.string(),
    });

    assertAllPathsEqualAndExec(
      'items',
      zodSchema,
      dnaSchema,
      itemColumnsManual,
    );
  });

  it('All types table: all 4 paths identical + executable', () => {
    const zodSchema = z.object({
      id: z.string().meta({ pk: true }),
      text_col: z.string(),
      int_col: z.number().int(),
      real_col: z.number(),
      bool_col: z.boolean(),
      date_col: z.date(),
    });
    const dnaSchema = dna.object({
      id: dna.string().meta({ pk: true }),
      text_col: dna.string(),
      int_col: dna.int(),
      real_col: dna.number(),
      bool_col: dna.boolean(),
      date_col: dna.date(),
    });

    assertAllPathsEqualAndExec(
      'typed',
      zodSchema,
      dnaSchema,
      typedColumnsManual,
    );
  });

  it('Optional + nullable table: all 4 paths identical + executable', () => {
    const zodSchema = z.object({
      id: z.string().meta({ pk: true }),
      required_col: z.string(),
      optional_col: z.string().optional(),
      nullable_col: z.string().nullable(),
    });
    const dnaSchema = dna.object({
      id: dna.string().meta({ pk: true }),
      required_col: dna.string(),
      optional_col: dna.string().optional(),
      nullable_col: dna.string().nullable(),
    });

    assertAllPathsEqualAndExec(
      'mixed',
      zodSchema,
      dnaSchema,
      mixedColumnsManual,
    );
  });

  it('FK with ON UPDATE RESTRICT: all 4 paths identical + executable', () => {
    const zodParent = z.object({ id: z.string().meta({ pk: true }) });
    const dnaParent = dna.object({ id: dna.string().meta({ pk: true }) });
    const zodChild = z.object({
      id: z.string().meta({ pk: true }),
      parent_id: z.string().meta({
        fk: {
          table: 'parents',
          col: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        },
      }),
    });
    const dnaChild = dna.object({
      id: dna.string().meta({ pk: true }),
      parent_id: dna.string().meta({
        fk: {
          table: 'parents',
          col: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'RESTRICT',
        },
      }),
    });

    assertAllPathsEqualAndExec(
      'parents',
      zodParent,
      dnaParent,
      parentColumnsManual,
    );
    assertAllPathsEqualAndExec(
      'children',
      zodChild,
      dnaChild,
      childRestrictColumnsManual,
    );
  });
});
