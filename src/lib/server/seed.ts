// Demo seeding (§25.1 / §25.2): fixed judge credentials + a seeded course so a
// judge can view a real gap report immediately, plus a second isolated demo
// user for cross-user checks. Everything here is deterministic.
import type { Attempt, ResponseRecord, StoreShape, TopicState, UserProfile, Workspace } from "@/lib/types";
import { SEED_NOTES, SEED_PAST_PAPER, SEED_SYLLABUS, SEED_TOPICS } from "@/lib/seedContent";
import { chunkDocument } from "@/lib/chunking";
import { mapChunkToTopic, TOPIC_MAP_THRESHOLD } from "@/lib/retrieval";
import { buildBankQuestions } from "@/lib/questionbank";
import { gradeAttempt } from "@/lib/grading";
import { buildGapReport, pushReport } from "@/lib/diagnosis";
import { hashPassword } from "@/lib/server/auth";

function addDocument(
  ws: Workspace,
  spec: { id: string; kind: "syllabus" | "notes" | "past_paper"; title: string; fileName: string; text: string }
) {
  const { chunks } = chunkDocument({ documentId: spec.id, documentVersion: 1, title: spec.title, text: spec.text });
  ws.documents.push({
    id: spec.id,
    fileName: spec.fileName,
    title: spec.title,
    kind: spec.kind,
    status: "ready",
    version: 1,
    sizeBytes: spec.text.length,
    addedAt: new Date().toISOString(),
    notes: "Seeded with the demo course.",
    extractionStatus: "extracted (plain text)",
  });
  for (const chunk of chunks) {
    // map chunk to topic via keyword overlap; below threshold => unmapped flag
    const guess = mapChunkToTopic(chunk.text, ws.topics);
    const mapped = guess.confidence >= TOPIC_MAP_THRESHOLD ? guess.topicId : null;
    if (!mapped) {
      console.log(`[seed] chunk unmapped → flagged for review: ${chunk.locator}`);
    }
    let chunkIdSuffix = 1;
    let chunkId = `${spec.id}_${chunkIdSuffix++}`;
    while (ws.chunks.some((c) => c.id === chunkId)) chunkId = `${spec.id}_${chunkIdSuffix++}`;
    ws.chunks.push({ ...chunk, id: chunkId, topicId: mapped });
  }
}

/** Past-paper importance basis (§25.8): count Q-blocks mapping to each topic. */
function importanceFromPastPaper(paperText: string, topics: { id: string; keywords: string[] }[]): Record<string, number> {
  const blocks = paperText.split(/(?=Q\d+\.)/).filter((b) => /Q\d+\./.test(b.slice(0, 6)));
  const counts: Record<string, number> = {};
  for (const t of topics) counts[t.id] = 0;
  for (const block of blocks) {
    const tokens = block.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/);
    let best: { id: string; hits: number } | null = null;
    for (const t of topics) {
      let hits = 0;
      for (const kw of t.keywords) {
        const parts = kw.toLowerCase().split(/\s+/);
        if (parts.some((p) => tokens.includes(p))) hits += 1;
      }
      if (hits > 0 && (!best || hits > best.hits)) best = { id: t.id, hits };
    }
    if (best) counts[best.id] += 1;
  }
  return counts;
}

