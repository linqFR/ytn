import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { dna } from '@ytrynot/dna';
import { QueryBuilder } from '../src/index.js';


/**
 * Integration tests: execute the generated DDL on a real SQLite database
 * (node:sqlite) to validate that the SQL is syntactically correct and
 * semantically functional (constraints, defaults, FKs, types).
 */
describe('SQLite Integration — Zod DDL execution', () => {
  function execDdl(ddl: string): void {
    const db = new DatabaseSync(':memory:');
    db.exec(ddl);
    db.close();
  }

  it('Basic table with PK and types', () => {
    const schema = z.object({
      id: z.string().uuid().meta({ pk: true }),
      name: z.string(),
      age: z.number().int(),
      score: z.number(),
      active: z.boolean(),
    });
    const ddl = QueryBuilder.reqCreateTable('users', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with UNIQUE constraint', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      email: z.string().meta({ unique: true }),
    });
    const ddl = QueryBuilder.reqCreateTable('users', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with AUTOINCREMENT', () => {
    const schema = z.object({
      id: z.number().int().meta({ pkauto: true }),
      name: z.string(),
    });
    const ddl = QueryBuilder.reqCreateTable('items', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with FOREIGN KEY and ON DELETE CASCADE', () => {
    const parent = z.object({ id: z.string().meta({ pk: true }) });
    const child = z.object({
      id: z.string().meta({ pk: true }),
      parent_id: z.string().meta({
        fk: { table: 'parents', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
      }),
    });
    const parentDdl = QueryBuilder.reqCreateTable('parents', parent);
    const childDdl = QueryBuilder.reqCreateTable('children', child);
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    expect(() => db.exec(parentDdl)).not.toThrow();
    expect(() => db.exec(childDdl)).not.toThrow();
    db.close();
  });

  it('Table with DEFAULT value', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      status: z.string().default('pending'),
    });
    const ddl = QueryBuilder.reqCreateTable('orders', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('CRUD operations execute and return correct results', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      name: z.string(),
      email: z.string(),
    });
    const crud = QueryBuilder.defTable('users', schema);
    const db = new DatabaseSync(':memory:');
    db.exec(crud.createTable);

    // Insert
    const insertStmt = db.prepare(crud.insert);
    insertStmt.run({ id: 'u1', name: 'Alice', email: 'alice@test.com' });
    insertStmt.run({ id: 'u2', name: 'Bob', email: 'bob@test.com' });

    // getAll
    const all = db.prepare(crud.getAll).all() as Array<{ id: string; name: string }>;
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Alice');

    // getById
    const one = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
    expect(one.name).toBe('Alice');

    // update
    db.prepare(crud.update).run({ id: 'u1', name: 'AliceUpdated', email: 'alice2@test.com' });
    const updated = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
    expect(updated.name).toBe('AliceUpdated');

    // delete
    db.prepare(crud.delete).run({ id: 'u2' });
    const remaining = db.prepare(crud.getAll).all() as unknown[];
    expect(remaining).toHaveLength(1);

    db.close();
  });

  it('FK enforcement: deleting parent cascades to child', () => {
    const parent = z.object({ id: z.string().meta({ pk: true }) });
    const child = z.object({
      id: z.string().meta({ pk: true }),
      parent_id: z.string().meta({
        fk: { table: 'parents', col: 'id', onDelete: 'CASCADE' },
      }),
    });
    const parentCrud = QueryBuilder.defTable('parents', parent);
    const childCrud = QueryBuilder.defTable('children', child);

    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(parentCrud.createTable);
    db.exec(childCrud.createTable);

    db.prepare(parentCrud.insert).run({ id: 'p1' });
    db.prepare(childCrud.insert).run({ id: 'c1', parent_id: 'p1' });

    // Delete parent → child should cascade
    db.prepare(parentCrud.delete).run({ id: 'p1' });
    const children = db.prepare(childCrud.getAll).all() as unknown[];
    expect(children).toHaveLength(0);

    db.close();
  });
});

