import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, workspaceFor } from "@/lib/server/store";
import { explainFromMaterial } from "@/lib/explain";
import { getProvider } from "@/lib/ai/providers";

/** POST /api/explain — grounded topic explanation with citations. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const query = (body.query ?? "").trim();
  if (query.length < 3) {
    return NextResponse.json({ error: "Ask a question of at least 3 characters." }, { status: 400 });
  }
  if (query.length > 400) {
    return NextResponse.json({ error: "Keep the question under 400 characters." }, { status: 400 });
  }

  const store = await getStore();
  const ws = workspaceFor(store, user.id);

  // Generation only from retrieved chunks. If an LLM provider is configured it
  // may rewrite the extractive answer, but it cannot add non-cited content.
  const base = explainFromMaterial(query, ws.chunks, ws.documents);
  if (!base.abstained) {
    try {
      const provider = getProvider();
      const upgraded = await provider.explain(query, base.citations, ws.chunks);
      if (upgraded) {
        return NextResponse.json({ ...base, answer: upgraded, upgradedBy: provider.name });
      }
    } catch {
      // fail-safe: keep the extractive answer
    }
  }
  return NextResponse.json(base);
}
