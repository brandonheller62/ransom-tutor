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
  similarity function, HNSW index, RLS (public read, secret-key write). Also **Auth**
  (email + password, login required) and the per-student tables `progress`,
  `conversations`, `messages` + private Storage bucket `chat-images`, all owner-only RLS
  (see "Accounts, saved chats, dark mode" below).
- **Voyage AI** — `voyage-3.5` embeddings, 1024 dimensions.
- **Tutor LLM** — dual-provider in `app/api/chat/route.ts`: Anthropic `claude-sonnet-5-5`
  (preferred) or OpenAI `gpt-5-mini` (fallback), chosen by which API key is present.
  Note the model split: the **chat tutor** runs on `claude-sonnet-5-5` (fast + cheap),
  while the **quiz backend** (`lib/llm.ts`) keeps `claude-opus-5-5` for FRQ grading.
- `package.json` has `"type": "module"` (required for the standalone tsx scripts).

## Current status

**All five milestones are DONE and live in production** at
https://ransomtutor.vercel.app. Milestone 1 (the chat tutor) streams end to end
(`app/api/chat/route.ts` builds the prompt via `lib/prompts.ts` + `lib/retrieve.ts`,
and `app/page.tsx` renders the stream). The route is **dual-provider** — it uses
Anthropic (`claude-sonnet-5-5`) when `ANTHROPIC_API_KEY` is set, otherwise falls back to
OpenAI (`gpt-5-mini`) via `OPENAI_API_KEY`. The Anthropic key IS set in production —
both paths run on Claude; the OpenAI bridge is the no-code-change fallback. Milestone 2
(practice quizzes) is also **done**: `app/api/quiz/route.ts` (MCQ/FRQ/grade) +
`lib/llm.ts` + the interactive quiz UI in `app/page.tsx`. Milestone 3 (progress) is
**done** too: `lib/progress.ts` is the engine for streaks, weekly goals, and per-unit
mastery, wired through `app/page.tsx` (rings, stats bar, goal + recap modals). Since
2026-10-12 (commit `c0d20ff`) login is REQUIRED (email + password, Supabase Auth) and
progress syncs to the account; saved chats, chat history, dark mode, legal pages, and
account deletion shipped the same day (see Accounts below). Milestone 4 (polish) is **done**: KaTeX math rendering via
`app/Markdown.tsx` (react-markdown + remark-math + rehype-katex; KaTeX CSS in
`app/layout.tsx`) and image attachments (📎 → base64 data URL → vision block) in BOTH the chat tutor
(`app/api/chat/route.ts`) and the FRQ grader (`app/api/quiz/route.ts` via `lib/llm.ts`),
sharing `lib/image.ts` (`parseDataUrl`). Milestone 5 (ship it) is **DONE — live and RAG-
verified in production** at https://ransomtutor.vercel.app (Vercel project `ransom-tutor`,
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

- `app/page.tsx` — default export `Home` is the auth gate (sign-in → terms consent →
  app); `TutorApp` is the client-side SPA: Home (course cards) → Class (unit cards) →
  Unit (chat + practice-quiz tabs). Navigation via `useState`, no router library yet.
  Quiz flow: `prefetchRef` is a one-slot buffer that generates the NEXT question in the
  background as soon as one is shown (keyed by course|unit|mode|difficulty via
  `questionKey()`), so "Next" is instant; `resetQuiz()` clears it and bumps `quizEpochRef`
  so late responses after a unit/mode switch are dropped. `recentQuestionsRef` holds the
  last 6 questions shown this session and is sent as `recent` on every generate request
  (including the prefetch) so the model doesn't repeat itself.
  Accessibility wiring (2026-09-12 audit): every clickable thing is a real `<button>`
  (cards are `motion.button`, so their children must be spans, not divs); a hidden
  `role="status"` region fed by `announce()` reads toasts and quiz results; the chat
  list is `role="log"` with `aria-busy={isStreaming}` so replies are read once complete;
  Chat/Practice is an ARIA tablist (arrow keys); toggle buttons carry `aria-pressed`.
  `useDialog(open, onClose)` gives both modals focus-in, Tab trapping, Escape, and focus
  return. GOTCHA: never put `autoFocus` inside a dialog; React focuses it before the
  hook runs, so the hook records the input as the opener and focus never returns.
  The tree is wrapped in `<MotionConfig reducedMotion="user">`.
