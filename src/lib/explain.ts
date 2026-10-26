// Explain-This-Topic assistant (offline mode).
// Answers only from retrieved workspace chunks (plan §6, §25.3, §25.4).
// Extractive MVP: composes the best-matching sentences, each with a citation
// marker. Abstains instead of inventing an answer.
// Improved: stopwords are filtered from the query, and a minimum fraction of
// meaningful (non-stopword) query tokens must match each sentence — off‑topic
// questions that only share a stopword (e.g. "the", "a") now correctly abstain.
import type { Chunk, DocumentFile } from "@/lib/types";
import { retrieveChunks } from "@/lib/retrieval";

// English stopwords – words that carry little meaningful content for matching.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "because", "as", "until",
  "while", "of", "at", "by", "for", "with", "about", "against", "between",
  "into", "through", "during", "before", "after", "above", "below", "to",
  "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "when", "where", "why", "how",
  "all", "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "can", "will", "just", "don", "should", "now",
]);

// Minimum fraction of non‑stopword query tokens that must match a sentence's
// word‑set for the answer to be considered grounded. 0.5 = at least half of
// the meaningful query must overlap; off‑topic queries that only match a
// meaningless stopword fall below this and trigger abstention.
const MIN_MATCH_FRACTION = 0.5;

function stripStopwords(tokens: Set<string>): Set<string> {
  const meaningful = new Set<string>();
  for (const t of tokens) {
    const cleaned = t.replace(/^[^a-zA-Z]*|[^a-zA-Z]*$/g, "").toLowerCase();
    if (cleaned && !STOPWORDS.has(cleaned)) {
      meaningful.add(t);
    }
  }
  return meaningful;
}

/** Score each sentence in a chunk by the fraction of meaningful query tokens
   that appear in it. Returns an array of {sentence, score} pairs. */
function scoreSentences(chunk: Chunk, meaningfulQuery: Set<string>): { s: string; score: number }[] {
  const sentences = chunk.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const scored: { s: string; score: number }[] = [];
  for (const s of sentences) {
    const toks = new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
    let matchCount = 0;
    for (const t of meaningfulQuery) {
      const cleanedT = t.replace(/^[^a-zA-Z]*|[^a-zA-Z]*$/g, "").toLowerCase();
      if (toks.has(cleanedT)) matchCount += 1;
    }
    const fraction = meaningfulQuery.size > 0 ? matchCount / meaningfulQuery.size : 0;
    scored.push({ s, score: fraction });
  }
  return scored;
}

export interface ExplainResult {
  abstained: boolean;
  answer: string;
  citations: { n: number; documentTitle: string; locator: string; quote: string; documentId: string }[];
}

/** Extractive answer from uploaded material.
// 1. Retrieve top‑k chunks (k=4) keyword‑matched to the query.
// 2. Filter stopwords from the query; keep only content words.
// 3. Score every sentence in every retrieved chunk by the fraction of
//    meaningful query tokens it contains.
// 4. Keep only sentences whose score >= MIN_MATCH_FRACTION.
// 5. If nothing meets the threshold, abstain (honest “not in your material”).
// 6. Otherwise, return the best sentences with [n] citations. */
export function explainFromMaterial(query: string, chunks: Chunk[], documents: DocumentFile[]): ExplainResult {
  const docTitles = new Map(documents.map((d) => [d.id, d.title]));
  const hits = retrieveChunks(query, chunks, { k: 4 });
  // Tokenise the raw query, then strip stopwords for content‑based matching.
  const rawTokens = new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
  const meaningfulQuery = stripStopwords(rawTokens);

  // If the user only asked stopwords (e.g. "the", "a"), there is nothing to ground.
  if (meaningfulQuery.size === 0) {
    return {
      abstained: true,
      answer:
        "I could not find this in your uploaded materials yet. To stay trustworthy, GapFinder answers only from what you uploaded — try different wording, or upload the notes/chapter that covers this.",
      citations: [],
    };
  }

  // Score every sentence in every retrieved chunk by the fraction of meaningful
  // query tokens it overlaps with.
  const allScored: { s: string; score: number; chunk: Chunk }[] = [];
  for (const hit of hits) {
    const sentences = scoreSentences(hit.chunk, meaningfulQuery);
    for (const { s, score } of sentences) {
      allScored.push({ s, score, chunk: hit.chunk });
    }
  }

  // Keep only sentences that meet the minimum term‑share threshold.
  const qualified = allScored.filter((x) => x.score >= MIN_MATCH_FRACTION);

  // If no sentence reaches the minimum share, abstain.
  if (qualified.length === 0) {
    return {
      abstained: true,
      answer:
        "I could not find this in your uploaded materials yet. To stay trustworthy, GapFinder answers only from what you uploaded — try different wording, or upload the notes/chapter that covers this.",
      citations: [],
    };
  }

  // Deduplicate sentences (keep the highest‑scoring occurrence) and build citations.
  const seen = new Set<string>();
  const sorted = qualified.sort((a, b) => b.score - a.score);
  const citations: ExplainResult["citations"] = [];
  const parts: string[] = [];
  let n = 0;
  for (const { s, score, chunk } of sorted) {
    // Normalise for dedup – compare trimmed lower‑cased text.
    const sig = s.toLowerCase().trim();
    if (seen.has(sig)) continue;
    seen.add(sig);

    n += 1;
    // Find the document title for the citation.
    const chunkDocTitle = docTitles.get(chunk.documentId) ?? "Uploaded material";
    citations.push({
      n,
      documentTitle: chunkDocTitle,
      locator: chunk.locator,
      quote: s,
      documentId: chunk.documentId,
    });
    parts.push(`[${n}] “${s}”`);
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