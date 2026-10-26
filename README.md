# GapFinder AI

**Find the problem before the student asks.** GapFinder takes a student's syllabus, notes and past papers, turns them into a topic map, assesses the student with questions grounded in **their own material**, and produces an evidence-backed gap report and a time-budgeted revision plan that adapts as they improve.

Unlike "chat with your PDF" tools, GapFinder's main output is a **diagnosis, not answers** — and it has the honesty to say *"Not enough evidence yet"* when the data can't support a label.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

**Judge demo credentials (fixed, preloaded course — plan §25.1):**

| Account | Password | Contents |
|---|---|---|
| `judge@demo.app` | `gapfinder-demo` | Seeded Physics 101 course + baseline assessment + report |
| `student@demo.app` | `demo-1234` | Empty workspace (user-isolation checks) |

Zero API keys are required: the app runs fully offline using a deterministic
retrieval + question-generation + grading pipeline. Optional LLM providers
(Gemini / Groq) plug in via `.env` (see `.env.example`) as a *fail-safe upgrade* —
they never change how topics are diagnosed.

### Acceptance checks

- In-app: Dashboard → **Quality checks → Run** (citation grounding, diagnosis policy on synthetic profiles, planner budget, MCQ sanity).
- Runtime (isolation + double-submit): `npm run eval:demo` while the dev server runs.

> Deployment note: the MVP store is a local JSON file (`.data/`, auto-seeded). Vercel cannot persist local files, so for a hosted demo run it as a persistent single instance, or swap the documented `getStore/mutate` seam to Supabase/Postgres — see `docs/ARCHITECTURE.md`.

---

## The loop (§19 judge demo story)

1. Sign in as the judge → dashboard shows the preloaded course and **next recommended action**.
2. **Materials** — syllabus + notes + past paper are indexed into chunks with source coverage; try uploading a text/PDF (scanned PDFs are **honestly rejected**).
3. **Assessments** — MCQ + short-answer questions, each citing the chunk it came from (answer-revealing quotes stay hidden until submission). Skipped / "I don't know" are **never** counted as wrong.
4. **Gap report** — per-topic `Strong / Medium / Weak / Not enough evidence / Needs review` with the reason, counts, and a full evidence trail (question → your answer → why → source quote).
5. **Revision plan** — deterministic priority + time allocation that *fits the minutes you give it*, each task explaining its why; completing a task records activity, **not mastery**.
6. **Reassess** — fresh items generated from your material, statuses update, plan auto-supersedes with a **"What changed?"** summary.
7. **Progress** — per-topic baseline → latest with cautious labelling of repeat evidence.

---

## Where retrieval / generation / diagnosis live (§25.3)

| Responsibility | Deterministic | LLM (optional) |
|---|---|---|
| Retrieval | TF-IDF keyword search over the *authorised workspace only* | — |
| Question generation | Anchor-first cloze from chunk sentences (`autogen-v1`) + seeded validated bank (`bank-v1`) | Higher-quality drafting, same validation gate |
| Answer evaluation | Rubric concept matching + why-earned/lost rationale | Optional short-answer scoring (fail-safe) |
| Gap analysis | **None** — pure threshold policy (`src/lib/policy.ts`) | Never touches status rules |
| Plan generation | Priority + knapsack-lite time allocation | Only phrasing, never time/priority |
| Explain topic | Extractive answer with `[n]` citations | Optional fluent rewrite (grounded) |

Full details: [`docs/RAG_PIPELINE.md`](docs/RAG_PIPELINE.md) · [`docs/AI_WORKFLOW.md`](docs/AI_WORKFLOW.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Repo layout

```
src/lib/            domain core (types, policy, retrieval, autogen, grading, planner, diagnosis)
src/lib/server/     store, auth, seeding (fs-backed, Supabase-swap seam)
src/lib/ai/         optional LLM provider adapters (fail-safe)
src/app/api/        route handlers (auth/me/course/upload/topics/quiz/attempt/report/plan/explain/progress/eval)
src/app/app/        protected UI pages (dashboard, materials, topic map, quiz, report, plan, explain, progress)
src/middleware.ts   cookie presence check (real authz is per-route, server-side)
scripts/            runtime acceptance checks (npm run eval:demo)
docs/               architecture, RAG pipeline, AI workflow docs
```

## Honest limitations (MVP)

- Plain text + readable text-PDF ingestion; scanned/handwritten/diagram-heavy PDFs are rejected with a clear reason.
- Local file store — single-instance only (Supabase/pgvector swap documented, not wired).
- Keyword retrieval (no vectors yet); retrieval quality measured by the eval suite.
- Diagnosis thresholds are provisional heuristics calibrated to the demo course, published in one file and checked against synthetic profiles — not validated psychometrics.
- Question generation (offline mode) is cloze-style: solid and always cited, but plain. LLM providers upgrade quality without changing the gates.

## Future enhancements (§ future work)

Class-level analytics for teachers · spaced-repetition scheduling of reassessments · LMS integration · multi-language material · richer rubric authoring · pgvector hybrid retrieval + re-ranking.
