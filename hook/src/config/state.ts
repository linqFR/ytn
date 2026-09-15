/**
 * state.ts — hook-state.db (SQLite local state).
 *
 * Stores session_id → nanoid mapping, last_stop_at, last_handoff_at, stop_count.
 * Also stores hook log entries (with rotation — keeps last N entries).
 * Uses @ytrynot/qb for DDL + DML generation.
 */

import { QueryBuilder as qb, type qbTable } from "@ytrynot/qb";
import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";

// ── Hook-local types ──

export interface SessionStateRow {
  session_id: string;
  nanoid: string | null;
  writer_id: string | null;
  last_stop_at: string | null;
  last_handoff_at: string | null;
  stop_count: number;
  created_at: string;
  updated_at: string | null;
  last_seen_at: string | null;
  title: string | null;
}

export interface HookLogRow {
  id: number;
  ts: string;
  event: string;
  session_id: string | null;
  tool_name: string | null;
  input: string | null;
  output: string | null;
  meta: string | null;
}

// ── Table definitions via qb ──

const sessionStateColumns: qbTable = [
  { name: "session_id", sqliteType: "TEXT", pk: true },
  { name: "nanoid", sqliteType: "TEXT", optional: true },
  { name: "writer_id", sqliteType: "TEXT", optional: true },
  { name: "last_stop_at", sqliteType: "TEXT", optional: true },
  { name: "last_handoff_at", sqliteType: "TEXT", optional: true },
  { name: "stop_count", sqliteType: "INTEGER", hasDefault: true, defaultValue: "0" },
  { name: "created_at", sqliteType: "TEXT" },
  { name: "updated_at", sqliteType: "TEXT", optional: true },
  { name: "last_seen_at", sqliteType: "TEXT", optional: true },
  { name: "title", sqliteType: "TEXT", optional: true },
];

const hookLogColumns: qbTable = [
  { name: "id", sqliteType: "INTEGER", pkauto: true },
  { name: "ts", sqliteType: "TEXT" },
  { name: "event", sqliteType: "TEXT" },
  { name: "session_id", sqliteType: "TEXT", optional: true },
  { name: "tool_name", sqliteType: "TEXT", optional: true },
  { name: "input", sqliteType: "TEXT", optional: true },
  { name: "output", sqliteType: "TEXT", optional: true },
  { name: "meta", sqliteType: "TEXT", optional: true },
];

const t = qb.defTable("session_state", sessionStateColumns);
const tLog = qb.defTable("hook_log", hookLogColumns);

/** Max log entries to keep (rotation). Older entries are pruned on insert. */
const LOG_MAX_ENTRIES = 1000;

// ── Public interface ──

export interface tsStateDb {
  getSession: (session_id: string) => SessionStateRow | undefined;
  upsertSession: (session_id: string, data: Partial<Omit<SessionStateRow, "session_id" | "created_at">>) => void;
  setNanoid: (session_id: string, nanoid: string, writer_id: string) => void;
  incrementStop: (session_id: string) => void;
  resetStopCount: (session_id: string) => void;
  setHandoff: (session_id: string) => void;
  touchSession: (session_id: string) => void;
  setTitle: (session_id: string, title: string) => void;
  log: (entry: { event: string; session_id?: string; tool_name?: string | null; input?: string | null; output?: string | null; meta?: Record<string, unknown> }) => void;
  getLogs: (limit?: number) => HookLogRow[];
}