- `app/globals.css` — the design system ported from the prototype (green/mint theme).
  Tokens include answer states (`--success-bg`, `--danger`, ...); `--text-faint` is held
  at 4.5:1+ contrast because it styles small uppercase labels. Global `:focus-visible`
  ring in `--accent`. `@media (pointer: coarse)` sets 44px touch targets (keyed to input
  device so iPads get it). Mobile control rows fade their trailing edge via a scroll-driven
  `--row-fade` animation. Reduced motion removes movement but keeps loaders pulsing.
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
  Quiz prompts: `getMcqPrompt` / `getFrqPrompt` / `getGradePrompt` share
  `QUIZ_FORMATTING`; the chat modes share `FORMATTING_RULES`. Both carry the same math
  rules (see Key conventions). `quizVariety(recent)` tells the generators to pick a
  fresh subtopic and scenario and to avoid every previously asked question.
- `app/api/chat/route.ts` — the tutor backend: retrieves context, builds the prompt,
  streams the reply (Claude `claude-sonnet-5-5` adaptive thinking, low effort, or OpenAI `gpt-5-mini`)
  back as plain text.
- `lib/llm.ts` — dual-provider, non-streaming `complete()` helper used by the quiz
  backend (Anthropic `claude-opus-5-5` preferred, OpenAI fallback; `reasoning_effort:
  "low"` on gpt-5). Kept on Opus (not Sonnet 5.5) because FRQ grading is the most
  judgment-heavy call in the app. Opus 5.5 always thinks and thinking tokens count
  against `max_tokens`, so the Anthropic path sets `thinking: {type: "adaptive"}` and
  floors the budget at 4096 (mirroring the gpt-5 reasoning floor).
- `app/api/quiz/route.ts` — practice-quiz backend (Milestone 2): `mcq` (generate +
  `parseMcq` into structured choices), `frq` (generate), `grade` (score a response).
  RAG-grounded by unit topic. `parseMcq` only scans for `A)`-`D)` lines between the
  question and `CORRECT:` (or `EXPLANATION:`), anchored to line starts, first match
  wins. Scanning the whole response once let "(USD)" in an explanation overwrite
  choice D. Any missing choice still returns null, so the route 422s and logs the raw
  text. `sanitizeRecent()` caps the client's `recent` list at 6 entries of 500 chars.
  The prototype's `parseMCQQuizResponse()` mirrors the same parsing rules.
- `lib/progress.ts` — progress engine (Milestone 3): `Progress` type,
  `computeMastery`, streak/week helpers, per-account `loadProgress(userId)`/
  `saveProgress(p, userId)` (localStorage cache, SSR-guarded) and `takeLegacyProgress()`.
  Account sync lives in `lib/cloud.ts`; session tracking + modals in `app/page.tsx`.
- `app/Markdown.tsx` — `<Markdown>` component (Milestone 4): renders tutor/quiz text as
  Markdown + LaTeX (react-markdown + remark-math + rehype-katex), strips em/en dashes.
  Use `inline` for inline contexts (e.g. MCQ choices). KaTeX CSS is imported in layout.
  Also runs `protectCurrency()`, a line-by-line scanner: a `$` is a math delimiter only
  if a closing `$` exists on the same line and the span is plausible math (no
  whitespace just inside the delimiters, no dangling `-`/`+`/`,` at the end). Those
  pairs are kept for KaTeX; every other `$` is escaped and renders as a dollar sign.
  Inside kept spans, a bare `%` becomes `\%` (TeX comment) and `\$` becomes
  `\text{\textdollar}` (remark-math ignores backslash escapes inside math and would
  close the span at that `$`). `\$`, `$$`, fenced code, and inline code are untouched.
  GOTCHA: remark-math renders one-line `$$...$$` as INLINE math; only `$$` on their own
  lines produce display math. Matters constantly for Quant Finance.
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

## Accounts, saved chats, dark mode (2026-10-12)

- `app/page.tsx` default export `Home` is the auth gate: no session → `app/AuthScreen.tsx`;
  session → `TutorApp` (the old `Home`), keyed by user id. API calls go through
  `apiPost()`, which adds the bearer token and signs out on a 401.
- `lib/supabase-browser.ts` — the browser client + `authHeaders()`.
  `lib/auth-server.ts` — `requireUser(req)` verifies the token with `getClaims` and
  returns a client acting as the student (publishable key + their JWT), so RLS applies.
- Tables (all owner-only RLS): `progress` (user_id PK, data jsonb), `conversations`,
  `messages` (role, content, image_path); private Storage bucket `chat-images`, paths
  `<userId>/<conversationId>/<uuid>.<ext>`. Server writes: `lib/chat-store.ts`; browser
  reads/rename/delete + progress sync: `lib/cloud.ts`.
