/**
 * server.ts — Public re-export for the ./server subpath.
 *
 * The implementation lives in ./server/server.ts; this thin file
 * keeps the package.json export path stable.
 */
export { startServer, type IServerOptions } from "./server/server.js";
