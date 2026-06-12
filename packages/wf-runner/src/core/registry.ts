import { existsSync, readdirSyncSafe } from "@ytn/shared/dirpath/fs-ops.js";
import { importSafe } from "@ytn/shared/js/loader.js";
import { toKebabCase } from "@ytn/shared/js/string-cases.js";
import "@ytn/shared/polyfill/map-ext.js";
import path from "node:path";
import type { tsNodeSignature } from "../types/node-def.type.js";

const memory = new Map<string, any>();
const folderRegistry = new Map<string, string>();

export const IMPORTTYPES = {
  lazy: "LAZYFOLDER",
  eager: "PERMFOLDER",
};

export async function configFolders(
  dirpath: string,
  type: typeof IMPORTTYPES.eager | typeof IMPORTTYPES.lazy = IMPORTTYPES.eager,
) {
  if (!existsSync(dirpath)) return undefined;
  folderRegistry.set(dirpath, type);

  // Eager load if PERMFOLDER
  if (type === IMPORTTYPES.eager) {
    const [err, files] = readdirSyncSafe(dirpath, { withFileTypes: true });
    if (files) {
      const loading = [];
      for (const file of files) {
        if (file.isFile() && (file.name.endsWith(".ts") || file.name.endsWith(".js"))) {
          const fullPath = path.resolve(dirpath, file.name);
          const gatename = path.parse(file.name).name;

          loading.push(
            importSafe(fullPath).then(([err, mod]) => {
              if (!err && mod) {
                const node =
                  mod.default ||
                  mod[gatename] ||
                  Object.values(mod).find((v) => typeof v === "object");
                if (node) memory.set(gatename, node);
              } else if (err) {
                console.error(`[Registry] Failed to eager load ${file.name}:`, err);
              }
            }),
          );
        }
      }
      // Wait for all nodes in this folder to be loaded
      await Promise.all(loading);
    }
  }

  return dirpath;
}

export async function lazyFolder(dirpath: string) {
  return configFolders(dirpath, IMPORTTYPES.lazy);
}

export async function get(gatename: string) {
  const filename = toKebabCase(gatename);

  return await memory.getOrInsertComputed(gatename, async () => {
    for (const [dirpath] of folderRegistry.entries()) {
      const fullPath = path.resolve(dirpath, `${filename}.ts`);
      if (existsSync(fullPath)) {
        const [err, mod] = await importSafe(fullPath);
        if (!err && mod) {
          return (
            mod.default ||
            mod[gatename] ||
            Object.values(mod).find((v) => typeof v === "object")
          );
        }
        if (err) {
          console.error(
            `[Registry] Error importing node "${gatename}" from ${dirpath}:`,
            err,
          );
        }
      }
    }
    return undefined;
  });
}

/** Returns the list of currently loaded node Gatenames. */
export function getRegisteredIds() {
  return [...memory.keys()];
}

/** Returns the list of configured discovery folders. */
export function getConfiguredFolders() {
  return Array.from(folderRegistry.keys());
}

/** Scans all discovery folders and loads every node found. */
export async function discoverAll() {
  const loading: Promise<any>[] = [];
  for (const dirpath of folderRegistry.keys()) {
    const [err, files] = readdirSyncSafe(dirpath, { withFileTypes: true });
    if (files) {
      for (const file of files) {
        if (file.isFile() && (file.name.endsWith(".ts") || file.name.endsWith(".js"))) {
          const gatename = path.parse(file.name).name;
          loading.push(get(gatename));
        }
      }
    }
  }
  await Promise.all(loading);
}

/** Returns the signatures of all nodes (loads them if necessary). */
export async function signatures(): Promise<tsNodeSignature[]> {
  await discoverAll();
  const nodes = await Promise.all(Array.from(memory.values()));
  return nodes.map((node) => node.signature);
}
