#!/usr/bin/env node
// GapFinder AI — runtime acceptance checks (§18 / §25.9).
//
// Prereq: `npm run dev` on localhost:3000, then `npm run eval:demo`.
// Covers what the in-app “Run” button cannot: cross-user isolation,
// double-submit idempotency, plus the in-app metric suite over the live store.

const BASE = process.env.GAPFINDER_URL ?? "http://localhost:3000";
let failures = 0;
let passes = 0;

function check(name, pass, detail) {
  console.log(`${pass ? "✓" : "✗"} ${name}`);
  if (detail) console.log(`   ${detail}`);
  pass ? passes++ : failures++;
}

async function call(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  const json = await (async () => { try { return JSON.parse(text); } catch { return {}; } })();
  return { res, json, text };
}

async function login(email, password) {
  const { res, json } = await call("/api/auth", { method: "POST", body: { action: "login", email, password } });
  if (!res.ok) throw new Error(`login failed for ${email}: ${JSON.stringify(json)}`);
  const setCookie = res.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0]; // "gf_session=..."
}

async function main() {
  console.log(`GapFinder acceptance checks → ${BASE}\n`);

  // 1 — in-app metric suite (ingestion, grounding, diagnosis, planner)
  const judge = await login("judge@demo.app", "gapfinder-demo");
  const { json: evalData } = await call("/api/eval", { cookie: judge });
  for (const r of evalData?.results ?? []) {
    check(`[${r.area}] ${r.name}`, r.pass, r.detail);
  }

  // 2 — cross-user isolation
  const intruder = await login("student@demo.app", "demo-1234");
  for (const path of ["/api/report", "/api/plan", "/api/progress"]) {
    const { res } = await call(path, { cookie: intruder });
    // student's own EMPTY workspace: must NOT be able to read judge content.
    // report/plan/progress all 200 but reply with the *student's* empty state.
    const looksLikeJudge = JSON.stringify((await call(path, { cookie: judge })).json) === JSON.stringify((await call(path, { cookie: intruder })).json);
    check(`isolation: ${path} not shared between users`, !looksLikeJudge, `200 with user-specific (empty) data is expected for student@demo.app; judge data must differ.`);
  }

  // 3 — judge cannot mutate what isn't theirs: unknown attempt id → 404
  {
    const { res } = await call("/api/attempt/attempt_does_not_exist", { cookie: judge });
    check("attempt isolation: unknown attempt → 404", res.status === 404, `status=${res.status}`);
  }

  // 4 — double-submit idempotency
  {
    const { json: started } = await call("/api/quiz", { method: "POST", body: { mode: "deep_dive", topicIds: ["t_kin"] }, cookie: judge });
    const attemptId = started?.attemptId;
    if (!attemptId) {
      check("idempotency: deep-dive assembly", false, started?.error ?? "no attempt id");
    } else {
      const { json: attempt } = await call(`/api/attempt/${attemptId}`, { cookie: judge });
      const q = attempt.attempt.questions[0];
      const payload = { action: "respond", questionId: q.id, state: "answered", value: q.options?.[0]?.id, idempotencyKey: "same-key-twice" };
      await call(`/api/attempt/${attemptId}`, { method: "POST", body: payload, cookie: judge });
      await call(`/api/attempt/${attemptId}`, { method: "POST", body: payload, cookie: judge });
      const { json: after } = await call(`/api/attempt/${attemptId}`, { cookie: judge });
      const nResponses = Object.keys(after.attempt.responses ?? {}).length;
      check("idempotency: same key twice → still 1 record", nResponses === 1, `responses=${nResponses}`);

      const { json: submit1 } = await call(`/api/attempt/${attemptId}`, { method: "POST", body: { action: "submit", idempotencyKey: "submit-once" }, cookie: judge });
      const { json: submit2 } = await call(`/api/attempt/${attemptId}`, { method: "POST", body: { action: "submit", idempotencyKey: "submit-once" }, cookie: judge });
      const sameResults =
        JSON.stringify(submit1?.attempt?.evaluations ?? {}) === JSON.stringify(submit2?.attempt?.evaluations ?? {}) ||
        submit2?.idempotent === true;
      check("idempotency: double submit → identical results", sameResults, "");
    }
  }

  // 5 — citation reveal policy: quiz-time payload must NOT contain quotes/keys
  {
    const { json: started } = await call("/api/quiz", { method: "POST", body: { mode: "deep_dive", topicIds: ["t_newton"] }, cookie: judge });
    const attemptId = started?.attemptId;
    if (attemptId) {
      const { json: attempt } = await call(`/api/attempt/${attemptId}`, { cookie: judge });
      const blob = JSON.stringify(attempt);
      const leakedQuote = attempt.attempt.questions.some((q) => q.citations?.some((c) => c.quote && c.quote.length > 0));
      const leakedKey = blob.includes('"answerOptionId"');
      check("citation policy: quiz payload hides quotes", !leakedQuote, "");
      check("citation policy: quiz payload hides answer key", !leakedKey, "");
    }
  }

  console.log(`\n${passes} passed, ${failures} failed.`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("EVAL FAILED:", e.message);
  process.exit(1);
});
