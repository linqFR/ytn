/**
 * Status history queries — append-only audit trail.
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileStatusHistoryQueries(db: GovDb): Pick<IQueries,
  | "getStatusHistory" | "insertStatusHistory"
> {
  const sh = tables.status_history.names;
  return {
    getStatusHistory: db.prepare(
      tables.status_history.req.select().where([sh.col.entity_type, sh.col.entity_id]).orderBy(sh.col.id, "ASC").toSQL(),
    ),
    insertStatusHistory: db.prepare(tables.status_history.insert),
  };
}
