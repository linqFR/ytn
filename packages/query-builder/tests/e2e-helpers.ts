import { DatabaseSync } from 'node:sqlite';
import Database from 'better-sqlite3';
import { z } from 'zod';
import { dna } from '@ytrynot/dna';
import type { DnaType } from '@ytrynot/dna';
import { QueryBuilder } from '../src/index.js';
import type { qbColumn, TableDef } from '../src/types.js';

// ─── Driver Abstraction ─────────────────────────────────────────────
// A minimal common interface so the same E2E suite runs against both
// node:sqlite (DatabaseSync) and better-sqlite3 (Database).

/** Minimal SQL value type for test parameter binding. */
export type SqlParam = null | number | bigint | string | Uint8Array;

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface PreparedStmt {
  run(params: Record<string, SqlParam>): RunResult;
  all(params?: Record<string, SqlParam>): Record<string, unknown>[];
  get(params?: Record<string, SqlParam>): Record<string, unknown> | undefined;
}

export interface DbDriver {
  exec(sql: string): void;
  prepare(sql: string): PreparedStmt;
  close(): void;
}

export function makeNodeSqlite(): DbDriver {
  const db = new DatabaseSync(':memory:');
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (params) => stmt.run(params),
        all: (params) =>
          (params ? stmt.all(params) : stmt.all()) as Record<string, unknown>[],
        get: (params) =>
          (params
            ? stmt.get(params)
            : stmt.get()) as Record<string, unknown> | undefined,
      };
    },
    close: () => db.close(),
  };
}

export function makeBetterSqlite(): DbDriver {
  const db = new Database(':memory:');
  return {
    exec: (sql) => {
      db.exec(sql);
    },
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (params) => stmt.run(params),
        all: (params) =>
          (params ? stmt.all(params) : stmt.all()) as Record<string, unknown>[],
        get: (params) =>
          (params
            ? stmt.get(params)
            : stmt.get()) as Record<string, unknown> | undefined,
      };
    },
    close: () => {
      db.close();
    },
  };
}

// ─── Schemas ────────────────────────────────────────────────────────
// Identical shape for Zod and DNA so both introspectors produce
// equivalent DDL and CRUD SQL.

export const userSchemaZod = z.object({
  id: z.string().uuid().meta({ pk: true }),
  email: z.string().email().meta({ unique: true }),
  name: z.string(),
  age: z.number().int(),
  score: z.number(),
  bio: z.string().nullable(),
});

export const userSchemaDna = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  email: dna.string().email().meta({ unique: true }),
  name: dna.string(),
  age: dna.int(),
  score: dna.number(),
  bio: dna.string().nullable(),
});

export const orderSchemaZod = z.object({
  id: z.string().uuid().meta({ pk: true }),
  user_id: z
    .string()
    .meta({ fk: { table: 'users', col: 'id', onDelete: 'CASCADE' } }),
  total: z.number(),
  status: z.string().default('pending'),
});

export const orderSchemaDna = dna.object({
  id: dna.string().uuid().meta({ pk: true }),
  user_id: dna
    .string()
    .meta({ fk: { table: 'users', col: 'id', onDelete: 'CASCADE' } }),
  total: dna.number(),
  status: dna.string().default('pending'),
});

// ─── Manual qbColumn[] (schema-agnostic DDL path) ──────────────
// Equivalent to userSchemaZod/userSchemaDna — used to test the 3rd DDL
// path: QueryBuilder.createTable() with manually constructed columns.

