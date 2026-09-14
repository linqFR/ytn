/**
 * env-vars.ts — Resolve governance MCP env vars.
 *
 * When the server starts, it writes its resolved env vars to a JSON file
 * in the OS temp directory. The client reads this file to obtain the paths
 * without needing to parse MCP config files or rely on DEVIN_PROJECT_DIR.
 *
 * Server writes:  TMP/gov-mcp-server.json
 * Client reads:   TMP/gov-mcp-server.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

/** Env var names. */
const GOVERNANCE_DB_PATH_VAR = "GOVERNANCE_DB_PATH";
const GOVERNANCE_REPORTS_DIR_VAR = "GOVERNANCE_REPORTS_DIR";

/** Shape of the server info file written to TMP. */
export interface GovMcpServerInfo {
  GOVERNANCE_DB_PATH: string;
  GOVERNANCE_REPORTS_DIR: string;
  GOVERNANCE_SERVER_SCRIPT: string;
  startedAt: string;
}

/** Path to the server info file in the OS temp directory. */
export const GOV_MCP_INFO_FILE = resolve(tmpdir(), "gov-mcp-server.json");

/**
 * Write server info to TMP. Called by the server at startup.
 * The server has the env vars in process.env (injected by the CLI).
 */
export function writeServerInfo(serverScript: string): GovMcpServerInfo {
  const info: GovMcpServerInfo = {
    GOVERNANCE_DB_PATH: process.env[GOVERNANCE_DB_PATH_VAR]!,
    GOVERNANCE_REPORTS_DIR: process.env[GOVERNANCE_REPORTS_DIR_VAR]!,
    GOVERNANCE_SERVER_SCRIPT: serverScript,
    startedAt: new Date().toISOString(),
  };
  writeFileSync(GOV_MCP_INFO_FILE, JSON.stringify(info), "utf-8");
  return info;
}

/**
 * Read server info from TMP. Called by the client.
 * Returns null if the file doesn't exist or is invalid.
 */
export function readServerInfo(): GovMcpServerInfo | null {
  try {
    return JSON.parse(readFileSync(GOV_MCP_INFO_FILE, "utf-8")) as GovMcpServerInfo;
  } catch {
    return null;
  }
}

// ── Resolved values for the client ──
// The client reads the server info file. If it doesn't exist (server not started yet),
// it falls back to process.env (e.g. in tests where the caller sets the vars directly).

const serverInfo = readServerInfo();

function resolveGovEnv(key: string): string {
  const val = serverInfo?.[key as keyof GovMcpServerInfo]
    ?? process.env[key];
  if (!val) throw new Error(`${key} not found in server info file or process.env`);
  return val;
}

/** Resolved GOVERNANCE_DB_PATH — SQLite database file. */
export const GOVERNANCE_DB_PATH = resolveGovEnv(GOVERNANCE_DB_PATH_VAR);

/** Resolved GOVERNANCE_REPORTS_DIR — generated reports output directory. */
export const GOVERNANCE_REPORTS_DIR = resolveGovEnv(GOVERNANCE_REPORTS_DIR_VAR);

/** Resolved server script path — entry point for the gov-mcp server subprocess. */
export const GOVERNANCE_SERVER_SCRIPT = resolveGovEnv("GOVERNANCE_SERVER_SCRIPT");
