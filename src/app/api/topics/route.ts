import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, mutate, workspaceFor } from "@/lib/server/store";
import { buildGapReport, pushReport } from "@/lib/diagnosis";

/** PATCH /api/topics — rename / toggle out-of-scope / set importance override.
 *  Any change bumps the topic-map version and recomputes the gap report
 *  (historical reports are preserved, §14/§25.6). */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { id?: string; title?: string; outOfScope?: boolean; importanceOverride?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Topic id required." }, { status: 400 });
  if (body.importanceOverride !== null && body.importanceOverride !== undefined) {
    const n = Number(body.importanceOverride);
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      return NextResponse.json({ error: "Importance override must be between 0 and 99." }, { status: 400 });
    }
  }

  return mutate((store) => {
    const ws = workspaceFor(store, user.id);
    const topic = ws.topics.find((t) => t.id === body.id);
    if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

    const changes: string[] = [];
    if (typeof body.title === "string" && body.title.trim()) {
      topic.title = body.title.trim().slice(0, 120);
      changes.push("renamed");
    }
    if (typeof body.outOfScope === "boolean") {
      topic.outOfScope = body.outOfScope;
      changes.push(body.outOfScope ? "marked out of scope" : "marked in scope");
    }
    if (body.importanceOverride === null) {
      topic.importanceOverride = null;
      changes.push("importance override cleared");
    } else if (typeof body.importanceOverride === "number") {
      topic.importanceOverride = Number(body.importanceOverride);
      changes.push(`importance set to ${body.importanceOverride}`);
    }
    if (changes.length === 0) {
      return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    }

    ws.topicMapVersion += 1;
    const report = buildGapReport(ws, new Date().toISOString());
    pushReport(ws, report);
    ws.events.push({
      at: new Date().toISOString(),
      type: "topic_map_changed",
      detail: `“${topic.title}” ${changes.join(", ")} (map v${ws.topicMapVersion}).`,
    });
    return NextResponse.json({ topic, topicMapVersion: ws.topicMapVersion, reportId: report.id });
  });
}
