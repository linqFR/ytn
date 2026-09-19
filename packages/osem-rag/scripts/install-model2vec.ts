/**
 * install-model2vec — download + validate the model2vec model files.
 *
 * Downloads `potion-base-8M` (model.safetensors + tokenizer.json) from
 * HuggingFace into the target directory — default OUTSIDE the repo
 * (`~/.osem/models/potion-base-8M`), overridable by argument or OSEM_MODEL_DIR.
 * Idempotent: existing valid files are verified, not re-downloaded.
 *
 *   npm.cmd run setup -w @ytrynot/osem-rag
 *   node node_modules/tsx/dist/cli.mjs packages/osem-rag/scripts/install-model2vec.ts [dir]
 */
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const MODEL_REPO = "minishlab/potion-base-8M";
/** Default model location OUTSIDE the repo (override: arg 1 or OSEM_MODEL_DIR). */
const DEFAULT_DIR = join(homedir(), ".osem", "models", "potion-base-8M");
const FILES = ["model.safetensors", "tokenizer.json"] as const;

const urlOf = (file: string) =>
  `https://huggingface.co/${MODEL_REPO}/resolve/main/${file}`;

async function download(dir: string, file: string): Promise<void> {
  const url = urlOf(file);
  console.log(`↓ ${file} …`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body)
    throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  await pipeline(
    Readable.fromWeb(res.body as import("node:stream/web").ReadableStream<Uint8Array>),
    createWriteStream(join(dir, file)),
  );
}

/** Validate the safetensors header ([u32 len][u32 pad][JSON header]) and tokenizer vocab. */
function validate(dir: string): { rows: number; dim: number; vocab: number } {
  const buf = readFileSync(join(dir, "model.safetensors"));
  const headerLen = buf.readUInt32LE(0);
  const header = JSON.parse(buf.slice(8, 8 + headerLen).toString("utf8")) as
    Record<string, { shape: number[] }>;
  const shape = header["embeddings"]?.shape;
  if (!Array.isArray(shape) || shape.length !== 2)
    throw new Error(`unexpected safetensors shape: ${JSON.stringify(header["embeddings"])}`);
  const tk = JSON.parse(readFileSync(join(dir, "tokenizer.json"), "utf8")) as {
    model: { vocab: Record<string, number> };
  };
  const vocab = Object.keys(tk.model.vocab ?? {}).length;
  if (!vocab) throw new Error("tokenizer.json: empty vocabulary");
  return { rows: shape[0], dim: shape[1], vocab };
}

const dir = process.argv[2] ?? DEFAULT_DIR;
await mkdir(dir, { recursive: true });
const missing = FILES.filter((f) => !existsSync(join(dir, f)));
if (missing.length === 0) {
  console.log(`model files already present in ${dir} — validating`);
} else {
  for (const file of missing) await download(dir, file);
}
const { rows, dim, vocab } = validate(dir);
console.log(`model2vec ready: ${rows}x${dim} embeddings, ${vocab} vocab entries, dir=${dir}`);
