import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { getStore, mutate, workspaceFor } from "@/lib/server/store";
import { chunkDocument, stableId } from "@/lib/chunking";
import { mapChunkToTopic, TOPIC_MAP_THRESHOLD } from "@/lib/retrieval";
import type { Chunk, DocumentFile, TopicState, Workspace } from "@/lib/types";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB MVP cap (§16)
const KINDS = ["syllabus", "notes", "textbook", "past_paper", "other"];

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data upload." }, { status: 400 });
  }

  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "other");
  const kind = (KINDS.includes(kindRaw) ? kindRaw : "other") as DocumentFile["kind"];

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large for the MVP limit (${MAX_BYTES / 1024 / 1024} MB).` }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let text = "";
  let extractionStatus = "";
  try {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const pdf = await pdfParse(buf);
      text = pdf.text;
      extractionStatus = `extracted from PDF (${text.length.toLocaleString()} chars, "${pdf.numpages}" pages)`;
      if (text.trim().length < 40) {
        return NextResponse.json(
          {
            error:
              "The PDF produced too little text — it is likely scanned/image-only, password-protected, or empty. The MVP supports readable, text-based PDFs only (honest limitation §16).",
          },
          { status: 415 }
        );
      }
    } else {
      text = buf.toString("utf8");
      extractionStatus = `extracted from plain text (${text.length.toLocaleString()} chars)`;
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Extraction failed: ${(e as Error).message}. Try a plain text file.` },
      { status: 415 }
    );
  }

  if (text.trim().length < 40) {
    return NextResponse.json({ error: "File has too little text to index." }, { status: 415 });
  }

  const now = new Date().toISOString();
  return mutate((store) => {
    const ws = workspaceFor(store, user.id);

    // same fileName replaces the previous version (old chunks deactivated)
    const existingId = ws.documents.find((d) => d.fileName === file.name && d.status !== "failed")?.id;
    const documentId = existingId ?? stableId("doc", [user.id, file.name, now]);
    const version = existingId
      ? (ws.documents.find((d) => d.id === existingId)?.version ?? 0) + 1
      : 1;
    if (existingId) {
      for (const c of ws.chunks) if (c.documentId === existingId) c.active = false;
    }
    const doc: DocumentFile = {
      id: documentId,
      fileName: file.name,
      title: file.name.replace(/\.[^.]+$/, ""),
      kind,
      status: "ready",
      version,
      sizeBytes: file.size,
      addedAt: now,
      notes: existingId ? "Replaced an earlier version of this file (old chunks deactivated)." : "Uploaded.",
      extractionStatus,
    };
    ws.documents.push(doc);

    // chunk → index (heading-first, overlapping splits)
    const { chunks } = chunkDocument({ documentId, documentVersion: version, title: doc.title, text });
    let unmapped = 0;
    for (const c of chunks) {
      const guess = ws.topics.length ? mapChunkToTopic(c.text, ws.topics) : { topicId: null, confidence: 0 };
      const mapped = ws.topics.length && guess.confidence >= TOPIC_MAP_THRESHOLD ? guess.topicId : null;
      if (!mapped) unmapped += 1;
      let chunkIdSuffix = 1;
      let chunkId = `${documentId}_${chunkIdSuffix++}`;
      while (ws.chunks.some((x) => x.id === chunkId)) chunkId = `${documentId}_${chunkIdSuffix++}`;
      ws.chunks.push({ ...c, documentVersion: version, id: chunkId, topicId: mapped });
    }

    // syllabus → new topics (origin: uploaded). Topic map version bump.
    let newTopics = 0;
    if (kind === "syllabus") {
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        // Try multiple patterns:
        // 1. "Unit N. Topic" or "Chapter N. Topic"
        // 2. "1. Topic" or "Module N - Topic"
        // 3. "- Topic" or "* Topic" (bullet points)
        let m = trimmed.match(/^(?:Unit|Chapter)\s+[\dIVX]+[.:)]?\s*(.{4,90})$/i);
        if (!m) {
          // Pattern: "N. Topic" (e.g., "1. Cell structure")
          m = trimmed.match(/^\d+[.:]\s*(.{4,90})$/);
          if (!m) {
            // Pattern: "Module N - Topic"
            m = trimmed.match(/^Module\s+[\d]+[\s-]*(.{4,90})$/i);
            if (!m) {
              // Bullet points: "- Topic" or "* Topic"
              m = trimmed.match(/^[ *\-]+(.{4,90})$/);
            }
          }
        }
        if (m) {
          const title = m[1].replace(/\s*\(.*?\)\s*$/, "").trim();
          // Skip very generic titles that aren't actual topics
          if (title.length >= 4 && title.length <= 120) {
            const dup = ws.topics.some((t) => t.title.toLowerCase() === title.toLowerCase());
            if (!dup) {
              const t: TopicState = {
                id: stableId("topic", [user.id, title, now]),
                title,
                keywords: title.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 3),
                origin: "uploaded",
                outOfScope: false,
                importanceOverride: null,
                ppWeight: null,
                parents: [],
                syllabusRef: line.trim(),
              };
              ws.topics.push(t);
              newTopics += 1;
            }
          }
        }
      }
      ws.topicMapVersion += 1;
    }

    // refresh the gap report so statuses reflect the new coverage
    const assessment = buildFreshReport(ws);
    ws.events.push({
      at: now,
      type: "document_added",
      detail: `${file.name} (${kind}) → ${chunks.length} chunk(s), ${unmapped} unmapped${newTopics ? `, +${newTopics} topics` : ""}.`,
    });

    return NextResponse.json({
      document: { ...doc, chunkCount: chunks.length },
      topicsAdded: newTopics,
      unmappedChunks: unmapped,
      reportId: assessment.id,
      message: `Indexed ${chunks.length} chunk(s).${unmapped ? ` ${unmapped} could not be confidently mapped to a topic — review them on Materials.` : ""}${newTopics ? ` Added ${newTopics} topic(s) from the syllabus.` : ""}`,
    });
  });
}

// local import to avoid cycles at module scope
import { buildGapReport, pushReport } from "@/lib/diagnosis";
function buildFreshReport(ws: Workspace) {
  const report = buildGapReport(ws, new Date().toISOString());
  pushReport(ws, report);
  return report;
}
