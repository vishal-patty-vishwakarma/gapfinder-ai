"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { Card, Loading, ProgressBar } from "@/components/ui";

interface SeriesPt { attemptId: string; order: number; mode: string; nValid: number; validRate: number | null }
interface TopicTrend {
  topicId: string;
  title: string;
  series: SeriesPt[];
  delta: number | null;
}
interface ProgressData {
  attempts: { id: string; order: number; mode: string; info: string; submittedAt: string | null; nResponses: number }[];
  topics: TopicTrend[];
  attemptCount: number;
  caution: string;
}

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ProgressData>("/api/progress").then(setData).catch((e) => setError((e as Error).message));
  }, []);

  if (error) return <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>;
  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Progress</h1>
        <p className="text-sm text-slate-500">Topic-level trend across attempts, compared cautiously (different items, versions and repeats are labelled).</p>
      </div>

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attempt history ({data.attemptCount})</p>
        <ul className="mt-2 divide-y text-sm">
          {data.attempts.map((a) => (
            <li key={a.id} className="py-2">
              <p className="font-medium">Attempt {a.order} — {a.mode.replace(/_/g, " ")} <span className="ml-1 text-xs text-slate-400">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : ""} · {a.nResponses} responses</span></p>
              <p className="text-xs text-slate-500">{a.info}</p>
            </li>
          ))}
          {data.attempts.length === 0 && <li className="py-2 text-slate-400">No submitted attempts yet.</li>}
        </ul>
      </Card>

      <div className="space-y-3">
        {data.topics.map((t) => {
          const first = t.series[0];
          const latest = t.series[t.series.length - 1];
          return (
            <Card key={t.topicId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.delta !== null && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.delta > 0 ? "bg-emerald-100 text-emerald-700" : t.delta < 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                    {t.delta > 0 ? "▲ +" : t.delta < 0 ? "▼ " : "• "}{t.delta} pts since first assessment
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {first && (
                  <div>
                    <p className="mb-1 text-[11px] text-slate-400">first: attempt {first.order} ({first.mode.replace(/_/g, " ")}) — {first.validRate === null ? "—" : `${Math.round(first.validRate * 100)}%`}</p>
                    <ProgressBar value={first.validRate === null ? 0 : first.validRate * 100} color="bg-slate-300" />
                  </div>
                )}
                {latest && t.series.length > 1 && (
                  <div>
                    <p className="mb-1 text-[11px] text-slate-400">latest: attempt {latest.order} ({latest.mode.replace(/_/g, " ")}) — {latest.validRate === null ? "—" : `${Math.round(latest.validRate * 100)}%`}</p>
                    <ProgressBar value={latest.validRate === null ? 0 : latest.validRate * 100} color="bg-indigo-500" />
                  </div>
                )}
              </div>
              {t.series.length > 1 && (
                <div className="mt-2 flex gap-1">
                  {t.series.map((s) => (
                    <span key={s.attemptId} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title={s.mode}>
                      A{s.order}: {s.validRate === null ? "—" : Math.round(s.validRate * 100)}% ({s.nValid} valid)
                    </span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">{data.caution}</p>
    </div>
  );
}
