import { describe, expect, it } from 'vitest';
import { QueryBuilder, type qbColumn } from '../src/index.js';

describe('CREATE TRIGGER', () => {
  it('generates AFTER UPDATE OF status trigger', () => {
    const sql = QueryBuilder.createTrigger('trg_act_done_pb', {
      timing: 'AFTER',
      event: 'UPDATE',
      of: ['status'],
      table: 'actions',
      when: "NEW.status = 'done' AND OLD.status != 'done'",
      body: `UPDATE problems SET status = 'partial' WHERE linked_act = NEW.id;`,
    });

    expect(sql).toContain('CREATE TRIGGER IF NOT EXISTS trg_act_done_pb');
    expect(sql).toContain('AFTER UPDATE OF status ON actions');
    expect(sql).toContain('FOR EACH ROW');
    expect(sql).toContain("WHEN NEW.status = 'done' AND OLD.status != 'done'");
    expect(sql).toContain('BEGIN');
    expect(sql).toContain("UPDATE problems SET status = 'partial' WHERE linked_act = NEW.id;");
    expect(sql).toContain('END;');
  });

  it('generates AFTER INSERT trigger without OF', () => {
    const sql = QueryBuilder.createTrigger('trg_actions_fts_insert', {
      timing: 'AFTER',
      event: 'INSERT',
      table: 'actions',
      body: `INSERT INTO search_index (entity_type, entity_id) VALUES ('action', NEW.id);`,
    });

    expect(sql).toContain('AFTER INSERT ON actions');
    expect(sql).not.toContain('OF');
    expect(sql).toContain('FOR EACH ROW');
    expect(sql).toContain('BEGIN');
    expect(sql).toContain("INSERT INTO search_index (entity_type, entity_id) VALUES ('action', NEW.id);");
    expect(sql).toContain('END;');
  });

  it('generates BEFORE DELETE trigger', () => {
    const sql = QueryBuilder.createTrigger('trg_cleanup', {
      timing: 'BEFORE',
      event: 'DELETE',
      table: 'users',
      body: `DELETE FROM user_settings WHERE user_id = OLD.id;`,
    });

    expect(sql).toContain('BEFORE DELETE ON users');
    expect(sql).toContain('DELETE FROM user_settings WHERE user_id = OLD.id;');
  });

  it('generates INSTEAD OF trigger', () => {
    const sql = QueryBuilder.createTrigger('trg_view_insert', {
      timing: 'INSTEAD OF',
      event: 'INSERT',
      table: 'my_view',
      body: `INSERT INTO base_table (val) VALUES (NEW.val);`,
    });

    expect(sql).toContain('INSTEAD OF INSERT ON my_view');
  });

  it('generates trigger without WHEN clause', () => {
    const sql = QueryBuilder.createTrigger('trg_simple', {
      timing: 'AFTER',
      event: 'INSERT',
      table: 'logs',
      body: `INSERT INTO audit (msg) VALUES ('inserted');`,
    });

    expect(sql).not.toContain('WHEN');
  });

  it('generates trigger with multi-statement body', () => {
    const sql = QueryBuilder.createTrigger('trg_multi', {
      timing: 'AFTER',
      event: 'UPDATE',
      of: ['status'],
      table: 'actions',
      when: "NEW.status = 'done'",
      body: `INSERT INTO log (msg) VALUES ('done');\nUPDATE stats SET count = count + 1;`,
    });

    expect(sql).toContain("INSERT INTO log (msg) VALUES ('done');");
    expect(sql).toContain('UPDATE stats SET count = count + 1;');
  });

  it('generates UPDATE OF with multiple columns', () => {
    const sql = QueryBuilder.createTrigger('trg_multi_col', {
      timing: 'AFTER',
      event: 'UPDATE',
      of: ['status', 'priority'],
      table: 'actions',
      body: `SELECT 1;`,
    });

    expect(sql).toContain('AFTER UPDATE OF status, priority ON actions');
  });

  it('validates trigger name', () => {
    expect(() =>
      QueryBuilder.createTrigger('invalid name!', {
        timing: 'AFTER',
        event: 'INSERT',
        table: 'logs',
        body: 'SELECT 1;',
      }),
    ).toThrow('invalid identifier');
  });

  it('validates table name', () => {
    expect(() =>
      QueryBuilder.createTrigger('trg_ok', {
        timing: 'AFTER',
        event: 'INSERT',
        table: 'invalid table!',
        body: 'SELECT 1;',
      }),
    ).toThrow('invalid identifier');
  });

  it('generates trigger with FOR EACH ROW omitted when forEachRow: false', () => {
    const sql = QueryBuilder.createTrigger('trg_no_fer', {
      timing: 'AFTER',
      event: 'INSERT',
      table: 'logs',
      body: 'SELECT 1;',
      forEachRow: false,
    });

    expect(sql).not.toContain('FOR EACH ROW');
  });
});

describe('TableDef.cols and TableDef.name', () => {
  it('exposes table name', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'title', sqliteType: 'TEXT' },
    ];
    const t = QueryBuilder.defTable('posts', columns);

    expect(t.name).toBe('posts');
  });

  it('exposes column names', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'title', sqliteType: 'TEXT' },
      { name: 'status', sqliteType: 'TEXT' },
    ];
    const t = QueryBuilder.defTable('posts', columns);

    expect(t.cols).toEqual(['id', 'title', 'status']);
  });

  it('cols can be used in createTrigger', () => {
    const columns: qbColumn[] = [
      { name: 'id', sqliteType: 'INTEGER', pkauto: true },
      { name: 'status', sqliteType: 'TEXT' },
    ];
    const t = QueryBuilder.defTable('actions', columns);

    const sql = QueryBuilder.createTrigger('trg_test', {
      timing: 'AFTER',
      event: 'UPDATE',
      of: [t.cols[1]], // 'status' via cols
      table: t.name,   // 'actions' via name
      when: `NEW.${t.cols[1]} = 'done'`,
      body: `SELECT 1;`,
    });

    expect(sql).toContain('AFTER UPDATE OF status ON actions');
    expect(sql).toContain("NEW.status = 'done'");
  });
});