describe('SQLite Integration — DNA DDL execution', () => {
  function execDdl(ddl: string): void {
    const db = new DatabaseSync(':memory:');
    db.exec(ddl);
    db.close();
  }

  it('Basic table with PK and types', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
      age: dna.int(),
      score: dna.number(),
      active: dna.boolean(),
    });
    const ddl = QueryBuilder.reqCreateTable('users', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with UNIQUE constraint', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      email: dna.string().meta({ unique: true }),
    });
    const ddl = QueryBuilder.reqCreateTable('users', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with AUTOINCREMENT', () => {
    const schema = dna.object({
      id: dna.int().meta({ pkauto: true }),
      name: dna.string(),
    });
    const ddl = QueryBuilder.reqCreateTable('items', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('Table with FOREIGN KEY and ON DELETE CASCADE', () => {
    const parent = dna.object({ id: dna.string().meta({ pk: true }) });
    const child = dna.object({
      id: dna.string().meta({ pk: true }),
      parent_id: dna.string().meta({
        fk: { table: 'parents', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
      }),
    });
    const parentDdl = QueryBuilder.reqCreateTable('parents', parent);
    const childDdl = QueryBuilder.reqCreateTable('children', child);
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    expect(() => db.exec(parentDdl)).not.toThrow();
    expect(() => db.exec(childDdl)).not.toThrow();
    db.close();
  });

  it('Table with DEFAULT value', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      status: dna.string().default('pending'),
    });
    const ddl = QueryBuilder.reqCreateTable('orders', schema);
    expect(() => execDdl(ddl)).not.toThrow();
  });

  it('CRUD operations execute and return correct results', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
      email: dna.string(),
    });
    const crud = QueryBuilder.defTable('users', schema);
    const db = new DatabaseSync(':memory:');
    db.exec(crud.createTable);

    // Insert
    const insertStmt = db.prepare(crud.insert);
    insertStmt.run({ id: 'u1', name: 'Alice', email: 'alice@test.com' });
    insertStmt.run({ id: 'u2', name: 'Bob', email: 'bob@test.com' });

    // getAll
    const all = db.prepare(crud.getAll).all() as Array<{ id: string; name: string }>;
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe('Alice');

    // getById
    const one = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
    expect(one.name).toBe('Alice');

    // update
    db.prepare(crud.update).run({ id: 'u1', name: 'AliceUpdated', email: 'alice2@test.com' });
    const updated = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
    expect(updated.name).toBe('AliceUpdated');

    // delete
    db.prepare(crud.delete).run({ id: 'u2' });
    const remaining = db.prepare(crud.getAll).all() as unknown[];
    expect(remaining).toHaveLength(1);

    db.close();
  });

  it('FK enforcement: deleting parent cascades to child', () => {
    const parent = dna.object({ id: dna.string().meta({ pk: true }) });
    const child = dna.object({
      id: dna.string().meta({ pk: true }),
      parent_id: dna.string().meta({
        fk: { table: 'parents', col: 'id', onDelete: 'CASCADE' },
      }),
    });
    const parentCrud = QueryBuilder.defTable('parents', parent);
    const childCrud = QueryBuilder.defTable('children', child);

    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(parentCrud.createTable);
    db.exec(childCrud.createTable);

    db.prepare(parentCrud.insert).run({ id: 'p1' });
    db.prepare(childCrud.insert).run({ id: 'c1', parent_id: 'p1' });

    // Delete parent → child should cascade
    db.prepare(parentCrud.delete).run({ id: 'p1' });
    const children = db.prepare(childCrud.getAll).all() as unknown[];
    expect(children).toHaveLength(0);

    db.close();
  });

  it('Optional and nullable fields accept NULL', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
      bio: dna.string().nullable(),
      nickname: dna.string().optional(),
    });
    const ddl = QueryBuilder.reqCreateTable('profiles', schema);
    const db = new DatabaseSync(':memory:');
    db.exec(ddl);
    db.prepare('INSERT INTO profiles (id, name) VALUES (?, ?)').run('p1', 'Alice');
    const row = db.prepare('SELECT * FROM profiles WHERE id = ?').get('p1') as {
      bio: unknown; nickname: unknown;
    };
    expect(row.bio).toBeNull();
    expect(row.nickname).toBeNull();
    db.close();
  });
});
