"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Dashboard", icon: "◎" },
  { href: "/app/materials", label: "Materials", icon: "▣" },
  { href: "/app/topic-map", label: "Topic map", icon: "◈" },
  { href: "/app/quiz", label: "Assessments", icon: "✓" },
  { href: "/app/report", label: "Gap report", icon: "◉" },
  { href: "/app/plan", label: "Revision plan", icon: "≡" },
  { href: "/app/explain", label: "Explain this topic", icon: "❝" },
  { href: "/app/progress", label: "Progress", icon: "▲" },
];

export default function AppNav({ userName, userEmail }: { userName: string; userEmail: string }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    router.push("/login");
  }
  return (
    <nav className="w-56 shrink-0">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">GF</div>
        <div>
          <p className="text-sm font-bold leading-4">GapFinder AI</p>
          <p className="text-[11px] text-slate-400">diagnosis, not answers</p>
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {LINKS.map((l) => {
          const active = path === l.href || (l.href !== "/app" && path.startsWith(l.href));
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition ${
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="w-4 text-center opacity-60">{l.icon}</span>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-3 text-xs">
        <p className="font-semibold text-slate-700">{userName}</p>
        <p className="mt-0.5 text-slate-400">{userEmail}</p>
        <button onClick={logout} className="mt-2 text-slate-500 underline hover:text-rose-600">
          Sign out
        </button>
      </div>
    </nav>
  );
}
