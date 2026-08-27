# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

A Socratic AI tutor built for an AI Innovation Fellowship at Ransom Everglades school.
It tutors students in five classes (all defined in `lib/courses.ts`, all RAG-ingested):

- **Advanced Physics: Mechanics** (10 units, algebra-based, SCI 514)
- **Applied Data Science** (9 units, Python-based, 2-semester arc)
- **Quantitative Finance & AI** (7 units, MATH 621; unit arc comes from the
  "Story" PDF — the syllabus itself has no unit breakdown. Three PDFs are
  ingested under the `quant-finance` label: the syllabus, the Story, and the
  **Investment Instruments** deck (section `investment instruments`, added
  2026-08-27) covering stocks, bonds, options, ETFs, and closed-end funds)
- **Digital Narrative** (2 units — genuinely a two-unit English seminar)
- **Advanced Machine Learning** (6 units, Colab/scikit-learn → NLP → LLMs → capstone)

The tutor leads students through problems with hints instead of answers, grounded in
the course syllabi via RAG (retrieval-augmented generation).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — note: Next 16 has breaking changes
  vs. older docs; see `AGENTS.md` and consult `node_modules/next/dist/docs/` when needed.
- **Supabase** — `documents` table with `embedding vector(1024)`, `match_documents()`
  similarity function, HNSW index, RLS (public read, secret-key write).
- **Voyage AI** — `voyage-3.5` embeddings, 1024 dimensions.
- **Tutor LLM** — dual-provider in `app/api/chat/route.ts`: Anthropic `claude-sonnet-5`
  (preferred) or OpenAI `gpt-5-mini` (fallback), chosen by which API key is present.
  Note the model split: the **chat tutor** runs on `claude-sonnet-5` (fast + cheap),
  while the **quiz backend** (`lib/llm.ts`) keeps `claude-opus-5` for FRQ grading.
- `package.json` has `"type": "module"` (required for the standalone tsx scripts).

## Current status

**All five milestones are DONE and live in production** at
https://ransomtutor.vercel.app. Milestone 1 (the chat tutor) streams end to end
(`app/api/chat/route.ts` builds the prompt via `lib/prompts.ts` + `lib/retrieve.ts`,
and `app/page.tsx` renders the stream). The route is **dual-provider** — it uses
Anthropic (`claude-sonnet-5`) when `ANTHROPIC_API_KEY` is set, otherwise falls back to
OpenAI (`gpt-5-mini`) via `OPENAI_API_KEY`. The Anthropic key IS set in production —
both paths run on Claude; the OpenAI bridge is the no-code-change fallback. Milestone 2
(practice quizzes) is also **done**: `app/api/quiz/route.ts` (MCQ/FRQ/grade) +
`lib/llm.ts` + the interactive quiz UI in `app/page.tsx`. Milestone 3 (progress) is
**done** too: `lib/progress.ts` is a local-only (browser `localStorage`, key
`socratic_progress_v1`) engine for streaks, weekly goals, and per-unit mastery, wired
through `app/page.tsx` (rings, stats bar, goal + recap modals). No login / no Supabase
for progress. Milestone 4 (polish) is **done**: KaTeX math rendering via
`app/Markdown.tsx` (react-markdown + remark-math + rehype-katex; KaTeX CSS in
`app/layout.tsx`) and image attachments (📎 → base64 data URL → vision block) in BOTH the chat tutor
(`app/api/chat/route.ts`) and the FRQ grader (`app/api/quiz/route.ts` via `lib/llm.ts`),
sharing `lib/image.ts` (`parseDataUrl`). Milestone 5 (ship it) is **DONE — live and RAG-
verified in production** at https://ransomtutor.vercel.app (project `socratic-tutor`,
auto-deploys from `main`). All required env vars are set in Vercel (Production) and
retrieval is confirmed working as of 2026-06-02 (runtime logs clean, no
`retrieveContext failed`). See `docs/ROADMAP.md` for the authoritative status.

NB (deploy gotchas, all fixed): (1) `lib/retrieve.ts` creates the Supabase client lazily
— creating it at module load broke the Vercel build's "collecting page data" phase. (2)
Vercel BLOCKS deploys whose git commit author email isn't the Vercel account email (use
`brandonheller62@gmail.com`, not the Apple private-relay address). (3) **`NEXT_PUBLIC_*`
env vars are inlined at BUILD time, not read at runtime** — this silently broke live RAG:
the Supabase vars were set in Vercel but the live deployment was a redeploy of a build
that predated them, so `NEXT_PUBLIC_SUPABASE_URL` was baked in as `undefined` and
`retrieveContext` threw `Supabase env not set` (swallowed by the route → HTTP 200, no
grounding). After adding/changing any `NEXT_PUBLIC_*` var, force a FRESH build (new commit
or Redeploy with build cache unchecked); a plain redeploy of an old build won't pick it up.

NB: `lib/llm.ts` sets `reasoning_effort: "low"` on the OpenAI path — `gpt-5-mini` is a
reasoning model and otherwise intermittently returns empty completions (hidden reasoning
eats the whole token budget). The chat route's OpenAI streaming branch does the same.

## Architecture

- `app/page.tsx` — client-side SPA: Home (course cards) → Class (unit cards) →
  Unit (chat + practice-quiz tabs). Navigation via `useState`, no router library yet.
- `app/globals.css` — the design system ported from the prototype (green/mint theme).
- `lib/courses.ts` — `classes` (titles, descriptions, syllabi, units) and
  `starterPromptsByUnit`. Source of truth for course content.
