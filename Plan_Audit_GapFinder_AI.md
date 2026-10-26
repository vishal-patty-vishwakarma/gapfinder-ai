# Audit: GapFinder AI Project Plan vs Problem Statement

**Document audited:** `GapFinder_AI_Project_Plan_FINAL.docx` (29 sections, incl. review-driven §25–29)
**Date:** 26 October 2026

---

## 1. Verdict

**Strong — approved with conditions.** The plan covers all 8 required features and all 5 mandatory AI capabilities, honors the Next.js + TypeScript mandate, explicitly defers the chatbot-first experience (matching "the main output must be a diagnosis"), and — unusually for a student plan — builds the exact things judges said they would *check* (retrieval quality, question quality, diagnosis accuracy) via a repeatable eval script (§25.9). The §25 review pass trims scope and explicitly supersedes earlier wording, which is good governance.

Remaining issues are mostly **un-pinned parameters and hackathon-operational risks**, not conceptual gaps. All are fixable before coding.

**Overall score: ~87/100 conceptually. Main risk is operational, not design.**

---

## 2. Requirement Coverage Matrix

| # | Problem Statement Requirement | Plan Coverage | Status |
|---|-------------------------------|---------------|--------|
| 1 | Material upload (syllabus, chapters, notes, past papers, PDF/text) | §3, §9, §16, §25.7 — validation, signed uploads, honest limits on scanned/protected files | ✅ Covered |
| 2 | Topic Map from syllabus | §3, §5, §6, §14 — editable, versioned, coverage indicators | ✅ Exceeds (editable + versioned) |
| 3 | Diagnostic Quiz grounded in own material, with citations | §10, §25.2, §25.4 — mandatory citation rule, server-side citation validation | ✅ Covered (⚠️ quiz-size arithmetic unresolved → P0-1) |
| 4 | Gap Report: weak/medium/strong + reason per rating | §12, §25.2 — plus "Not enough evidence" / "Needs review" states with traceable rationale | ✅ Exceeds |
| 5 | Personalized Revision Plan (gap report + time) | §13, §25.6 — deterministic time-budget allocation, auto-superseding plans, "What changed?" | ✅ Exceeds |
| 6 | Explain-This-Topic Assistant (material-only, cited) | §6, §25.3, §25.4 — retrieval-only, abstention path | ✅ Covered |
| 7 | Progress Dashboard: improvement across attempts, plan updates | §6, §25.6 — plan adaptation strong; improvement visual hedged into vagueness | ⚠️ Partial → P1-5 |
| 8 | Secure Auth + personal docs + demo credentials | §17, §25.1 — fixed creds, per-judge workspace, server-side authz | ✅ Covered (⚠️ demo-account model contradiction → P0-4) |

### Mandatory AI Features

| AI Feature | Plan Coverage | Status |
|------------|---------------|--------|
| RAG with citations | §9, §25.4 — untrusted-content framing, citation IDs verified server-side | ✅ Strong |
| Question generation from retrieval (not model memory) | §10, §25.3 — source-chunk-bound generation + validation gates | ✅ Strong |
| Answer evaluation (explains why right/wrong) | §11, §25.5 — rubrics, partial credit, visible earn/lose rationale | ✅ Strong |
| Gap analysis (quiz results → topic weaknesses) | §12, §25.3 — deterministic policy, not LLM-invented labels | ✅ Strong |
| Plan generation & adaptation | §13, §25.6 — deterministic planner + versioned plan updates | ✅ Strong |
| Clarity: where retrieval vs generation, kept separate | §7, §9, §25.3 — explicit deterministic-vs-LLM responsibility table | ✅ Judge-ready |

### Mandates & Deliverables

| Item | Status |
|------|--------|
| Next.js + TypeScript mandatory | ✅ Core, not optional (§8, §25.7) |
| Supabase/Postgres/pgvector/NextAuth-style stack | ✅ Matches suggested stack (§8) |
| Hosted app + demo credentials + preloaded sample course | ✅ §19, §25.1, §28 |
| Docs: problem statement, architecture diagram, RAG pipeline, AI workflow, limitations | ⚠️ Mostly (§28 dropped the word "diagram"; RAG constants unspecified; see P0-3, P2-10) |

---

## 3. What the Plan Does Exceptionally Well