export const userColumnsManual: qbColumn[] = [
  { name: 'id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
  { name: 'email', sqliteType: 'TEXT', optional: false, hasDefault: false, unique: true, meta: { unique: true } },
  { name: 'name', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: {} },
  { name: 'age', sqliteType: 'INTEGER', optional: false, hasDefault: false, meta: {} },
  { name: 'score', sqliteType: 'REAL', optional: false, hasDefault: false, meta: {} },
  { name: 'bio', sqliteType: 'TEXT', optional: true, hasDefault: false, meta: {} },
];

export const orderColumnsManual: qbColumn[] = [
  { name: 'id', sqliteType: 'TEXT', optional: false, hasDefault: false, meta: { pk: true } },
  { name: 'user_id', sqliteType: 'TEXT', optional: false, hasDefault: false, fk: { table: 'users', col: 'id', onDelete: 'CASCADE' }, meta: { fk: { table: 'users', col: 'id', onDelete: 'CASCADE' } } },
  { name: 'total', sqliteType: 'REAL', optional: false, hasDefault: false, meta: {} },
  { name: 'status', sqliteType: 'TEXT', optional: false, hasDefault: true, defaultValue: 'pending', meta: {} },
];

// ─── Test Matrix ────────────────────────────────────────────────────

export const drivers: Array<{ name: string; make: () => DbDriver }> = [
  { name: 'node:sqlite', make: makeNodeSqlite },
  { name: 'better-sqlite3', make: makeBetterSqlite },
];

export interface SchemaSource {
  name: string;
  userCrud: () => TableDef;
  orderCrud: () => TableDef;
  userDdl: () => string;
  orderDdl: () => string;
}

export const schemaSources: SchemaSource[] = [
  {
    name: 'Zod',
    userCrud: () => QueryBuilder.defTable('users', userSchemaZod),
    orderCrud: () => QueryBuilder.defTable('orders', orderSchemaZod),
    userDdl: () => QueryBuilder.reqCreateTable('users', userSchemaZod),
    orderDdl: () => QueryBuilder.reqCreateTable('orders', orderSchemaZod),
  },
  {
    name: 'DNA',
    userCrud: () => QueryBuilder.defTable('users', userSchemaDna),
    orderCrud: () => QueryBuilder.defTable('orders', orderSchemaDna),
    userDdl: () => QueryBuilder.reqCreateTable('users', userSchemaDna),
    orderDdl: () => QueryBuilder.reqCreateTable('orders', orderSchemaDna),
  },
  {
    name: 'Manual',
    userCrud: () => QueryBuilder.defTable('users', userColumnsManual),
    orderCrud: () => QueryBuilder.defTable('orders', orderColumnsManual),
    userDdl: () => QueryBuilder.createTable('users', userColumnsManual),
    orderDdl: () => QueryBuilder.createTable('orders', orderColumnsManual),
  },
];

// ─── DDL Paths (6 ways to create a table) ───────────────────────────
// For any pair of equivalent Zod + DNA schemas, returns all DDL
// generation paths so tests can execute them in parallel:
//   1. createTableFromZod (schema-driven)
//   2. createTableFromDna (schema-driven)
//   3. defTable(zod).createTable (unified API, Zod source)
//   4. defTable(dna).createTable (unified API, DNA source)
//   5. defTable(manual).createTable (unified API, manual source)
//   6. createTable with manual qbColumn[] (granular DDL only)

export interface DdlPath {
  name: string;
  ddl: string;
}

export function ddlPaths(
  table: string,
  zodSchema: z.ZodTypeAny,
  dnaSchema: DnaType,
  manualColumns?: qbColumn[],
): DdlPath[] {
  const paths: DdlPath[] = [
    {
      name: 'ddl(zod)',
      ddl: QueryBuilder.reqCreateTable(table, zodSchema),
    },
    {
      name: 'ddl(dna)',
      ddl: QueryBuilder.reqCreateTable(table, dnaSchema),
    },
    {
      name: 'defTable(zod).createTable',
      ddl: QueryBuilder.defTable(table, zodSchema).createTable,
    },
    {
      name: 'defTable(dna).createTable',
      ddl: QueryBuilder.defTable(table, dnaSchema).createTable,
    },
  ];
  if (manualColumns) {
    paths.push({
      name: 'defTable(manual).createTable',
      ddl: QueryBuilder.defTable(table, manualColumns).createTable,
    });
    paths.push({
      name: 'createTable (manual qbColumn[])',
      ddl: QueryBuilder.createTable(table, manualColumns),
    });
  }
  return paths;
}

// ─── Manual qbColumn[] equivalents ──────────────────────────────
// Hand-built column shapes matching the Zod/DNA schemas above, so the
// schema-agnostic createTable() path can be tested in parallel.

function col(
  name: string,
  sqliteType: qbColumn['sqliteType'],
  extra: Partial<qbColumn> = {},
): qbColumn {
  return {
    name,
    sqliteType,
    optional: false,
    hasDefault: false,
    meta: {},
    ...extra,
  };
}

export const itemColumnsManual: qbColumn[] = [
  col('id', 'INTEGER', { pkauto: true, meta: { pkauto: true } }),
  col('label', 'TEXT'),
];

export const typedColumnsManual: qbColumn[] = [
  col('id', 'TEXT', { meta: { pk: true } }),
  col('text_col', 'TEXT'),
  col('int_col', 'INTEGER'),
  col('real_col', 'REAL'),
  col('bool_col', 'BOOLEAN'),
  col('date_col', 'DATETIME'),
];

export const mixedColumnsManual: qbColumn[] = [
  col('id', 'TEXT', { meta: { pk: true } }),
  col('required_col', 'TEXT'),
  col('optional_col', 'TEXT', { optional: true }),
  col('nullable_col', 'TEXT', { optional: true }),
];

export const defaultsColumnsManual: qbColumn[] = [
  col('id', 'TEXT', { meta: { pk: true } }),
  col('status', 'TEXT', { hasDefault: true, defaultValue: 'pending' }),
  col('count', 'INTEGER', { hasDefault: true, defaultValue: 0 }),
];

export const parentColumnsManual: qbColumn[] = [
  col('id', 'TEXT', { meta: { pk: true } }),
];

export const childRestrictColumnsManual: qbColumn[] = [
  col('id', 'TEXT', { meta: { pk: true } }),
  col('parent_id', 'TEXT', {
    fk: {
      table: 'parents',
      col: 'id',
      onDelete: 'CASCADE',
      onUpdate: 'RESTRICT',
    },
  }),
];
