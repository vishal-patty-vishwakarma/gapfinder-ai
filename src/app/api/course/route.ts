import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, workspaceFor } from "@/lib/server/store";
import { coverageForTopics } from "@/lib/retrieval";

/** GET /api/course — materials + topic coverage (Materials & Topic Map screens) */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  const activeQuestionsPerTopic: Record<string, number> = {};
  for (const t of ws.topics) {
    activeQuestionsPerTopic[t.id] = ws.questions.filter(
      (q) => q.topicId === t.id && q.validationStatus === "validated"
    ).length;
  }
  const cov = coverageForTopics(ws.topics, ws.chunks);
  return NextResponse.json({
    course: { title: ws.courseTitle, subject: ws.subject, examinationDate: ws.examDate },
    importanceBasis: ws.pastPaperImportanceBasis,
    documents: ws.documents.map((d) => ({
      id: d.id,
      fileName: d.fileName,
      title: d.title,
      kind: d.kind,
      status: d.status,
      sizeBytes: d.sizeBytes,
      addedAt: d.addedAt,
      notes: d.notes,
      extractionStatus: d.extractionStatus,
      chunkCount: ws.chunks.filter((c) => c.documentId === d.id && c.active).length,
      preview: ws.chunks
        .filter((c) => c.documentId === d.id && c.active)
        .slice(0, 2)
        .map((c) => (c.text.slice(0, 260) + "…")),
    })),
    topics: ws.topics.map((t) => ({
      id: t.id,
      title: t.title,
      origin: t.origin,
      outOfScope: t.outOfScope,
      importanceOverride: t.importanceOverride,
      ppWeight: t.ppWeight,
      parents: t.parents,
      syllabusRef: t.syllabusRef,
      mappedChunks: cov.rows.find((r) => r.topicId === t.id)?.mapped ?? 0,
      validatedQuestions: activeQuestionsPerTopic[t.id] ?? 0,
    })),
    unmappedChunks: ws.chunks
      .filter((c) => c.active && !c.topicId)
      .map((c) => ({
        id: c.id,
        documentId: c.documentId,
        locator: c.locator,
        preview: c.text.slice(0, 220),
      })),
    coverage: cov,
    topicMapVersion: ws.topicMapVersion,
  });
}
