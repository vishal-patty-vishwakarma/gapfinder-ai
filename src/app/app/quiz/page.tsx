"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, json } from "@/components/api";
import { Card, Button, Loading } from "@/components/ui";

interface TopicLite { id: string; title: string; outOfScope: boolean; mappedChunks: number }
interface AttemptRow { id: string; order: number; mode: string; info: string; submittedAt: string | null; nResponses: number }

export default function QuizIndex() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicLite[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await api<{ topics: TopicLite[] }>("/api/course");
        setTopics(c.topics.filter((t) => !t.outOfScope));
        const p = await api<{ attempts: AttemptRow[] }>("/api/progress");
        setAttempts(p.attempts);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  async function start(mode: "diagnostic" | "deep_dive" | "reassess") {
    setBusy(mode);
    setError(null);
    try {
      const body = mode === "diagnostic" ? { mode } : { mode, topicIds: [...selected] };
      if (mode !== "diagnostic" && selected.size === 0) throw new Error("Select at least one topic for a targeted assessment.");
      const r = await api<{ attemptId: string }>("/api/quiz", json("POST", body));
      router.push(`/app/quiz/${r.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const inProgress = attempts.find((a) => a.submittedAt === null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Assessments</h1>
        <p className="text-sm text-slate-500">Every question is generated/selected from your own uploaded material, with a citation to where it came from.</p>
      </div>

      {inProgress && (
        <Card className="border-indigo-200 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-900">You have an assessment in progress ({inProgress.mode}).</p>
          <Link href={`/app/quiz/${inProgress.id}`} className="mt-2 inline-block"><Button>Resume it first</Button></Link>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-sm font-semibold">Diagnostic assessment <span className="font-normal text-slate-500">(all topics with material)</span></p>
        <p className="mt-1 text-xs text-slate-500">MCQ + short-answer per topic. Fresh items preferred where unused bank items exist; repeats are honest-flagged.</p>
        <Button className="mt-3" onClick={() => start("diagnostic")} disabled={busy !== null || !!inProgress}>{busy === "diagnostic" ? "Assembling…" : "Start diagnostic"}</Button>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">Targeted / reassessment <span className="font-normal text-slate-500">(choose topics)</span></p>
        <p className="mt-1 text-xs text-slate-500">Freshly grounded items are generated from your material first (autogen-v1); reused bank items are marked as weaker evidence.</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {topics.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${selected.has(t.id) ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}>
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.has(t.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(t.id);
                  else next.delete(t.id);
                  setSelected(next);
                }}
              />
              <span>
                {t.title}
                {t.mappedChunks === 0 && <span className="ml-1 text-[11px] text-rose-500">(no material)</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => start("deep_dive")} disabled={busy !== null || selected.size === 0}>{busy === "deep_dive" ? "Assembling…" : "Deep dive (collect evidence)"}</Button>
          <Button variant="ghost" onClick={() => start("reassess")} disabled={busy !== null || selected.size === 0}>{busy === "reassess" ? "Assembling…" : "Reassess (fresh after revision)"}</Button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">Your attempts</p>
        {attempts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nothing yet — the baseline sample attempt appears after the first report exists.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <p className="font-medium">Attempt {a.order} — {a.mode.replace(/_/g, " ")} <span className={`ml-1 rounded px-1.5 py-0.5 text-[11px] ${a.submittedAt ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{a.submittedAt ? "submitted" : "in progress"}</span></p>
                  <p className="text-xs text-slate-500">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "not submitted"} · {a.nResponses} responses</p>
                </div>
                <Link href={`/app/quiz/${a.id}`} className="text-xs font-medium text-indigo-600 hover:underline">Open →</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
