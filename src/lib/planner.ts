// Deterministic revision planner (plan §13 / §25.3嗓 / §25.6).
//
// The LLM never allocates time or chooses priority — it can only phrase task
// wording. This engine is inspectable: every item carries `why`.
import type {
  GapReport,
  Plan,
  PlanItem,
  PlanItemKind,
  TopicAssessment,
  TopicState,
  TopicStatus,
  Workspace,
} from "@/lib/types";
import { STATUS_LABELS } from "@/lib/policy";

const BASE_MINUTES: Record<PlanItemKind, number> = {
  add_material: 10,
  assess_now: 15,
  core_concept: 20,
  practice: 15,
  self_explain: 10,
};

// Minimum minutes per item after scaling. Items below this are dropped.
const MIN_ITEM_MINUTES = 5;

const KIND_ORDER: Record<PlanItemKind, number> = {
  add_material: 0,
  assess_now: 1,
  core_concept: 2,
  practice: 3,
  self_explain: 4,
};

const STATUS_RANK: Record<TopicStatus, number> = {
  weak: 1,
  not_enough_evidence: 2,
  needs_review: 3,
  medium: 4,
  strong: 9,
};

export function effectiveImportance(topic: TopicState): { weight: number; basis: string } {
  if (topic.importanceOverride !== null && topic.importanceOverride !== undefined) {
    return { weight: topic.importanceOverride, basis: "manual override you set on the topic map" };
  }
  if (topic.ppWeight !== null && topic.ppWeight !== undefined) {
    const w = topic.ppWeight;
    const basis =
      w === 0
        ? "no questions in your past paper map to this topic (weighting basis, not a guarantee)"
        : `${w} past-paper question${w === 1 ? "" : "s"} map to this topic (weighting basis, not a guarantee)`;
    return { weight: w, basis };
  }
  return { weight: 1, basis: "default equal weight (no usable past-paper signal)" };
}

function parentDepth(topicId: string, byId: Map<string, TopicState>, seen: Set<string> = new Set()): number {
  const t = byId.get(topicId);
  if (!t || t.parents.length === 0 || seen.has(topicId)) return 0;
  seen.add(topicId);
  return 1 + Math.max(...t.parents.map((p) => parentDepth(p, byId, seen)));
}

function tasksForStatus(ta: TopicAssessment, hasLearningMaterial: boolean): PlanItemKind[] {
  // "No material" for planning = no LEARNING material (notes/textbook chunks).
  // A syllabus line or past-paper mention is course structure, not study
  // material — the honest next step for such a topic is add_material.
  const noMaterial = !hasLearningMaterial && ta.coverage.bankQuestions === 0;
  switch (ta.status) {
    case "weak":
      return noMaterial ? ["add_material"] : ["core_concept", "practice", "self_explain"];
    case "medium":
      return noMaterial ? ["add_material"] : ["core_concept", "practice"];
    case "needs_review":
      return ["assess_now"];
    case "not_enough_evidence":
      return noMaterial ? ["add_material"] : ["assess_now"];
    case "strong":
      return [];
  }
}

const ITEM_TITLES: Record<PlanItemKind, (t: TopicState) => string> = {
  add_material: (t) => `Add learning material for “${t.title}”`,
  assess_now: (t) => `Take a targeted assessment on “${t.title}”`,
  core_concept: (t) => `Rebuild the core concepts (read from your own sources) — ${t.title}`,
  practice: (t) => `Work through a practice set — ${t.title}`,
  self_explain: (t) => `Self-explain: write the key ideas from memory, then check them against your notes — ${t.title}`,
};

