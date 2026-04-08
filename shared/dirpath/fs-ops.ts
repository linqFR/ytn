import fs from "node:fs";
import {
  catchAsyncFn,
  catchSyncFn,
  safeResultErr,
  safeResultOk,
  tsSafeResult
} from "../safe/safemode.js";

/**
 * Deterministic and failure-transparent I/O primitives.
 */

// --- Async Operations ---

/**
 * @function readSafe
 * @description Reads a file asynchronously and returns a SafeResult.
 *
 * @param {string} filePath - Path to the file.
 * @param {BufferEncoding} [encoding="utf8"] - File encoding.
 * @returns {Promise<tsSafeResult<string | Buffer>>} A promise resolving to a [error, data] tuple.
 */
export async function readSafe(
  filePath: string,
  encoding: BufferEncoding = "utf8",
) {
  return catchAsyncFn(fs.promises.readFile)(filePath, encoding);
}

/**
 * @function writeSafe
 * @description Writes a file asynchronously and returns a SafeResult.
 *
 * @param {string} filePath - Path to the file.
 * @param {string | Buffer} content - Content to write.
 * @returns {Promise<tsSafeResult<void>>} A promise resolving to a [error, result] tuple.
 */
export async function writeSafe(filePath: string, content: string | Buffer) {
  return catchAsyncFn(fs.promises.writeFile)(filePath, content);
}

/**
 * @function removeSafe
 * @description Removes a file or directory asynchronously (recursive and forced).
 *
 * @param {string} filePath - Path to remove.
 * @returns {Promise<tsSafeResult<void>>} A promise resolving to a [error, result] tuple.
 */
export async function removeSafe(filePath: string) {
  return catchAsyncFn(fs.promises.rm)(filePath, {
    recursive: true,
    force: true,
  });
}

// --- Sync Operations ---

/**
 * @function readSyncSafe
 * @description Reads a file synchronously and returns a SafeResult.
 *
 * @param {string} filePath - Path to the file.
 * @param {BufferEncoding} [encoding="utf8"] - File encoding.
 * @returns {tsSafeResult<string | Buffer>} A [error, data] tuple.
 */
export function readSyncSafe(
  filePath: string,
  encoding: BufferEncoding = "utf8",
) {
  return catchSyncFn(fs.readFileSync)(filePath, encoding);
}

/**
 * @function writeSyncSafe
 * @description Writes a file synchronously and returns a SafeResult.
 *
 * @param {string} filePath - Path to the file.
 * @param {string | Buffer} content - Content to write.
 * @returns {tsSafeResult<void>} A [error, result] tuple.
 */
export function writeSyncSafe(filePath: string, content: string | Buffer) {
  return catchSyncFn(fs.writeFileSync)(filePath, content);
}

/**
 * @function existsSync
 * @description Synchronously checks if a path exists.
 *
 * @param {string | Buffer | URL} path - The path to check.
 * @returns {boolean} True if the path exists.
 */
export function existsSync(path: string | Buffer | URL): boolean {
  return fs.existsSync(path);
}

/**
 * @function ensureDir
 * @description Ensures a directory exists by creating it recursively if it doesn't.
 *
 * @param {string} dirPath - Path to the directory.
 * @returns {tsSafeResult<string | undefined>} A SafeResult containing the first directory path created, or an error.
 */
export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    return catchSyncFn(fs.mkdirSync)(dirPath, { recursive: true });
  }
  return safeResultErr<boolean>(false) as any;
}

/**
 * @function copyDeep
 * @description Deep copies a file or directory synchronously.
 *
 * @param {string} src - Source path.
 * @param {string} dest - Destination path.
 * @param {boolean} [overwrite=false] - Whether to overwrite existing files.
 * @returns {tsSafeResult<void>} A failure-transparent result.
 */
export function copyDeep(
  src: string,
  dest: string,
  overwrite: boolean = false,
) {
  return catchSyncFn(fs.cpSync)(src, dest, {
    recursive: true,
    force: overwrite,
  });
}

/**
 * @function removeDeep
 * @description Deep removes a file or directory synchronously.
 *
 * @param {string} target - Path to remove.
 * @returns {tsSafeResult<boolean>} Standardized success/failure result.
 */
export function removeDeep(target: string) {
  if (!fs.existsSync(target)) return safeResultOk(true);
  return catchSyncFn(fs.rmSync)(target, { recursive: true, force: true })[0]
    ? safeResultErr(false)
    : safeResultOk(true);
}

/**
 * @function countLineSync
 * @description Efficiently counts lines in a text file synchronously.
 *
 * @param {string} filePath - Path to the file.
 * @returns {tsSafeResult<number>} The number of lines, or a SafeError.
 */
export function countLineSync(filePath: string) {
  const [err, content] = catchSyncFn(fs.readFileSync)(filePath, "utf8");
  if (err) return safeResultErr(err);
  return safeResultOk((content as string).split("\n").length);
}
