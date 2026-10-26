// GapFinder AI — domain types.
// JSON-serialisable shapes persisted in the local store. Kept framework-free so
// the diagnosis/planner/grading logic is pure and testable.

export type ID = string;

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "short";
export type QuestionSource = "bank" | "auto";
export type AttemptMode = "diagnostic" | "deep_dive" | "reassess";
export type AttemptStatus = "in_progress" | "submitted";
export type TopicStatus =
  | "strong"
  | "medium"
  | "weak"
  | "not_enough_evidence"
  | "needs_review";
export type EvaluationKind =
  | "correct"
  | "partial"
  | "incorrect"
  | "skipped"
  | "dont_know"
  | "needs_review"
  | "invalid";
export type DocKind = "syllabus" | "notes" | "textbook" | "past_paper" | "other";
export type DocStatus = "ready" | "unsupported" | "failed" | "processing";

// --- Sources -----------------------------------------------------------------

export interface Citation {
  chunkId: ID;
  documentId: ID;
  documentTitle: string;
  locator: string; // e.g. "§ Forces and free-body diagrams"
  quote: string; // anchor sentence (only revealed after submission for quiz items)
}

export interface Chunk {
  id: ID;
  documentId: ID;
  documentVersion: number;
  index: number;
  text: string;
  locator: string;
  topicId: ID | null; // null = unmapped (flagged for review in Materials)
  active: boolean;
  embeddingModel: string; // e.g. "keyword-v1"
}

export interface DocumentFile {
  id: ID;
  fileName: string;
  title: string;
  kind: DocKind;
  status: DocStatus;
  version: number;
  sizeBytes: number;
  addedAt: string;
  notes: string; // honest status / failure explanation
  extractionStatus?: string;
}

export interface TopicState {
  id: ID;
  title: string;
  keywords: string[];
  origin: "syllabus" | "uploaded";
  outOfScope: boolean;
  importanceOverride: number | null; // manual correction (demo-friendly)
  ppWeight: number | null; // past-paper mention basis (§25.8), null = unknown
  parents: ID[]; // prerequisite topic ids
  syllabusRef: string;
}

// --- Questions ---------------------------------------------------------------

export interface MCQOption {
  id: string;
  label: string;
  whyWrong?: string; // shown when the student picks it
}

export interface RubricConcept {
  id: string;
  label: string;
  aliases: string[];
  citationRef: number; // index into question.citations
}

export interface Question {
  id: ID;
  version: number;
  topicId: ID;
  type: QuestionType;
  difficulty: Difficulty;
  source: QuestionSource;
  stem: string;
  options: MCQOption[];
  answerOptionId: ID | null; // mcq only
  expectedConcepts: RubricConcept[]; // short only
  explanationRight: string; // why the answer is right
  citations: Citation[];
  validationStatus: "validated" | "needs_review" | "invalid";
  validationIssues: string[];
  generationVersion: string; // e.g. "bank-v1" | "autogen-v1" | "gemini-1"
}

// --- Attempts ----------------------------------------------------------------

export interface ResponseRecord {
  questionId: ID;
  state: "answered" | "skipped" | "dont_know"; // distinct states (§11 of plan)
  value: string | null; // option id or short-answer text
  submitted: boolean;
}

export interface EvaluationRecord {
  questionId: ID;
  kind: EvaluationKind; // skipped/dont_know/needs_review/invalid are NOT "wrong"
  score: number | null; // 0..1
  rationale: string;
  rubricHits: string[]; // concept ids
  rubricMisses: string[]; // concept ids
  independent: boolean; // false when item was reused from an earlier attempt
}

export interface Attempt {
  id: ID;
  mode: AttemptMode;
  status: AttemptStatus;
  topicIds: ID[];
  questionIds: ID[];
  createdAt: string;
  submittedAt: string | null;
  responses: Record<ID, ResponseRecord>;
  evaluations: Record<ID, EvaluationRecord>;
  // computed at submit time: per attempt per topic: n_valid, n_correct, n_partial, n_wrong, independent
  info: string; // honest note about mode/reuses, shown to the student
}

// --- Diagnosis ---------------------------------------------------------------

export interface TopicAssessment {
  topicId: ID;
  status: TopicStatus;
  reasons: string[];
  n_valid: number; // correct + incorrect (excludes skip/dk/invalid/needs_review)
  n_correct: number;
  n_partial: number;
  n_wrong: number;
  n_skip: number;
  n_dontKnow: number;
  n_hardCorrect: number;
  n_needsReview: number;
  n_repeat: number;
  validRate: number | null; // proportion correct of valid items
  coverage: {
    syllabus: boolean;
    materialChunks: number;
    bankQuestions: number;
    activeQuestions: number;
  };
  evidenceIds: string[]; // question ids backing the status
}

export interface GapReport {
  id: ID;
  createdAt: string;
  policyVersion: string;
  attemptIds: ID[];
  topics: Record<ID, TopicAssessment>;
  superseded: boolean;
}

export interface TopicStatusPublic {
  topicId: ID;
  title: string;
  status: TopicStatus;
}

// --- Planning ----------------------------------------------------------------

export type PlanItemKind =
  | "add_material" // weak topic but no usable material — honest blocking task
  | "assess_now" // topic lacks evidence — generate a targeted mini quiz
  | "core_concept"
  | "practice"
  | "self_explain";

export interface PlanCitation {
  documentTitle: string;
  locator: string;
  quote: string;
  documentId: ID;
}

export interface PlanItem {
  id: ID;
  topicId: ID;
  topicTitle: string;
  order: number;
  minutes: number;
  kind: PlanItemKind;
  title: string;
  why: string;
  citations: PlanCitation[];
  done: boolean;
  doneAt: string | null;
}

export interface PlanWhatChanged {
  added: { topicId: ID; title: string }[];
  removed: { topicId: ID; title: string }[];
  retimed: { topicId: ID; title: string; from: number; to: number }[];
  reason: string;
}

export interface Plan {
  id: ID;
  version: number;
  createdAt: string;
  budgetMinutes: number;
  examDate: string | null;
  basedOnReportId: ID;
  items: PlanItem[];
  status: "active" | "superseded";
  whatChanged: PlanWhatChanged | null;
  note: string | null; // allocator message (e.g. "no time available")
}

// --- Workspace / store -------------------------------------------------------

export interface ActivityEvent {
  at: string;
  type: string; // e.g. "plan_updated", "reassess_finished", "task_done"
  detail: string;
}

export interface UserProfile {
  id: ID;
  email: string;
  name: string;
  kind: "demo" | "regular";
  passwordHash: string;
  createdAt: string;
}

export interface Workspace {
  userId: ID;
  courseTitle: string;
  subject: string;
  examDate: string | null;
  pastPaperImportanceBasis: string; // honesty label for importance weights
  documents: DocumentFile[];
  chunks: Chunk[];
  topics: TopicState[];
  topicMapVersion: number;
  questions: Question[];
  attempts: Attempt[];
  reports: GapReport[];
  plans: Plan[];
  events: ActivityEvent[];
}

export interface StoreShape {
  users: Record<string, UserProfile>;
  workspaces: Record<string, Workspace>;
}
