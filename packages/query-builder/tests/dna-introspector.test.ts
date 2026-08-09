import { describe, expect, it } from 'vitest';
import { dna } from '@ytrynot/dna';
import { QueryBuilder } from '../src/index.js';


describe('DNA Introspector — createTableFromDna', () => {
  it('Basic object → DDL with types', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
      age: dna.int(),
      score: dna.number(),
      active: dna.boolean(),
      bio: dna.string().nullable(),
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
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      required_field: dna.string(),
      optional_field: dna.string().optional(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('required_field TEXT NOT NULL');
    // optional_field should NOT have NOT NULL
    expect(ddl).not.toMatch(/optional_field TEXT NOT NULL/);
  });

  it('Nullable fields omit NOT NULL', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      nullable_field: dna.string().nullable(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).not.toMatch(/nullable_field TEXT NOT NULL/);
  });

  it('Nullish fields (optional + nullable) omit NOT NULL', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      nullish_field: dna.string().nullish(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).not.toMatch(/nullish_field TEXT NOT NULL/);
  });

  it('nonoptional cancels optional', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      field: dna.string().optional().nonoptional(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    // nonoptional should restore NOT NULL
    expect(ddl).toContain('field TEXT NOT NULL');
  });

  it('Unique constraint from meta', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      email: dna.string().meta({ unique: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('UNIQUE');
  });

  it('Primary key (pk) without AUTOINCREMENT', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('PRIMARY KEY');
    expect(ddl).not.toContain('AUTOINCREMENT');
  });

  it('Auto-increment primary key (pkauto)', () => {
    const schema = dna.object({
      id: dna.int().meta({ pkauto: true }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('PRIMARY KEY AUTOINCREMENT');
  });

  it('Foreign key with ON DELETE / ON UPDATE', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      user_id: dna.string().meta({
        fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
      }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('FOREIGN KEY (user_id) REFERENCES users(id)');
    expect(ddl).toContain('ON DELETE CASCADE');
    expect(ddl).toContain('ON UPDATE RESTRICT');
  });

  it('Foreign key as string shorthand', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      ref: dna.string().meta({ fk: 'categories(id)' }),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('FOREIGN KEY (ref) REFERENCES categories(id)');
  });

  it('Default value from .default()', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      status: dna.string().default('pending'),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('DEFAULT');
    expect(ddl).toContain('pending');
  });

  it('Wrappers around DnaObject (optional, nullable)', () => {
    const inner = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
    });

    const ddl = QueryBuilder.reqCreateTable('wrapped', inner.optional().nullable());
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS wrapped');
    expect(ddl).toContain('PRIMARY KEY');
  });

  it('Throws on non-object schema', () => {
    const schema = dna.string();
    expect(() => QueryBuilder.defTable('t', schema)).toThrow();
  });

  it('PK inference by convention (id, uuid)', () => {
    const schema = dna.object({
      uuid: dna.string(),
      name: dna.string(),
    });

    const ddl = QueryBuilder.reqCreateTable('t', schema);
    expect(ddl).toContain('uuid TEXT PRIMARY KEY');
  });
});

describe('DNA Introspector — defTable', () => {
  it('Generates all CRUD operations', () => {
    const schema = dna.object({
      id: dna.string().meta({ pk: true }),
      name: dna.string(),
      email: dna.string(),
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
    expect(crud.update).not.toMatch(/id = @id,/); // PK not in SET
    expect(crud.delete).toContain('DELETE FROM users WHERE id = @id');
    expect(crud.upsert).toContain('INSERT INTO users');
  });

  it('PK detection via meta.pk', () => {
    const schema = dna.object({
      custom_id: dna.string().meta({ pk: true }),
      name: dna.string(),
    });

    const crud = QueryBuilder.defTable('t', schema);
    expect(crud.getById).toContain('custom_id = @custom_id');
    expect(crud.delete).toContain('custom_id = @custom_id');
  });

  it('PK inference by convention (id)', () => {
    const schema = dna.object({
      id: dna.string(),
      name: dna.string(),
    });

    const crud = QueryBuilder.defTable('t', schema);
    expect(crud.getById).toContain('id = @id');
  });

  it('Throws on non-object schema', () => {
    const schema = dna.string();
    expect(() => QueryBuilder.defTable('t', schema)).toThrow();
  });
});