1. **Diagnosis-first thesis is structurally enforced** — deterministic diagnosis engine (§8, §12) means no LLM-only topic labels; "Not enough evidence" is a first-class product state, not an error path. This is the correct answer to "a student can't ask about a gap they don't know they have."
2. **Retrieval/generation separation is explicit and demonstrable** (§25.3 table) — exactly the "clarity on AI usage" judges are told to probe.
3. **Citation integrity** — citations must resolve to stored chunk IDs checked server-side; model-returned citation IDs are never trusted (§25.4). This kills the most common "chat-with-PDF" failure mode.
4. **Honest answer-evaluation semantics** (§11) — skip, don't-know, disputed, needs-review and provider-failure states are distinct from "wrong," and the demo script shows that explicitly (§19). Genuinely differentiated.
5. **Separates content model from learner model** (§7) — embeddings measure relevance, not understanding; the plan states this outright.
6. **Versioning everywhere** (§14) — sources, topic maps, questions, rubrics, reports are version-bound; old reports are never silently rewritten.
7. **Security posture above demo bar** (§17) — server-side authz on every request, RLS-with-service-role caveat, prompt-injection defense for both documents *and* student answers, quotas, XSS in extracted text.
8. **Self-aware scope trimming** (§25, §26) — parallel worker leasing, audit subsystems and embedding migrations are deferred with an explicit precedence rule.

---

## 4. Gaps & Risks (Prioritized)

### P0 — Fix before coding

**P0-1. Quiz-size vs coverage arithmetic is unresolved.**
§25.2 sets "≥3 valid items per diagnosed topic," but a normal syllabus is 15–30 topics → 45–90 questions. Far too long for a live judge demo, and taking fewer topics risks the gap report looking sparse. The plan hints at "assess fewer topics in depth" but gives no concrete numbers.
**Fix:** Freeze a demo inventory at Gate A, e.g.: 10–12 topic demo syllabus; a 20–30 question screening quiz (1–2 items/topic); optional deep-dive follow-up quiz (3 more items) only on weak/ambiguous topics; state explicitly on-screen which topics have full vs screening-level evidence.

**P0-2. No LLM provider decision and no outage fallback.**
Open decision §22-1 acknowledges this, but in a hackathon one provider outage or rate limit = dead demo. Everything in the plan's demo path depends on live generation.
**Fix:** Choose a primary provider *now* (speed/cost: Groq or Gemini free tier), keep the adapter (§8 already provides for it), and pre-generate a **cached demo question pool + report** so the seeded demo flow can run with zero live LLM calls if needed. The seeded synthetic learner profile (§25.2) covers the *diagnosis* side; the questions themselves need a pre-generated pool too.

**P0-3. RAG pipeline has no concrete constants — but the RAG documentation deliverable requires them.**
Chunking strategy exists (§9: heading-first, then overlapping splits), but chunk target size/overlap, embedding model + dimensions, similarity metric, top-k, and keyword/hybrid fallback are all unstated.
**Fix:** Pin defaults, e.g.: heading-first chunking → ~800–1000 char chunks, 10–15% overlap; text-embedding model of chosen provider (supabase pgvector, cosine); top-k 6–8; keyword fallback (or hybrid) when vector recall at a topic < threshold. One paragraph each — needed for the "RAG Pipeline (chunking, embedding, retrieval)" docs deliverable.

**P0-4. Demo-account model contradicts itself.**
§17: "avoid one shared mutable account for every judge." §25.1: fixed judge credentials in README *plus* optional per-judge "Try demo" workspace. With fixed shared credentials, judge writes mutate shared state; these two clauses must resolve to one decision.
**Fix:** Either (a) fixed account is seeded and effectively read-mostly with server-side quota + reset, or (b) "Try demo" provisions a fresh per-session workspace. Pick one before coding; don't ship both half-built.

### P1 — Should fix

**P1-5. Progress "improvement" story is under-specified.**
The problem statement promises "shows improvement across quiz attempts, and the plan updates as the student improves." §25.6 nails the plan-update half; the improvement half is hedged ("compare cautiously...") with no concrete visualization. Over-caution can read as a missing requirement to a judge.
**Fix:** Spec a concrete demo visual: per-topic **baseline quiz score → reassessment score delta** from version-matched/rotated items, with a one-line caveat about comparability. Numbers, not adjectives.

**P1-6. Background processing mechanism is unnamed.**
§25.7 demands staged TypeScript jobs within Vercel's limits but never chooses the mechanism (sync processing for demo-sized files? scheduled function? Inngest/QStash?).
**Fix:** One decision at Gate B. For demo-sized files, synchronous processing inside the route handler is simplest and defensible; document the choice.

