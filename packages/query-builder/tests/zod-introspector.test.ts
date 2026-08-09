import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { QueryBuilder } from '../src/index.js';


/**
 * Zod Introspector — mirrors dna-introspector.test.ts case-by-case.
 * Ensures both introspectors produce equivalent DDL and CRUD.
 */
describe('Zod Introspector — createTableFromZod', () => {
  it('Basic object → DDL with types', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      name: z.string(),
      age: z.number().int(),
      score: z.number(),
      active: z.boolean(),
      bio: z.string().nullable(),
    });

    const ddl = QueryBuilder.reqCreateTable('users', schema);
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(ddl).toContain('id TEXT');
    expect(ddl).toContain('name TEXT');
    expect(ddl).toContain('age INTEGER');
    expect(ddl).toContain('score REAL');
    expect(ddl).toContain('active BOOLEAN');
    expect(ddl).toContain('bio TEXT');
    expect(ddl).toContain('PRIMARY KEY');
  });

  it('Optional fields omit NOT NULL', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      required_field: z.string(),
      optional_field: z.string().optional(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('required_field TEXT NOT NULL');
    expect(ddl).not.toMatch(/optional_field TEXT NOT NULL/);
  });

  it('Nullable fields omit NOT NULL', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      nullable_field: z.string().nullable(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).not.toMatch(/nullable_field TEXT NOT NULL/);
  });

  it('Nullish fields (optional + nullable) omit NOT NULL', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      nullish_field: z.string().nullish(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).not.toMatch(/nullish_field TEXT NOT NULL/);
  });

  it('NonOptional cancels optional', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      field: z.string().optional().nonoptional(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('field TEXT NOT NULL');
  });

  it('Unique constraint from meta', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      email: z.string().meta({ unique: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('UNIQUE');
  });

  it('Primary key (pk) without AUTOINCREMENT', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('PRIMARY KEY');
    expect(ddl).not.toContain('AUTOINCREMENT');
  });

  it('Auto-increment primary key (pkauto)', () => {
    const schema = z.object({
      id: z.number().int().meta({ pkauto: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('PRIMARY KEY AUTOINCREMENT');
  });

  it('Foreign key with ON DELETE / ON UPDATE', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      user_id: z.string().meta({
        fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
      }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('FOREIGN KEY (user_id) REFERENCES users(id)');
    expect(ddl).toContain('ON DELETE CASCADE');
    expect(ddl).toContain('ON UPDATE RESTRICT');
  });

  it('Foreign key as string shorthand', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      ref: z.string().meta({ fk: 'categories(id)' }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('FOREIGN KEY (ref) REFERENCES categories(id)');
  });

  it('Default value from .default()', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      status: z.string().default('pending'),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('DEFAULT');
    expect(ddl).toContain('pending');
  });

  it('Wrappers around ZodObject (optional, nullable)', () => {
    const inner = z.object({
      id: z.string().meta({ pk: true }),
      name: z.string(),
    });

    const ddl = QueryBuilder.reqCreateTable('wrapped', inner.optional().nullable());
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS wrapped');
    expect(ddl).toContain('PRIMARY KEY');
  });

  it('Throws on non-object schema', () => {
    const schema = z.string();
    expect(() => QueryBuilder.defTable('t', schema)).toThrow();
  });

  it('PK inference by convention (id, uuid)', () => {
    const schema = z.object({
      uuid: z.string(),
      name: z.string(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('uuid TEXT PRIMARY KEY');
  });
});

describe('Zod Introspector — defTable', () => {
  it('Generates all CRUD operations', () => {
    const schema = z.object({
      id: z.string().meta({ pk: true }),
      name: z.string(),
      email: z.string(),
    });

    const crud = QueryBuilder.defTable('users', schema);
    expect(crud.getAll).toContain('SELECT');
    expect(crud.getAll).toContain('FROM users');
    expect(crud.getById).toContain('WHERE id = @id');
    expect(crud.insert).toContain('INSERT INTO users');
    expect(crud.insert).toContain('@id');
    expect(crud.insert).toContain('@name');
    expect(crud.insert).toContain('@email');
    expect(crud.update).toContain('UPDATE users SET');
    expect(crud.update).not.toMatch(/id = @id,/);
    expect(crud.delete).toContain('DELETE FROM users WHERE id = @id');
    expect(crud.upsert).toContain('INSERT INTO users');
  });

  it('PK detection via meta.pk', () => {
    const schema = z.object({
      custom_id: z.string().meta({ pk: true }),
      name: z.string(),
    });

    const crud = QueryBuilder.defTable('t', schema);
    expect(crud.getById).toContain('custom_id = @custom_id');
    expect(crud.delete).toContain('custom_id = @custom_id');
  });

  it('PK inference by convention (id)', () => {
    const schema = z.object({
      id: z.string(),
      name: z.string(),
    });

    const crud = QueryBuilder.defTable('t', schema);
    expect(crud.getById).toContain('id = @id');
  });

  it('Throws on non-object schema', () => {
    const schema = z.string();
    expect(() => QueryBuilder.defTable('t', schema)).toThrow();
  });
});
