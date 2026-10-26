import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, workspaceFor } from "@/lib/server/store";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const store = await getStore();
  const ws = workspaceFor(store, user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, kind: user.kind },
    course: {
      title: ws.courseTitle,
      subject: ws.subject,
      attempts: ws.attempts.length,
      submitted: ws.attempts.filter((a) => a.status === "submitted").length,
      inProgressAttemptId: ws.attempts.find((a) => a.status === "in_progress")?.id ?? null,
      topics: ws.topics.filter((t) => !t.outOfScope).length,
      documents: ws.documents.length,
      imports: ws.pastPaperImportanceBasis,
    },
  });
}