export function buildPlan(opts: {
  ws: Workspace;
  report: GapReport;
  availableMinutes: number;
  examDate: string | null;
  nowIso: string;
  previousPlan: Plan | null;
}): Plan {
  const { ws, report, availableMinutes, examDate, nowIso, previousPlan } = opts;
  const byId = new Map(ws.topics.map((t) => [t.id, t]));

  type Entry = { topic: TopicState; ta: TopicAssessment; rank: number; weight: number; basis: string; hasLearning: boolean };
  // Learning material = notes/textbook document chunks mapped to the topic.
  const learningByTopic = new Map<string, number>();
  for (const c of ws.chunks) {
    if (!c.active || !c.topicId) continue;
    const kind = ws.documents.find((d) => d.id === c.documentId)?.kind;
    if (kind === "notes" || kind === "textbook") {
      learningByTopic.set(c.topicId, (learningByTopic.get(c.topicId) ?? 0) + 1);
    }
  }
  const entries: Entry[] = [];
  for (const ta of Object.values(report.topics)) {
    const topic = byId.get(ta.topicId);
    if (!topic || topic.outOfScope) continue;
    const imp = effectiveImportance(topic);
    entries.push({
      topic,
      ta,
      rank: STATUS_RANK[ta.status],
      weight: imp.weight,
      basis: imp.basis,
      hasLearning: (learningByTopic.get(topic.id) ?? 0) > 0,
    });
  }

  entries.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const d = parentDepth(a.topic.id, byId) - parentDepth(b.topic.id, byId);
    if (d !== 0) return d; // prerequisites first within the same band
    return b.weight - a.weight || a.topic.title.localeCompare(b.topic.title);
  });

  // Materialise item specs
  let order = 0;
  let specs: PlanItem[] = [];
  const examToday =
    examDate !== null &&
    (new Date(examDate).getTime() - new Date(nowIso).getTime()) / 86400000 <= 1.5;

  for (const e of entries) {
    const kinds = tasksForStatus(e.ta, e.hasLearning);
    for (const kind of kinds) {
      const topChunks = ws.chunks.filter((c) => c.active && c.topicId === e.topic.id).slice(0, 2);
      const citations = topChunks.map((c) => {
        const firstSentence = c.text.split(/(?<=[.!?])\s+/).filter(Boolean)[0] ?? c.text.slice(0, 120);
        const doc = ws.documents.find((d) => d.id === c.documentId);
        return {
          documentTitle: doc?.title ?? "Uploaded material",
          locator: c.locator,
          quote: firstSentence.slice(0, 200),
          documentId: c.documentId,
        };
      });
      const why =
        `${STATUS_LABELS[e.ta.status]} — ${e.ta.reasons[0] ?? "evidence-based priority"}` +
        ` · Exam weight: ${e.basis}`;
      const base = examToday ? 5 : BASE_MINUTES[kind];
      specs.push({
        id: `pi_${e.topic.id}_${kind}`,
        topicId: e.topic.id,
        topicTitle: e.topic.title,
        order: order++,
        minutes: base,
        kind,
        title: ITEM_TITLES[kind](e.topic),
        why,
        citations,
        done: false,
        doneAt: null,
      });
    }
  }

  // Time-budget allocation: never exceed availableMinutes.
  // Items scaled below MIN_ITEM_MINUTES are dropped (lowest priority first).
  // 0 available minutes => no items, explicit note.
  let note: string | null = null;
  if (availableMinutes <= 0) {
    note = "No revision tasks allocated — zero minutes available.";
    // still materialise specs so the dashboard shows "no plan" rather than empty
    const totalBase = specs.reduce((s, i) => s + i.minutes, 0);
    return {
      id: `plan_v${(previousPlan?.version ?? 0) + 1}`,
      version: previousPlan?.version + 1 ?? 1,
      createdAt: nowIso,
      budgetMinutes: 0,
      examDate,
      basedOnReportId: report.id,
      items: [],
      status: "active",
      whatChanged: previousPlan
        ? { added: [], removed: [], retimed: [], reason: "Plan discarded: 0 minutes available." }
        : { added: [], removed: [], retimed: [], reason: "No plan built: 0 minutes available." },
      note,
    };
  }

  const totalBase = specs.reduce((s, i) => s + i.minutes, 0);
  let factor = totalBase > availableMinutes ? availableMinutes / totalBase : 1;
  let used = 0;

  // Scale all items, then drop those below the minimum floor.
  for (const item of specs) {
    const scaled = Math.max(MIN_ITEM_MINUTES, Math.round((item.minutes * factor) / 5) * 5);
    item.minutes = scaled;
    used += scaled;
  }

  // Drop lowest-priority items (last in sorted order) that can't meet the floor.
  // Re-accumulate used after each drop until all remaining items fit.
  let overflow = used - availableMinutes;
  while (overflow > 0 && specs.length > 0) {
    const tail = specs.pop()!;
    used -= tail.minutes;
    overflow = used - availableMinutes;
  }

  // If after dropping everything still doesn't fit (shouldn't happen since MIN_ITEM_MINUTES * n <= available), reset.
  if (overflow > 0) {
    // All items dropped; keep nothing.
    specs = [];
    used = 0;
    note = `Your ${availableMinutes} available minutes are insufficient for any tasks (minimum ${MIN_ITEM_MINUTES} min per task).`;
  } else if (totalBase <= availableMinutes) {
    note = `Full plan fits your budget (${totalBase} of ${availableMinutes} available minutes).`;
  } else {
    // Re-sort after potential drops; remaining items are already ranked by priority.
    note = `Fit to your ${availableMinutes} available minutes — scaled from ${Math.round(totalBase)} min; ${specs.length} task(s) allocated.`;
  }

  // what-changed summary vs previous active plan
  let whatChanged: Plan["whatChanged"] = null;
  if (previousPlan) {
    const prevTopics = new Map<string, number>();
    for (const it of previousPlan.items) prevTopics.set(it.topicId, (prevTopics.get(it.topicId) ?? 0) + it.minutes);
    const curTopics = new Map<string, number>();
    for (const it of specs) curTopics.set(it.topicId, (curTopics.get(it.topicId) ?? 0) + it.minutes);
    const added: { topicId: string; title: string }[] = [];
    const removed: { topicId: string; title: string }[] = [];
    const retimed: { topicId: string; title: string; from: number; to: number }[] = [];
    for (const [tid, mins] of curTopics) {
      if (!prevTopics.has(tid)) {
        added.push({ topicId: tid, title: byId.get(tid)?.title ?? tid });
      } else if (prevTopics.get(tid) !== mins) {
        retimed.push({ topicId: tid, title: byId.get(tid)?.title ?? tid, from: prevTopics.get(tid)!, to: mins });
      }
    }
    for (const [tid, mins] of prevTopics) {
      if (!curTopics.has(tid)) removed.push({ topicId: tid, title: byId.get(tid)?.title ?? tid });
    }
    const nAttempts = ws.attempts.filter((a) => a.status === "submitted").length;
    whatChanged = {
      added,
      removed,
      retimed,
      reason: `Replanned from the latest gap report using ${nAttempts} submitted attempt(s)${examToday ? " in quick-review mode (exam imminent)" : ""}.`,
    };
  }

  const version = (previousPlan?.version ?? 0) + 1;
  return {
    id: `plan_v${version}`,
    version,
    createdAt: nowIso,
    budgetMinutes: availableMinutes,
    examDate,
    basedOnReportId: report.id,
    items: specs,
    status: "active",
    whatChanged,
    note,
  };
}
