// Answer evaluation (plan §11 / §25.5).
// Deterministic, rubric-based. States are explicit: correct / partial /
// incorrect / skipped / don't-know / needs_review — never a silent "wrong".
// When an LLM provider is configured it may score short answers, but it never
// overrules persisted state policy; failures degrade to these defaults.
import type { EvaluationRecord, Question, ResponseRecord } from "@/lib/types";
import { isUnresolvedKind, isValidKind } from "@/lib/policy";

function norm(text: string): string {
  return " " + text.toLowerCase().replace(/[^a-z0-9½\s'-]/g, " ").replace(/\s+/g, " ") + " ";
}

/** Single-word aliases match words starting with them; multi-word aliases are exact phrases. */
function conceptHit(textNormed: string, aliases: string[]): boolean {
  const words = textNormed.trim().split(" ");
  return aliases.some((a) => {
    const al = a.toLowerCase().trim();
    if (!al) return false;
    if (al.includes(" ")) return textNormed.includes(" " + al + " ");
    return words.some((w) => w.startsWith(al));
  });
}

export function gradeResponse(question: Question, response: ResponseRecord, attemptHistory: Set<string>): EvaluationRecord {
  const independent = !attemptHistory.has(question.id);

  if (response.state === "skipped") {
    return {
      questionId: question.id,
      kind: "skipped",
      score: null,
      rationale: "Recorded as skipped — no-signal, NOT counted as wrong (plan §11).",
      rubricHits: [], rubricMisses: [],
      independent,
    };
  }
  if (response.state === "dont_know") {
    return {
      questionId: question.id,
      kind: "dont_know",
      score: null,
      rationale: "Recorded as “I don’t know” — no-signal, NOT counted as wrong.",
      rubricHits: [], rubricMisses: [],
      independent,
    };
  }

  if (question.type === "mcq") {
    const option = question.options.find((o) => o.id === response.value);
    const correct = option?.id === question.answerOptionId;
    const answerOption = question.options.find((o) => o.id === question.answerOptionId);
    const rationale = correct
      ? `Correct. ${question.explanationRight}`
      : `You chose “${option?.label ?? "(malformed answer)"}”. ${option?.whyWrong ?? ""} The correct answer is “${answerOption?.label}”: ${question.explanationRight}`;
    return {
      questionId: question.id,
      kind: correct ? "correct" : "incorrect",
      score: correct ? 1 : 0,
      rationale,
      rubricHits: [], rubricMisses: [],
      independent,
    };
  }

  // --- short answer: rubric concepts with aliases + citation per concept ---
  const text = response.value ?? "";
  const textNormed = norm(text);
  const hits: string[] = [];
  const misses: string[] = [];
  for (const concept of question.expectedConcepts) {
    if (conceptHit(textNormed, concept.aliases)) hits.push(concept.id);
    else misses.push(concept.id);
  }
  const score = question.expectedConcepts.length ? hits.length / question.expectedConcepts.length : 0;

  const conceptById = new Map(question.expectedConcepts.map((c) => [c.id, c]));
  const earned = hits.map((id) => conceptById.get(id)?.label).filter(Boolean);
  const missed = misses.map((id) => conceptById.get(id)?.label).filter(Boolean);

  // Uncertainty guard: substantial written answer that matches NOTHING in
  // recognisable wording is not treated as confidently wrong (plan §11).
  const contentful = text.trim().length >= 30;
  if (hits.length === 0 && contentful) {
    return {
      questionId: question.id,
      kind: "needs_review",
      score: null,
      rationale: `Your answer did not match the expected ideas in recognisable wording (${missed.join("; ") || "rubric unavailable"}). Flagged for review so it is not counted against you.`,
      rubricHits: [], rubricMisses: misses,
      independent,
    };
  }

  let kind: EvaluationRecord["kind"];
  if (hits.length === question.expectedConcepts.length) kind = "correct";
  else if (misses.length === question.expectedConcepts.length) kind = "incorrect";
  else kind = "partial";

  const rationale =
    (hits.length > 0 ? `Credit earned for: ${earned.map((l, i) => `“${l}”`).join(", ")}. ` : "") +
    (misses.length > 0 ? `Missing: ${missed.join("; ")}.` : "") +
    ` ${question.explanationRight}`;

  return {
    questionId: question.id,
    kind,
    score,
    rationale,
    rubricHits: hits,
    rubricMisses: misses,
    independent,
  };
}

/** Grade every response in an attempt (used at submit time). */
export function gradeAttempt(
  responses: Record<string, ResponseRecord>,
  questions: Question[],
  priorSubmittedQuestionIds: Set<string>
): Record<string, EvaluationRecord> {
  const out: Record<string, EvaluationRecord> = {};
  for (const qid of Object.keys(responses)) {
    const q = questions.find((x) => x.id === qid);
    if (!q) {
      out[qid] = {
        questionId: qid,
        kind: "invalid",
        score: null,
        rationale: "Question reference not found in this workspace.",
        rubricHits: [], rubricMisses: [],
        independent: true,
      };
      continue;
    }
    out[qid] = gradeResponse(q, responses[qid], priorSubmittedQuestionIds);
  }
  return out;
}

export function hasUnresolvedEvals(evals: Record<string, EvaluationRecord>): boolean {
  return Object.values(evals).some((e) => isUnresolvedKind(e.kind));
}

export function anyQuestionIssues(questions: Question[]): boolean {
  return questions.some((q) => q.validationStatus !== "validated" || !isValidKind("incorrect"));
}
