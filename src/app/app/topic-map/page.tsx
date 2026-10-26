"use client";

import { useEffect, useState } from "react";
import { Card, Button, Loading } from "@/components/ui";

interface TopicRow {
  id: string;
  title: string;
  origin: string;
  outOfScope: boolean;
  importanceOverride: number | null;
  ppWeight: number | null;
  parents: string[];
  syllabusRef: string;
  mappedChunks: number;
  validatedQuestions: number;
}
interface CourseData {
  topics: TopicRow[];
  importanceBasis: string;
  topicMapVersion: number;
}

export default function TopicMapPage() {
  const [data, setData] = useState<CourseData | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/course", { credentials: "include" });
    if (res.ok) {
      const d = (await res.json()) as CourseData;
      setData(d);
      setTitles(Object.fromEntries(d.topics.map((t) => [t.id, t.title])));
      setOverrides(
        Object.fromEntries(
          d.topics.map((t) => [t.id, t.importanceOverride === null || t.importanceOverride === undefined ? "" : String(t.importanceOverride)])
        )
      );
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (!data) return <Loading />;

  async function patch(topic: TopicRow, body: Record<string, unknown>) {
    setBusy(topic.id);
    setError(null);
    try {
      await fetch("/api/topics", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: topic.id, ...body }),
        credentials: "include",
      });
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
        <h1 className="text-xl font-bold tracking-tight">Topic map</h1>
        <p className="text-sm text-slate-500">
          Editable topic structure from your syllabus. Every change bumps the map version and regenerates the gap report — historical reports are preserved.
        </p>
      </div>

      <div className="space-y-3">
        {data.topics.map((t) => (
          <Card key={t.id} className={`p-4 ${t.outOfScope ? "opacity-55" : ""}`}>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded bg-slate-100 px-1.5 py-0.5">{t.origin}</span>
              <span>{t.mappedChunks} chunk(s) · {t.validatedQuestions} question(s)</span>
              <span>weight: {t.importanceOverride !== null ? `override ${t.importanceOverride}` : t.ppWeight !== null ? `paper ×${t.ppWeight}` : "default"}</span>
              {t.parents.length > 0 && <span>prerequisites: {t.parents.map((p) => data.topics.find((x) => x.id === p)?.title ?? p).join(", ")}</span>}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">{t.syllabusRef}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className="min-w-64 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={titles[t.id] ?? t.title}
                onChange={(e) => setTitles({ ...titles, [t.id]: e.target.value })}
              />
              <Button variant="ghost" onClick={() => patch(t, { title: titles[t.id] })} disabled={busy === t.id}>Rename</Button>
              <input
                className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                placeholder="weight"
                value={overrides[t.id]}
                onChange={(e) => setOverrides({ ...overrides, [t.id]: e.target.value })}
              />
              <Button variant="ghost" onClick={() => patch(t, { importanceOverride: overrides[t.id] === "" ? null : Number(overrides[t.id]) })} disabled={busy === t.id}>Set weight</Button>
              <Button variant={t.outOfScope ? "subtle" : "ghost"} onClick={() => patch(t, { outOfScope: !t.outOfScope })} disabled={busy === t.id}>
                {t.outOfScope ? "Include in scope" : "Mark out of scope"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400">{data.importanceBasis}</p>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
