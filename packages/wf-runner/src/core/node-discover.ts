import * as registry from "./registry.js";
import type { tsNodeSignature } from "../types/node-def.type.js";

/**
 * Discover and expose the signatures of all nodes registered or discoverable.
 *
 * @description
 * Scans all registered folders (eager and lazy), loads the nodes if they ARE not already in memory,
 * and returns their serialized signatures (id, description, input/output JSON schemas).
 *
 * @returns {Promise<tsNodeSignature[]>} An array of node signatures.
 */
export async function registrySignatures(): Promise<tsNodeSignature[]> {
  return registry.signatures();
}

/**
 * Exposes the signature of a specific node by its Gatename.
 *
 * @param {string} gatename The name of the node to retrieve.
 * @returns {Promise<tsNodeSignature | undefined>} The node signature or undefined if not found.
 */
export async function nodeSignature(
  gatename: string,
): Promise<tsNodeSignature | undefined> {
  const node = await registry.get(gatename);
  return node?.signature;
}
