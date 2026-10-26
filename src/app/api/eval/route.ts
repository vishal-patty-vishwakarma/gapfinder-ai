import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { workspaceFor } from "@/lib/server/store";
import { getStore } from "@/lib/server/store";
import { runAcceptanceChecks } from "@/lib/evaldemo";

/** GET /api/eval — acceptance checks (plan §18) over THIS user's workspace. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const { results, summary } = runAcceptanceChecks(ws);
  return NextResponse.json({
    results,
    summary,
    runtimeNote: "Isolation + double-submit idempotency are runtime checks: run `npm run eval:demo` against a live dev server.",
  });
}
