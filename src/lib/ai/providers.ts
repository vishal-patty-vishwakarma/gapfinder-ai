// LLM provider adapter (§25.3 / §22-1).
//
// The deterministic offline pipeline is the DEFAULT and always available.
// Any configured provider is a quality upgrade with fail-safe behaviour:
// every LLM call can fail/timeout without harming the demo — we fall back.
// Diagnosis itself never calls an LLM (plan §12).
import type { Chunk } from "@/lib/types";

export interface ExplainCitation {
  n: number;
  documentTitle: string;
  locator: string;
  quote: string;
  documentId: string;
}

export interface AIProvider {
  name: string;
  /** Rewrite the extractive answer into fluent prose, grounded in the citations. */
  explain(query: string, citations: ExplainCitation[], chunks: Chunk[]): Promise<string | null>;
}

class OfflineProvider implements AIProvider {
  name = "offline (deterministic)";
  async explain(): Promise<string | null> {
    return null; // keep the extractive answer untouched
  }
}

function makeFetchProvider(name: string, run: (query: string, context: string) => Promise<string | null>): AIProvider {
  return {
    name,
    async explain(query, citations) {
      if (citations.length === 0) return null;
      const context = citations.map((c) => `[${c.n}] (${c.locator}) ${c.quote}`).join("\n");
      try {
        return await run(query, context);
      } catch {
        return null;
      }
    },
  };
}

const gemini = makeFetchProvider("gemini (configured)", async (query, context) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Answer the student's question ONLY using the numbered excerpts. Cite as [n]. If the excerpts do not contain the answer, reply exactly: NOT_IN_MATERIAL.\n\nExcerpts:\n" + context,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(20_000),
    }
  );
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text || text.includes("NOT_IN_MATERIAL")) return null;
  return text;
});

const groq = makeFetchProvider("groq (configured)", async (query, context) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content:
            "Answer using ONLY the numbered excerpts; cite as [n]. If they do not contain the answer reply exactly NOT_IN_MATERIAL.",
        },
        { role: "user", content: `Excerpts:\n${context}\n\nQuestion: ${query}` },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text || text.includes("NOT_IN_MATERIAL")) return null;
  return text;
});

export function getProvider(): AIProvider {
  switch ((process.env.LLM_PROVIDER ?? "offline").toLowerCase()) {
    case "gemini":
      return gemini;
    case "groq":
      return groq;
    default:
      return new OfflineProvider();
  }
}
