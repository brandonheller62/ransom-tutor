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
- **Anthropic API** — for the tutor itself (Milestone 1, not yet wired).
- `package.json` has `"type": "module"` (required for the standalone tsx scripts).

## Current status

The RAG pipeline works and the UI is ported from the prototype, but the AI responses
are **not connected yet**. See `docs/ROADMAP.md` for the authoritative status and next
steps. AI actions in `app/page.tsx` currently show a "not wired yet" toast.

## Architecture

- `app/page.tsx` — client-side SPA: Home (course cards) → Class (unit cards) →
  Unit (chat + practice-quiz tabs). Navigation via `useState`, no router library yet.
- `app/globals.css` — the design system ported from the prototype (green/mint theme).
- `lib/courses.ts` — `classes` (titles, descriptions, syllabi, units) and
  `starterPromptsByUnit`. Source of truth for course content.
- `lib/retrieve.ts` — `retrieveContext(question, course, matchCount, threshold)`;
  server-side, uses the publishable key. Drops into an API route unchanged.
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
