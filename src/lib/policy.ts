// GapFinder AI — diagnosis policy v1.
//
// This file is the single source of truth for topic status rules. It is
// deliberately deterministic and inspectable: no LLM participates in deciding
// a topic status (plan §12 / §25.3). Thresholds are PROVISIONAL heuristics
// calibrated to the seeded demo course (max 3 valid items per topic), not
// validated psychometrics. `npm run eval:demo` checks them on synthetic
// learner profiles (Gate A acceptance).

import type { Attempt, Question, TopicState, TopicStatus, TopicAssessment, EvaluationKind } from "@/lib/types";

export const POLICY_VERSION = "gap-diagnosis-v1";

// Valid item = was answered (not skip / don't know) AND graded correct,
// incorrect or partial. Skipped / don't-know / needs_review / invalid are NOT
// counted as wrong (plan §11) but are reported as separate no-signal states.
export const MIN_VALID_FOR_STATUS = 2; // a status needs at least 2 valid items
export const MIN_VALID_FOR_STRONG = 3; // Strong needs depth, not just 2 right guesses

export function isValidKind(kind: EvaluationKind): boolean {
  return kind === "correct" || kind === "incorrect" || kind === "partial";
}

export function isUnresolvedKind(kind: EvaluationKind): boolean {
  return kind === "needs_review" || kind === "invalid";
}

/** Core banding. `validRate` = (correct + partial*0.5) / valid. */
export function bandStatus(validRate: number, nValid: number, hardCorrect: number): TopicStatus {
  // Weak: repeated, valid evidence of difficulty.
  if (validRate <= 0.4) return "weak";
  // Strong: consistent AND depth signal (hard or short item — cannot be guessed)
  // AND either a perfect score on >=2 items (short write-ins count as depth)
  // or >=3 valid items.
  if (validRate >= 0.67 && hardCorrect >= 1 && (validRate === 1 || nValid >= MIN_VALID_FOR_STRONG)) {
    return "strong";
  }
  return "medium";
}

export function statusReasons(
  status: TopicStatus,
  ea: { n_valid: number; n_correct: number; n_partial: number; n_wrong: number; n_skip: number; n_dontKnow: number; n_hardCorrect: number; n_needsReview: number; n_invalid: number; n_repeat: number; validRate: number | null; learningChunks: number; bankQuestions: number; syllabus: boolean }
): string[] {
  const r: string[] = [];
  const pct = ea.validRate === null ? null : Math.round(ea.validRate * 100);
  const n = ea.n_valid + (ea.n_partial > 0 ? ea.n_partial : 0);
  const totalValid = ea.n_valid; // valid includes partial in our counting below? no: valid = correct+incorrect+partial
  const nValid = totalValid;

  if (status === "needs_review") {
    if (ea.n_needsReview > 0)
      r.push(`${ea.n_needsReview} answer evaluation(s) marked "needs review" and excluded from the confident diagnosis until resolved.`);
    if (ea.n_invalid > 0)
      r.push(`${ea.n_invalid} invalid item(s) excluded (faulty question or source removed).`);
    r.push("The evidence is compromised — the final status will be shown once these are resolved.");
    return r;
  }

  if (status === "not_enough_evidence") {
    if (!ea.syllabus) r.push("This topic is not on the syllabus (custom topic).");
    if (ea.learningChunks === 0 && ea.bankQuestions === 0) {
      r.push("Syllabus-only topic: no learning material and no assessment items exist yet.");
    } else if (nValid === 0 && (ea.n_skip > 0 || ea.n_dontKnow > 0)) {
      r.push(`Attempted but no valid evidence: ${ea.n_skip} skipped, ${ea.n_dontKnow} "don't know" — recorded as no-signal, not as wrong.`);
    } else if (nValid === 1) {
      r.push(`Only ${nValid} valid item answered — a single question cannot prove mastery or weakness (plan §12).`);
      if (ea.n_skip > 0 || ea.n_dontKnow > 0)
        r.push(`${ea.n_skip} skipped / ${ea.n_dontKnow} don't-know responses were not counted.`);
    } else {
      r.push(`Only ${nValid} valid item(s) — below the minimum of ${MIN_VALID_FOR_STATUS}.`);
    }
    return r;
  }

  // Weak / Medium / Strong
  if (status === "weak") {
    r.push(`Mostly incorrect: ${pct}% credit across ${nValid} valid item(s) (${ea.n_correct} correct, ${ea.n_wrong} wrong).`);
    if (ea.learningChunks === 0) r.push("No learning material covers this topic — the first revision step is adding material.");
    if (ea.n_skip + ea.n_dontKnow > 0)
      r.push(`${ea.n_skip + ea.n_dontKnow} skipped/"don't know" responses are NOT counted against you.`);
  } else if (status === "strong") {
    const depth = nValid < MIN_VALID_FOR_STRONG
      ? "confirmed by a short-answer/hard item that cannot be guessed"
      : "including a short-answer or hard item";
    r.push(`${pct}% credit across ${nValid} valid item(s), ${depth}.`);
    if (ea.validRate === 1 && nValid < MIN_VALID_FOR_STRONG)
      r.push("Still provisional: only 2 items so far — a reassessment after revision would strengthen this.");
  } else {
    // medium
    if (ea.validRate !== null && ea.validRate < 0.67) {
      r.push(`Mixed evidence: ${pct}% credit across ${nValid} valid item(s) — some understanding, some gaps.`);
      if (ea.n_partial > 0) r.push(`${ea.n_partial} short answer(s) earned partial credit — look at missing rubric points in the evidence trail.`);
    } else {
      r.push(`${pct}% credit across ${nValid} valid item(s), but fewer than ${MIN_VALID_FOR_STRONG} items or no short/hard item correct yet — guessing or surface recall cannot be ruled out.`);
    }
    if (ea.n_skip + ea.n_dontKnow > 0)
      r.push(`${ea.n_skip + ea.n_dontKnow} skipped/"don't know" responses were recorded as no-signal.`);
  }

  if (ea.n_repeat > 0)
    r.push(`Includes ${ea.n_repeat} reused item(s) from an earlier attempt — repeat answers are weaker evidence of progress.`);
  return r;
}

