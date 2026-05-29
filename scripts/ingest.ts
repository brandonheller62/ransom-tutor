/**
 * scripts/ingest.ts
 *
 * One-shot PDF ingestion for the Socratic Tutor RAG pipeline.
 *
 * What it does:
 *   1. Reads a PDF from disk and extracts its text.
 *   2. Splits the text into overlapping, section-aware chunks.
 *   3. Embeds each chunk with Voyage (voyage-3.5, 1024 dims).
 *   4. Inserts the chunks + embeddings into the Supabase `documents` table.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts <path-to-pdf> --course=<courseKey> [--section=<label>] [--chunk=800] [--overlap=150]
 *
 * Examples:
 *   npx tsx scripts/ingest.ts ./docs/physics-syllabus.pdf --course=physics --section=syllabus
 *   npx tsx scripts/ingest.ts ./docs/momentum-pset.pdf --course=physics --section="Unit 6 problems" --chunk=1200
 *
 * Required in .env.local (NEVER commit this file):
 *   VOYAGE_API_KEY=...                  <- from your Voyage dashboard
 *   SUPABASE_URL=https://ujukrzfxmzgofwfbpass.supabase.co
 *   SUPABASE_SECRET_KEY=...       <- SECRET. Bypasses RLS. Server/CLI only. Never ship to the browser.
 */

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
// pdf-parse v2 exposes a PDFParse class (no default export).
import { PDFParse } from "pdf-parse";

// Load .env.local explicitly (Next.js loads it automatically in-app,
// but a standalone script needs to be told where to look).
config({ path: ".env.local" });

// ---------- Config & key checks ----------

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!VOYAGE_API_KEY || !SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env vars. Ensure VOYAGE_API_KEY, SUPABASE_URL, and " +
      "SUPABASE_SECRET_KEY are set in .env.local."
  );
  process.exit(1);
}

const VOYAGE_MODEL = "voyage-3.5";
const EMBED_DIM = 1024; // must match the vector(1024) column
const VOYAGE_BATCH = 64; // Voyage accepts many inputs per call; batch to cut round-trips

// ---------- Tiny arg parser ----------

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const [k, v] = arg.slice(2).split("=");
      flags[k] = v ?? "true";
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const pdfPath = positional[0];
const course = flags.course;
const sectionLabel = flags.section ?? "general";
const CHUNK_SIZE = Number(flags.chunk ?? 800);
const CHUNK_OVERLAP = Number(flags.overlap ?? 150);

if (!pdfPath || !course) {
  console.error(
    "Usage: npx tsx scripts/ingest.ts <path-to-pdf> --course=<courseKey> " +
      "[--section=<label>] [--chunk=800] [--overlap=150]"
  );
  process.exit(1);
}

// ---------- Chunking ----------

/**
 * Section-aware splitter.
 * First splits on blank lines (paragraph/section boundaries), then packs
 * paragraphs into chunks up to CHUNK_SIZE chars, carrying CHUNK_OVERLAP
 * chars of tail context into the next chunk so ideas straddling a boundary
 * aren't lost. Smaller chunks => sharper retrieval; overlap => preserved context.
 */
function chunkText(text: string, size: number, overlap: number): string[] {
  // Normalize whitespace and collapse the runs of newlines PDFs love to emit.
  const clean = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const para of paragraphs) {
    // If a single paragraph is bigger than the chunk size, hard-split it.
    if (para.length > size) {
      pushCurrent();
      current = "";
      for (let i = 0; i < para.length; i += size - overlap) {
        chunks.push(para.slice(i, i + size).trim());
      }
      continue;
    }

    if ((current + "\n\n" + para).length > size) {
      pushCurrent();
      // Start the next chunk with the overlap tail of the previous one.
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = tail + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  pushCurrent();

  return chunks;
}

// ---------- Voyage embeddings ----------

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: "document", // ingest side; retrieval uses "query"
      output_dimension: EMBED_DIM,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  // Voyage returns { data: [{ embedding, index }, ...] }; sort by index to be safe.
  return json.data
    .sort((a: any, b: any) => a.index - b.index)
    .map((d: any) => d.embedding as number[]);
}

// ---------- Main ----------

async function main() {
  console.log(`Reading ${pdfPath} ...`);
  const buffer = readFileSync(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  const rawText = parsed.text;
  await parser.destroy(); // release the parser's worker/resources

  const chunks = chunkText(rawText, CHUNK_SIZE, CHUNK_OVERLAP);
  console.log(
    `Extracted ${rawText.length} chars -> ${chunks.length} chunks ` +
      `(size ${CHUNK_SIZE}, overlap ${CHUNK_OVERLAP}).`
  );

  if (chunks.length === 0) {
    console.error("No text extracted. Is this a scanned/image-only PDF? (Would need OCR.)");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!);
  const source = basename(pdfPath);

  let inserted = 0;

  for (let i = 0; i < chunks.length; i += VOYAGE_BATCH) {
    const batch = chunks.slice(i, i + VOYAGE_BATCH);
    console.log(`Embedding chunks ${i + 1}-${i + batch.length} of ${chunks.length} ...`);
    const embeddings = await embedBatch(batch);

    const rows = batch.map((content, j) => ({
      content,
      embedding: embeddings[j],
      metadata: {
        course,
        source,
        section: sectionLabel,
        chunk_index: i + j,
      },
    }));

    const { error } = await supabase.from("documents").insert(rows);
    if (error) {
      console.error("Insert failed:", error.message);
      process.exit(1);
    }
    inserted += rows.length;
  }

  console.log(`\nDone. Inserted ${inserted} chunks for course "${course}" from ${source}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