- Chat route saves turns best-effort and never blocks tutoring; the first turn's
  conversation id comes back in `X-Conversation-Id`. `chatEpochRef` drops a reply still
  streaming into a chat that was replaced (New chat, mode switch, resume).
- Progress: per-account localStorage cache `socratic_progress_v1:<userId>`; `updatedAt`
  decides device vs. account; the unkeyed legacy blob goes to the first account on a device.
- Dark mode: `data-theme` on `<html>` set pre-paint by the script in `app/layout.tsx`
  (saved choice or device setting); `app/ThemeToggle.tsx`; palette in `app/globals.css`.
  Text on solid `--accent` fills uses `--on-accent` (white in light, near-black in dark).
- Account deletion: footer "Delete account" → `app/DeleteAccountDialog.tsx` (type DELETE
  to unlock) → `deleteMyAccount()` in `lib/cloud.ts`: removes Storage images first (SQL
  can't delete Storage objects), then RPC `delete_my_account()` (security definer, deletes
  `auth.uid()` only) cascades everything else. Then local sign-out + `clearProgress()`.
- `useDialog` now lives in `app/useDialog.ts` (shared by the modals and the history drawer).
- Legal: `/privacy` + `/terms` describe exactly what the app stores and which providers
  receive data (Supabase, Vercel, Anthropic, OpenAI fallback, Voyage). Consent is stored
  in `user_metadata.terms_version`; `Home` shows `ConsentScreen` until it equals
  `LEGAL_VERSION` in `lib/legal.ts`. If you add data collection, a provider, or
  analytics, update `app/privacy/page.tsx` and bump `LEGAL_VERSION`.
- Supabase setting: Auth → Email → "Confirm email" is OFF (set 2026-10-12). Keep it off;
  the default mailer can't reach students, so sign-up would never complete.

## The prototype (historical reference)

`docs/prototype/Socratic_Tutor_draft2_v1.html` is the original single-file HTML/CSS/JS app
(it called `window.claude.complete`, which only works inside claude.ai). It is the design
and behavior **blueprint** for the Next.js port. When building features (chat modes, MCQ/FRQ
quizzes, mastery/progress), port the corresponding logic from this file.

All of the prototype's behaviors have now been ported: the tutor modes (`lib/prompts.ts`),
the MCQ/FRQ quiz flows (`app/api/quiz/route.ts` + the quiz UI), the progress
engine (`lib/progress.ts`), KaTeX rendering (`app/Markdown.tsx`), and image attachments. The
prototype remains useful as a design/behavior reference.

## Key conventions (carry into the tutor)

- **No em/en dashes** in AI responses — the prototype's system prompt bans them.
- **LaTeX only for real math**: inline `$...$`, display `$$...$$` (rendered via
  `app/Markdown.tsx`), used only for variables, equations, fractions, and symbols.
  Plain numbers, prices, and percentages stay as text (`144.29 yen per dollar`, not
  `$144.29$`).
- **Currency is NOT math**: always `\$100`, and never a dollar sign inside `$...$`
  (keep the math unitless and name the currency in the prose).
- **Percent inside math is `\%`**: a bare `%` is a TeX comment and breaks the span.
- `protectCurrency()` in `app/Markdown.tsx` is the deterministic backstop for all
  three rules, since RAG chunks and student text flow through the renderer too.
- **Hint gate**: "Show me the answer" stays disabled until the student uses 2 hints.
- **AI policy tiers**: both syllabi use Red/Yellow/Green; include in General Questions context.
- **Accessible by default**: new clickable UI is a `<button>` (never a div with onClick),
  icon-only controls get `aria-label`, selected states get `aria-pressed`/`aria-selected`,
  and status changes a student needs to hear go through `announce()`.

## Secrets

In `.env.local` (gitignored). Server-only: `SUPABASE_SECRET_KEY`, `VOYAGE_API_KEY`,
`ANTHROPIC_API_KEY`. Browser-safe (`NEXT_PUBLIC_`): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never import a server-only key into client code.
The live app never needs `SUPABASE_SECRET_KEY`: API routes act as the signed-in student
(`lib/auth-server.ts`), and account deletion goes through the `delete_my_account()` SQL
function. Keep it that way; the secret key is for `scripts/ingest.ts` and admin scripts.

## Commands

- `npm run dev` — local dev server (http://localhost:3000)
- `npm run build` — production build + full type-check
- `npm run ingest -- "<pdf>" --course=<label> --section=<label>` — ingest a PDF
  (course = the Supabase metadata label, e.g. `quant-finance`)
- `npx tsx scripts/retrieve-test.ts "<question>" [course-label]` — test retrieval
