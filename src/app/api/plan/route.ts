import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, mutate, workspaceFor } from "@/lib/server/store";
import { latestReport } from "@/lib/diagnosis";
import { buildPlan } from "@/lib/planner";

function activePlan(ws: ReturnType<typeof workspaceFor>) {
  return ws.plans.find((p) => p.status === "active") ?? null;
}

/** GET /api/plan — the active plan (+ history count). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const plan = activePlan(ws);
  return NextResponse.json({
    plan,
    basis: ws.pastPaperImportanceBasis,
    historyCount: ws.plans.length,
    note: "Task completion records ACTIVITY, not mastery — only assessment evidence changes a topic's status (§13).",
  });
}

/** POST /api/plan — (re)build the plan from the latest report. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { availableMinutes?: number; examDate?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const available = Number(body.availableMinutes ?? 60);
  if (!Number.isFinite(available) || available < 0 || available > 10_000) {
    return NextResponse.json({ error: "Available minutes must be between 0 and 10000." }, { status: 400 });
  }
  const examDate = body.examDate ? String(body.examDate).slice(0, 10) : null;

  return mutate((store) => {
    const ws = workspaceFor(store, user.id);
    ws.examDate = examDate;
    const report = latestReport(ws);
    if (!report) {
      return NextResponse.json({ error: "Take an assessment first — plans are built from the gap report." }, { status: 400 });
    }
    const previousPlan = activePlan(ws);
    const plan = buildPlan({ ws, report, availableMinutes: Math.round(available), examDate, nowIso: new Date().toISOString(), previousPlan });
    if (previousPlan) previousPlan.status = "superseded";
    ws.plans.push(plan);
    ws.events.push({
      at: plan.createdAt,
      type: "plan_updated",
      detail: `Plan v${plan.version} built for ${available} available minutes from report ${report.id}.`,
    });
    return NextResponse.json({ plan });
  });
}

/** PATCH /api/plan — mark a task done (activity event only, §13). */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { itemId?: string; done?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  return mutate((store) => {
    const ws = workspaceFor(store, user.id);
    const plan = activePlan(ws);
    if (!plan) return NextResponse.json({ error: "No active plan." }, { status: 404 });
    const item = plan.items.find((i) => i.id === body.itemId);
    if (!item) return NextResponse.json({ error: "Plan item not found." }, { status: 404 });
    item.done = !!body.done;
    item.doneAt = item.done ? new Date().toISOString() : null;
    ws.events.push({
      at: new Date().toISOString(),
      type: item.done ? "task_done" : "task_undone",
      detail: `${item.done ? "Done" : "Reopened"}: ${item.title}. (Activity only — the topic status changes only via assessment evidence.)`,
    });
    return NextResponse.json({ plan });
  });
}
