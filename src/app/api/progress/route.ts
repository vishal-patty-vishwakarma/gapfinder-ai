import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, workspaceFor } from "@/lib/server/store";

/** GET /api/progress — attempt history + per-topic baseline→latest deltas. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const submitted = ws.attempts.filter((a) => a.status === "submitted");

  const perTopic = ws.topics
    .filter((t) => !t.outOfScope)
    .map((topic) => {
      const series = submitted
        .map((attempt, idx) => {
          const evals = Object.values(attempt.evaluations).filter((ev) => {
            const q = ws.questions.find((x) => x.id === ev.questionId);
            return q && q.topicId === topic.id;
          });
          const valid = evals.filter((e) => ["correct", "incorrect", "partial"].includes(e.kind));
          const credit = valid.length
            ? valid.reduce((s, e) => s + (e.score ?? 0), 0) / valid.length
            : null;
          return {
            attemptId: attempt.id,
            order: idx + 1,
            mode: attempt.mode,
            submittedAt: attempt.submittedAt,
            nValid: valid.length,
            validRate: credit,
          };
        })
        .filter((x) => x.nValid > 0);
      const first = series[0] ?? null;
      const latest = series[series.length - 1] ?? null;
      return {
        topicId: topic.id,
        title: topic.title,
        series,
        first,
        latest,
        delta:
          first && latest && first.validRate !== null && latest.validRate !== null
            ? Math.round((latest.validRate - first.validRate) * 100)
            : null,
      };
    });

  return NextResponse.json({
    attempts: submitted.map((a, i) => ({
      id: a.id,
      order: i + 1,
      mode: a.mode,
      info: a.info,
      submittedAt: a.submittedAt,
      nResponses: Object.keys(a.responses).length,
    })),
    topics: perTopic,
    attemptCount: submitted.length,
    caution:
      "Deltas compare different assessment items and versions. Repeats are marked; treat small changes as signals, not scores (§ comparisons are cautious).",
  });
}
