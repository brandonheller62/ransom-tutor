/**
 * scripts/retrieve-test.ts
 *
 * Quick manual check that the retrieval half of the RAG pipeline works:
 * embeds a question with Voyage and pulls the closest physics chunks via
 * Supabase match_documents(). Run:
 *
 *   npx tsx scripts/retrieve-test.ts "your question here"
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

// Load env FIRST, then dynamically import retrieve.ts. A static import would be
// hoisted above config() and retrieve.ts builds its Supabase client at load time,
// so the env vars must already be set. (Next.js loads .env.local for us, so the
// app itself doesn't need this dance.)
const { retrieveContext } = await import("../lib/retrieve");

const question = process.argv[2] ?? "What is the late work and AI use policy?";

const chunks = await retrieveContext(question, "physics", 3);

console.log(`\nQ: ${question}\n`);
console.log(`Got ${chunks.length} chunk(s):\n`);
for (const c of chunks) {
  console.log(`— id ${c.id} | similarity ${c.similarity.toFixed(3)} | section ${c.metadata.section}`);
  console.log(`  ${c.content.replace(/\s+/g, " ").slice(0, 160)}…\n`);
}
