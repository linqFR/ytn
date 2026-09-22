import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryTransport } from "@modelcontextprotocol/client";
import { afterAll, describe, expect, it } from "vitest";

import { createCore } from "../src/index.js";
import { publishDiscoveryFile, startStdioServer } from "../src/server.js";

const cleanup: string[] = [];
afterAll(() => {
  for (const p of cleanup) rmSync(p, { force: true, recursive: true });
});

describe("publishDiscoveryFile", () => {
  it("writes the JSON descriptor to the OS temp dir by default", () => {
    const path = publishDiscoveryFile("mcp-core-test-default.json", {
      MY_DB: "E:/data/app.db",
      DROPPED: undefined,
    });
    cleanup.push(path);

    expect(path).toBe(join(tmpdir(), "mcp-core-test-default.json"));
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed).toEqual({ MY_DB: "E:/data/app.db" }); // undefined dropped
  });

  it("writes to a custom dir when `dir` is given", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-core-discovery-"));
    cleanup.push(dir);

    const path = publishDiscoveryFile("my-server.json", { MY_DB: "/db" }, dir);

    expect(path).toBe(join(dir, "my-server.json"));
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ MY_DB: "/db" });
  });
});

describe("startStdioServer discovery option", () => {
  it("publishes the descriptor after connecting, with startedAt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-core-discovery-"));
    cleanup.push(dir);

    const [, serverTransport] = InMemoryTransport.createLinkedPair();
    const core = createCore({ tools: [], ctx: {} });
    const server = await startStdioServer({
      name: "test-server",
      version: "0.0.0",
      core,
      transport: serverTransport,
      discovery: { fileName: "srv.json", fields: { MY_DB: "/db" }, dir },
    });

    const path = join(dir, "srv.json");
    expect(existsSync(path)).toBe(true);
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed.MY_DB).toBe("/db");
    expect(typeof parsed.startedAt).toBe("string");

    await server.close();
  });
});