export function stateMgr(): tsStateDb {
  const dataDir = join(process.env.DEVIN_PROJECT_DIR ?? ".", "hook", "data");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "hook-state.db");
  const db = new Database(dbPath);

  // Robustesse multi-process / concurrence (hook spawn un process par event)
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 3000");

  // DDL via qb
  db.exec(t.createTable);
  db.exec(tLog.createTable);

  // Migrations: add columns to existing tables (CREATE TABLE IF NOT EXISTS won't add them)
  const existingSessionCols = db.prepare("PRAGMA table_info(session_state)").all() as Array<{ name: string }>;
  const sessionColNames = new Set(existingSessionCols.map(c => c.name));
  const sessionMigrations: Record<string, string> = {
    updated_at: "TEXT",
    last_seen_at: "TEXT",
    title: "TEXT",
  };
  for (const [col, type] of Object.entries(sessionMigrations)) {
    if (!sessionColNames.has(col)) {
      db.exec(`ALTER TABLE session_state ADD COLUMN ${col} ${type}`);
    }
  }
  // Drop legacy column (SQLite 3.35+ supports ALTER TABLE DROP COLUMN)
  if (sessionColNames.has("identity_refresh_in")) {
    db.exec(`ALTER TABLE session_state DROP COLUMN identity_refresh_in`);
  }

  // hook_log migrations: add tool_name, input, output columns; drop level, message
  const existingLogCols = db.prepare("PRAGMA table_info(hook_log)").all() as Array<{ name: string }>;
  const logColNames = new Set(existingLogCols.map(c => c.name));
  const logMigrations: Record<string, string> = {
    tool_name: "TEXT",
    input: "TEXT",
    output: "TEXT",
  };
  for (const [col, type] of Object.entries(logMigrations)) {
    if (!logColNames.has(col)) {
      db.exec(`ALTER TABLE hook_log ADD COLUMN ${col} ${type}`);
    }
  }
  // Drop legacy columns (SQLite 3.35+ supports ALTER TABLE DROP COLUMN)
  for (const col of ["level", "message"]) {
    if (logColNames.has(col)) {
      db.exec(`ALTER TABLE hook_log DROP COLUMN ${col}`);
    }
  }

  // Index on ts for efficient rotation queries
  db.exec(tLog.q.createIndex("idx_hook_log_ts", ["ts"]).toSQL());
  db.exec(tLog.q.createIndex("idx_hook_log_event", ["event"]).toSQL());

  // Prepared statements via qb-generated SQL
  const stmtGet = db.prepare(t.getById);
  const stmtUpsert = db.prepare(t.upsert);

  // UPSERT for setNanoid: INSERT (session_id, nanoid, writer_id, created_at, updated_at)
  // ON CONFLICT(session_id) DO UPDATE SET nanoid=excluded.nanoid, writer_id=excluded.writer_id, updated_at=excluded.updated_at
  const stmtUpsertNanoid = db.prepare(
    t.req
      .insert(["session_id", "nanoid", "writer_id", "created_at", "updated_at"])
      .onConflict("session_id")
      .doUpdate(["nanoid", "writer_id", "updated_at"])
      .toSQL(),
  );

  // UPSERT for incrementStop: INSERT (session_id, last_stop_at, stop_count, created_at, updated_at)
  // ON CONFLICT(session_id) DO UPDATE SET last_stop_at=excluded.last_stop_at, stop_count=session_state.stop_count + 1, updated_at=excluded.updated_at
  // No modulo — stop_count resets to 0 only when identity is actually re-injected (resetStopCount).
  const stmtUpsertStop = db.prepare(
    t.req
      .insert(["session_id", "last_stop_at", "stop_count", "created_at", "updated_at"])
      .onConflict("session_id")
      .doUpdateRaw({
        last_stop_at: "excluded.last_stop_at",
        stop_count: "session_state.stop_count + 1",
        updated_at: "excluded.updated_at",
      })
      .toSQL(),
  );

  // UPSERT for resetStopCount: INSERT (session_id, last_stop_at, stop_count, created_at, updated_at)
  // ON CONFLICT(session_id) DO UPDATE SET last_stop_at=excluded.last_stop_at, stop_count=0, updated_at=excluded.updated_at
  const stmtResetStopCount = db.prepare(
    t.req
      .insert(["session_id", "last_stop_at", "stop_count", "created_at", "updated_at"])
      .onConflict("session_id")
      .doUpdateRaw({
        last_stop_at: "excluded.last_stop_at",
        stop_count: "0",
        updated_at: "excluded.updated_at",
      })
      .toSQL(),
  );

  // UPSERT for setHandoff: INSERT (session_id, last_handoff_at, created_at, updated_at)
  // ON CONFLICT(session_id) DO UPDATE SET last_handoff_at=excluded.last_handoff_at, updated_at=excluded.updated_at
  const stmtUpsertHandoff = db.prepare(
    t.req
      .insert(["session_id", "last_handoff_at", "created_at", "updated_at"])
      .onConflict("session_id")
      .doUpdate(["last_handoff_at", "updated_at"])
      .toSQL(),
  );

  // UPSERT for touchSession: INSERT (session_id, last_seen_at, created_at)
  // ON CONFLICT(session_id) DO UPDATE SET last_seen_at=excluded.last_seen_at
  const stmtTouch = db.prepare(
    t.req
      .insert(["session_id", "last_seen_at", "created_at"])
      .onConflict("session_id")
      .doUpdate(["last_seen_at"])
      .toSQL(),
  );

  // UPSERT for setTitle: INSERT (session_id, title, created_at, updated_at)
  // ON CONFLICT(session_id) DO UPDATE SET title=excluded.title, updated_at=excluded.updated_at
  const stmtSetTitle = db.prepare(
    t.req
      .insert(["session_id", "title", "created_at", "updated_at"])
      .onConflict("session_id")
      .doUpdate(["title", "updated_at"])
      .toSQL(),
  );

  // Devin sessions.db (read-only) — lookup conversation title by session_id
  const devinSessionsPath = join(
    process.env.APPDATA ?? join(homedir(), ".config"),
    "devin", "cli", "sessions.db",
  );
  let devinSessions: Database.Database | null = null;
  try {
    devinSessions = new Database(devinSessionsPath, { readonly: true, fileMustExist: true });
    devinSessions.pragma("busy_timeout = 1000");
  } catch {
    // Devin sessions.db not found — title lookup will return null
  }
  const stmtGetTitle = devinSessions?.prepare("SELECT title FROM sessions WHERE id = ?");

  // Log statements
  const stmtInsertLog = db.prepare(
    tLog.req.insert(["ts", "event", "session_id", "tool_name", "input", "output", "meta"]).toSQL(),
  );
  const stmtCountLogs = db.prepare(tLog.q.count().toSQL());
  // Raw SQL: qb does not support subqueries in WHERE (NOT IN + SELECT ... LIMIT)
  const stmtPruneLogs = db.prepare(
    "DELETE FROM hook_log WHERE id NOT IN (SELECT id FROM hook_log ORDER BY id DESC LIMIT ?)",
  );

  function pruneIfNeeded(): void {
    const count = (stmtCountLogs.get() as { count: number }).count;
    if (count > LOG_MAX_ENTRIES) {
      stmtPruneLogs.run(LOG_MAX_ENTRIES);
    }
  }

  return {
    getSession(session_id: string): SessionStateRow | undefined {
      return stmtGet.get({ session_id }) as SessionStateRow | undefined;
    },
    upsertSession(session_id: string, data: Partial<Omit<SessionStateRow, "session_id" | "created_at">>): void {
      const now = new Date().toISOString();
      stmtUpsert.run({
        session_id,
        nanoid: data.nanoid ?? null,
        writer_id: data.writer_id ?? null,
        last_stop_at: data.last_stop_at ?? null,
        last_handoff_at: data.last_handoff_at ?? null,
        stop_count: data.stop_count ?? 0,
        created_at: now,
        updated_at: now,
        last_seen_at: data.last_seen_at ?? now,
      });
    },
    setNanoid(session_id: string, nanoid: string, writer_id: string): void {
      const now = new Date().toISOString();
      stmtUpsertNanoid.run({ session_id, nanoid, writer_id, created_at: now, updated_at: now });
    },
    incrementStop(session_id: string): void {
      const now = new Date().toISOString();
      stmtUpsertStop.run({ session_id, last_stop_at: now, stop_count: 1, created_at: now, updated_at: now });
    },
    resetStopCount(session_id: string): void {
      const now = new Date().toISOString();
      stmtResetStopCount.run({ session_id, last_stop_at: now, stop_count: 0, created_at: now, updated_at: now });
    },
    setHandoff(session_id: string): void {
      const now = new Date().toISOString();
      stmtUpsertHandoff.run({ session_id, last_handoff_at: now, created_at: now, updated_at: now });
    },
    touchSession(session_id: string): void {
      const now = new Date().toISOString();
      stmtTouch.run({ session_id, last_seen_at: now, created_at: now });
      // Lookup title from Devin sessions.db if not yet stored
      const existing = stmtGet.get({ session_id }) as SessionStateRow | undefined;
      if (!existing?.title && stmtGetTitle) {
        const row = stmtGetTitle.get(session_id) as { title: string | null } | undefined;
        if (row?.title) {
          const tNow = new Date().toISOString();
          stmtSetTitle.run({ session_id, title: row.title, created_at: now, updated_at: tNow });
        }
      }
    },
    setTitle(session_id: string, title: string): void {
      const now = new Date().toISOString();
      stmtSetTitle.run({ session_id, title, created_at: now, updated_at: now });
    },
    log(entry: { event: string; session_id?: string; tool_name?: string | null; input?: string | null; output?: string | null; meta?: Record<string, unknown> }): void {
      stmtInsertLog.run({
        ts: new Date().toISOString(),
        event: entry.event,
        session_id: entry.session_id ?? null,
        tool_name: entry.tool_name ?? null,
        input: entry.input ?? null,
        output: entry.output ?? null,
        meta: entry.meta ? JSON.stringify(entry.meta) : null,
      });
      pruneIfNeeded();
    },
    getLogs(limit: number = 100): HookLogRow[] {
      const sql = tLog.q.select().orderBy("id", "DESC").limit(limit).toSQL();
      return db.prepare(sql).all() as HookLogRow[];
    },
  };
}
