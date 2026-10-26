import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, mutate, workspaceFor } from "@/lib/server/store";
import { gradeAttempt } from "@/lib/grading";
import { buildGapReport, pushReport } from "@/lib/diagnosis";
import { buildPlan } from "@/lib/planner";
import type { Attempt, EvaluationKind, Question, ResponseRecord, Workspace } from "@/lib/types";

/** NEVER leak the answer key before submission (plan §25.4):
 *  quiz-time payload hides answerOptionId / whyWrong / expectedConcepts and
 *  hides citation QUOTES (title + locator only). Submitted payloads reveal. */
function sanitizeQuestion(q: Question, revealed: boolean) {
  return {
    id: q.id,
    topicId: q.topicId,
    type: q.type,
    difficulty: q.difficulty,
    source: q.source,
    stem: q.stem,
    shortAnswerGuide: q.type === "short" ? "Answer in your own words; your notes define the expected ideas." : undefined,
    options: revealed
      ? q.options.map((o) => ({ id: o.id, label: o.label, whyWrong: o.whyWrong }))
      : q.options.map((o) => ({ id: o.id, label: o.label })),
    answerOptionId: revealed ? q.answerOptionId : undefined,
    expectedConcepts: revealed ? q.expectedConcepts.map((c) => ({ id: c.id, label: c.label })) : undefined,
    citations: q.citations.map((c) => ({
      documentTitle: c.documentTitle,
      locator: c.locator,
      quote: revealed ? c.quote : undefined,
    })),
    explanationRight: revealed ? q.explanationRight : undefined,
    explanationRightNotRevealed: !revealed ? q.explanationRight : undefined,
    validationStatus: q.validationStatus,
  };
}

function sanitizeAttempt(ws: Workspace, attempt: Attempt, revealed: boolean) {
  return {
    id: attempt.id,
    mode: attempt.mode,
    status: attempt.status,
    topicIds: attempt.topicIds,
    createdAt: attempt.createdAt,
    submittedAt: attempt.submittedAt,
    info: attempt.info,
    responses: attempt.responses,
    evaluations: revealed
      ? attempt.evaluations
      : undefined,
    questions: attempt.questionIds
      .map((qid) => ws.questions.find((q) => q.id === qid))
      .filter((q): q is Question => !!q)
      .map((q) => sanitizeQuestion(q, revealed)),
    nquestions: attempt.questionIds.length,
  };
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const attempt = ws.attempts.find((a) => a.id === ctx.params.id);
  if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
  return NextResponse.json({ attempt: sanitizeAttempt(ws, attempt, attempt.status === "submitted") });
}

type Body = {
  action?: "respond" | "submit";
  questionId?: string;
  state?: "answered" | "skipped" | "dont_know";
  value?: string | null;
  idempotencyKey?: string;
};

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  return mutate((store) => {
    const ws = workspaceFor(store, user.id);
    const attempt = ws.attempts.find((a) => a.id === ctx.params.id);
    if (!attempt) return NextResponse.json({ error: "Attempt not found." }, { status: 404 });

    if (body.action === "respond") {
      if (attempt.status !== "in_progress") {
        return NextResponse.json({ error: "Attempt already submitted." }, { status: 409 });
      }
      const q = ws.questions.find((x) => x.id === body.questionId);
      if (!q || !attempt.questionIds.includes(body.questionId!)) {
        return NextResponse.json({ error: "Question not part of this attempt." }, { status: 400 });
      }
      const state = body.state;
      if (state !== "answered" && state !== "skipped" && state !== "dont_know") {
        return NextResponse.json({ error: "Invalid response state." }, { status: 400 });
      }
      let value: string | null = null;
      if (state === "answered") {
        value = body.value ?? null;
        if (q.type === "mcq") {
          if (!q.options.some((o) => o.id === value)) {
            return NextResponse.json({ error: "Choose one of the listed options." }, { status: 400 });
          }
        } else {
          const text = (value ?? "").trim();
          if (text.length === 0) {
            return NextResponse.json({ error: "Write an answer, or use skip / don't know." }, { status: 400 });
          }
          if (text.length > 2000) {
            return NextResponse.json({ error: "Answer too long (max 2000 characters)." }, { status: 400 });
          }
          value = text;
        }
      }
      const record: ResponseRecord = { questionId: q.id, state, value, submitted: false };
      attempt.responses[q.id] = record; // overwrite-safe; duplicates converge
      return NextResponse.json({ ok: true, saved: attempt.responses[q.id] });
    }

    if (body.action === "submit") {
      if (attempt.status !== "in_progress") {
        // Idempotent double-submit: return the SAME persisted results.
        return NextResponse.json({ attempt: sanitizeAttempt(ws, attempt, true), idempotent: true });
      }
      if (Object.keys(attempt.responses).length === 0) {
        return NextResponse.json({ error: "Answer at least one question before submitting." }, { status: 400 });
      }
      // prior independent-evidence tracking
      const priorIds = new Set<string>();
      for (const a of ws.attempts.filter((a2) => a2.id !== attempt.id && a2.status === "submitted")) {
        for (const qid of a.questionIds) priorIds.add(qid);
      }
      const withSubmitted: Record<string, ResponseRecord> = {};
      for (const [qid, r] of Object.entries(attempt.responses)) withSubmitted[qid] = { ...r, submitted: true };
      attempt.responses = withSubmitted;
      attempt.evaluations = gradeAttempt(withSubmitted, ws.questions, priorIds);
      attempt.status = "submitted";
      attempt.submittedAt = new Date().toISOString();

      // Auto-update the gap report (§25.6: new report → new plan version)
      const now = new Date().toISOString();
      const report = buildGapReport(ws, now);
      pushReport(ws, report);
      const previousPlan = ws.plans.find((p) => p.status === "active") ?? null;
      const plan = buildPlan({
        ws,
        report,
        availableMinutes: previousPlan?.budgetMinutes ?? 60,
        examDate: ws.examDate,
        nowIso: now,
        previousPlan,
      });
      if (previousPlan) previousPlan.status = "superseded";
      ws.plans.push(plan);

      ws.events.push({
        at: now,
        type: "assessment_submitted",
        detail: `${attempt.mode} submitted (${Object.keys(attempt.evaluations).length} responses). Report ${report.id} regenerated; plan auto-updated to v${plan.version}.`,
      });

      return NextResponse.json({ attempt: sanitizeAttempt(ws, attempt, true), reportId: report.id, planVersion: plan.version });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  });
}
