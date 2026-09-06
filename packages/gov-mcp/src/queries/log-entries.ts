/**
 * Log entry queries — append-only journal, threads, cursor updates, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileLogEntryQueries(db: GovDb): Pick<IQueries,
  | "listLogEntries" | "getLastLogEntryByRef" | "getThreadEntries" | "getLogEntryById"
  | "insertLogEntry" | "updateLogEntryThread"
  | "reportLogEntriesByDate" | "reportLogEntriesByRef" | "getUpdatesRaw" | "getMaxLogEntryId"
> {
  const t = tables;
  const le = t.log_entries.names;
  return {
    listLogEntries: db.prepare(t.log_entries.req.select().orderBy(le.col.id, "DESC").limit(100).toSQL()),
    getLastLogEntryByRef: db.prepare(
      t.log_entries.req.select().where([le.col.ref_id]).orderBy(le.col.id, "DESC").limit(1).toSQL(),
    ),
    getThreadEntries: db.prepare(
      t.log_entries.req.select().where([le.col.thread_id]).orderBy(le.col.id, "ASC").toSQL(),
    ),
    getLogEntryById: db.prepare(t.log_entries.getById),
    insertLogEntry: db.prepare(t.log_entries.insert),
    updateLogEntryThread: db.prepare(
      t.log_entries.req.update(le.col.thread_id).whereRaw(`${le.col.id} = @id`).toSQL(),
    ),
    reportLogEntriesByDate: db.prepare(
      t.log_entries.req.select().where([le.col.date]).orderBy(le.col.id, "ASC").toSQL(),
    ),
    reportLogEntriesByRef: db.prepare(
      t.log_entries.req.select(le.col.id, le.col.timestamp, le.col.type, le.col.author, le.col.subject, le.col.body)
        .where([le.col.ref_id]).orderBy(le.col.id, "ASC").toSQL(),
    ),
    // Raw SQL: parametrized LIMIT (? bound at runtime) is not supported by qb's .limit() (number only).
    // Table/column names derived from defTable; WHERE/ORDER use positional params for cursor pagination.
    getUpdatesRaw: db.prepare(`SELECT * FROM ${le.table} WHERE ${le.col.id} > ? ORDER BY ${le.col.id} ASC LIMIT ?`),
    getMaxLogEntryId: db.prepare(`SELECT MAX(${le.col.id}) AS max_id FROM ${le.table}`),
  };
}
