// Explain-This-Topic assistant (offline mode).
// Answers only from retrieved workspace chunks (plan §6, §25.3, §25.4).
// Extractive MVP: composes the best-matching sentences, each with a citation
// marker. Abstains instead of inventing an answer.
import type { Chunk, DocumentFile } from "@/lib/types";
import { retrieveChunks } from "@/lib/retrieval";

export interface ExplainResult {
  abstained: boolean;
  answer: string;
  citations: { n: number; documentTitle: string; locator: string; quote: string; documentId: string }[];
}

function bestSentences(chunk: Chunk, queryTokens: Set<string>, max: number): string[] {
  const sentences = chunk.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const scored = sentences.map((s) => {
    const toks = new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
    let score = 0;
    for (const t of queryTokens) if (toks.has(t)) score += 1;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).filter((x) => x.score > 0).map((x) => x.s);
}

const ABSTAIN_THRESHOLD = 0.5;

export function explainFromMaterial(query: string, chunks: Chunk[], documents: DocumentFile[]): ExplainResult {
  const docTitles = new Map(documents.map((d) => [d.id, d.title]));
  const hits = retrieveChunks(query, chunks, { k: 4 });
  const queryTokens = new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));

  const usable = hits.slice(0, 3);
  if (usable.length === 0 || usable[0].score < ABSTAIN_THRESHOLD) {
    return {
      abstained: true,
      answer:
        "I could not find this in your uploaded materials yet. To stay trustworthy, GapFinder answers only from what you uploaded — try different wording, or upload the notes/chapter that covers this.",
      citations: [],
    };
  }

  const citations: ExplainResult["citations"] = [];
  const parts: string[] = [];
  let n = 0;
  for (const hit of usable) {
    const sentences = bestSentences(hit.chunk, queryTokens, 2);
    if (sentences.length === 0) continue;
    for (const sentence of sentences) {
      n += 1;
      citations.push({
        n,
        documentTitle: docTitles.get(hit.chunk.documentId) ?? "Uploaded material",
        locator: hit.chunk.locator,
        quote: sentence,
        documentId: hit.chunk.documentId,
      });
      parts.push(`[${n}] “${sentence}”`);
    }
  }

  if (parts.length === 0) {
    return {
      abstained: true,
      answer: "I could not find this in your uploaded materials yet.",
      citations: [],
    };
  }

  return {
    abstained: false,
    answer: "From your materials:\n\n" + parts.join("\n"),
    citations,
  };
}
