// Gap report builder: aggregates submitted attempts into topic evidence and
// applies the frozen diagnosis policy. Pure + deterministic (plan §12/§25.3).
import type { GapReport, TopicAssessment, Workspace } from "@/lib/types";
import { computeTopicAssessment, POLICY_VERSION } from "@/lib/policy";

export function buildGapReport(ws: Workspace, nowIso: string): GapReport {
  const submitted = ws.attempts.filter((a) => a.status === "submitted");
  const topics: Record<string, TopicAssessment> = {};
  for (const t of ws.topics) {
    if (t.outOfScope) continue; // excluded from diagnosis entirely
    const mappedChunks = ws.chunks.filter((c) => c.active && c.topicId === t.id).length;
    // Learning material = notes/textbook documents. Syllabus and past papers
    // are STRUCTURE, not study material (§13: no-source topic ⇒ add_material).
    const learningChunks = ws.chunks.filter((c) => {
      if (!c.active || c.topicId !== t.id) return false;
      const kind = ws.documents.find((d) => d.id === c.documentId)?.kind;
      return kind === "notes" || kind === "textbook";
    }).length;
    const bankQs = ws.questions.filter((q) => q.topicId === t.id && q.validationStatus === "validated").length;
    topics[t.id] = computeTopicAssessment(
      t.id,
      submitted,
      ws.questions,
      t,
      mappedChunks,
      learningChunks,
      bankQs
    );
  }
  return {
    id: `report_${nowIso}_${submitted.length}`,
    createdAt: nowIso,
    policyVersion: POLICY_VERSION,
    attemptIds: submitted.map((a) => a.id),
    topics,
    superseded: false,
  };
}

/** Stamp previous reports superseded and append the new one (history kept). */
export function pushReport(ws: Workspace, report: GapReport): void {
  for (const r of ws.reports) r.superseded = true;
  ws.reports.push(report);
}

export function latestReport(ws: Workspace): GapReport | null {
  const active = ws.reports.filter((r) => !r.superseded);
  return active.length ? active[active.length - 1] : ws.reports[ws.reports.length - 1] ?? null;
}
