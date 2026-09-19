/**
 * Pure-JS model2vec loader (potion-base-8M) — zero dependency.
 * Safetensors format: [u32 headerLen][u32 pad][header JSON][data F32 LE]
 * Hand-rolled WordPiece tokenizer (BertNormalizer: lowercase + strip accents).
 * Deterministic: same text → same vector.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IEmbedder } from "./types.ts";

export function loadModel2Vec(dir: string): IEmbedder {
  const buf = readFileSync(join(dir, "model.safetensors"));
  const headerLen = buf.readUInt32LE(0);
  const header = JSON.parse(buf.slice(8, 8 + headerLen).toString("utf8"));
  const info = header["embeddings"];
  const [rows, dim] = info.shape;
  const dataStart = 8 + headerLen;
  const mat = new Float32Array(
    buf.buffer.slice(buf.byteOffset + dataStart,
      buf.byteOffset + dataStart + rows * dim * 4));
  const tk = JSON.parse(readFileSync(join(dir, "tokenizer.json"), "utf8"));
  const vocab: Map<string, number> = new Map(Object.entries(tk.model.vocab));

  // BertNormalizer: lowercase + strip accents + clean
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  const embed = (text: string): Float32Array => {
    const v = new Float32Array(dim);
    const words = normalize(text).split(/\s+/).filter(Boolean);
    for (const w of words) {
      let start = 0;
      while (start < w.length) {
        let cur = w.length, found = -1;
        while (cur > start) {
          const sub = (start === 0 ? "" : "##") + w.slice(start, cur);
          const id = vocab.get(sub);
          if (id !== undefined) { found = id; break; }
          cur--;
        }
        if (cur === start) { start++; continue; }   // unknown char → skip
        for (let d = 0; d < dim; d++) v[d] += mat[found * dim + d];
        start = cur;
      }
    }
    let n2 = 0;
    for (const x of v) n2 += x * x;
    const nrm = Math.sqrt(n2) || 1;
    for (let d = 0; d < dim; d++) v[d] /= nrm;
    return v;
  };

  return { embed, dim, vocab: rows };
}
