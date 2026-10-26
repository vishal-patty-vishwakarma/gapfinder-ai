import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, mutate, workspaceFor } from "@/lib/server/store";
import { autogenQuestionsForTopic } from "@/lib/autogen";
import type { Attempt, AttemptMode, Question, Workspace } from "@/lib/types";

type Body = { mode?: AttemptMode; topicIds?: string[] };

function pickBankUnused(ws: Workspace, topicId: string, used: Set<string>, prefer: "easy" | "hard" | "short"): Question | null {
  const pool = ws.questions.filter((q) => q.topicId === topicId && q.validationStatus === "validated");
  const matches = pool.filter((q) =>
    prefer === "short" ? q.type === "short" : q.type === "mcq" && (prefer === "hard" ? q.difficulty === "hard" : q.difficulty !== "hard")
  );
  const fresh = matches.filter((q) => !used.has(q.id));
  if (fresh.length > 0) return fresh[0];
  if (matches.length > 0) return matches[0]; // reuse acceptable; flagged at submit
  return null;
}

/** POST /api/quiz — assemble a new attempt (§25.2: evidence-depth aware). */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const mode = body.mode ?? "diagnostic";
  if (!["diagnostic", "deep_dive", "reassess"].includes(mode)) {
    return NextResponse.json({ error: "Unknown assessment mode." }, { status: 400 });
  }

  return mutate((store) => {
    const ws = workspaceFor(store, user.id);
    const inProgress = ws.attempts.find((a) => a.status === "in_progress");
    if (inProgress) {
      return NextResponse.json(
        { error: "You already have an assessment in progress — finish or resume it first.", attemptId: inProgress.id },
        { status: 409 }
      );
    }

    const eligible = ws.topics.filter((t) => !t.outOfScope);
    const requested = (body.topicIds ?? []).filter((id) => eligible.some((t) => t.id === id));
    const targets = mode === "diagnostic" ? eligible : eligible.filter((t) => requested.includes(t.id));
    if (mode !== "diagnostic" && targets.length === 0) {
      return NextResponse.json({ error: "No in-scope topics selected." }, { status: 400 });
    }

    const used = new Set<string>();
    for (const a of ws.attempts.filter((x) => x.status === "submitted")) {
      for (const qid of a.questionIds) used.add(qid);
    }

    let picks: Question[] = [];
    const notes: string[] = [];
    for (const topic of targets) {
      if (mode === "diagnostic") {
        // 1. Try bank questions first (seeded, citation-verified).
        let mcq: Question | null | undefined = pickBankUnused(ws, topic.id, used, "easy") ?? pickBankUnused(ws, topic.id, used, "hard");
        let short: Question | null | undefined = pickBankUnused(ws, topic.id, used, "short");
        // 2. If nothing from the bank, fall back to autogen from uploaded chunks.
        if (!mcq || !short) {
          const autogen = autogenQuestionsForTopic(topic, ws.chunks, ws.documents, mcq || short ? 1 : 2);
          const freshM = autogen.find((q) => !used.has(q.id) && q.type === "mcq");
          const freshS = autogen.find((q) => !used.has(q.id) && q.type === "short");
          if (!mcq && freshM) { picks.push(freshM); notes.push(`${topic.title}: auto-generated MCQ from your material (autogen-v1).`); }
          if (!short && freshS) { picks.push(freshS); notes.push(`${topic.title}: auto-generated short answer from your material (autogen-v1).`); }
          if (!mcq) mcq = freshM ?? undefined;
          if (!short) short = freshS ?? undefined;
        }
        if (mcq) picks.push(mcq);
        if (short) picks.push(short);
        if (!mcq && !short) notes.push(`${topic.title}: no assessment item available (add material or upload a chapter).`);
      } else {
        // deep_dive / reassess prefer AUTOGEN (fresh, grounded) items, then unused bank items.
        let fresh = autogenQuestionsForTopic(topic, ws.chunks, ws.documents, 1).find((q) => !used.has(q.id)) ?? null;
        if (fresh) {
          notes.push(`${topic.title}: fresh item generated from your material (autogen-v1).`);
        } else {
          fresh = pickBankUnused(ws, topic.id, used, "hard") ?? pickBankUnused(ws, topic.id, used, "easy") ?? pickBankUnused(ws, topic.id, used, "short");
          if (fresh) notes.push(`${topic.title}: reused a bank item (repeat answers are weaker evidence).`);
        }
        if (fresh) picks.push(fresh);
        else notes.push(`${topic.title}: nothing new to ask — reuse would only repeat evidence. Add material first.`);
      }
    }

    if (picks.length === 0) {
      return NextResponse.json({ error: "No assessment items could be assembled: " + notes.join(" | ") }, { status: 400 });
    }

    // persist any newly generated questions before snapshotting the attempt
    for (const q of picks) {
      if (!ws.questions.some((x) => x.id === q.id)) ws.questions.push(q);
    }

    const attempt: Attempt = {
      id: "attempt_" + Math.random().toString(36).slice(2, 10),
      mode,
      status: "in_progress",
      topicIds: Array.from(new Set(picks.map((q) => q.topicId))),
      questionIds: picks.map((q) => q.id),
      createdAt: new Date().toISOString(),
      submittedAt: null,
      responses: {},
      evaluations: {},
      info:
        (mode === "diagnostic"
          ? "Diagnostic assessment of the topics you selected."
          : mode === "deep_dive"
            ? "Targeted assessment to collect more valid evidence on the selected topics."
            : "Fresh reassessment after revision. Freshly grounded items take priority; reused items are weaker evidence.") +
        (notes.length ? " " + notes.join(" ") : ""),
    };
    ws.attempts.push(attempt);
    return NextResponse.json({ attemptId: attempt.id, count: picks.length, info: attempt.info });
  });
}
