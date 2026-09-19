/** Built-in hash embedder: character-trigram feature hashing (FNV-1a).
 *  Zero dependency, deterministic, catches typos and EN morphology.
 *  Weakness: no real semantics — pair with a model2vec embedder for meaning. */
import type { IEmbedder } from "./types.ts";

export function createHashEmbedder(dim = 256): IEmbedder {
  const embed = (text: string): Float32Array => {
    const v = new Float32Array(dim);
    const toks = text.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) ?? [];
    const grams: string[] = [];
    for (const t of toks) {
      grams.push(t);
      for (let i = 0; i < t.length - 2; i++) grams.push(t.slice(i, i + 3));
    }
    for (const g of grams) {
      let h = 2166136261;
      for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
      const idx = (h >>> 0) % dim;
      v[idx] += (h & 1) ? 1 : -1;
    }
    let n = 0;
    for (const x of v) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < dim; i++) v[i] /= n;
    return v;
  };
  return { embed, dim, vocab: 0 };
}
