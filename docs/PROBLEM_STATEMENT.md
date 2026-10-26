# Problem Statement

## GapFinder AI: Evidence-Backed Learning Gap Diagnosis

### Overview
GapFinder AI is a web application that helps students identify their learning gaps before an exam. The system takes a student's syllabus, study notes, and past papers, constructs a topic map, generates assessment questions grounded in the student's own material, and produces an evidence-backed gap report and a time-budgeted revision plan.

### Core Problem
Students often discover too late that they have fundamental misunderstandings in a subject. Traditional "chat with your PDF" tools provide answers but don't diagnose gaps. GapFinder's main output is a **diagnosis**, not answers — and it has the honesty to say *"Not enough evidence yet"* when the data can't support a label.

### Mandatory Requirements (from plan doc)
- **Next.js + TypeScript** is mandatory for the complete project
- Chat must not be the main product — diagnosis is the main output
- Mandatory deliverables: GitHub repo, hosted app, fixed judge demo credentials, preloaded sample syllabus/material, docs (problem statement, architecture diagram, RAG pipeline, AI workflow, limitations/future work)
- Mandatory AI features: RAG with citations, question generation from retrieved content, answer evaluation explaining why right/wrong, gap analysis to topic-level weaknesses, adaptive plan generation, and clear retrieval/generation separation (retrieval may never decide learner statuses)
- Every generated question must carry a citation to a stored source location; citation IDs validated server-side; answer-revealing snippets hidden until submission
- Demo credentials required for judging; sample material preloaded so judges can try immediately

### AI Feature Requirements
| Responsibility | Deterministic | LLM (optional) |
|---|---|---|
| Retrieval | TF-IDF keyword search over the authorised workspace only | — |
| Question generation | Anchor-first cloze from chunk sentences (`autogen-v1`) + seeded validated bank (`bank-v1`) | Higher-quality drafting, same validation gate |
| Answer evaluation | Rubric concept matching + why-earned/lost rationale | Optional short-answer scoring (fail-safe) |
| Gap analysis | **None** — pure threshold policy (`src/lib/policy.ts`) | Never touches status rules |
| Plan generation | Priority + knapsack-lite time allocation | Only phrasing, never time/priority |
| Explain topic | Extractive answer with `[n]` citations | Optional fluent rewrite (grounded) |

### Key Design Decisions
1. **Retrieval vs. Generation Separation**: The retrieval service selects evidence chunks; the generation service may only use those citations. Never merge the two roles.
2. **Diagnosis is Purely Deterministic**: Topic statuses are computed solely from assessed responses via `src/lib/policy.ts`. No LLM participates in deciding a topic status (plan §12 / §25.3).
3. **Answer Evaluation States**: Every response is persisted with an explicit state — never a silent "wrong": `correct`, `incorrect`, `partial`, `skipped`, `dont_know`, `needs_review`, `invalid`.
4. **Citation Policy**: Quiz-time payloads contain only `document title + locator` — the anchor quote is hidden until submission (§25.4). After submission, the evidence trail shows the exact quote.
5. **Plans are Append-Only History**: Each new gap report supersedes the previous plan version; the dashboard shows a "What changed?" diff. Completing a task records *activity only*, not mastery.
6. **Honest Limitations**: Scanned/image PDFs are rejected with a clear reason, not silently "processed". The local JSON store does not persist on serverless platforms (Supabase swap documented but not wired).

### Open Issues & Future Work
- pgvector hybrid retrieval + re-ranking
- LMS integration (Canvas, Blackboard)
- Multi-language material support
- Spaced-repetition scheduling of reassessments
- Teacher-level analytics
- Richer rubric authoring