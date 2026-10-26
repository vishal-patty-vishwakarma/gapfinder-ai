import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, workspaceFor } from "@/lib/server/store";
import { latestReport } from "@/lib/diagnosis";
import { STATUS_LABELS } from "@/lib/policy";

/** GET /api/report — latest gap report with the full evidence trail. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const report = latestReport(ws);
  if (!report) {
    return NextResponse.json({ report: null, message: "No assessment attempts yet." });
  }

  const topics = Object.values(report.topics).map((ta) => {
    const topic = ws.topics.find((t) => t.id === ta.topicId);
    const evidence = ta.evidenceIds.map((qid) => {
      const q = ws.questions.find((x) => x.id === qid);
      const attempt = ws.attempts.find(
        (a) => a.status === "submitted" && a.evaluations?.[qid] !== undefined && a.questionIds.includes(qid)
      );
      const ev = attempt?.evaluations[qid];
      const resp = attempt?.responses[qid];
      return {
        questionId: qid,
        stem: q?.stem ?? "(question record removed)",
        answerGiven: resp?.state === "answered" ? resp.value : resp?.state ?? "unanswered",
        kind: ev?.kind,
        score: ev?.score,
        rationale: ev?.rationale,
        rubricHits: (ev?.rubricHits ?? []).map((cid) => q?.expectedConcepts.find((c) => c.id === cid)?.label ?? cid),
        rubricMisses: (ev?.rubricMisses ?? []).map((cid) => q?.expectedConcepts.find((c) => c.id === cid)?.label ?? cid),
        citations: q?.citations ?? [],
      };
    });
    return {
      topicId: ta.topicId,
      title: topic?.title ?? ta.topicId,
      syllabusRef: topic?.syllabusRef ?? "",
      status: ta.status,
      statusLabel: STATUS_LABELS[ta.status],
      reasons: ta.reasons,
      counts: {
        valid: ta.n_valid,
        correct: ta.n_correct,
        partial: ta.n_partial,
        wrong: ta.n_wrong,
        skip: ta.n_skip,
        dontKnow: ta.n_dontKnow,
        needsReview: ta.n_needsReview,
        repeat: ta.n_repeat,
      },
      validRate: ta.validRate,
      coverage: {
        ...ta.coverage,
        basis: topic?.ppWeight !== null && topic?.ppWeight !== undefined ? `past-paper mentions: ${topic.ppWeight}` : "no past-paper signal",
        importanceOverride: topic?.importanceOverride ?? null,
      },
      evidence,
    };
  });

  const order = { weak: 0, needs_review: 1, not_enough_evidence: 2, medium: 3, strong: 4 } as Record<string, number>;
  topics.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5) || a.title.localeCompare(b.title));

  return NextResponse.json({
    report: {
      id: report.id,
      createdAt: report.createdAt,
      policyVersion: report.policyVersion,
      basedOnAttempts: report.attemptIds.length,
    },
    topics: topics.filter((t) => ws.topics.find((wst) => wst.id === t.topicId && !wst.outOfScope)),
    outOfScope: ws.topics.filter((t) => t.outOfScope).map((t) => ({ id: t.id, title: t.title })),
    importanceBasis: ws.pastPaperImportanceBasis,
  });
}
