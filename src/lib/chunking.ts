// Heading-first chunking (plan §9): split on section lines, then split
// oversized sections into overlapping chunks. Preserves a human-readable
// locator string used for citations.
import type { Chunk } from "@/lib/types";

export interface Section {
  heading: string;
  body: string;
  lineStart: number;
}

export function splitSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let current: Section = { heading: "Introduction", body: "", lineStart: 1 };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(#+\s|\*\*.{2,80}\*\*$|Unit\s+\d|Q\d)/i.test(line.trim())) {
      if (current.body.trim().length > 0 || current.heading !== "Introduction") {
        sections.push(current);
      }
      current = { heading: line.trim().replace(/^#+\s*/, "").replace(/\*\*/g, ""), body: "", lineStart: i + 1 };
    } else {
      current.body += line + "\n";
    }
  }
  if (current.body.trim().length > 0) sections.push(current);
  return sections.filter((s) => s.body.trim().length > 0);
}

function splitOversized(body: string, max = 1100): string[] {
  if (body.length <= max) return [body];
  const sentences = body.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).length > max && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += (buf ? " " : "") + s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/** Deterministic id from content hash-ish (stable across restarts). */
export function stableId(prefix: string, parts: string[]): string {
  const raw = parts.join("§");
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return `${prefix}_${h.toString(36)}`;
}

export function chunkDocument(opts: {
  documentId: string;
  documentVersion: number;
  title: string;
  text: string;
}): { chunks: Omit<Chunk, "topicId">[]; sections: Section[] } {
  const sections = splitSections(opts.text);
  const chunks: Omit<Chunk, "topicId">[] = [];
  let idx = 0;
  for (const section of sections) {
    const pieces = splitOversized(section.body.replace(/\n{3,}/g, "\n\n").trim());
    for (let p = 0; p < pieces.length; p++) {
      const chunkId = stableId("ch", [opts.documentId, String(section.lineStart), String(p)]);
      const locator = section.heading && section.heading !== "Introduction"
        ? `${section.heading}${pieces.length > 1 ? ` (part ${p + 1})` : ""}`
        : opts.title;
      chunks.push({
        id: chunkId,
        documentId: opts.documentId,
        documentVersion: opts.documentVersion,
        index: idx++,
        text: pieces[p],
        locator,
        active: true,
        embeddingModel: "keyword-v1",
      });
    }
  }
  return { chunks, sections };
}
