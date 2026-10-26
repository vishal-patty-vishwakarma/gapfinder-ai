"use client";

import { useEffect, useState } from "react";
import { Card, Button, Loading, StatusPill } from "@/components/ui";

interface DocItem {
  id: string;
  fileName: string;
  title: string;
  kind: string;
  status: string;
  version: number;
  sizeBytes: number;
  addedAt: string;
  notes: string;
  extractionStatus?: string;
  chunkCount: number;
  preview: string[];
}
interface TopicRow {
  id: string;
  title: string;
  origin: string;
  outOfScope: boolean;
  ppWeight: number | null;
  importanceOverride: number | null;
  syllabusRef: string;
  mappedChunks: number;
  validatedQuestions: number;
}
interface CourseData {
  documents: DocItem[];
  topics: TopicRow[];
  unmappedChunks: { id: string; documentId: string; locator: string; preview: string }[];
  importanceBasis: string;
  topicMapVersion: number;
}

const KINDS = [
  ["syllabus", "Syllabus"],
  ["notes", "Notes"],
  ["textbook", "Textbook chapter"],
  ["past_paper", "Past question paper"],
  ["other", "Other"],
] as const;

export default function MaterialsPage() {
  const [data, setData] = useState<CourseData | null>(null);
  const [kind, setKind] = useState("notes");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function load() {
    const res = await fetch("/api/course", { credentials: "include" });
    if (res.ok) setData(await res.json());
  }
  useEffect(() => {
    load();
  }, []);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error ?? "Upload failed");
      setMessage(out.message);
      setFile(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <Loading />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Materials</h1>
        <p className="text-sm text-slate-500">Your syllabus, notes, textbook chapters and past papers. Each URL/text is chunked and mapped to topics; anything that can’t be confidently mapped is flagged for review — never silently “processed”.</p>
      </div>

      <Card className="p-5">
        <div
          className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]); }}
        >
          <p className="text-sm text-slate-600">{file ? `Selected: ${file.name} (${Math.ceil(file.size / 1024)} KB)` : "Drag a file here, or choose below"}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <input type="file" accept=".txt,.md,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {KINDS.map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
            <Button onClick={upload} disabled={!file || busy}>{busy ? "Processing…" : "Upload & index"}</Button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">MVP supports plain text (.txt/.md) and readable, text-based PDFs up to 8 MB. Scanned/image PDFs are honestly rejected, not silently “processed”.</p>
        </div>
        {message && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </Card>

      <div className="grid gap-3">
        {data.documents.map((d) => (
          <Card key={d.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{d.title}</span>
              <StatusPill status={d.status === "ready" ? "correct" : "invalid"} label={d.status} />
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">{d.kind.replace("_", " ")}</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">v{d.version} · {d.chunkCount} chunk(s) · {Math.ceil(d.sizeBytes / 1024)} KB</span>
              <span className="ml-auto text-[11px] text-slate-400">{new Date(d.addedAt).toLocaleDateString()}</span>
            </div>
            {d.extractionStatus && <p className="mt-1 text-[11px] text-slate-500">{d.extractionStatus}</p>}
            {d.notes && <p className="text-[11px] text-slate-400">{d.notes}</p>}
            {d.preview.map((p, i) => (
              <p key={i} className="mt-2 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{p}</p>
            ))}
          </Card>
        ))}
        {data.documents.length === 0 && <Card className="p-10 text-center text-sm text-slate-400">No documents yet — upload your syllabus first.</Card>}
      </div>

      {data.unmappedChunks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800">⚠ {data.unmappedChunks.length} chunk(s) could not be confidently mapped to a topic</p>
          <p className="mt-1 text-xs text-amber-700">They are still searchable in Explain, but they do not count toward any topic’s material coverage until a confident mapping exists (honesty over false coverage).</p>
          <ul className="mt-2 space-y-1.5">
            {data.unmappedChunks.map((c) => (
              <li key={c.id} className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                <span className="font-medium">{c.locator}</span> <span className="text-slate-400">({c.documentId})</span> — {c.preview.slice(0, 120)}…
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source coverage by topic <span className="font-normal normal-case">(map v{data.topicMapVersion})</span></p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-400">
              <th className="py-1.5 pr-2">Topic</th>
              <th>Chunks</th>
              <th>Questions</th>
              <th>Exam weight</th>
            </tr>
          </thead>
          <tbody>
            {data.topics.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2 pr-2">
                  {t.title}
                  {t.outOfScope && <span className="ml-1 text-[11px] text-slate-400">(out of scope)</span>}
                  {t.mappedChunks === 0 && <span className="ml-1 text-[11px] text-rose-500">(no material)</span>}
                </td>
                <td>{t.mappedChunks}</td>
                <td>{t.validatedQuestions}</td>
                <td className="text-xs">
                  {t.importanceOverride !== null ? <span className="font-semibold text-indigo-700">override: {t.importanceOverride}</span> : t.ppWeight !== null ? `paper ×${t.ppWeight}` : "default"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-400">{data.importanceBasis}</p>
      </Card>
    </div>
  );
}
