"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, json } from "@/components/api";
import { Card, Button, StatusPill, Loading, ErrorBox } from "@/components/ui";

interface Cite { documentTitle: string; locator: string; quote?: string }
interface Q {
  id: string;
  topicId: string;
  type: "mcq" | "short";
  difficulty: string;
  source: string;
  stem: string;
  options?: { id: string; label: string; whyWrong?: string }[];
  answerOptionId?: string;
  citations: Cite[];
  explanationRight?: string;
  validationStatus: string;
}
interface PendingEvaluation {
  questionId: string;
  kind: string;
  score: null | number;
  rationale: string;
  rubricHits?: string[];
  rubricMisses?: string[];
}
interface AttemptData {
  attempt: {
    id: string;
    mode: string;
    status: "in_progress" | "submitted";
    info?: string;
    questions: Q[];
    responses: Record<string, { questionId: string; state: string; value: string | null }>;
    evaluations?: Record<string, PendingEvaluation>;
  };
}

export default function QuizPage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const [data, setData] = useState<AttemptData | null>(null);
  const [topicTitles, setTopicTitles] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, { state: string; value: string | null }>>({});
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const a = await api<AttemptData>(`/api/attempt/${params.attemptId}`);
      setData(a);
      setAnswers(a.attempt.responses ?? {});
      const c = await api<{ topics: { id: string; title: string }[] }>("/api/course");
      setTopicTitles(Object.fromEntries(c.topics.map((t) => [t.id, t.title])));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [params.attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const attempt = data.attempt;
  const submitted = attempt.status === "submitted";

  function persist(qid: string, state: string, value: string | null) {
    setAnswers((prev) => ({ ...prev, [qid]: { state, value } }));
    api(`/api/attempt/${attempt.id}`, json("POST", { action: "respond", questionId: qid, state, value, idempotencyKey: `${qid}:${state}:${value ?? ""}` })).catch((e) =>
      setError((e as Error).message)
    );
  }

  async function submit() {
    const unanswered = attempt.questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !window.confirm(`${unanswered} question(s) will be recorded as skipped. Submit now?`)) return;
    setBusy(true);
    try {
      await api(`/api/attempt/${attempt.id}`, json("POST", { action: "submit", idempotencyKey: `submit:${attempt.id}` }));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // ---------- RESULTS VIEW ----------
  if (submitted) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Assessment results — {attempt.mode.replace(/_/g, " ")}</h1>
          <p className="text-sm text-slate-500">{attempt.info}</p>
        </div>
        {attempt.questions.map((q, i) => {
          const ev = attempt.evaluations?.[q.id];
          const resp = attempt.responses[q.id];
          const given = resp?.state === "answered" ? resp.value : resp?.state ?? "unanswered";
          return (
            <Card key={q.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">Q{i + 1}</span>
                <span className="text-xs text-slate-500">{topicTitles[q.topicId] ?? q.topicId}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{q.difficulty} · {q.source}</span>
                <span className="ml-auto">
                  {(ev?.kind ?? "unanswered") === "unanswered" ? (
                    <StatusPill status="skipped" label="no response" />
                  ) : (
                    <StatusPill status={ev!.kind} label={ev!.kind === "partial" ? `partial (${Math.round((ev!.score ?? 0) * 100)}%)` : ev!.kind} />
                  )}
                </span>
              </div>
              <p className="text-sm font-medium">{q.stem}</p>
              {q.type === "mcq" && (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {q.options?.map((o) => (
                    <li key={o.id} className={`rounded-lg border px-3 py-2 ${o.id === q.answerOptionId ? "border-emerald-300 bg-emerald-50" : o.id === given ? "border-rose-300 bg-rose-50" : "border-slate-200"}`}>
                      <span className="font-medium">{o.label}</span>
                      {o.id === q.answerOptionId && <span className="ml-2 text-xs font-semibold text-emerald-700">← correct</span>}
                      {o.whyWrong && o.id === given && <p className="mt-1 text-xs text-rose-800">{o.whyWrong}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {q.type === "short" && typeof given === "string" && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-600">“{given}”</p>
              )}
              {ev?.rubricMisses && ev.rubricMisses.length > 0 && ev.rubricHits && (
                <div className="mt-2 text-xs">
                  {ev.rubricMisses.map((m) => (
                    <p key={m} className="text-amber-700">✗ missed: {m}</p>
                  ))}
                  {rubricHitLines(ev)}
                </div>
              )}
              {q.explanationRight && <p className="mt-2 text-sm text-slate-700">{q.explanationRight}</p>}
              {ev?.rationale && <p className="mt-1 text-xs text-slate-500">{ev.rationale}</p>}
              <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                {q.citations.map((c, ci) => (
                  <p key={ci} className="text-[11px] text-slate-500">
                    📎 {c.documentTitle} · {c.locator}
                    {c.quote && <span className="block pl-4 italic text-slate-600">“{c.quote}”</span>}
                  </p>
                ))}
              </div>
            </Card>
          );
        })}
        <div className="flex gap-2">
          <Link href="/app/report"><Button>View gap report →</Button></Link>
          <Link href="/app/plan"><Button variant="ghost">Revision plan</Button></Link>
        </div>
      </div>
    );
  }

  // ---------- QUIZ VIEW ----------
  const q = attempt.questions[idx];
  const answerState = answers[q.id];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Assessment — {attempt.mode.replace(/_/g, " ")}</h1>
        <p className="text-sm text-slate-500">{answeredCount} / {attempt.questions.length} answered</p>
      </div>
      <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">{attempt.info}</p>

      <div className="flex flex-wrap gap-1">
        {attempt.questions.map((qq, i) => (
          <button key={qq.id} onClick={() => setIdx(i)} className={`h-7 w-7 rounded-lg text-xs font-semibold ${i === idx ? "bg-indigo-600 text-white" : answers[qq.id] ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {i + 1}
          </button>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Q{idx + 1}</span>
          <span className="text-xs text-slate-500">{topicTitles[q.topicId] ?? ""}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{q.difficulty} · answered from your material</span>
          <span className="text-[11px] text-amber-700">answer-revealing quotes stay hidden until you submit</span>
        </div>
        <p className="whitespace-pre-wrap text-sm font-medium leading-6">{q.stem}</p>

        <div className="my-2 border-l-2 border-slate-200 pl-3 text-[11px] text-slate-400">
          📎 {q.citations.map((c) => `${c.documentTitle} · ${c.locator}`).join(" | ")}
        </div>

        {q.type === "mcq" ? (
          <div className="mt-3 space-y-2">
            {q.options?.map((o) => (
              <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition ${answerState?.value === o.id ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answerState?.value === o.id}
                  onChange={() => persist(q.id, "answered", o.id)}
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : (
          <textarea
            className="mt-3 min-h-[110px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Write your answer in your own words…"
            defaultValue={(answerState?.value as string) ?? ""}
            onBlur={(e) => {
              const text = e.target.value.trim();
              if (text) persist(q.id, "answered", text);
            }}
          />
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => persist(q.id, "dont_know", null)} disabled={busy}>I don’t know</Button>
          <Button variant="ghost" onClick={() => persist(q.id, "skipped", null)} disabled={busy}>Skip</Button>
          <div className="ml-auto flex gap-2">
            <Button variant="subtle" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>← Prev</Button>
            {idx < attempt.questions.length - 1 ? (
              <Button onClick={() => setIdx((i) => i + 1)}>Save & next →</Button>
            ) : (
              <Button onClick={submit} disabled={busy || answeredCount === 0}>{busy ? "Submitting…" : "Submit assessment"}</Button>
            )}
          </div>
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        Skipped and “don’t know” never count as wrong answers. Your responses are saved as you go — refresh or resume later, submission is idempotent.
      </p>
    </div>
  );
}

function rubricHitLines(ev: PendingEvaluation) {
  return (ev.rubricHits ?? []).map((h) => (
    <p key={h} className="text-emerald-700">✓ earned: {h}</p>
  ));
}
