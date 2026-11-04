/**
 * scripts/ingest-notes.ts
 *
 * Bulk-ingest a folder of class notes (.md / .txt) into the Supabase `documents` table.
 *
 * Expects the course-materials layout:  <course folder>/notes/<unit-id>-<name>/<note>.md
 * Each note's section label is "<unit-id> notes" (e.g. "p4 notes"), and every chunk is
 * prefixed with the note's title so a retrieved chunk still says what it is about.
 *
 * Chunks from all files are embedded together in small batches, spaced out to stay
 * under the Voyage free tier (3 requests/min, 10K tokens/min).
 *
 * Usage:
 *   npx tsx scripts/ingest-notes.ts <notes-dir> --course=<label> [--dry-run] [--replace]
 *
 *   --dry-run  print what would be ingested, embed nothing
 *   --replace  first delete existing rows for this course whose section ends in " notes"
 *              (ingestion is otherwise insert-only, so re-running would duplicate rows)
 *
 * Example:
 *   npx tsx scripts/ingest-notes.ts ./course-materials/adv-physics-mech/notes --course=physics
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const VOYAGE_MODEL = "voyage-3.5";
const EMBED_DIM = 1024;
const BATCH = 24; // ~24 chunks x ~300 tokens stays well under 10K tokens per request
const WAIT_MS = 65_000; // one request per ~minute keeps us under the token-per-minute cap
const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const course = args.find((a) => a.startsWith("--course="))?.split("=")[1];
const dryRun = args.includes("--dry-run");
const replace = args.includes("--replace");

if (!dir || !course) {
  console.error("Usage: npx tsx scripts/ingest-notes.ts <notes-dir> --course=<label> [--dry-run] [--replace]");
  process.exit(1);
}
if (!dryRun && (!VOYAGE_API_KEY || !SUPABASE_URL || !SUPABASE_SECRET_KEY)) {
  console.error("Missing VOYAGE_API_KEY / SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local.");
  process.exit(1);
}

function chunkText(text: string): string[] {
  const paragraphs = text.replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (para.length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim());
      current = "";
      for (let i = 0; i < para.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(para.slice(i, i + CHUNK_SIZE).trim());
      }
      continue;
    }
    if ((current + "\n\n" + para).length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - CHUNK_OVERLAP)) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

type Row = { content: string; source: string; section: string; chunk_index: number };

function collect(notesDir: string): Row[] {
  const rows: Row[] = [];
  for (const unit of readdirSync(notesDir).sort()) {
    const unitPath = join(notesDir, unit);
    if (!statSync(unitPath).isDirectory()) continue;
    const unitId = unit.split("-")[0]; // "p4-forces-and-newtons-laws" -> "p4"
    for (const file of readdirSync(unitPath).sort()) {
      if (!/\.(md|txt)$/i.test(file)) continue;
      const text = readFileSync(join(unitPath, file), "utf8");
      const title = (text.match(/^#\s+(.+)$/m)?.[1] ?? file).trim();
      chunkText(text).forEach((chunk, i) => {
        // Re-state the title on every chunk after the first, so it stands on its own.
        const content = i === 0 ? chunk : `[${title}]\n\n${chunk}`;
        rows.push({ content, source: file, section: `${unitId} notes`, chunk_index: i });
      });
    }
  }
  return rows;
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: "document", output_dimension: EMBED_DIM }),
  });
  if (!res.ok) throw new Error(`Voyage API error ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rows = collect(dir!);
  const files = new Set(rows.map((r) => r.source)).size;
  console.log(`${files} files -> ${rows.length} chunks for course "${course}".`);
  const bySection: Record<string, number> = {};
  for (const r of rows) bySection[r.section] = (bySection[r.section] ?? 0) + 1;
  console.log(bySection);
  if (dryRun) return;

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SECRET_KEY!);

  if (replace) {
    const { error, count } = await supabase
      .from("documents")
      .delete({ count: "exact" })
      .eq("metadata->>course", course!)
      .like("metadata->>section", "% notes");
    if (error) throw new Error(`Delete failed: ${error.message}`);
    console.log(`Deleted ${count ?? 0} existing note rows.`);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    if (i > 0) {
      console.log(`Waiting ${WAIT_MS / 1000}s for the Voyage rate limit ...`);
      await sleep(WAIT_MS);
    }
    const batch = rows.slice(i, i + BATCH);
    console.log(`Embedding chunks ${i + 1}-${i + batch.length} of ${rows.length} ...`);
    const embeddings = await embed(batch.map((r) => r.content));
    const { error } = await supabase.from("documents").insert(
      batch.map((r, j) => ({
        content: r.content,
        embedding: embeddings[j],
        metadata: { course, source: r.source, section: r.section, chunk_index: r.chunk_index },
      }))
    );
    if (error) throw new Error(`Insert failed after ${inserted} rows: ${error.message}`);
    inserted += batch.length;
  }
  console.log(`\nDone. Inserted ${inserted} chunks for course "${course}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
