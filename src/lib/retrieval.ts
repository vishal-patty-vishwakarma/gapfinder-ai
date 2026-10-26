// Retrieval service (offline/deterministic mode).
//
// This is the retrieval side of RAG: given a query and topic filter, select and
// rank source chunks from the AUTHORISED workspace only. Generation then uses
// these chunks — the two roles are kept separate (plan §7/§9/§25.3).
//
// MVP index mode: TF-IDF-style keyword scoring in-memory over the workspace's
// chunks. The `indexMode` label is honest: no real embeddings are stored yet.
// Upgrade path (documented, not silently swapped): Supabase + pgvector with the
// same interface — see docs/RAG_PIPELINE.md.
import type { Chunk, TopicState } from "@/lib/types";

export const INDEX_MODE = "keyword-v1 (local TF-IDF over workspace chunks; pgvector upgrade path documented)";

const STOP = new Set(
  ("a an the and or of to in on for with is are was were be been at by from as it its this that these those " +
    "you your if then than so such can will not no what which when where how into onto between among").split(" ")
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export interface ScoredChunk {
  chunk: Chunk;
  score: number;
  matchedTerms: string[];
}

export function scoreChunks(
  queryTokens: string[],
  chunks: Chunk[],
  opts?: { topicId?: string | null }
): ScoredChunk[] {
  const active = chunks.filter(
    (c) => c.active && (opts?.topicId == null ? true : c.topicId === opts.topicId)
  );
  if (active.length === 0) return [];

  // Document frequencies
  const df = new Map<string, number>();
  const tokenized = active.map((c) => {
    const toks = new Set(tokenize(c.text));
    for (const t of toks) df.set(t, (df.get(t) ?? 0) + 1);
    return toks;
  });

  const N = active.length;
  const results: ScoredChunk[] = [];
  for (let i = 0; i < active.length; i++) {
    const toks = tokenized[i];
    let score = 0;
    const matched: string[] = [];
    for (const q of queryTokens) {
      if (toks.has(q)) {
        const idf = Math.log(1 + N / (1 + (df.get(q) ?? 0)));
        score += 1 + idf;
        matched.push(q);
      }
    }
    if (score > 0) results.push({ chunk: active[i], score, matchedTerms: matched });
  }
  results.sort((a, b) => b.score - a.score || a.chunk.index - b.chunk.index);
  return results;
}

/** Retrieve top-k chunks for a query, optionally constrained to a topic. */
export function retrieveChunks(
  query: string,
  chunks: Chunk[],
  opts?: { topicId?: string | null; k?: number }
): ScoredChunk[] {
  const k = opts?.k ?? 5;
  const tokens = tokenize(query);
  const scored = scoreChunks(tokens, chunks, opts);
  return scored.slice(0, k);
}

/** The coverage shape the UI needs. */
export function coverageForTopics(topics: TopicState[], chunks: Chunk[]) {
  const rows = topics.map((t) => {
    let mapped = 0;
    let unmappedChunks = 0;
    for (const c of chunks) {
      if (!c.active) continue;
      if (c.topicId === t.id) mapped += 1;
    }
    return { topicId: t.id, title: t.title, mapped };
  });
  const unmappedChunks = chunks.filter((c) => c.active && !c.topicId).length;
  return { rows, unmappedChunks };
}

/** Best-effort topic mapping for a new chunk using topic keywords. */
export function mapChunkToTopic(text: string, topics: TopicState[]): { topicId: string | null; confidence: number } {
  const tokens = new Set(tokenize(text));
  let best: { id: string; score: number } | null = null;
  for (const t of topics) {
    let score = 0;
    for (const kw of t.keywords) {
      const kwTokens = tokenize(kw);
      if (kwTokens.length === 0) continue;
      const all = kwTokens.every((w) => tokens.has(w));
      if (all) score += 2;
      else if (kwTokens.some((w) => tokens.has(w))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: t.id, score };
  }
  if (!best) return { topicId: null, confidence: 0 };
  return { topicId: best.id, confidence: best.score };
}

export const TOPIC_MAP_THRESHOLD = 2; // below this confidence => unmapped (needs review)
