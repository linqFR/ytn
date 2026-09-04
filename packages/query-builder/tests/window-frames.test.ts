import { describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index.js';

describe('Window frames (ROWS/RANGE/GROUPS BETWEEN)', () => {
  it('ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('moving_avg', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: { type: 'ROWS', start: '1 PRECEDING', end: '1 FOLLOWING' },
      })
      .toSQL();

    expect(sql).toContain(
      'AVG(amount) OVER(ORDER BY month ASC ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as moving_avg',
    );
  });

  it('RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW (default end)', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('running_total', {
        func: 'SUM(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: { type: 'RANGE', start: 'UNBOUNDED PRECEDING' },
      })
      .toSQL();

    expect(sql).toContain(
      'SUM(amount) OVER(ORDER BY month ASC RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as running_total',
    );
  });

  it('ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('grand_total', {
        func: 'SUM(amount)',
        frame: {
          type: 'ROWS',
          start: 'UNBOUNDED PRECEDING',
          end: 'UNBOUNDED FOLLOWING',
        },
      })
      .toSQL();

    expect(sql).toContain(
      'SUM(amount) OVER(ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as grand_total',
    );
  });

  it('GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('group_avg', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: { type: 'GROUPS', start: '2 PRECEDING', end: 'CURRENT ROW' },
      })
      .toSQL();

    expect(sql).toContain(
      'AVG(amount) OVER(ORDER BY month ASC GROUPS BETWEEN 2 PRECEDING AND CURRENT ROW) as group_avg',
    );
  });

  it('frame with PARTITION BY + ORDER BY + ROWS', () => {
    const sql = QueryBuilder.table('sales')
      .select('dept', 'month', 'amount')
      .selectWindow('dept_moving', {
        func: 'AVG(amount)',
        partitionBy: ['dept'],
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: { type: 'ROWS', start: '1 PRECEDING', end: '1 FOLLOWING' },
      })
      .toSQL();

    expect(sql).toContain(
      'AVG(amount) OVER(PARTITION BY dept ORDER BY month ASC ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) as dept_moving',
    );
  });

  it('frame with EXCLUDE CURRENT ROW', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('avg_others', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: {
          type: 'ROWS',
          start: 'UNBOUNDED PRECEDING',
          end: 'UNBOUNDED FOLLOWING',
          exclude: 'CURRENT ROW',
        },
      })
      .toSQL();

    expect(sql).toContain(
      'ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING EXCLUDE CURRENT ROW',
    );
  });

  it('frame with EXCLUDE GROUP', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('avg_no_group', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: {
          type: 'GROUPS',
          start: 'UNBOUNDED PRECEDING',
          end: 'UNBOUNDED FOLLOWING',
          exclude: 'GROUP',
        },
      })
      .toSQL();

    expect(sql).toContain('EXCLUDE GROUP');
  });

  it('frame with EXCLUDE TIES', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('avg_no_ties', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: {
          type: 'ROWS',
          start: 'UNBOUNDED PRECEDING',
          end: 'CURRENT ROW',
          exclude: 'TIES',
        },
      })
      .toSQL();

    expect(sql).toContain('EXCLUDE TIES');
  });

  it('frame with EXCLUDE NO OTHERS (explicit no-op)', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('avg_all', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: {
          type: 'ROWS',
          start: 'UNBOUNDED PRECEDING',
          end: 'CURRENT ROW',
          exclude: 'NO OTHERS',
        },
      })
      .toSQL();

    expect(sql).toContain('EXCLUDE NO OTHERS');
  });

  it('no frame produces standard OVER clause (backward compat)', () => {
    const sql = QueryBuilder.table('employees')
      .select('id', 'dept', 'salary')
      .selectWindow('row_num', {
        func: 'ROW_NUMBER()',
        partitionBy: ['dept'],
        orderBy: [{ field: 'salary', dir: 'DESC' }],
      })
      .toSQL();

    expect(sql).toContain(
      'ROW_NUMBER() OVER(PARTITION BY dept ORDER BY salary DESC) as row_num',
    );
    expect(sql).not.toContain('BETWEEN');
  });

  it('5 PRECEDING and 3 FOLLOWING offset', () => {
    const sql = QueryBuilder.table('sales')
      .select('month', 'amount')
      .selectWindow('wide_avg', {
        func: 'AVG(amount)',
        orderBy: [{ field: 'month', dir: 'ASC' }],
        frame: { type: 'ROWS', start: '5 PRECEDING', end: '3 FOLLOWING' },
      })
      .toSQL();

    expect(sql).toContain('ROWS BETWEEN 5 PRECEDING AND 3 FOLLOWING');
  });
});
