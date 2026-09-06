/**
 * Scope + Writer queries — infrastructure tables.
 *
 * Scopes define the hierarchical workspace tree; writers operate within them.
 * `scopeTree` is a recursive CTE (raw SQL — qb escape hatch).
 */

import type { GovDb } from "../driver.ts";
import type { IQueries } from "../types/queries.ts";
import { tables } from "../definitions/schema.js";

export function compileScopeWriterQueries(db: GovDb): Pick<IQueries,
  | "getScopeById" | "listScopes" | "insertScope" | "insertScopeOrIgnore" | "updateScopeFields" | "scopeTree"
  | "getWriterByNanoid" | "getWriterById" | "insertWriter"
  | "getWriterCursor" | "updateWriterCursor"
  | "insertEntityScope" | "deleteEntityScopes" | "getEntityScopes"
  | "insertFreeField" | "getFreeFields" | "getFreeFieldsAll" | "deprecateFreeField"
> {
  const t = tables;
  const sc = t.scopes.names;
  const w = t.writers.names;
  const es = t.entity_scopes.names;
  const ff = t.free_fields.names;
  return {
    getScopeById: db.prepare(t.scopes.getById),
    listScopes: db.prepare(t.scopes.req.select().orderBy(sc.col.sort_order, "ASC").toSQL()),
    insertScope: db.prepare(t.scopes.insert),
    insertScopeOrIgnore: db.prepare(
      t.scopes.req.insert(t.scopes.cols).or("IGNORE").toSQL(),
    ),
    updateScopeFields: db.prepare(
      t.scopes.req.update(sc.col.label, sc.col.description, sc.col.parent, sc.col.sort_order, sc.col.updated_at).whereRaw(`${sc.col.id} = @id`).toSQL(),
    ),
    scopeTree: db.prepare(
      `WITH RECURSIVE scope_tree(id) AS (
         SELECT ${sc.col.id} FROM ${sc.table} WHERE ${sc.col.id} = @scope
         UNION ALL
         SELECT s.${sc.col.id} FROM ${sc.table} s JOIN scope_tree st ON s.${sc.col.parent} = st.${sc.col.id}
       )
       SELECT ${sc.col.id} FROM scope_tree`,
    ),
    getWriterByNanoid: db.prepare(t.writers.req.select().where([w.col.nanoid]).toSQL()),
    getWriterById: db.prepare(t.writers.req.select().where([w.col.id]).toSQL()),
    insertWriter: db.prepare(t.writers.insert),
    getWriterCursor: db.prepare(t.writers.req.select(w.col.last_read_log_id).where([w.col.nanoid]).toSQL()),
    updateWriterCursor: db.prepare(
      t.writers.req.update(w.col.last_read_log_id).whereRaw(`${w.col.nanoid} = @nanoid`).toSQL(),
    ),
    insertEntityScope: db.prepare(t.entity_scopes.insert),
    deleteEntityScopes: db.prepare(
      t.entity_scopes.req.delete().where([es.col.entity_type, es.col.entity_id]).toSQL(),
    ),
    getEntityScopes: db.prepare(
      t.entity_scopes.req.select().where([es.col.entity_type, es.col.entity_id]).toSQL(),
    ),
    insertFreeField: db.prepare(t.free_fields.insert),
    getFreeFields: db.prepare(
      `SELECT * FROM ${ff.table} WHERE ${ff.col.entity_type} = @entity_type AND ${ff.col.entity_id} = @entity_id AND ${ff.col.status} = 'active' ORDER BY ${ff.col.id} ASC`,
    ),
    getFreeFieldsAll: db.prepare(
      `SELECT * FROM ${ff.table} WHERE ${ff.col.entity_type} = @entity_type AND ${ff.col.entity_id} = @entity_id ORDER BY ${ff.col.id} ASC`,
    ),
    deprecateFreeField: db.prepare(
      `UPDATE ${ff.table} SET ${ff.col.status} = 'deprecated', ${ff.col.updated_at} = @updated_at WHERE ${ff.col.id} = @id`,
    ),
  };
}
