"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("judge@demo.app");
  const [password, setPassword] = useState("gapfinder-demo");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: tab, email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign in");
      router.push("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white">GF</div>
          <h1 className="text-2xl font-bold tracking-tight">GapFinder AI</h1>
          <p className="mt-1 text-sm text-slate-500">Find your gaps from your own syllabus, notes and past papers — before the exam finds them for you.</p>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            {[
              { k: "login", label: "Sign in" },
              { k: "register", label: "Register" },
            ].map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k as "login" | "register")}
                className={`flex-1 rounded-md px-3 py-1.5 ${tab === t.k ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "login" && (
            <p className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
              <strong>Judge demo (fixed credentials, preloaded course):</strong> judge@demo.app / gapfinder-demo — or empty-workspace user <code>student@demo.app / demo-1234</code> for isolation checks.
            </p>
          )}
          {tab === "register" && (
            <input className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "Working…" : tab === "login" ? "Sign in" : "Create account"}
          </Button>
          <p className="mt-4 text-center text-xs text-slate-400">
            Demo register creates an <strong>empty workspace</strong> — upload your own syllabus & notes to start. The demo judge account comes with a seeded Physics 101 course.
          </p>
        </Card>
      </div>
    </div>
  );
}