**P1-7. Diagnosis thresholds are placeholders until calibrated.**
Fine for a planning doc, but Gate A's exit should include a **frozen threshold table v1** (e.g., Strong = ≥X valid items, ≥Y% correct across ≥Z coverage; Weak = repeated failure across ≥N valid items) tested against the synthetic profiles (§25.9's known-gap check).

**P1-8. Gates have no time budget.**
Gates A–G (§27) are well-ordered but untimed, and the doc punts ("decided once the team and environment are known"). Assign % of total time and a date per gate; make Gate B (judge can finish the core flow) a hard checkpoint at ~40% elapsed to protect demo polish.

**P1-9. Adaptive follow-up questions are mentioned but unspecified.**
§25.2 lists them as an option but gives no states/spec. Either give it a minimal spec (one fixed extra quiz per thin-evidence topic) or **cut it** to protect the core loop.

### P2 — Polish

- **P2-10.** §28's updated deliverables checklist dropped "Architecture **diagram**" (it was in §21). The problem statement explicitly requires an Architecture Diagram — restore it.
- **P2-11.** Run `eval:demo` (§25.9) in CI so retrieval hit rate / question validation pass rate / citation validity are provable, not aspirational.
- **P2-12.** Past-paper frequency importance (§25.8): implement the "basis used" display and the manual-correction path — it's already hinted; make it a checklist item.
- **P2-13.** "Future enhancements" currently lives only in the scope-defer list (§4); the deliverable demands a named **Limitations and Future Enhancements** docs section — §28 has limitations, add the explicit future-work section.
- **P2-14.** Optional enhancement worth documenting (not building if time is short): parse past-paper questions themselves as extra grounded quiz items — currently past papers only feed importance weighting (§25.8) and topic signals (§16). A judge may ask why past questions aren't in the quiz; have the answer ready (missing answer keys → treated as material signal, not ground truth — the plan already says this in §16, good).

---

## 5. Scoring Summary

| Area | Score | Note |
|------|-------|------|
| Feature coverage vs problem statement | 9/10 | All 8 features planned; progress-improvement visual under-specified |
| Mandatory AI features (all 5) | 10/10 | Fully mapped; deterministic/LLM roles separated |
| Retrieval vs generation clarity | 10/10 | §25.3 table is judge-ready |
| Stack mandate (Next.js + TS) | 10/10 | Core throughout |
| Differentiation (diagnosis, not chat) | 10/10 | Chat deferred explicitly (§4, §73) |
| Judge experience | 8/10 | Seeded course + walkthrough strong; account model & provider resilience unresolved |
| Engineering realism | 8/10 | States/versioning/idempotency excellent; concurrency/queueing trimmed sensibly |
| Documentation readiness | 7/10 | Sections exist; concrete parameters, diagram wording, demo arithmetic missing |
| Schedule realism | 6/10 | Gates untimed |
| **Overall** | **~87/100** | Operational risk, not conceptual |

---

## 6. Immediate Next Steps (before coding)

1. **Freeze the demo inventory** (Gate A artifact): 1 subject, 10–12 topics, questions per tier, past-paper sample, expected Weak/Medium/Strong/Not-enough-evidence distribution.
2. **Convert §22's open decisions into a decisions table with chosen values:** provider + offline fallback, demo account model, processing mechanism, RAG constants, threshold table v1.
3. **Patch §28 checklist:** restore "architecture diagram," add "future enhancements" section, add "eval script in CI."
4. **Timebox gates A–G with a % budget**; Gate B is the checkpoint where a judge can finish the core flow.

---

## 7. Questions a Judge Is Likely to Ask — and the plan's readiness

| Likely judge question | Plan's answer | Ready? |
|-----------------------|---------------|--------|
| Where is retrieval, where is generation? | §25.3 explicit table | ✅ |
| How do you prevent hallucinated citations? | Server-side citation-ID validation (§25.4) | ✅ |
| Why is a topic labelled Weak? | Traceable evidence chain, deterministic policy (§12) | ✅ |
| What if there's no data for a topic? | "Not enough evidence" state (§12, §25.2) | ✅ |
| Does marking a task done increase the score? | No — only assessment evidence does (§13, §25.6) | ✅ |
| What are your retrieval/question-quality metrics? | eval:demo, 5 metrics (§25.9) | ✅ (needs CI) |
| Why aren't past-paper questions in the quiz? | §16 rationale — answer exists but needs a crisp demo-facing phrasing | ⚠️ prepare |
| What if the LLM goes down mid-demo? | Currently nothing | ❌ P0-2 |
| How long is the quiz? | Unanswered concretely | ❌ P0-1 |