/**
 * Aggregate non-in_progress attempts into per-topic evidence and apply the
 * policy. Pure function of persisted data.
 */
export function computeTopicAssessment(
  topicId: string,
  attempts: Attempt[],
  allQuestions: Question[],
  topic: TopicState | undefined,
  chunkCountForTopic: number,
  learningChunkCount: number,
  bankQuestionCount: number
): TopicAssessment {
  const qById = new Map(allQuestions.map((q) => [q.id, q]));
  const evidenceIds: string[] = [];

  let valid = 0, correct = 0, partial = 0, wrong = 0;
  let skip = 0, dontKnow = 0, hardCorrect = 0, needsReview = 0, invalid = 0, repeat = 0;
  let unresolved = 0;

  for (const attempt of attempts) {
    if (attempt.status !== "submitted") continue;
    for (const [qid, ev] of Object.entries(attempt.evaluations)) {
      const question = qById.get(qid);
      if (!question || question.topicId !== topicId) continue;
      evidenceIds.push(qid);
      if (ev.kind === "skipped") { skip += 1; continue; }
      if (ev.kind === "dont_know") { dontKnow += 1; continue; }
      if (isUnresolvedKind(ev.kind)) {
        if (ev.kind === "needs_review") needsReview += 1;
        else invalid += 1;
        // Could this item, if resolved, change the label? (needs_review only)
        if (ev.kind === "needs_review") unresolved += 1;
        continue;
      }
      valid += 1;
      if (!ev.independent) repeat += 1;
      if (ev.kind === "correct") {
        correct += 1;
        if ((question.difficulty === "hard" || question.type === "short") && ev.independent) {
          hardCorrect += 1;
        }
      } else if (ev.kind === "partial") {
        partial += 1;
      } else {
        wrong += 1;
      }
    }
  }

  const validRate = valid > 0 ? (correct + partial * 0.5) / valid : null;
  const nValid = valid;
  const coverage = {
    syllabus: !!topic,
    materialChunks: chunkCountForTopic,
    learningChunks: learningChunkCount,
    bankQuestions: bankQuestionCount,
    activeQuestions: bankQuestionCount,
  };

  let status: TopicStatus;
  // If there are enough valid items, use the band status and supersede any
  // needs_review items (later valid evidence takes priority).
  if (nValid >= MIN_VALID_FOR_STATUS) {
    const vRate = validRate ?? ((correct + partial * 0.5) / (valid || 1));
    status = bandStatus(vRate, nValid, hardCorrect);
    // If there were needs_review items but we have enough valid evidence,
    // add a note about supersession
    if (needsReview > 0) {
      // The reason will be added in statusReasons below
    }
  } else if (nValid + needsReview >= MIN_VALID_FOR_STATUS && topic !== undefined) {
    // Not enough valid items on their own, but combining valid + needs_review
    // might meet the threshold. However, we should be conservative: only use
    // needs_review status if there are no strong valid indicators.
    status = "needs_review";
  } else if (unresolved > 0 && nValid + unresolved >= MIN_VALID_FOR_STATUS && topic !== undefined) {
    status = "needs_review";
  } else if (nValid < MIN_VALID_FOR_STATUS) {
    // Re-opening potential: a pending review could push us over the minimum.
    status = "not_enough_evidence";
  } else {
    status = bandStatus(validRate!, nValid, hardCorrect);
  }

  // NOTE: needs_review is used when ANY unresolved item exists for a topic with
  // enough valid items/votes to band — because a single flip can move the band
  // (e.g. 2 valid, 1 wrong, 1 pending: rate could go .5 → .67 → strong band).
  // Students can resolve it by reporting the item or re-assessing the topic.

  const reasons = statusReasons(status, {
    n_valid: nValid,
    n_correct: correct,
    n_partial: partial,
    n_wrong: wrong,
    n_skip: skip,
    n_dontKnow: dontKnow,
    n_hardCorrect: hardCorrect,
    n_needsReview: needsReview,
    n_invalid: invalid,
    n_repeat: repeat,
    validRate,
    learningChunks: learningChunkCount,
    bankQuestions: bankQuestionCount,
    syllabus: !!topic,
  });

  return {
    topicId,
    status,
    reasons,
    n_valid: nValid,
    n_correct: correct,
    n_partial: partial,
    n_wrong: wrong,
    n_skip: skip,
    n_dontKnow: dontKnow,
    n_hardCorrect: hardCorrect,
    n_needsReview: needsReview,
    n_repeat: repeat,
    validRate,
    coverage,
    evidenceIds: Array.from(new Set(evidenceIds)),
  };
}

export const STATUS_LABELS: Record<TopicStatus, string> = {
  strong: "Strong",
  medium: "Medium / Developing",
  weak: "Weak",
  not_enough_evidence: "Not enough evidence",
  needs_review: "Needs review",
};
