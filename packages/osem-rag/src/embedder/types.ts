/** Embedder contract — implement this to plug any static embedding model. */

export interface IEmbedder {
  /** Returns a L2-normalized dense vector for the text. Deterministic. */
  embed(text: string): Float32Array;
  readonly dim: number;
  readonly vocab: number;
}
