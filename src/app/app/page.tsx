"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, json } from "@/components/api";
import { Card, StatusPill, Button, Loading, ProgressBar } from "@/components/ui";

interface StatusCount { status: string; n: number }
  interface ReportLite {
    topics: {
      topicId: string;
      title: string;
      status: string;
      counts?: { valid: number; correct: number; partial: number; wrong: number; skip: number; dontKnow: number; needsReview: number };
    }[];
  }
interface Me { user: { name: string; email: string; kind: string }; course: { title: string; attempts: number; submitted: number; inProgressAttemptId: string | null; topics: number; documents: number } }
interface PlanLite { plan: { version: number; budgetMinutes: number; items: { id: string; done: boolean; minutes: number }[] } | null }

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [report, setReport] = useState<ReportLite | null>(null);
  const [plan, setPlan] = useState<PlanLite | null>(null);
  const [evalResults, setEvalResults] = useState<{ results: { area: string; name: string; pass: boolean; detail: string }[]; summary: { pass: number; fail: number } } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEvals, setShowEvals] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, r, p] = await Promise.all([
          api<Me>("/api/me"),
          api<ReportLite & { report: null | unknown }>("/api/report").catch(() => ({ topics: [] })),
          api<PlanLite>("/api/plan").catch(() => ({ plan: null })),
        ]);
        setMe(m);
        setReport(r);
        setPlan(p);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  if (error) return <Loading />;
  if (!me) return <Loading />;

  const statusCounts: StatusCount[] = Object.entries(
    report?.topics.reduce((acc, t) => ((acc[t.status] = (acc[t.status] ?? 0) + 1), acc), {} as Record<string, number>) ?? {}
  ).map(([status, n]) => ({ status, n }));

  const targets = report?.topics.filter((t) => t.status === "weak" || t.status === "not_enough_evidence" || t.status === "needs_review").map((t) => t.topicId) ?? [];

  // Honest count: topics that actually have assessment responses behind them
  // (any response state, including skips/"don't know"). Topics with zero
  // responses are NOT "attempted" — they show "Not enough evidence".
  const assessedCount =
    report?.topics.filter(
      (t) =>
        (t.counts?.valid ?? 0) +
          (t.counts?.skip ?? 0) +
          (t.counts?.dontKnow ?? 0) +
          (t.counts?.needsReview ?? 0) >
        0
    ).length ?? 0;
  const doneCount = plan?.plan?.items.filter((i) => i.done).length ?? 0;
  const totalItems = plan?.plan?.items.length ?? 0;

  async function startDiagnostic() {
    setBusy("diag");
    try {
      const r = await api<{ attemptId: string }>("/api/quiz", json("POST", { mode: "diagnostic" }));
      router.push(`/app/quiz/${r.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  async function deepDiveTargets() {
    setBusy("deep");
    try {
      const r = await api<{ attemptId: string }>("/api/quiz", json("POST", { mode: "deep_dive", topicIds: targets }));
      router.push(`/app/quiz/${r.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  async function runChecks() {
    setShowEvals(true);
    setBusy("eval");
    try {
      setEvalResults(await api("/api/eval"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const nextAction = () => {
    if (me.course.inProgressAttemptId) return { label: "Resume your assessment in progress", href: `/app/quiz/${me.course.inProgressAttemptId}`, btn: "Resume" };
    if (!report || report.topics.length === 0) return { label: "Take the diagnostic assessment to build your gap report", href: undefined as unknown as string, btn: "Start diagnostic" };
    if (totalItems === 0) return { label: "Build a revision plan from your gap report", href: "/app/plan", btn: "Open planner" };
    if (doneCount < totalItems) return { label: "Continue your revision plan", href: "/app/plan", btn: "Open plan" };
    if (targets.length > 0) return { label: "Collect missing evidence on flagged topics (targeted assessment)", href: undefined as unknown as string, btn: "Assess now" };
    return { label: "Strong across the board — reassess after revision to keep evidence fresh", href: undefined as unknown as string, btn: "Reassess" };
  };

  const action = nextAction();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500">{me.course.title || "No course set up yet — upload a syllabus on Materials."}</p>
        </div>
        <Link href="/app/materials" className="text-xs font-medium text-indigo-600 hover:underline">Materials →</Link>
      </div>

      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Next recommended action</p>
        <p className="mt-1 text-sm text-slate-700">{action.label}</p>
        <div className="mt-3 flex gap-2">
          {action.href ? (
            <Link href={action.href}><Button>{action.btn}</Button></Link>
          ) : action.btn === "Start diagnostic" ? (
            <Button onClick={startDiagnostic} disabled={busy === "diag"}>{busy === "diag" ? "Starting…" : action.btn}</Button>
          ) : (
            <Button onClick={deepDiveTargets} disabled={busy === "deep" || targets.length === 0}>{busy === "deep" ? "Working…" : action.btn}</Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500">Topics with assessment evidence</p>
          <p className="mt-1 text-2xl font-bold">{assessedCount}<span className="text-sm font-normal text-slate-400"> / {me.course.topics} on syllabus</span></p>
          <p className="mt-0.5 text-[11px] text-slate-400">topics with no responses show “Not enough evidence”</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Submitted attempts</p>
          <p className="mt-1 text-2xl font-bold">{me.course.submitted}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Documents indexed</p>
          <p className="mt-1 text-2xl font-bold">{me.course.documents}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500">Plan progress</p>
          <p className="mt-1 text-2xl font-bold">{doneCount}<span className="text-sm font-normal text-slate-400"> / {totalItems} tasks</span></p>
          <div className="mt-2"><ProgressBar value={totalItems ? (doneCount / totalItems) * 100 : 0} color="bg-emerald-500" /></div>
        </Card>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Topic status summary</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusCounts.length === 0 && <p className="text-sm text-slate-400">No assessment evidence yet.</p>}
          {statusCounts.map((s) => (
            <StatusPill key={s.status} status={s.status} label={`${s.status.replace(/_/g, " ")} · ${s.n}`} />
          ))}
        </div>
        <Link href="/app/report" className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:underline">See the full gap report with evidence →</Link>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quality checks (acceptance criteria)</p>
            <p className="mt-1 text-sm text-slate-500">Citation grounding, diagnosis policy on synthetic profiles, planner budget, MCQ sanity.</p>
          </div>
          <Button variant="ghost" onClick={runChecks} disabled={busy === "eval"}>{busy === "eval" ? "Running…" : "Run"}</Button>
        </div>
        {showEvals || evalResults ? (
          <div className="mt-4 space-y-1.5">
            {evalResults && evalResults.results.length === 0 && <p className="text-sm text-slate-400">Nothing to check yet (no data).</p>}
            {evalResults?.results.map((r) => (
              <div key={r.area + r.name} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className={r.pass ? "text-emerald-600" : "text-rose-600"}>{r.pass ? "✓" : "✗"}</span>
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.detail}</p>
                </div>
                <span className="ml-auto text-xs text-slate-400">{r.area}</span>
              </div>
            ))}
            {evalResults && (
              <p className="pt-1 text-xs text-slate-500">
                {evalResults.summary.pass} passed, {evalResults.summary.fail} failed. Runtime checks (cross-user isolation, double-submit): run <code className="rounded bg-slate-100 px-1">npm run eval:demo</code>.
              </p>
            )}
          </div>
        ) : null}
      </Card>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
