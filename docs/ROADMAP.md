# Socratic Tutor — Roadmap

Your single source of truth for "what's done" and "what's next." Updated 2026-05-29.

---

## ✅ You are here

You have a working **RAG pipeline** and a **Next.js app** with the tutor UI built.
The app currently *looks* and *navigates* like the real thing, but the AI
responses are not connected yet.

| Done | What |
|------|------|
| ✅ | Supabase database (documents table, vector(1024), match_documents, HNSW, RLS) |
| ✅ | Voyage embeddings (voyage-3.5, 1024 dims) |
| ✅ | Ingestion script (`scripts/ingest.ts`) — physics + data-science syllabi ingested (32 chunks) |
| ✅ | Retrieval helper (`lib/retrieve.ts`) — tested, returns ranked chunks |
| ✅ | New-format Supabase keys (`sb_secret_` / `sb_publishable_`) |
| ✅ | Next.js 16 app scaffolded (App Router, TypeScript, Tailwind) |
| ✅ | Prototype UI ported (`app/page.tsx`, `app/globals.css`, `lib/courses.ts`) — Home → Class → Unit, chat + practice shells |

---

## 👉 NEXT STEP (start here)

> **Order of operations (important):** Don't deploy to Vercel yet. The right
> sequence is **(1) get an Anthropic API key → (2) build Milestone 1 → (3) confirm
> the tutor works on localhost → (4) THEN deploy.** The Anthropic key gates the
> real work, not the deploy. Deploying earlier would just publish a non-working
> preview (the code stays safe on GitHub regardless). Note: Vercel env vars can be
> added or changed any time (a redeploy applies them), so nothing is locked in by
> waiting.

### Milestone 1 — Make the chat actually tutor ✅ BUILT (awaiting your key)

The chat tutor is wired end to end. Steps 2-4 below are **done**:

2. ✅ SDK installed (`@anthropic-ai/sdk`).
3. ✅ `app/api/chat/route.ts` — receives message + course + unit + mode + difficulty,
   calls `retrieveContext()` for syllabus grounding, builds the prompt via
   `lib/prompts.ts`, and streams `claude-opus-4-8` back.
4. ✅ `app/page.tsx` — Send, Enter, hint buttons, "show answer" gate (2 hints),
   "I solved it", "new problem", Reset, and Export all call the live tutor and
   render the streamed reply.

**The one step left is yours:**

1. **Add your Anthropic API key** to `.env.local` (the `ANTHROPIC_API_KEY=` line is
   already there, blank):
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Get it from https://console.anthropic.com → API Keys.) Save, then restart the dev
   server (`Ctrl+C`, then `npm run dev`). Open a unit → Chat Tutor and start talking.

---

## 🔜 After that

### Milestone 2 — Practice quizzes
Wire the MCQ / FRQ "Start Practice" flow to the AI (port the quiz logic from the prototype).

### Milestone 3 — Progress & login
Decide where progress lives (browser `localStorage` vs. Supabase with student login),
then restore streaks, weekly goals, and mastery scores (currently showing 0).

### Milestone 4 — Polish
- KaTeX math rendering in tutor replies
- Image attachments (handwritten work)

### Milestone 5 — Ship it
> Do this only after Milestone 1 works on localhost (see "Order of operations" above).
1. ~~`git init` + push this folder to **GitHub**~~ ✅ done — https://github.com/brandonheller62-dot/socratic-tutor (private).
2. Import the repo into **Vercel** (Add New → Project → import `socratic-tutor`).
3. In Vercel → Project Settings → Environment Variables, add the same keys from
   `.env.local` (VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY,
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ANTHROPIC_API_KEY).
4. Deploy → you get a live URL.

---

## 🧹 Housekeeping (do when convenient)
- [ ] Ingest any updated PDFs. **Ingestion is insert-only** — to *replace* a
      syllabus, delete the old rows first, then re-ingest:
  ```bash
  # 1) delete old rows for a course
  node --input-type=module -e 'import{config}from"dotenv";import{createClient}from"@supabase/supabase-js";config({path:".env.local",quiet:true});const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY);const{error,count}=await sb.from("documents").delete({count:"exact"}).eq("metadata->>course","data-science");console.log(error?error.message:`deleted ${count}`)'
  # 2) re-ingest
  npx tsx scripts/ingest.ts "./course-materials/Syllabus.pdf" --course=data-science --section=syllabus
  ```