- `lib/retrieve.ts` — `retrieveContext(question, course, matchCount, threshold)`;
  server-side, uses the publishable key. NB: the retrieval `course` filter uses the
  Supabase metadata labels (`physics`, `data-science`, `quant-finance`,
  `digital-narrative`, `advanced-ml`), not the app's `CourseKey` values
  (`physics`, `datascience`, `quantfinance`, `digitalnarrative`, `advancedml`) —
  the `RETRIEVAL_COURSE` maps in `app/api/chat/route.ts` AND `app/api/quiz/route.ts`
  translate; both must gain a row when a course is added.
- `lib/prompts.ts` — `getSystemPrompt({course, unit, mode, difficulty, context})`;
  ported from the prototype's `getSystemPrompt()` (tutor / checker / general modes), plus
  a `teach` mode (learn-by-teaching: the model role-plays a curious student and the user
  teaches it; the Difficulty control sets the student persona via `TEACH_PERSONA`).
- `app/api/chat/route.ts` — the tutor backend: retrieves context, builds the prompt,
  streams the reply (Claude `claude-sonnet-5` adaptive thinking, or OpenAI `gpt-5-mini`)
  back as plain text.
- `lib/llm.ts` — dual-provider, non-streaming `complete()` helper used by the quiz
  backend (Anthropic `claude-opus-5` preferred, OpenAI fallback; `reasoning_effort:
  "low"` on gpt-5). Kept on Opus (not Sonnet 5) because FRQ grading is the most
  judgment-heavy call in the app. Opus 5 thinks by default and thinking tokens count
  against `max_tokens`, so the Anthropic path sets `thinking: {type: "adaptive"}` and
  floors the budget at 4096 (mirroring the gpt-5 reasoning floor).
- `app/api/quiz/route.ts` — practice-quiz backend (Milestone 2): `mcq` (generate +
  `parseMcq` into structured choices), `frq` (generate), `grade` (score a response).
  RAG-grounded by unit topic.
- `lib/progress.ts` — local-only progress engine (Milestone 3): `Progress` type,
  `computeMastery`, streak/week helpers, `loadProgress`/`saveProgress` (localStorage,
  SSR-guarded). Session tracking + modals are wired in `app/page.tsx`.
- `app/Markdown.tsx` — `<Markdown>` component (Milestone 4): renders tutor/quiz text as
  Markdown + LaTeX (react-markdown + remark-math + rehype-katex), strips em/en dashes.
  Use `inline` for inline contexts (e.g. MCQ choices). KaTeX CSS is imported in layout.
  Also runs `protectCurrency()`: single-`$` spans that don't look like math (no LaTeX
  command, `^`/`_`/`=`, or short single token) get both dollars escaped so prose with
  two dollar amounts ("$100 now ... that $100 later") isn't eaten by remark-math.
  Matters constantly for Quant Finance; `$$...$$` and streaming partials are untouched.
- `scripts/ingest.ts` — CLI ingestion (uses **pdf-parse v2**: `new PDFParse({data}).getText()`,
  not v1's default export). Uses `SUPABASE_SECRET_KEY` (bypasses RLS to write).
  NB: the Voyage account is on the free tier (3 requests/min) — space multiple ingest
  runs ~70s apart or they 429; failures happen before insert, so no partial rows.
  Ingestion is **insert-only**: re-running it on the same PDF duplicates rows, so to
  replace a document delete its rows first (filter on `metadata->>source`).
  Source PDFs live in `course-materials/`; the store holds 180 chunks across the five
  courses (physics 19, data-science 12, advanced-ml 39, digital-narrative 36,
  quant-finance 74).
- `scripts/retrieve-test.ts` — manual retrieval test; takes the question and an optional
  Supabase course label (`physics` default) as args; dynamically imports `retrieve.ts`
  after loading `.env.local` (static ESM imports hoist above dotenv).

## The prototype (historical reference)

`docs/prototype/Socratic_Tutor_draft2_v1.html` is the original single-file HTML/CSS/JS app
(it called `window.claude.complete`, which only works inside claude.ai). It is the design
and behavior **blueprint** for the Next.js port. When building features (chat modes, MCQ/FRQ
quizzes, mastery/progress), port the corresponding logic from this file.

All of the prototype's behaviors have now been ported: the tutor modes (`lib/prompts.ts`),
the MCQ/FRQ quiz flows (`app/api/quiz/route.ts` + the quiz UI), the localStorage progress
engine (`lib/progress.ts`), KaTeX rendering (`app/Markdown.tsx`), and image attachments. The
prototype remains useful as a design/behavior reference.

## Key conventions (carry into the tutor)

- **No em/en dashes** in AI responses — the prototype's system prompt bans them.
- **LaTeX math**: inline `$...$`, display `$$...$$` (rendered via `app/Markdown.tsx`).
- **Currency is NOT math**: prompts tell the model to write `\$100`, and
  `protectCurrency()` in `app/Markdown.tsx` escapes non-math `$...$` spans as a
  deterministic backstop.
- **Hint gate**: "Show me the answer" stays disabled until the student uses 2 hints.
- **AI policy tiers**: both syllabi use Red/Yellow/Green; include in General Questions context.

## Secrets

In `.env.local` (gitignored). Server-only: `SUPABASE_SECRET_KEY`, `VOYAGE_API_KEY`,
`ANTHROPIC_API_KEY`. Browser-safe (`NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never import a server-only key into client code.

## Commands

- `npm run dev` — local dev server (http://localhost:3000)
- `npm run build` — production build + full type-check
- `npm run ingest -- "<pdf>" --course=<label> --section=<label>` — ingest a PDF
  (course = the Supabase metadata label, e.g. `quant-finance`)
- `npx tsx scripts/retrieve-test.ts "<question>" [course-label]` — test retrieval
