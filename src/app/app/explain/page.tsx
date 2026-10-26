"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";

interface Cite { n: number; documentTitle: string; locator: string; quote: string; documentId: string }
interface ExplainOut { abstained: boolean; answer: string; citations: Cite[]; upgradedBy?: string }

const SUGGESTIONS = [
  "What does a horizontal line on a position–time graph mean?",
  "What happens if I double the resultant force on a cart?",
  "Why is real-world efficiency always less than 100%?",
  "How do I draw a free-body diagram?",
  "What is the physics definition of a joule and of work?",
];

export default function ExplainPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ExplainOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: text }),
        credentials: "include",
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Could not answer");
      setResult(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Explain this topic</h1>
        <p className="text-sm text-slate-500">Answers ONLY from your uploaded material, with citation markers. If your material doesn’t cover it, GapFinder says so instead of inventing an answer.</p>
      </div>

      <Card className="p-5">
        <textarea className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. What does the gradient of a velocity–time graph tell me?" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => ask(query)} disabled={busy || query.trim().length < 3}>{busy ? "Searching your material…" : "Ask"}</Button>
          {!busy && result === null && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => { setQuery(s); ask(s); }} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-700">
                  {s.length > 46 ? s.slice(0, 46) + "…" : s}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {result && (
        <Card className={`p-5 ${result.abstained ? "border-slate-300 bg-slate-50" : ""}`}>
          <p className={`whitespace-pre-wrap text-sm ${result.abstained ? "text-slate-600" : "text-slate-800"}`}>{result.answer}</p>
          {!result.abstained && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] text-slate-400">{result.upgradedBy ? `Synthesised by ${result.upgradedBy}, grounded in the cited excerpts below.` : "Extractive answer — each citation points to the exact section in your material."}</p>
              {result.citations.map((c) => (
                <div key={c.n} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-500">[{c.n}] 📎 {c.documentTitle} · {c.locator}</p>
                  <p className="mt-0.5 text-xs italic text-slate-600">“{c.quote}”</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
