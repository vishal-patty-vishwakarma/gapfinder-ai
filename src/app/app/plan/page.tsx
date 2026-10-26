"use client";

import { useEffect, useState } from "react";
import { api, json } from "@/components/api";
import { Card, Button, Loading, StatusPill } from "@/components/ui";

interface PlanItemData {
  id: string;
  topicId: string;
  topicTitle: string;
  order: number;
  minutes: number;
  kind: string;
  title: string;
  why: string;
  citations: { documentTitle: string; locator: string; quote: string }[];
  done: boolean;
}
interface PlanData {
  plan: {
    id: string;
    version: number;
    createdAt: string;
    budgetMinutes: number;
    examDate: string | null;
    basedOnReportId: string;
    items: PlanItemData[];
    status: string;
    note: string | null;
    whatChanged: { added: { title: string }[]; removed: { title: string }[]; retimed: { title: string; from: number; to: number }[]; reason: string } | null;
  } | null;
  basis: string;
  note: string;
  historyCount: number;
}

const KIND_LABELS: Record<string, string> = {
  add_material: "material needed",
  assess_now: "assessment",
  core_concept: "concept rebuild",
  practice: "practice",
  self_explain: "self-explain",
};

export default function PlanPage() {
  const [data, setData] = useState<PlanData | null>(null);
  const [minutes, setMinutes] = useState("120");
  const [examDate, setExamDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const p = await api<PlanData>("/api/plan");
      setData(p);
      if (p.plan) {
        setMinutes(String(p.plan.budgetMinutes));
        if (p.plan.examDate) setExamDate(p.plan.examDate);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (error && !data) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  if (!data) return <Loading />;

  const plan = data.plan;

  async function replan() {
    setBusy("replan");
    setError(null);
    try {
      await api("/api/plan", json("POST", { availableMinutes: Number(minutes), examDate: examDate || null }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function toggleDone(item: PlanItemData) {
    setBusy(item.id);
    setError(null);
    try {
      await api("/api/plan", json("PATCH", { itemId: item.id, done: !item.done }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Revision plan</h1>
        <p className="text-sm text-slate-500">Priorities and time allocation are deterministic and inspectable — every task explains its why. Completing a task records activity, not mastery.</p>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Minutes available</label>
            <input type="number" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Exam date (optional)</label>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="mt-1 w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <Button onClick={replan} disabled={busy === "replan"}>{busy === "replan" ? "Planning…" : plan?.status === "active" ? "Rebuild / replan" : "Build my plan"}</Button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">{data.basis}</p>
      </Card>

      {!plan && <Card className="p-10 text-center text-sm text-slate-500">No plan yet — set your available time (and date) above and build one from your latest gap report.</Card>}

      {plan && (
        <>
          <Card className="border-slate-300 bg-slate-50 p-4 text-sm">
            <p><span className="font-semibold">Plan v{plan.version}</span> · {plan.items.length} task(s) · {plan.budgetMinutes} min available · {plan.items.reduce((s, i) => s + i.minutes, 0)} min allocated</p>
            {plan.note && <p className="mt-1 text-xs text-slate-500">{plan.note}</p>}
            {plan.whatChanged && (
              <details className="mt-2 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-indigo-600">What changed from the previous plan?</summary>
                <div className="mt-1.5 space-y-1 rounded-lg bg-white p-2.5">
                  <p>{plan.whatChanged.reason}</p>
                  {plan.whatChanged.added.length > 0 && <p><span className="font-semibold text-emerald-700">Added:</span> {plan.whatChanged.added.map((a) => a.title).join(", ")}</p>}
                  {plan.whatChanged.removed.length > 0 && <p><span className="font-semibold text-rose-700">Removed:</span> {plan.whatChanged.removed.map((a) => a.title).join(", ")}</p>}
                  {plan.whatChanged.retimed.length > 0 && <p><span className="font-semibold text-amber-700">Re-timed:</span> {plan.whatChanged.retimed.map((a) => `${a.title} (${a.from}→${a.to} min)`).join(", ")}</p>}
                </div>
              </details>
            )}
          </Card>

          <div className="space-y-2.5">
            {plan.items.map((item, i) => (
              <Card key={item.id} className={`p-4 ${item.done ? "opacity-55" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">#{i + 1}</span>
                      <StatusPill status="medium" label={KIND_LABELS[item.kind] ?? item.kind} />
                      <span className="text-[11px] text-slate-400">{item.minutes} min</span>
                    </div>
                    <p className={`mt-2 text-sm font-medium ${item.done ? "line-through" : ""}`}>{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500"><span className="font-semibold text-slate-600">Why: </span>{item.why}</p>
                    {item.citations.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {item.citations.map((c, ci) => (
                          <p key={ci} className="text-[11px] text-slate-400">📎 {c.documentTitle} · {c.locator}<span className="block pl-4 italic">“{c.quote.slice(0, 140)}{c.quote.length > 140 ? "…" : ""}”</span></p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant={item.done ? "ghost" : "primary"} onClick={() => toggleDone(item)} disabled={busy === item.id}>
                    {busy === item.id ? "…" : item.done ? "Reopen" : "Mark done"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          {plan.items.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">{plan.note ?? "No revision tasks by current policy."}</Card>}
        </>
      )}

      <p className="text-xs text-slate-400">{data.note} · plan history: {data.historyCount} version(s)</p>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
