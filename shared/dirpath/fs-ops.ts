
import fs from "node:fs";
import { 
  SafeResult, 
  safeResultOk, 
  safeResultErr 
} from "../safe/safemode.js";

/**
 * Deterministic and failure-transparent I/O primitives.
 */

// --- Async Operations ---
export async function readSafe(
  filePath: string, 
  encoding: BufferEncoding = "utf8"
): Promise<SafeResult<string | Buffer>> {
  try {
    const data = await fs.promises.readFile(filePath, encoding);
    return safeResultOk(data);
  } catch (err) {
    return safeResultErr(err);
  }
}

export async function writeSafe(
  filePath: string, 
  content: string | Buffer
): Promise<SafeResult<boolean>> {
  try {
    await fs.promises.writeFile(filePath, content);
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

export async function removeSafe(filePath: string): Promise<SafeResult<boolean>> {
  try {
    await fs.promises.rm(filePath, { recursive: true, force: true });
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

// --- Sync Operations ---
export function readSyncSafe(
  filePath: string, 
  encoding: BufferEncoding = "utf8"
): SafeResult<string | Buffer> {
  try {
    const data = fs.readFileSync(filePath, encoding);
    return safeResultOk(data);
  } catch (err) {
    return safeResultErr(err);
  }
}

export function writeSyncSafe(
  filePath: string, 
  content: string | Buffer
): SafeResult<boolean> {
  try {
    fs.writeFileSync(filePath, content);
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

export const existsSync = fs.existsSync;

/** Ensures a directory exists. */
export function ensureDir(dirPath: string): SafeResult<boolean> {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

/** Deep copy. */
export function copyDeep(
  src: string, 
  dest: string, 
  overwrite: boolean = false
): SafeResult<boolean> {
  try {
    fs.cpSync(src, dest, { recursive: true, force: overwrite });
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

/** Deep remove. */
export function removeDeep(target: string): SafeResult<boolean> {
  if (!fs.existsSync(target)) return safeResultOk(true);
  try {
    fs.rmSync(target, { recursive: true, force: true });
    return safeResultOk(true);
  } catch (err) {
    return safeResultErr(err);
  }
}

/** Efficiently count lines. */
export function countLineSync(filePath: string): SafeResult<number> {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return safeResultOk(content.split("\n").length);
  } catch (err) {
    return safeResultErr(err);
  }
}
