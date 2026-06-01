# Socratic Tutor — Roadmap

Your single source of truth for "what's done" and "what's next." Updated 2026-05-29.

---

## ✅ You are here

**Milestones 1-4 are LIVE** on localhost: the chat tutor, the practice quizzes
(MCQ/FRQ + grading), local progress tracking, and the polish pass (KaTeX math +
image attachments) all work end to end. The model calls are currently driven by
an **OpenAI key (`gpt-5-mini`)** as a temporary bridge, and auto-switch to
`claude-opus-4-8` the moment an `ANTHROPIC_API_KEY` is added to `.env.local`
(Anthropic is preferred when both keys are present) — no code change needed.

The only milestone left is **Milestone 5 — Ship it** (deploy to Vercel).

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

### Milestone 1 — Make the chat actually tutor ✅ DONE (live on localhost)

The chat tutor is wired end to end and verified responding:

- ✅ Both SDKs installed (`@anthropic-ai/sdk`, `openai`).
- ✅ `app/api/chat/route.ts` — receives message + course + unit + mode + difficulty,
  calls `retrieveContext()` for syllabus grounding, builds the prompt via
  `lib/prompts.ts`, and streams the reply. **Dual-provider:** Anthropic
  (`claude-opus-4-8`) when `ANTHROPIC_API_KEY` is set, otherwise OpenAI
  (`gpt-5-mini`).
- ✅ `app/page.tsx` — Send, Enter, hint buttons, "show answer" gate (2 hints),
  "I solved it", "new problem", Reset, and Export all call the live tutor and
  render the streamed reply.

**To swap to Claude later (preferred):** paste your key into the
`ANTHROPIC_API_KEY=` line in `.env.local` and restart `npm run dev`. The route
auto-prefers Anthropic; nothing else to change. Get the key from
https://console.anthropic.com → API Keys.

> ⚠️ Known quirk on the OpenAI bridge: `gpt-5-mini` occasionally emits an em dash
> despite the "no em/en dashes" rule in `lib/prompts.ts`. Cosmetic only; goes away
> on Claude. Revisit if it bothers you (could strip em dashes post-stream).

---

## 🔜 After that

### Milestone 2 — Practice quizzes ✅ DONE (live on localhost)
The MCQ / FRQ "Start Practice" flow is wired to the AI and verified end to end.
- `app/api/quiz/route.ts` — non-streaming backend with three actions: `mcq`
  (generates + parses into structured choices), `frq` (generates an AP-style
  10-pt question), `grade` (per-part scoring + feedback). RAG-grounded via the
  unit topic. Shares the dual-provider helper `lib/llm.ts`.
- `lib/prompts.ts` — `getMcqPrompt` / `getFrqPrompt` / `getGradePrompt` (ported
  from the prototype).
- `app/page.tsx` — interactive MCQ cards (click to answer, color feedback,
  explanation, Next), FRQ textarea → Submit for Grading → feedback → Next, and a
  live score bar (correct/total for MCQ, completed count for FRQ).
- Quiz CSS ported into `app/globals.css`.

> Note: `lib/llm.ts` sets `reasoning_effort: "low"` on the OpenAI (`gpt-5-mini`)
> path. Without it the reasoning model intermittently returned EMPTY completions
> (the hidden reasoning consumed the whole token budget). Keep this in mind if you
> ever see blank quiz/tutor output on the OpenAI bridge.

### Milestone 3 — Progress ✅ DONE (local to the device)
Decision: progress lives in the **browser's `localStorage`** (no login / no
Supabase) — simplest for a single shared device. Implemented in `lib/progress.ts`
(types, mastery/streak/week math, load/save) and wired through `app/page.tsx`:
- **Per-unit mastery rings** on the class screen (was hardcoded 0).
- **Streak**, **weekly-goal** (editable via a modal), and **all-time problems**
  in the home stats bar.
- **Session recap modal** when you leave a unit you practiced in (time, problems,
  solved, hints, mastery delta).
- Progress is fed by BOTH the chat tutor ("I solved it" = solved, each hint =
  small penalty) AND the quizzes (each MCQ/FRQ counts; MCQ-correct = solved).

> Storage key: `socratic_progress_v1` in localStorage. Clearing browser data
> resets all progress. It does not sync across devices/browsers (by design).

### Milestone 4 — Polish ✅ DONE
- **KaTeX math rendering** everywhere (chat replies, MCQ/FRQ questions, choices,
  explanations, grading). `app/Markdown.tsx` wraps `react-markdown` +
  `remark-math` + `rehype-katex` (+ `remark-breaks`), with the em/en-dash
  stripper ported from the prototype. KaTeX CSS imported in `app/layout.tsx`.
  Partial `$...$` during streaming renders as plain text until the closing
  delimiter arrives, so it never crashes mid-stream.
- **Image attachments** (handwritten work / textbook photos). 📎 button in the
  chat input → preview thumbnail → sends a base64 data URL. `app/api/chat/route.ts`
  attaches it as a vision block (Anthropic `image` / OpenAI `image_url`). Works
  with or without accompanying text. Max 5 MB; jpeg/png/gif/webp. Verified live:
  gpt-5-mini correctly read a test image.

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
