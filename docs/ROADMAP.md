# Socratic Tutor — Roadmap

Your single source of truth for "what's done" and "what's next." Updated 2026-06-02.

---

## ✅ You are here

**All five milestones are LIVE and verified in production** at
**https://ransomtutor.vercel.app**: the chat tutor, the practice quizzes
(MCQ/FRQ + grading), local progress tracking, the polish pass (KaTeX math +
image attachments), and — as of 2026-06-02 — **RAG grounding on the live site**.
The model calls are currently driven by an **OpenAI key (`gpt-5-mini`)** as a
temporary bridge, and auto-switch to `claude-opus-4-8` the moment an
`ANTHROPIC_API_KEY` is added (Anthropic is preferred when both keys are present)
— no code change needed.

**Milestone 5 — Ship it is DONE.** The app is deployed to **Vercel**,
auto-deploying from `main`, with all required env vars set in Production and
retrieval confirmed working (no more `retrieveContext failed` in the runtime
logs).

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

## 👉 WHERE THINGS STAND

All five milestones are built, deployed, and verified in production (Milestone 5
includes RAG grounding, confirmed live 2026-06-02). The model currently runs on
the **OpenAI `gpt-5-mini`** bridge; to switch to Claude, add `ANTHROPIC_API_KEY`
to `.env.local` (local) and to Vercel's env vars (production) — the app
auto-prefers Anthropic.

Remaining odds and ends:
- (Optional) Get an Anthropic key to move off the temporary OpenAI bridge. After
  adding it to Vercel, trigger a fresh build (see the build-time env gotcha below).

### Milestone 1 — Make the chat actually tutor ✅ DONE (live in production)

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

## ✅ The rest (all built)

### Milestone 2 — Practice quizzes ✅ DONE (live in production)
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
- **Image attachments** (handwritten work / textbook photos), in BOTH the chat
  tutor and the **FRQ grader**. 📎 button → preview thumbnail → sends a base64
  data URL; the server attaches it as a vision block (Anthropic `image` / OpenAI
  `image_url`) via the shared `lib/image.ts` + `lib/llm.ts`. Works with or without
  accompanying text (FRQ accepts a typed answer, a photo, or both). Max 5 MB;
  jpeg/png/gif/webp. Verified live end to end.

### Milestone 5 — Ship it ✅ DONE (live + RAG verified in production)
1. ~~`git init` + push to **GitHub**~~ ✅ done — https://github.com/brandonheller62/ransom-tutor (private).
2. ~~Import the repo into **Vercel**~~ ✅ done — project `socratic-tutor` under the
   "Brandon's projects" team, auto-deploying from `main`.
3. ~~**Environment Variables:**~~ ✅ done — set in Vercel → Settings → Environment
   Variables, scoped to **Production**:
   - **Required (all set):** `OPENAI_API_KEY`, `VOYAGE_API_KEY`,
     `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - **Skip:** `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (ingest-only, not used by the live
     app). `ANTHROPIC_API_KEY` — add later to switch to Claude.
4. ~~Confirm RAG works on the live site.~~ ✅ verified 2026-06-02 — runtime logs are
   clean (no `retrieveContext failed`), tutor answers are syllabus-grounded.

**Gotchas hit during deploy (fixed):**
- `lib/retrieve.ts` created the Supabase client at module load → the build crashed in
  the "collecting page data" phase (`supabaseUrl is required`). Fixed: the client is now
  created lazily inside `retrieveContext`.
- Vercel marked deploys **BLOCKED** (no build) because the git commit **author email**
  was an Apple private-relay address, not the Vercel account email. Fixed by setting
  `git config user.email brandonheller62@gmail.com` and re-authoring the commit.
- **`NEXT_PUBLIC_*` env vars are inlined at BUILD time, not read at runtime.** This is
  what silently broke RAG in production: the Supabase vars were added in Vercel, but the
  live deployment was a **redeploy of an older build** that ran before the vars existed,
  so `NEXT_PUBLIC_SUPABASE_URL` was baked in as `undefined` and `retrieveContext` threw
  `Supabase env not set` (swallowed by the route's try/catch → HTTP 200 with no
  grounding). Fix: after adding/changing any `NEXT_PUBLIC_*` var, trigger a **fresh
  build** — push a new commit, or use Redeploy with **"Use existing Build Cache"
  unchecked**. A plain redeploy of an old build will NOT pick up the new value.
- If the live site shows a Vercel login wall, turn off **Settings → Deployment
  Protection → Vercel Authentication** so students can reach it.

---

## 🔮 Future milestones (not started — do later)

Ideas captured for a future round of work. None are started yet.

- [ ] **Real problems from the class** — pull in the actual problems used in
      class as exemplars, then have the tutor/quizzes generate *new* questions
      modeled on those (same style and difficulty). Don't just serve the class
      problems verbatim — use them to calibrate the type and difficulty of the
      AI-generated practice.
- [ ] **Other advanced physics teacher's syllabus** — get that teacher's
      syllabus and ingest it as RAG course material. (Remember: ingestion is
      insert-only — to replace, delete old rows first; see Housekeeping below.)
- [ ] **Add more classes** — expand beyond Physics / Data Science. Add the new
      course to `lib/courses.ts` and mind the app-key vs. Supabase-label
      mismatch (`datascience` vs. `data-science`) handled in `app/api/chat/route.ts`.
- [ ] **Add mobile UI**
- [ ] **Allow users to copy/paste photos in and take pictures of their work and drop it into the chat**

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
