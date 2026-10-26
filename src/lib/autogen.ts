// Offline question generation from retrieved chunks (plan §25.3 / §25.4).
//
// Deterministic "anchor-first" generation:
//   1. pick one anchor sentence from a retrieved chunk (topic-keyword match)
//   2. cloze-build an MCQ around it, with distractors drawn from the topic's
//      own vocabulary — never from the model's general knowledge
//   3. every item carries a citation to the anchor sentence
// With an LLM provider configured (see lib/ai/), the same pipeline may
// draft higher-quality items, but the validation gate stays identical.
import type { Chunk, Question, MCQOption, DocumentFile } from "@/lib/types";
import type { TopicState } from "@/lib/types";
import { tokenize } from "@/lib/retrieval";

function splitSentences(chunk: Chunk): string[] {
  return chunk.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 30);
}

/** Choose the sentence in a chunk most relevant to the topic. */
export function anchorSentence(chunk: Chunk, topic: TopicState): string | null {
  const topicTokens = tokenize(topic.title).concat(...topic.keywords.map((k) => tokenize(k)));
  let best: { sentence: string; score: number } | null = null;
  for (const sentence of splitSentences(chunk)) {
    const tokens = new Set(tokenize(sentence));
    let score = 0;
    for (const t of topicTokens) if (tokens.has(t)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { sentence, score };
  }
  return best ? best.sentence : null;
}

function blanked(sentence: string, term: string): string {
  const idx = sentence.toLowerCase().indexOf(term.toLowerCase());
  if (idx < 0) return sentence;
  return sentence.slice(0, idx) + "________" + sentence.slice(idx + term.length);
}

export function autogenQuestionsForTopic(
  topic: TopicState,
  chunks: Chunk[],
  documents: DocumentFile[],
  count: number
): Question[] {
  const docTitleMap = new Map(documents.map((d) => [d.id, d.title]));
  const out: Question[] = [];
  const active = chunks.filter((c) => c.active && c.topicId === topic.id);

  for (const chunk of active) {
    if (out.length >= count) break;
    const anchor = anchorSentence(chunk, topic);
    if (!anchor) continue;

    // Find a blankable term: prefer a topic keyword present in the anchor.
    let term: string | null = null;
    for (const kw of topic.keywords) {
      if (kw.length >= 4 && anchor.toLowerCase().includes(kw.toLowerCase())) {
        term = kw;
        break;
      }
    }
    if (!term) continue;

    // Distractors: other distinct topic keywords not in the anchor.
    const distractorPool = topic.keywords.filter(
      (k) => k.length >= 4 && !anchor.toLowerCase().includes(k.toLowerCase()) && k.toLowerCase() !== term.toLowerCase()
    );
    if (distractorPool.length < 3) continue;

    const options: MCQOption[] = [
      { id: "o1", label: term },
      ...distractorPool.slice(0, 3).map((k) => ({
        id: "x" + k.length + k.slice(0, 3),
        label: k,
        whyWrong: "This term does not complete this specific statement from your notes.",
      })),
    ];
    // Deterministic option rotation keyed by chunk+term (no randomness).
    const shift = (chunk.id.length + term.length) % options.length;
    const rotated = options.map((_, i) => options[(i + shift) % options.length]);
    const answerId = rotated.find((o) => o.label === term)!.id;
    options.splice(0, options.length, ...rotated);

    out.push({
      id: `auto_${topic.id}_${chunk.id}`,
      version: 1,
      topicId: topic.id,
      type: "mcq",
      difficulty: "medium",
      source: "auto",
      stem: `Complete this statement from your notes:\n\n“${blanked(anchor, term)}”`,
      options,
      answerOptionId: answerId,
      expectedConcepts: [],
      explanationRight: `Your notes state: “${anchor}”`,
      citations: [
        {
          chunkId: chunk.id,
          documentId: chunk.documentId,
          documentTitle: docTitleMap.get(chunk.documentId) ?? chunk.locator,
          locator: chunk.locator,
          quote: anchor,
        },
      ],
      validationStatus: "validated",
      validationIssues: [],
      generationVersion: "autogen-v1",
    });
  }
  return out.slice(0, count);
}
