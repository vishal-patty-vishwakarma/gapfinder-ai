"use client";

import { useState } from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const map: Record<string, string> = {
    strong: "bg-emerald-100 text-emerald-800 border-emerald-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    weak: "bg-rose-100 text-rose-800 border-rose-200",
    not_enough_evidence: "bg-slate-100 text-slate-600 border-slate-300",
    needs_review: "bg-violet-100 text-violet-800 border-violet-200",
    correct: "bg-emerald-100 text-emerald-800 border-emerald-200",
    partial: "bg-amber-100 text-amber-800 border-amber-200",
    incorrect: "bg-rose-100 text-rose-800 border-rose-200",
    skipped: "bg-slate-100 text-slate-600 border-slate-300",
    dont_know: "bg-slate-100 text-slate-600 border-slate-300",
    invalid: "bg-rose-100 text-rose-900 border-rose-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700 border-slate-300"}`}>
      {label ?? status}
    </span>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "subtle" | "danger";
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    subtle: "text-indigo-700 hover:bg-indigo-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition ${styles} disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, color = "bg-indigo-500" }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-slate-400">Loading…</div>;
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-14 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}
