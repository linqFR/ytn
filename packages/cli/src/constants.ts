/**
 * @ytrynot/cli — Shared constants.
 *
 * @module @ytrynot/cli/constants
 */

/**
 * Internal route identifier key, injected by `apply` from `.meta().cli.routeId`.
 *
 * Uses a NUL byte prefix (`\x00`) — the only character universally impossible
 * to pass as a CLI argument on all platforms (Unix `execve()` C-strings are
 * NUL-terminated, Windows `CommandLineToArgvW` treats `\x00` as terminator,
 * Node.js `child_process.spawn` rejects null bytes since Node 18.x).
 *
 * Convention: any field starting with `\x00` is internal, filtered from
 * the payload and from `toParseArgsConfig().options`.
 */
export const ROUTE_ID_KEY = "\x00ID" as const;
