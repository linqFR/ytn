/**
 * SQLite driver abstraction for @ytrynot/gov-mcp.
 *
 * Uses better-sqlite3 as the default driver (synchronous, well-tested,
 * excellent file handling). A node:sqlite adapter is provided as an
 * alternative for zero-dependency deployments.
 *
 * Pragmas are applied at startup as invariants:
 *   WAL, busy_timeout=5000, foreign_keys=ON, synchronous=NORMAL, encoding=UTF-8
 */

import type { Database as DatabaseSync } from "better-sqlite3";
import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Pragmas applied at startup, in order. */
const STARTUP_PRAGMAS = [
  "PRAGMA journal_mode = WAL",
  "PRAGMA busy_timeout = 5000",
  "PRAGMA foreign_keys = ON",
  "PRAGMA synchronous = NORMAL",
  "PRAGMA encoding = 'UTF-8'",
] as const;

/** Options for opening a governance database. */
export interface IDriverOptions {
  /** Path to the .db file. Defaults to packages/gov-mcp/data/ytn-gov-mcp.db. */
  dbPath?: string;
  /** Skip pragma application (used by tests that manage their own pragmas). */
  skipPragmas?: boolean;
  /** Read-only mode. */
  readonly?: boolean;
}

/** A prepared statement that returns rows of type T. */
export interface IStatement<T = Record<string, unknown>> {
  /** Bind parameters and return all matching rows. */
  all(...params: unknown[]): T[];
  /** Bind parameters and return the first matching row, or undefined. */
  get(...params: unknown[]): T | undefined;
  /** Bind parameters and execute (INSERT/UPDATE/DELETE), returns metadata. */
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

/** Transaction function wrapper. */
export type TxFn<T> = () => T;

/** SQLite driver abstraction. */
export class GovDb {
  readonly #db: DatabaseSync;
  readonly #statements = new Map<string, IStatement>();

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  /** Open a governance database, applying startup pragmas. */
  static open(options: IDriverOptions = {}): GovDb {
    const dbPath = options.dbPath ?? resolveDefaultDbPath();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const db = new Database(dbPath, {
      readonly: options.readonly ?? false,
      fileMustExist: false,
    });
    if (!options.skipPragmas) {
      for (const pragma of STARTUP_PRAGMAS) {
        db.exec(pragma);
      }
    }
    return new GovDb(db);
  }

  /** Create an in-memory database (for tests). */
  static memory(): GovDb {
    const db = new Database(":memory:");
    for (const pragma of STARTUP_PRAGMAS) {
      db.exec(pragma);
    }
    return new GovDb(db);
  }

  /** Execute raw SQL (DDL, scripts). No parameters. */
  exec(sql: string): void {
    this.#db.exec(sql);
  }

  /** Prepare a statement and cache it by SQL string. */
  prepare<T = Record<string, unknown>>(sql: string): IStatement<T> {
    let stmt = this.#statements.get(sql) as IStatement<T> | undefined;
    if (!stmt) {
      stmt = this.#db.prepare(sql) as unknown as IStatement<T>;
      this.#statements.set(sql, stmt as IStatement);
    }
    return stmt;
  }

  /** Execute a function inside a transaction. Commits on success, rolls back on error. */
  transaction<T>(fn: TxFn<T>): T {
    const tx = this.#db.transaction(fn);
    return tx();
  }

  /** Like transaction() but returns a Result instead of throwing. */
  safeTransaction<T>(fn: TxFn<T>): { ok: true; data: T } | { ok: false; error: string } {
    try {
      const tx = this.#db.transaction(fn);
      return { ok: true, data: tx() };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Close the database connection. */
  close(): void {
    this.#statements.clear();
    this.#db.close();
  }

  /** Get the underlying better-sqlite3 database (escape hatch). */
  get raw(): DatabaseSync {
    return this.#db;
  }

  /** Check if a table exists. */
  tableExists(name: string): boolean {
    const row = this.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(name);
    return row !== undefined;
  }

  /** List all table names. */
  listTables(): string[] {
    const rows = this.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    ).all() as { name: string }[];
    return rows.map((r) => r.name);
  }
}

/** Replace ${workspaceFolder} with process.cwd() so MCP configs stay portable.
 *  Also handles IDEs that expand ${workspaceFolder} to an empty string or "/". */
function expandWorkspace(path: string): string {
  let expanded = path.replaceAll("${workspaceFolder}", process.cwd());
  // Some IDEs (e.g. Devin) expand ${workspaceFolder} to "" or "/", producing
  // paths like "/packages/..." or "packages/..." — fix by prepending cwd.
  if (expanded.startsWith("/") && !expanded.startsWith("//")) {
    expanded = process.cwd() + expanded;
  }
  return expanded;
}

/** Resolve the default DB path from GOVERNANCE_DB_PATH env or package default. */
function resolveDefaultDbPath(): string {
  const envPath = process.env.GOVERNANCE_DB_PATH;
  if (envPath) return resolve(expandWorkspace(envPath));
  // Default: packages/gov-mcp/data/ytn-gov-mcp.db relative to this file
  return resolve(import.meta.dirname, "..", "data", "ytn-gov-mcp.db");
}
