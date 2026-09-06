/**
 * Spec queries — CRUD, reports.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileSpecQueries(db: GovDb): Pick<IQueries,
  | "getSpecById" | "listSpecs" | "insertSpec" | "updateSpecStatus" | "reportSpecsByDate"
> {
  const t = tables;
  const s = t.specs.names;
  return {
    getSpecById: db.prepare(t.specs.getById),
    listSpecs: db.prepare(t.specs.req.select().orderBy(s.col.updated_at, "DESC").limit(100).toSQL()),
    insertSpec: db.prepare(t.specs.insert),
    updateSpecStatus: db.prepare(
      t.specs.req.update(s.col.status, s.col.supersedes, s.col.updated_at).whereRaw(`${s.col.id} = @id`).toSQL(),
    ),
    reportSpecsByDate: db.prepare(
      t.specs.req.select(s.col.id, s.col.filename, s.col.status)
        .whereRaw(`${s.col.date} LIKE @date`).orderBy(s.col.id, "ASC").toSQL(),
    ),
  };
}
