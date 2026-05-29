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

### Milestone 1 — Make the chat actually tutor

Turn the stubbed "Send" button into a working Socratic tutor.

1. **Add your Anthropic API key** to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   (Get it from https://console.anthropic.com → API Keys.)
2. **Install the SDK:** `npm install @anthropic-ai/sdk`
3. **Create an API route** `app/api/chat/route.ts` that:
   - receives the student message + course + unit + mode + difficulty,
   - calls `retrieveContext(question, course)` to pull syllabus chunks,
   - builds the Socratic system prompt (port `getSystemPrompt()` from the prototype),
   - calls the Anthropic API and streams the answer back.
4. **Wire `app/page.tsx`** — replace the `showToast(SOON)` calls on Send/hints
   with real `fetch("/api/chat")` calls and render the streamed reply.

> When you're ready, just say: *"Let's build Milestone 1."*

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
1. `git init` + push this folder to **GitHub**.
2. Import the repo into **Vercel**.
3. In Vercel → Project Settings → Environment Variables, add the same keys from
   `.env.local` (VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY,
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, ANTHROPIC_API_KEY).
4. Deploy → you get a live URL.

---

## 🧹 Housekeeping (do when convenient)
- [ ] Rotate the legacy Supabase keys (the old `service_role` + `anon` JWTs passed
      through a chat). Supabase dashboard → API Keys → disable legacy keys.
- [ ] Ingest any updated PDFs. **Ingestion is insert-only** — to *replace* a
      syllabus, delete the old rows first, then re-ingest:
  ```bash
  # 1) delete old rows for a course
  node --input-type=module -e 'import{config}from"dotenv";import{createClient}from"@supabase/supabase-js";config({path:".env.local",quiet:true});const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY);const{error,count}=await sb.from("documents").delete({count:"exact"}).eq("metadata->>course","data-science");console.log(error?error.message:`deleted ${count}`)'
  # 2) re-ingest
  npx tsx scripts/ingest.ts "./course-materials/Syllabus.pdf" --course=data-science --section=syllabus
  ```
