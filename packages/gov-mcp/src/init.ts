/**
 * Database initialization — schema + triggers + invariant scope seeding.
 */

import { ROOT_SCOPE_ID } from "./definitions/constants.js";
import { currentTimestamp } from "./helpers.js";
import type { GovDb } from "./driver.js";
import { generateSchemaSQL, tables } from "./definitions/schema.js";
import { generateTriggersSQL } from "./definitions/triggers.js";

/**
 * Initialize a governance database: create schema, triggers, and seed the invariant scope.
 * Safe to call on an existing database (uses IF NOT EXISTS / OR IGNORE).
 *
 * Only `workspace` is seeded (it is the FK default invariant).
 * Other scopes must be declared by the agent via the `create_scope` MCP tool.
 */
export function initDatabase(db: GovDb): void {
  db.exec(generateSchemaSQL());
  db.exec(generateTriggersSQL());

  // Seed only the invariant root scope — other scopes are declared via create_scope
  // OR IGNORE: idempotent on re-init. QB insert doesn't support OR IGNORE, so we wrap in try/catch.
  const now = currentTimestamp();
  try {
    db.prepare(tables.scopes.insert).run({
      id: ROOT_SCOPE_ID,
      label: "Workspace",
      description: "Entire workspace scope",
      parent: null,
      sort_order: 0,
      created_at: now,
      updated_at: now,
    });
  } catch {
    // Already exists — idempotent re-init
  }
}

/** Initialize only if the database is empty (no tables). */
export function initIfEmpty(db: GovDb): boolean {
  if (db.tableExists("scopes")) return false;
  initDatabase(db);
  return true;
}
