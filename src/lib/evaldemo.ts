// Acceptance-check suite (plan §18) — pure functions over a workspace so the
// endpoint and the CLI script share one source of truth.
//
// NOTE: isolation + idempotency are runtime checks run by scripts/eval-demo.mjs
// against a live server (they require two sessions and double submits).
import type { Attempt, EvaluationKind, EvaluationRecord, Question, ResponseRecord, TopicState, Workspace } from "@/lib/types";
import { computeTopicAssessment, bandStatus } from "@/lib/policy";
import { buildPlan, effectiveImportance } from "@/lib/planner";

export interface CheckResult {
  area: string;
  name: string;
  pass: boolean;
  detail: string;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function syntheticAttempt(id: string, topicId: string, mcq: Question, short: Question, mcqPick: "correct" | "wrong", shortKind: "correct" | "wrong" | "skip" | "dont_know"): Attempt {
  const responses: Record<string, ResponseRecord> = {};
  const qBank: Question[] = [mcq, short];
  responses[mcq.id] = {
    questionId: mcq.id,
    state: "answered",
    value: mcqPick === "correct" ? mcq.answerOptionId : (mcq.options.find((o) => o.id !== mcq.answerOptionId)?.id ?? null),
    submitted: true,
  };
  const shortText =
    shortKind === "correct"
      ? short.expectedConcepts.map((c) => c.aliases[0]).join(", ")
      : shortKind === "wrong"
        ? "Nope, other thing."
        : "";
  responses[short.id] = {
    questionId: short.id,
    state: shortKind === "correct" || shortKind === "wrong" ? "answered" : shortKind === "skip" ? "skipped" : "dont_know",
    value: shortKind === "skip" || shortKind === "dont_know" ? null : shortText,
    submitted: true,
  };
  const evals: Record<string, EvaluationRecord> = {};
  for (const q of qBank) {
    const r = responses[q.id];
    if (q.type === "mcq") {
      const correct = r.value === q.answerOptionId;
      evals[q.id] = { questionId: q.id, kind: correct ? "correct" : "incorrect", score: correct ? 1 : 0, rationale: "", rubricHits: [], rubricMisses: [], independent: true };
    } else if (r.state === "skipped") {
      evals[q.id] = { questionId: q.id, kind: "skipped", score: null, rationale: "", rubricHits: [], rubricMisses: [], independent: true };
    } else if (r.state === "dont_know") {
      evals[q.id] = { questionId: q.id, kind: "dont_know", score: null, rationale: "", rubricHits: [], rubricMisses: [], independent: true };
    } else {
      const hits = q.expectedConcepts.filter((c) => shortText.toLowerCase().includes(c.aliases[0].toLowerCase()) || c.aliases.some((a) => shortText.toLowerCase().includes(a.toLowerCase()))).length;
      const score = q.expectedConcepts.length ? hits / q.expectedConcepts.length : 0;
      const kind: EvaluationKind = score === 1 ? "correct" : score === 0 ? "incorrect" : "partial";
      evals[q.id] = { questionId: q.id, kind, score, rationale: "", rubricHits: [], rubricMisses: [], independent: true };
    }
  }
  return {
    id,
    mode: "diagnostic",
    status: "submitted",
    topicIds: [topicId],
    questionIds: qBank.map((q) => q.id),
    createdAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
    responses,
    evaluations: evals,
    info: "synthetic",
  };
}

export function runAcceptanceChecks(ws: Workspace): { results: CheckResult[]; summary: { pass: number; fail: number } } {
  const results: CheckResult[] = [];
  const add = (area: string, name: string, pass: boolean, detail: string) => results.push({ area, name, pass, detail });

  // 1 — Ingestion / coverage
  const materialTopics = ["t_kin", "t_graph", "t_newton", "t_forces", "t_energy", "t_conserve"];
  const missingCoverage = materialTopics.filter(
    (tid) => ws.chunks.filter((c) => c.active && c.topicId === tid).length === 0
  );
  add(
    "Ingestion",
    "Every material-backed topic has mapped chunks",
    missingCoverage.length === 0,
    missingCoverage.length === 0 ? "6/6 topics have active mapped chunks." : `Missing: ${missingCoverage.join(", ")}`
  );

  // 2 — RAG grounding: citations resolve to real chunks + anchor present
  let grounded = 0;
  let groundedTotal = 0;
  const groundingIssues: string[] = [];
  for (const q of ws.questions.filter((x) => x.source === "bank")) {
    groundedTotal += 1;
    const ok = q.citations.length > 0 && q.citations.every((c) => {
      const ch = ws.chunks.find((x) => x.id === c.chunkId);
      return ch && ch.active && ch.text.includes(c.quote);
    });
    if (ok) grounded += 1;
    else groundingIssues.push(`${q.id}: ${q.validationIssues.join("; ") || "citation unresolved"}`);
  }
  add(
    "RAG grounding",
    "Bank question citations resolve to stored chunks with anchors verified",
    grounded === groundedTotal && groundedTotal > 0,
    `${grounded}/${groundedTotal} grounded. ${groundingIssues.slice(0, 3).join(" | ")}`
  );

  // 3 — MCQ sanity
  let mcqIssues: string[] = [];
  for (const q of ws.questions.filter((x) => x.type === "mcq")) {
    if (q.options.length < 2) mcqIssues.push(`${q.id}: few options`);
    const labels = new Set(q.options.map((o) => o.label));
    if (labels.size !== q.options.length) mcqIssues.push(`${q.id}: duplicate option labels`);
    if (!q.answerOptionId || !q.options.some((o) => o.id === q.answerOptionId)) mcqIssues.push(`${q.id}: answer not among options`);
  }
  add(
    "Question validity",
    "MCQ options are unique and the key exists",
    mcqIssues.length === 0,
    mcqIssues.length ? mcqIssues.slice(0, 3).join(" | ") : "All MCQs passed schema checks."
  );

  // 4 — Rubric richness for short answers
  const shorts = ws.questions.filter((x) => x.type === "short");
  const poorRubrics = shorts.filter((q) => q.expectedConcepts.length < 2 || q.expectedConcepts.some((c) => c.aliases.length < 2));
  add(
    "Question validity",
    "Short answers carry explainable rubrics (>=2 concepts with aliases)",
    shorts.length > 0 && poorRubrics.length === 0,
    poorRubrics.length ? poorRubrics.map((q) => q.id).join(", ") : `${shorts.length} short answers checked.`
  );

  // 5 — Diagnosis policy on synthetic profiles
  const byTopic = new Map<string, Question[]>();
  for (const q of ws.questions.filter((x) => x.source === "bank" && x.validationStatus === "validated")) {
    const list = byTopic.get(q.topicId) ?? [];
    list.push(q);
    byTopic.set(q.topicId, list);
  }
  const materialTopicIds = [...byTopic.keys()];
  if (materialTopicIds.length > 0) {
    const profiles: { name: string; pick: "correct" | "wrong"; shortKind: "correct" | "wrong" | "skip" | "dont_know"; expect: string }[] = [
      { name: "consistent_student", pick: "correct", shortKind: "correct", expect: "strong" },
      { name: "guessing_student (MCQ-only)", pick: "correct", shortKind: "skip", expect: "not_enough_evidence" },
      { name: "weak_student", pick: "wrong", shortKind: "wrong", expect: "weak" },
      { name: "skipper", pick: "wrong", shortKind: "skip", expect: "not_enough_evidence" },
      { name: "mixed_student", pick: "correct", shortKind: "wrong", expect: "medium" },
    ];
    for (const profile of profiles) {
      const attempts: Attempt[] = [];
      for (const tid of materialTopicIds) {
        const pool = byTopic.get(tid) ?? [];
        const mcq = pool.find((q) => q.type === "mcq" && q.difficulty !== "hard") ?? pool.find((q) => q.type === "mcq");
        const short = pool.find((q) => q.type === "short");
        if (!mcq || !short) continue;
        attempts.push(syntheticAttempt(`syn_${profile.name}_${tid}`, tid, mcq, short, profile.pick, profile.shortKind));
      }
      const bad: string[] = [];
      for (const tid of materialTopicIds) {
        const ta = computeTopicAssessment(tid, attempts, ws.questions, ws.topics.find((t) => t.id === tid), 1, 1, 3);
        if (ta.status !== profile.expect) bad.push(`${tid}: got ${ta.status}, expected ${profile.expect}`);
      }
      add("Diagnosis", `Policy handles profile “${profile.name}”`, bad.length === 0, bad.length ? bad.join(" | ") : `All ${materialTopicIds.length} topics labelled ${profile.expect}.`);
    }
  }

  // 6 — Planner respects the time budget & material-needed rule
  const report = ws.reports.filter((r) => !r.superseded).slice(-1)[0] ?? null;
  if (report) {
    const plan = buildPlan({ ws: clone(ws), report: clone(report), availableMinutes: 60, examDate: null, nowIso: new Date().toISOString(), previousPlan: null });
    const total = plan.items.reduce((s, i) => s + i.minutes, 0);
    const ucmItem = plan.items.find((i) => i.topicId === "t_ucm");
    add(
      "Planner",
      "Plan fits a 60-minute budget",
      total <= 60,
      total <= 60 ? `${total} allocated minutes.` : `${total} exceeds the 60-minute budget.`
    );
    add(
      "Planner",
      "No-source topic produces an add-material task",
      !!ucmItem && ucmItem.kind === "add_material",
      ucmItem ? `“${ucmItem.title}” (${ucmItem.minutes} min).` : "No add-material item for the topic without material."
    );
    const ucmImportance = ws.topics.find((t) => t.id === "t_ucm") ? effectiveImportance(ws.topics.find((t) => t.id === "t_ucm")!) : null;
    add(
      "Planner",
      "Importance basis is labelled (fallback or past-paper)",
      !!ucmImportance,
      ucmImportance ? ucmImportance.basis : "topic missing"
    );
  }

  return {
    results,
    summary: { pass: results.filter((r) => r.pass).length, fail: results.filter((r) => !r.pass).length },
  };
}
