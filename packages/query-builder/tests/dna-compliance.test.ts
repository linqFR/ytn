import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { dna } from '@ytrynot/dna';
import { QueryBuilder } from '../src/index.js';


/**
 * DNA Compliance — Table creation tests.
 * Mirrors zod-compliance.test.ts case-by-case to ensure both introspectors
 * produce equivalent, SQLite-valid DDL.
 * Each test executes the generated DDL on a real SQLite database (node:sqlite).
 */
describe('DNA Compliance — Table creation', () => {
    function execDdl(ddl: string): void {
        const db = new DatabaseSync(':memory:');
        db.exec(ddl);
        db.close();
    }

    it('Recursive Unwrapping (Wrapped DnaObject)', () => {
        const ComplexSchema = dna.object({
            id: dna.string().meta({ pk: true }),
            name: dna.string().meta({ unique: true }),
        })
        .optional()
        .nullable();

        const ddl = QueryBuilder.reqCreateTable('complex_table', ComplexSchema);
        expect(() => execDdl(ddl)).not.toThrow();
    });

    it('Exotic Wrappers (Lazy, Default, Catch)', () => {
        const Base = dna.object({
            id: dna.int().meta({ pk: true }),
            data: dna.string().default('empty'),
        });

        const LazySchema = dna.lazy(() => Base).catch({ id: 0, data: 'error' });

        const ddl = QueryBuilder.reqCreateTable('lazy_table', LazySchema);
        expect(() => execDdl(ddl)).not.toThrow();
    });

    it('Integer Detection', () => {
        const IntSchema = dna.object({
            count: dna.int(),
        });

        const ddl = QueryBuilder.reqCreateTable('int_table', IntSchema);
        expect(ddl).toContain('count INTEGER');
        expect(() => execDdl(ddl)).not.toThrow();
    });

    it('Metadata on Wrapped Fields', () => {
        const MetaSchema = dna.object({
            id: dna.string().meta({ pk: true }),
            tag: dna.string().meta({ unique: true }).optional().nullable(),
        });

        const ddl = QueryBuilder.reqCreateTable('meta_table', MetaSchema);
        expect(() => execDdl(ddl)).not.toThrow();
    });

    it('Foreign Key Integrity (ON DELETE/UPDATE)', () => {
        const ParentSchema = dna.object({
            id: dna.string().meta({ pk: true }),
        });
        const FKSchema = dna.object({
            id: dna.string().meta({ pk: true }),
            user_id: dna.string().meta({
                fk: { table: 'users', col: 'id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' },
            }),
        });

        const parentDdl = QueryBuilder.reqCreateTable('users', ParentSchema);
        const childDdl = QueryBuilder.reqCreateTable('fk_table', FKSchema);
        const db = new DatabaseSync(':memory:');
        db.exec('PRAGMA foreign_keys = ON');
        expect(() => db.exec(parentDdl)).not.toThrow();
        expect(() => db.exec(childDdl)).not.toThrow();
        db.close();
    });

    it('Explicit PK (pk vs pkauto)', () => {
        const StandardPK = dna.string().meta({ pk: true });
        const AutoPK = dna.int().meta({ pkauto: true });

        const ddlStandard = QueryBuilder.reqCreateTable('std', dna.object({ id: StandardPK }));
        expect(ddlStandard).toContain('PRIMARY KEY');
        expect(ddlStandard).not.toContain('AUTOINCREMENT');
        expect(() => execDdl(ddlStandard)).not.toThrow();

        const ddlAuto = QueryBuilder.reqCreateTable('aut', dna.object({ id: AutoPK }));
        expect(ddlAuto).toContain('PRIMARY KEY AUTOINCREMENT');
        expect(() => execDdl(ddlAuto)).not.toThrow();
    });

    it('Composite primary key (array)', () => {
        const schema = dna.object({
            tenant_id: dna.string(),
            user_id: dna.string(),
            role: dna.string(),
        });

        const ddl = QueryBuilder.reqCreateTable('tenant_users', schema, {
            primaryKey: ['tenant_id', 'user_id'],
        });
        expect(ddl).toContain('PRIMARY KEY (tenant_id, user_id)');
        expect(() => execDdl(ddl)).not.toThrow();
    });

    it('PK inference by convention (id)', () => {
        const schema = dna.object({
            id: dna.string(),
            email: dna.string(),
        });

        const ddl = QueryBuilder.reqCreateTable('accounts', schema);
        expect(ddl).toContain('id TEXT PRIMARY KEY');
        expect(() => execDdl(ddl)).not.toThrow();
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

    it('CRUD operations execute correctly', () => {
        const schema = dna.object({
            id: dna.string().meta({ pk: true }),
            name: dna.string(),
            email: dna.string(),
        });

        const crud = QueryBuilder.defTable('users', schema);
        const db = new DatabaseSync(':memory:');
        db.exec(crud.createTable);

        db.prepare(crud.insert).run({ id: 'u1', name: 'Alice', email: 'a@t.com' });
        db.prepare(crud.insert).run({ id: 'u2', name: 'Bob', email: 'b@t.com' });

        const all = db.prepare(crud.getAll).all() as Array<{ name: string }>;
        expect(all).toHaveLength(2);

        const one = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
        expect(one.name).toBe('Alice');

        db.prepare(crud.update).run({ id: 'u1', name: 'Updated', email: 'a2@t.com' });
        const updated = db.prepare(crud.getById).get({ id: 'u1' }) as { name: string };
        expect(updated.name).toBe('Updated');

        db.prepare(crud.delete).run({ id: 'u2' });
        expect(db.prepare(crud.getAll).all()).toHaveLength(1);
        db.close();
    });
});
