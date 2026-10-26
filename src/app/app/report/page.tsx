"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, json } from "@/components/api";
import { Card, StatusPill, Button, Loading } from "@/components/ui";

interface EvidenceItem {
  questionId: string;
  stem: string;
  answerGiven: string | null;
  kind: string | null;
  score: number | null;
  rationale: string | null;
  rubricHits: string[];
  rubricMisses: string[];
  citations: { documentTitle: string; locator: string; quote: string }[];
}
interface TopicCard {
  topicId: string;
  title: string;
  syllabusRef: string;
  status: string;
  statusLabel: string;
  reasons: string[];
  counts: { valid: number; correct: number; partial: number; wrong: number; skip: number; dontKnow: number; needsReview: number; repeat: number };
  validRate: number | null;
  coverage: { syllabus: boolean; materialChunks: number; learningChunks: number; bankQuestions: number; basis: string; importanceOverride: number | null };
  evidence: EvidenceItem[];
}
interface ReportData {
  report: { id: string; createdAt: string; policyVersion: string; basedOnAttempts: number } | null;
  topics: TopicCard[];
  outOfScope: { id: string; title: string }[];
  importanceBasis: string;
}

export default function ReportPage() {
  const router = useRouter();
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ReportData>("/api/report").then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  if (!data) return <Loading />;
  if (!data.report) {
    return (
      <Card className="p-10 text-center">
        <p className="font-semibold">No gap report yet</p>
        <p className="mt-1 text-sm text-slate-500">Your report is built automatically when you submit an assessment.</p>
        <Link href="/app/quiz" className="mt-3 inline-block"><Button>Go to assessments</Button></Link>
      </Card>
    );
  }

  async function assess(topicId: string) {
    setBusy(topicId);
    try {
      const r = await api<{ attemptId: string }>("/api/quiz", json("POST", { mode: "deep_dive", topicIds: [topicId] }));
      router.push(`/app/quiz/${r.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Gap report</h1>
        <p className="text-sm text-slate-500">
          {data.report.createdAt && new Date(data.report.createdAt).toLocaleString()} · policy {data.report.policyVersion} · based on {data.report.basedOnAttempts} submitted attempt(s)
        </p>
      </div>

      <div className="space-y-4">
        {data.topics.map((t) => (
          <Card key={t.topicId} className={`${t.status === "weak" ? "border-rose-200" : t.status === "needs_review" ? "border-violet-200" : t.status === "not_enough_evidence" ? "border-slate-300" : ""} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-xs text-slate-400">{t.syllabusRef}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs font-bold ${t.validRate === null ? "text-slate-400" : "text-slate-700"}`}>
                  {t.validRate === null ? "—" : `${Math.round(t.validRate * 100)}% credit`}
                </span>
                <StatusPill status={t.status} label={t.statusLabel} />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">valid: {t.counts.correct + t.counts.partial + t.counts.wrong}</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">correct: {t.counts.correct}</span>
              {t.counts.partial > 0 && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">partial: {t.counts.partial}</span>}
              <span className="rounded bg-rose-50 px-2 py-0.5 text-rose-700">wrong: {t.counts.wrong}</span>
              {(t.counts.skip > 0 || t.counts.dontKnow > 0) && (
                <span className="rounded bg-slate-50 px-2 py-0.5 text-slate-500">skip/dk: {t.counts.skip + t.counts.dontKnow} (not counted as wrong)</span>
              )}
              {t.counts.needsReview > 0 && <span className="rounded bg-violet-50 px-2 py-0.5 text-violet-700">needs review: {t.counts.needsReview}</span>}
              {t.counts.repeat > 0 && <span className="rounded bg-lime-50 px-2 py-0.5 text-lime-700">repeats: {t.counts.repeat}</span>}
            </div>

            <ul className="mt-2.5 space-y-1 text-sm text-slate-700">
              {t.reasons.map((r, i) => (
                <li key={i} className="flex gap-1.5"><span className="text-slate-300">▸</span>{r}</li>
              ))}
            </ul>

            <p className="mt-2 text-[11px] text-slate-400">
              coverage: {t.coverage.materialChunks} mapped chunk(s) · {t.coverage.bankQuestions} validated question(s) · importance: {t.coverage.importanceOverride !== null ? `manual override (${t.coverage.importanceOverride})` : t.coverage.basis}
            </p>

            {(t.status === "not_enough_evidence" || t.status === "needs_review") && t.coverage.learningChunks > 0 && (
              <Button className="mt-3" onClick={() => assess(t.topicId)} disabled={busy === t.topicId}>
                {busy === t.topicId ? "Assembling…" : "Assess this topic now (+ valid evidence)"}
              </Button>
            )}
            {t.status === "not_enough_evidence" && t.coverage.learningChunks === 0 && (
              <Link href="/app/materials" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">Add material for this topic →</Link>
            )}

            {t.evidence.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-indigo-600">Evidence trail ({t.evidence.length})</summary>
                <div className="mt-2 space-y-2">
                  {t.evidence.map((e) => (
                    <div key={e.questionId} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <StatusPill status={e.kind ?? "skipped"} label={e.kind ?? "unanswered"} />
                        {e.score !== null && <span className="text-[11px] text-slate-400">{Math.round(e.score * 100)}%</span>}
                      </div>
                      <p className="mt-1.5 text-xs text-slate-700">{e.stem}</p>
                      {typeof e.answerGiven === "string" && <p className="mt-1 text-[11px] italic text-slate-500">Your answer: “{e.answerGiven}”</p>}
                      {e.rationale && <p className="mt-1 text-[11px] text-slate-600">{e.rationale}</p>}
                      {e.rubricMisses.length > 0 && <p className="mt-1 text-[11px] text-amber-700">missed: {e.rubricMisses.join(", ")}</p>}
                      {e.rubricHits.length > 0 && <p className="mt-0.5 text-[11px] text-emerald-700">earned: {e.rubricHits.join(", ")}</p>}
                      <div className="mt-1.5">
                        {e.citations.map((c, i) => (
                          <p key={i} className="text-[11px] text-slate-400">📎 {c.documentTitle} · {c.locator}<span className="block pl-4 italic">“{c.quote.slice(0, 160)}{c.quote.length > 160 ? "…" : ""}”</span></p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </Card>
        ))}
      </div>

      {data.outOfScope.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Out of scope (excluded from diagnosis)</p>
          <ul className="mt-1.5 text-sm text-slate-500">{data.outOfScope.map((t) => <li key={t.id}>• {t.title}</li>)}</ul>
        </Card>
      )}

      <p className="text-xs text-slate-400">{data.importanceBasis}</p>
    </div>
  );
}
