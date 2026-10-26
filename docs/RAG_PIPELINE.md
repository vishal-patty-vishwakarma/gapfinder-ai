# RAG Pipeline

Grounding = **retrieval → generation**: retrieval selects evidence; generation may only use that evidence, with verifiable citations. The two roles never merge.

## 1. Ingestion & extraction

- Accept: plain text (.txt/.md) and **readable, text-based PDF** (pdf-parse), ≤ 8 MB (§16).
- Scanned / image PDFs / empty files → rejected with an explicit reason; processing statuses are visible on Materials — never "silently processed".
- Same filename re-upload → new document **version**; old chunks deactivated (citations keep resolving to their exact historical chunk).

## 2. Chunking (`src/lib/chunking.ts`)

- **Heading-first**: split on `#`/`Unit n`/`Qn` headers → sections.
- Oversized sections split sentence-wise into ≤ 1100-char chunks.
- Each chunk keeps: text, human-readable **locator** (`§ heading`), document id/version, active flag.
- Chunk quality is implicit in section boundaries; table/formula-heavy content is *not* specially handled (documented limitation).

## 3. Indexing & retrieval (`src/lib/retrieval.ts`)

- MVP index: **TF-IDF keyword scoring** over the workspace's active chunks (`INDEX_MODE` label in code is explicit).
- `retrieveChunks(query, chunks, {topicId, k})`: tokenize → per-chunk score (1 + idf per matched query token) → sorted top-k (k = 4–6 depending on task).
- **Topic-constrained retrieval** for question generation: chunks must belong to the topic (a WHERE-scoped filter analogue), so items can't be off-topic even if wording is similar.
- **Workspace confinement** is structural: retrieval only ever sees the authenticated user's chunks.
- Upgrade path (documented, not silently swapped): Postgres **pgvector** embeddings + hybrid keyword re-ranking, same function signature; `embeddingModel` field is already versioned per chunk.

## 4. Topic mapping (coverage honesty)

New chunks map to topics by keyword-overlap scoring (`mapChunkToTopic`), threshold = 2.
Below threshold → chunk is **unmapped and flagged in the UI**; it does NOT count toward any topic's material coverage. No fabricated coverage.

## 5. Question generation (§25.3/§25.4)

**bank-v1 (seeded, used for diagnostics):** curated MCQ/short items whose citations are verified **at seed time** — every quote must appear verbatim in the referenced chunk, else the item is marked `invalid` and excluded from attempts (fail loudly, not silently).

**autogen-v1 (reassessments / deep dives):** anchor-first generation:
1. pick the most topically-relevant **anchor sentence** in a mapped chunk;
2. cloze-blank the anchor's topic keyword;
3. distractors drawn from the topic's own vocabulary (never general knowledge);
4. cite the anchor sentence (chunk + locator + quote);
5. deterministic option rotation; schema validation.

With an LLM provider configured, the generator may draft better items — but they pass through the SAME validation gate (citation resolves; key supported by the anchor; distractors distinct). **Question generation from the model's general memory is not accepted.**

## 6. Submission/citation policy

- Quiz-time payloads contain only `document title + locator` — the anchor **quote is hidden until submission** (§25.4).
- After submission, the evidence trail shows the exact quote.
- Citation IDs are checked server-side against stored chunks; model-invented citations would fail validation and mark the item `needs_review`/`invalid`.

## 7. Measured, not asserted (`npm run eval:demo`)

- **Citation validity rate**: every bank item's citations resolve to live chunks AND contain the anchor.
- **Retrieval hit rate**: explain/synthetic queries must find their topic's chunks in top-k.
- **Grounding regressions** surface immediately when seed content shifts.

## 8. Known limitations

- Keyword retrieval has no semantic understanding — paraphrase-heavy queries can miss (honest abstention is the failure mode, not hallucination).
- Extractive ("only-quotes") answers in offline mode — correct but terse; optional LLM rewrite keeps citations.
- Chunk topic mapping is heuristic; unmapped chunks are flagged for user review rather than auto-silently mapped.
