/**
 * lib/retrieve.ts
 *
 * Retrieval side of the RAG pipeline. Given a student's question and a course,
 * embeds the question with Voyage and asks Supabase's match_documents() for the
 * closest chunks. Use the returned chunks as grounding context in the tutor prompt.
 *
 * This runs SERVER-SIDE only (API route / server action). It uses the publishable
 * key, which is fine because RLS allows public SELECT and blocks writes. Do NOT use
 * the secret key here.
 *
 * Required env (server-side):
 *   VOYAGE_API_KEY=...
 *   NEXT_PUBLIC_SUPABASE_URL=https://ujukrzfxmzgofwfbpass.supabase.co
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
 */

import { createClient } from "@supabase/supabase-js";

const VOYAGE_MODEL = "voyage-3.5";
const EMBED_DIM = 1024;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export interface RetrievedChunk {
  id: number;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      input_type: "query", // query side; ingest uses "document"
      output_dimension: EMBED_DIM,
    }),
  });

  if (!res.ok) {
    throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.data[0].embedding as number[];
}

/**
 * Retrieve the most relevant chunks for a question, scoped to one course.
 *
 * @param question   The student's question or current problem context.
 * @param course     Course key to filter on (e.g. "physics"). Matches metadata.
 * @param matchCount How many chunks to return (default 5).
 * @param threshold  Minimum cosine similarity 0..1 (default 0.3 filters noise).
 */
export async function retrieveContext(
  question: string,
  course: string,
  matchCount = 5,
  threshold = 0.3
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(question);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
    filter: { course }, // pre-filter: physics tutor only sees physics chunks
    match_threshold: threshold,
  });

  if (error) throw new Error(`match_documents failed: ${error.message}`);
  return (data ?? []) as RetrievedChunk[];
}
