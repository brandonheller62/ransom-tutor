# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

A Socratic AI tutor built for an AI Innovation Fellowship at Ransom Everglades school.
It tutors students in two classes:

- **Advanced Physics: Mechanics** (10 units, algebra-based, SCI 514)
- **Applied Data Science** (9 units, Python-based, 2-semester arc)

The tutor leads students through problems with hints instead of answers, grounded in
the course syllabi via RAG (retrieval-augmented generation).

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — note: Next 16 has breaking changes
  vs. older docs; see `AGENTS.md` and consult `node_modules/next/dist/docs/` when needed.
- **Supabase** — `documents` table with `embedding vector(1024)`, `match_documents()`
  similarity function, HNSW index, RLS (public read, secret-key write).
- **Voyage AI** — `voyage-3.5` embeddings, 1024 dimensions.
- **Tutor LLM** — dual-provider in `app/api/chat/route.ts`: Anthropic `claude-opus-4-8`
  (preferred) or OpenAI `gpt-5-mini` (fallback), chosen by which API key is present.
- `package.json` has `"type": "module"` (required for the standalone tsx scripts).

## Current status

Milestone 1 is **done and live on localhost**: the chat tutor streams end to end
(`app/api/chat/route.ts` builds the prompt via `lib/prompts.ts` + `lib/retrieve.ts`,
and `app/page.tsx` renders the stream). The route is **dual-provider** — it uses
Anthropic (`claude-opus-4-8`) when `ANTHROPIC_API_KEY` is set, otherwise falls back to
OpenAI (`gpt-5-mini`) via `OPENAI_API_KEY`. Currently running on the OpenAI bridge until
the Anthropic key is added (Anthropic is preferred when both are present). Milestone 2
(practice quizzes) is also **done**: `app/api/quiz/route.ts` (MCQ/FRQ/grade) +
`lib/llm.ts` + the interactive quiz UI in `app/page.tsx`. Milestone 3 (progress) is
**done** too: `lib/progress.ts` is a local-only (browser `localStorage`, key
`socratic_progress_v1`) engine for streaks, weekly goals, and per-unit mastery, wired
through `app/page.tsx` (rings, stats bar, goal + recap modals). No login / no Supabase
for progress. Milestone 4 (polish) is **done**: KaTeX math rendering via
`app/Markdown.tsx` (react-markdown + remark-math + rehype-katex; KaTeX CSS in
`app/layout.tsx`) and image attachments (📎 → base64 data URL → vision block) in BOTH the chat tutor
(`app/api/chat/route.ts`) and the FRQ grader (`app/api/quiz/route.ts` via `lib/llm.ts`),
sharing `lib/image.ts` (`parseDataUrl`). Only Milestone 5 (deploy to Vercel) remains. See
`docs/ROADMAP.md` for the authoritative status.

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
  Supabase metadata labels (`physics` / `data-science`), not the app's `CourseKey`
  (`physics` / `datascience`) — `app/api/chat/route.ts` maps between them.
- `lib/prompts.ts` — `getSystemPrompt({course, unit, mode, difficulty, context})`;
  ported from the prototype's `getSystemPrompt()` (tutor / checker / general modes).
- `app/api/chat/route.ts` — the tutor backend: retrieves context, builds the prompt,
  streams the reply (Claude `claude-opus-4-8` adaptive thinking, or OpenAI `gpt-5-mini`)
  back as plain text.
- `lib/llm.ts` — dual-provider, non-streaming `complete()` helper used by the quiz
  backend (Anthropic preferred, OpenAI fallback; `reasoning_effort: "low"` on gpt-5).
- `app/api/quiz/route.ts` — practice-quiz backend (Milestone 2): `mcq` (generate +
  `parseMcq` into structured choices), `frq` (generate), `grade` (score a response).
  RAG-grounded by unit topic.
- `lib/progress.ts` — local-only progress engine (Milestone 3): `Progress` type,
  `computeMastery`, streak/week helpers, `loadProgress`/`saveProgress` (localStorage,
  SSR-guarded). Session tracking + modals are wired in `app/page.tsx`.
- `app/Markdown.tsx` — `<Markdown>` component (Milestone 4): renders tutor/quiz text as
  Markdown + LaTeX (react-markdown + remark-math + rehype-katex), strips em/en dashes.
  Use `inline` for inline contexts (e.g. MCQ choices). KaTeX CSS is imported in layout.
- `scripts/ingest.ts` — CLI ingestion (uses **pdf-parse v2**: `new PDFParse({data}).getText()`,
  not v1's default export). Uses `SUPABASE_SECRET_KEY` (bypasses RLS to write).
- `scripts/retrieve-test.ts` — manual retrieval test; dynamically imports `retrieve.ts`
  after loading `.env.local` (static ESM imports hoist above dotenv).

## The prototype (historical reference)

`docs/prototype/Socratic_Tutor_draft2_v1.html` is the original single-file HTML/CSS/JS app
(it called `window.claude.complete`, which only works inside claude.ai). It is the design
and behavior **blueprint** for the Next.js port. When building features (chat modes, MCQ/FRQ
quizzes, mastery/progress), port the corresponding logic from this file.

Prototype behaviors still to port: `getSystemPrompt()` (4 modes — Socratic Tutor, Solution
Checker, MCQ Practice, FRQ Practice), the MCQ/FRQ quiz flows, and the localStorage progress
engine (streaks, weekly goals, `computeMastery()`).

## Key conventions (carry into the tutor)

- **No em/en dashes** in AI responses — the prototype's system prompt bans them.
- **LaTeX math**: inline `$...$`, display `$$...$$` (KaTeX rendering still to be added).
- **Hint gate**: "Show me the answer" stays disabled until the student uses 2 hints.
- **AI policy tiers**: both syllabi use Red/Yellow/Green; include in General Questions context.

## Secrets

In `.env.local` (gitignored). Server-only: `SUPABASE_SECRET_KEY`, `VOYAGE_API_KEY`,
`ANTHROPIC_API_KEY`. Browser-safe (`NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never import a server-only key into client code.

## Commands

- `npm run dev` — local dev server (http://localhost:3000)
- `npm run build` — production build + full type-check
- `npm run ingest -- "<pdf>" --course=<key> --section=<label>` — ingest a PDF
- `npx tsx scripts/retrieve-test.ts "<question>"` — test retrieval