function buildDemoWorkspace(userId: string): Workspace {
  const ws: Workspace = {
    userId,
    courseTitle: "Physics 101 — Motion & Energy (demo course)",
    subject: "Physics",
    examDate: null,
    pastPaperImportanceBasis:
      "Importance basis: how many questions in “Physics 101 — Practice paper 1 (no answers provided)” map to each topic. Answer keys are absent — past papers are used as a weighting signal only, never as ground truth (§25.8).",
    documents: [],
    chunks: [],
    topics: [],
    topicMapVersion: 1,
    questions: [],
    attempts: [],
    reports: [],
    plans: [],
    events: [],
  };

  // Documents first (chunks need to exist before question resolution),
  // then topics, then re-map chunks once topics exist.
  const docsToLoad = [
    { id: "doc_syllabus", kind: "syllabus" as const, title: SEED_SYLLABUS.title, fileName: SEED_SYLLABUS.fileName, text: SEED_SYLLABUS.text },
    { id: "doc_notes", kind: "notes" as const, title: SEED_NOTES.title, fileName: SEED_NOTES.fileName, text: SEED_NOTES.text },
    { id: "doc_paper", kind: "past_paper" as const, title: SEED_PAST_PAPER.title, fileName: SEED_PAST_PAPER.fileName, text: SEED_PAST_PAPER.text },
  ];

  // topics (with past paper importance basis)
  const importance = importanceFromPastPaper(
    SEED_PAST_PAPER.text,
    SEED_TOPICS.map((t) => ({ id: t.id, keywords: t.keywords }))
  );
  for (const t of SEED_TOPICS) {
    ws.topics.push({
      id: t.id,
      title: t.title,
      keywords: t.keywords,
      origin: "syllabus",
      outOfScope: false,
      importanceOverride: null,
      ppWeight: importance[t.id] ?? 0,
      parents: t.parents,
      syllabusRef: t.syllabusRef,
    });
  }
  ws.topicMapVersion = 1;

  for (const d of docsToLoad) addDocument(ws, d);

  // Question bank (citations resolved + anchor-verified at seed time)
  const resolve = (docId: string, locator: string) => {
    const c = ws.chunks.find((x) => x.documentId === docId && x.locator === locator && x.active);
    return c ? { chunkId: c.id, text: c.text } : null;
  };
  ws.questions = buildBankQuestions(resolve);
  const invalid = ws.questions.filter((q) => q.validationStatus !== "validated");
  if (invalid.length > 0) {
    console.error(`[seed] ${invalid.length} bank question(s) failed validation:`, invalid.flatMap((q) => q.validationIssues));
  }

  // ---- Baseline "Sample Student" attempt (§25.2 realistic mix) ----
  // Strong: kin, graph · Medium: newton, forces · Weak: energy · NEE: conserve, ucm
  const sample: Record<string, ResponseRecord> = {
    q_kin_1: { questionId: "q_kin_1", state: "answered", value: "o3", submitted: true },
    q_kin_3: {
      questionId: "q_kin_3", state: "answered", submitted: true,
      value: "Distance is the total path length travelled and is always positive, while displacement is the change in position in a straight line including direction. If the cyclist returns to her starting point her displacement is zero even though the distance ridden is not.",
    },
    q_graph_1: { questionId: "q_graph_1", state: "answered", value: "o1", submitted: true },
    q_graph_3: {
      questionId: "q_graph_3", state: "answered", submitted: true,
      value: "A straight sloping line has a constant gradient, so the velocity is constant. A curved line means the velocity is changing, so the object is accelerating or decelerating.",
    },
    q_newton_1: { questionId: "q_newton_1", state: "answered", value: "o1", submitted: true },
    q_newton_3: {
      questionId: "q_newton_3", state: "answered", submitted: true,
      value: "The force of the foot on the ball is equal and opposite to the force of the ball on the foot.",
    },
    q_forces_1: { questionId: "q_forces_1", state: "answered", value: "o2", submitted: true },
    q_forces_3: {
      questionId: "q_forces_3", state: "answered", submitted: true,
      value: "You draw the object as a single figure and every force on it is an arrow away from it.",
    },
    q_energy_1: { questionId: "q_energy_1", state: "answered", value: "o2", submitted: true },
    q_energy_3: { questionId: "q_energy_3", state: "answered", submitted: true, value: "E of a battery." },
    q_conserve_1: { questionId: "q_conserve_1", state: "answered", value: "o1", submitted: true },
    q_conserve_3: { questionId: "q_conserve_3", state: "dont_know", value: null, submitted: true },
  };

  const baseline: Attempt = {
    id: "attempt_baseline",
    mode: "diagnostic",
    status: "submitted",
    topicIds: SEED_TOPICS.filter((t) => t.id !== "t_ucm").map((t) => t.id),
    questionIds: Object.keys(sample),
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    submittedAt: new Date().toISOString(),
    responses: sample,
    evaluations: gradeAttempt(sample, ws.questions, new Set()),
    info: "Seeded baseline assessment from a sample student, so the judge can view a complete gap report immediately (§25.2).",
  };
  ws.attempts.push(baseline);

  const report = buildGapReport(ws, new Date().toISOString());
  pushReport(ws, report);
  ws.events.push({
    at: new Date().toISOString(),
    type: "workspace_seeded",
    detail: "Seeded demo course, sample material and baseline assessment.",
  });
  return ws;
}

export function emptyWorkspaceFor(userId: string, _name: string): Workspace {
  return {
    userId,
    courseTitle: "",
    subject: "",
    examDate: null,
    pastPaperImportanceBasis: "",
    documents: [],
    chunks: [],
    topics: [],
    topicMapVersion: 1,
    questions: [],
    attempts: [],
    reports: [],
    plans: [],
    events: [],
  };
}

export async function buildSeedState(): Promise<StoreShape> {
  const judge: UserProfile = {
    id: "u_judge",
    email: "judge@demo.app",
    name: "Demo Judge",
    kind: "demo",
    passwordHash: hashPassword("gapfinder-demo"),
    createdAt: new Date().toISOString(),
  };
  const student: UserProfile = {
    id: "u_student",
    email: "student@demo.app",
    name: "Student Two (isolation tests)",
    kind: "demo",
    passwordHash: hashPassword("demo-1234"),
    createdAt: new Date().toISOString(),
  };
  return {
    users: { [judge.id]: judge, [student.id]: student },
    workspaces: {
      [judge.id]: buildDemoWorkspace(judge.id),
      [student.id]: emptyWorkspaceFor(student.id, student.name),
    },
  };
}
