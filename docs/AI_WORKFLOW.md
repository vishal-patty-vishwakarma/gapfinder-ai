# AI Workflow

## Who decides what

| Task | Deterministic | LLM (optional adapter) | Fail-safe |
|---|---|---|---|
| **Question generation** | Require valid source ids, topic mapping, schema & validation gates | Draft MCQ/short items from retrieved passages | Bank fallback / item invalidated |
| **Answer evaluation** | Persist response states; rubric concept matching; score policy | Optional scoring assist for short answers | Deterministic grading always available |
| **Gap analysis** | Aggregate valid responses; frozen thresholds choose status | **none** — never touches status rules | — |
| **Revision planning** | Priority + time allocation (user's budget) | Only task phrasing | Plan rebuilt without LLM |
| **Topic explanation** | Retrieve authorised chunks; verify citations; compose `[n]` extractive answer | Optional fluent rewrite confined to cited content | Abstain → "not found in your materials" |

Provider selection: `LLM_PROVIDER=offline | gemini | groq` (`.env`). Every LLM call
is optional and fail-safe: on timeout/error/unavailable key the deterministic
path continues unchanged, so a provider outage cannot kill the demo.

## Answer evaluation states (§11)

Every response is persisted with an explicit state — never a silent "wrong":

| Situation | Recorded as |
|---|---|
| MCQ option selected | `correct` / `incorrect` (with *why your option is wrong* + why the key is right) |
| Short answer with partial concepts | `partial` (score = concepts hit / total) |
| Short answer matching nothing (≥30 chars) | `needs_review` — excluded from diagnosis until resolved |
| Skipped | `skipped` (no-signal) |
| "I don't know" | `dont_know` (no-signal, distinct from skipped) |
| Item invalidated / source deleted | `invalid` |
| Reused question from an earlier attempt | `independent=false` — weaker evidence, labelled on the report |

Repeat answers are explicitly **not** independent evidence of mastery (§10).

## Diagnosis policy (v1, `src/lib/policy.ts`)

- Valid item = answered AND graded `correct` / `partial` / `incorrect`.
- `validRate = (correct + partial·0.5) / valid`.
- **Strong**: rate ≥ 0.67 AND depth signal (hard/short item correct) AND (rate = 1.0 or ≥ 3 valid items). An all-easy-MCQ profile cannot be Strong — **guessing is ruled out by design** (eval profile `guessing_student` asserts this).
- **Weak**: rate ≤ 0.4 across ≥ 2 valid items.
- **Medium / Developing**: everything between (mixed evidence; or consistent but un-deep evidence).
- **Not enough evidence**: < 2 valid items; also when evidence is all skipped/don't-know; also syllabus-only topics with no material.
- **Needs review**: unresolved grading/invalid items currently compromising the label.
- Non-negotiables: missing evidence ≠ weakness · failed/invalid items never harm the student · a single easy correct item never proves mastery · every status is traceable to responses, rubrics, question & source versions.

Thresholds are *provisional heuristics*, visible in one file, and asserted on five synthetic learner profiles by the acceptance suite.

## Plan generation (§13)

1. Inputs: latest gap report, topic importance (past-paper mentions with a labelled basis; manual override; equal-weight fallback), available minutes, optional exam date, prerequisite structure.
2. Status ordering: add-material → Weak → Medium/NEE → Needs-review; prerequisites within a band come first.
3. Task shapes: `add_material` (weak topic with no sources — honest blocking task), `assess_now` (missing evidence), `core_concept` / `practice` / `self_explain` (weak: 3 tasks; medium: 2).
4. Time: greedy fit to the declared budget (scaled + trimmed, ≥5-min granularity); exam-imminent → quick-review mode; **0 available minutes → nothing allocated, message says so**.
5. Every item carries `why` (status reason + importance basis) and up to 2 source citations.
6. Each new gap report **supersedes** the previous plan; the dashboard shows a "What changed?" diff (added / removed / re-timed). Completing a task records *activity only* — reassessment evidence, not task completion, changes diagnosis.
