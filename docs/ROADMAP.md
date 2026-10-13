# Socratic Tutor — Roadmap

Your single source of truth for "what's done" and "what's next." Updated 2026-10-12.

---

## ✅ You are here

**All five milestones are LIVE and verified in production** at
**https://ransomtutor.vercel.app**: the chat tutor, the practice quizzes
(MCQ/FRQ + grading), progress tracking, the polish pass (KaTeX math +
image attachments), and **RAG grounding on the live site**.

**Accounts shipped 2026-10-12** (commit `c0d20ff`): required email + password
sign-in, progress synced to the account, every chat saved and resumable from a
**Chats** panel, dark mode, Privacy Policy + Terms of Use with recorded consent,
and self-serve account deletion. Supabase "Confirm email" is OFF (done
2026-10-12; verified sign-up returns a session immediately). Keep it off: the
built-in mailer can't reach students.
The model calls run on **Anthropic** (`ANTHROPIC_API_KEY` is set in prod): the
chat tutor uses **`claude-sonnet-5-5`** (fast + cost-efficient) and quiz generation +
FRQ grading use **`claude-opus-5-5`** (`lib/llm.ts`, since 2026-08-20). If the
Anthropic key is ever removed, both paths fall back to the **OpenAI bridge
(`gpt-5-mini`)** with no code change.

**Five courses are live** (2026-08-20): Physics, Data Science, **Quantitative
Finance & AI** (7 units), **Digital Narrative** (2 units), and **Advanced
Machine Learning** (6 units) — all in `lib/courses.ts` with per-unit starter
prompts, and all RAG-ingested into Supabase. Quant Finance is the deepest-
grounded course: beyond the syllabus and the "Story" PDF, the **Investment
Instruments** deck was ingested on 2026-08-27 (32 chunks, section
`investment instruments`), so the tutor can ground answers about stocks,
bonds, options, ETFs, and closed-end funds in the actual class material.

**Milestone 5 — Ship it is DONE.** The app is deployed to **Vercel**,
auto-deploying from `main`, with all required env vars set in Production and
retrieval confirmed working (no more `retrieveContext failed` in the runtime
logs).

| Done | What |
|------|------|
| ✅ | Supabase database (documents table, vector(1024), match_documents, HNSW, RLS) |
| ✅ | Voyage embeddings (voyage-3.5, 1024 dims) |
| ✅ | Ingestion script (`scripts/ingest.ts`) — all five courses ingested (180 chunks: physics 19, data-science 12, advanced-ml 39, digital-narrative 36, quant-finance 74) |
| ✅ | Retrieval helper (`lib/retrieve.ts`) — tested, returns ranked chunks |
| ✅ | New-format Supabase keys (`sb_secret_` / `sb_publishable_`) |
| ✅ | Next.js 16 app scaffolded (App Router, TypeScript, Tailwind) |
| ✅ | Prototype UI ported (`app/page.tsx`, `app/globals.css`, `lib/courses.ts`) — Home → Class → Unit, chat + practice shells |
| ✅ | Accounts: Supabase Auth, `progress` / `conversations` / `messages` tables + `chat-images` bucket (owner-only RLS), `delete_my_account()` |

---

## 👉 WHERE THINGS STAND

All five milestones are built, deployed, and verified in production, and the app
runs on **Anthropic** in prod (`claude-sonnet-5-5` chat / `claude-opus-5-5` quizzes).
Recent additions beyond the original milestones: three new courses (2026-08-20),
mode-switching + mode-aware starter prompts, retry/error handling for transient
LLM failures, the mobile UI overhaul, and the currency guard in `app/Markdown.tsx`
(dollar amounts no longer get swallowed by the math renderer — important for
Quant Finance). On 2026-09-12: instant "Next" in quizzes (background prefetch), no
more near-duplicate questions within a session, a UI cleanup pass, two MCQ
rendering fixes (choice D overwritten by explanation text; math delimiters broken
by the currency guard), and an accessibility pass from a design audit (keyboard
access, screen-reader announcements, contrast, touch targets, reduced motion).
On 2026-10-12: user accounts (login required), synced progress, saved chats with a
history panel to resume them, dark mode, Privacy Policy + Terms of Use, account
deletion, and a clean lint run. See "Future milestones" below for the details.


### Milestone 1 — Make the chat actually tutor ✅ DONE (live in production)

The chat tutor is wired end to end and verified responding:

- ✅ Both SDKs installed (`@anthropic-ai/sdk`, `openai`).
- ✅ `app/api/chat/route.ts` — receives message + course + unit + mode + difficulty,
  calls `retrieveContext()` for syllabus grounding, builds the prompt via
  `lib/prompts.ts`, and streams the reply. **Dual-provider:** Anthropic
  (`claude-sonnet-5-5`) when `ANTHROPIC_API_KEY` is set, otherwise OpenAI
  (`gpt-5-mini`).
- ✅ `app/page.tsx` — Send, Enter, hint buttons, "show answer" gate (2 hints),
  "I solved it", "new problem", New chat (was Reset), and Export all call the live tutor and
  render the streamed reply.

**Anthropic is live** in both local dev and production. The OpenAI bridge
remains as an automatic fallback if the key is ever removed.

> ⚠️ Known quirk on the OpenAI bridge (fallback only): `gpt-5-mini` occasionally
> emits an em dash despite the "no em/en dashes" rule in `lib/prompts.ts`.
> Cosmetic; `app/Markdown.tsx` strips them anyway.

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

### Milestone 3 — Progress ✅ DONE (synced to the account since 2026-10-12)
Originally progress lived only in the **browser's `localStorage`** (no login).
Since accounts shipped, it's stored on the student's account (`progress` table)
with a per-account localStorage copy for instant loading. Implemented in `lib/progress.ts`
(types, mastery/streak/week math, load/save) and wired through `app/page.tsx`:
- **Per-unit mastery rings** on the class screen (was hardcoded 0).
- **Streak**, **weekly-goal** (editable via a modal), and **all-time problems**
  in the home stats bar.
- **Session recap modal** when you leave a unit you practiced in (time, problems,
  solved, hints, mastery delta).
- Progress is fed by BOTH the chat tutor ("I solved it" = solved, each hint =
  small penalty) AND the quizzes (each MCQ/FRQ counts; MCQ-correct = solved).

> Storage: the account's row in the `progress` table is the source of truth;
> `socratic_progress_v1:<userId>` in localStorage is a cache, and whichever copy has
> the newer `updatedAt` wins on load. Clearing browser data no longer loses progress.

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
2. ~~Import the repo into **Vercel**~~ ✅ done — project `ransom-tutor` under the
   "Brandon's projects" team, auto-deploying from `main`.
3. ~~**Environment Variables:**~~ ✅ done — set in Vercel → Settings → Environment
   Variables, scoped to **Production**:
   - **Required (all set):** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (fallback),
     `VOYAGE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - **Skip:** `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (ingest-only, not used by the live
     app).
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

## 🔮 Future milestones (open + recently shipped)

Ideas captured for future rounds of work. Open items are `[ ]`; `[x]` entries
have shipped and are kept here as a record of what was done and where.

- [ ] **Real problems from the class** — pull in the actual problems used in
      class as exemplars, then have the tutor/quizzes generate *new* questions
      modeled on those (same style and difficulty). Don't just serve the class
      problems verbatim — use them to calibrate the type and difficulty of the
      AI-generated practice.
- [ ] **Other advanced physics teacher's syllabus** — get that teacher's
      syllabus and ingest it as RAG course material. (Remember: ingestion is
      insert-only — to replace, delete old rows first; see Housekeeping below.)
- [x] **User accounts (required login)**: DONE (2026-10-12). Email + password via
      Supabase Auth; the app shows only `app/AuthScreen.tsx` until a session exists
      (`Home` in `app/page.tsx` gates on `onAuthStateChange` and keys `TutorApp` by user
      id). `/api/chat` and `/api/quiz` reject requests without a valid access token
      (`lib/auth-server.ts` `requireUser()`, which also returns a Supabase client acting
      as the student, so RLS covers every server write). Progress syncs to the
      `progress` table (one JSON row per student); localStorage keeps a per-account
      copy (`socratic_progress_v1:<userId>`) and `updatedAt` picks the newer side. A
      device's old pre-account progress goes to the first account that signs in there.
      **Dashboard setting (done 2026-10-12):** Supabase → Authentication → Sign In /
      Providers → Email → "Confirm email" is OFF (the built-in mailer only reaches project team
      members, so students would never get the email).
      **Delete account** (footer) opens `app/DeleteAccountDialog.tsx`, an alertdialog that
      stays locked until the student types DELETE. `deleteMyAccount()` in `lib/cloud.ts`
      removes their Storage images, then calls the `delete_my_account()` SQL function
      (security definer, `auth.uid()` only, no execute for anon), which deletes the auth
      user and cascades to every table. No secret key needed on the server. No password reset for the same
      reason; add custom SMTP (e.g. Resend) if that becomes needed.
- [x] **Privacy Policy + Terms of Use**: DONE (2026-10-12). `/privacy` and `/terms`
      (`app/privacy/page.tsx`, `app/terms/page.tsx`, shared frame `app/LegalPage.tsx`).
      Sign-up requires an "I'm 13+ and agree" checkbox and stores `terms_version` +
      `terms_accepted_at` in the account's `user_metadata`. Any signed-in account whose
      `terms_version` isn't the current `LEGAL_VERSION` (`lib/legal.ts`) sees
      `ConsentScreen` before the app, so bumping the version re-asks everyone. Footer
      links in the app and on the sign-in screen. **Not legal advice; have the school
      or a parent/advisor review before launch.** Keep the policy in step with the code:
      new data, providers, or analytics mean an edit + version bump.
- [x] **Persist chats across sessions**: DONE (2026-10-12). Tables `conversations`
      and `messages` (owner-only RLS) plus a private `chat-images` Storage bucket
      (`<userId>/<conversationId>/<uuid>.jpg`). The chat route creates the conversation
      on the first turn (id returned in `X-Conversation-Id`), saves the new user message
      while the reply streams, and saves the reply before closing the stream.
      "New chat" (was Reset) and mode switches start a fresh saved chat.
- [x] **Resume any past chat**: DONE (2026-10-12). "Chats" in the header opens
      `app/HistoryPanel.tsx`: chats grouped by course + unit, newest first, with
      rename and delete (delete also removes stored images). Opening one restores
      unit, mode, difficulty, and messages (images re-downloaded as data URLs so the
      model sees them again) without going through `handleModeChange`.
- [x] **Add more classes** — DONE 2026-08-20 for three courses: **Quantitative
      Finance & AI** (7 units, from the "Story" PDF's unit arc), **Digital
      Narrative** (2 units), and **Advanced Machine Learning** (6 units). Each
      needed: a `Course` entry + per-unit starter prompts in `lib/courses.ts`,
      a `RETRIEVAL_COURSE` row in BOTH `app/api/chat/route.ts` and
      `app/api/quiz/route.ts` (app-key vs. Supabase-label mismatch), and a
      `npm run ingest` per PDF (mind the Voyage 3-requests/min free tier —
      space runs ~70s apart). Remaining candidates:
  - [ ] **Marine Field Research**
  - [ ] **Literary Theory**
- [x] **"Teach the Tutor" mode (learn-by-teaching)** — DONE. A role-flipped chat
      mode: the *student* teaches and the chatbot plays a curious student
      (protégé effect). Added `"teach"` to `Mode` in `lib/prompts.ts` with a
      `getSystemPrompt` branch that role-plays a student — it asks clarifying
      questions, requests worked examples, probes "why", occasionally voices a
      plausible wrong idea for the teacher to correct, and summarizes "what I
      learned" so the teacher can check. The existing Difficulty control doubles
      as the student's sophistication (`TEACH_PERSONA`: warmup = novice →
      challenge = skeptical peer). A "Teach the Tutor" mode button is wired into
      `app/page.tsx` (mode-aware intro bubble + export labels); `mode` flows
      through `app/api/chat/route.ts` unchanged. Verified end to end on the
      Anthropic chat path (now `claude-sonnet-5-5`).
- [x] **Mode-aware starter prompts** — DONE (extended to Solution Checker too).
      `getStarterPrompts(mode, unit)` in `lib/courses.ts` returns the chips for
      the chat view: tutor mode keeps the hand-written per-unit questions in
      `starterPromptsByUnit`; checker and teach modes get four mode-generic
      openers spliced with the unit topic (the data-science "Unit N:" title
      prefix is stripped for splicing). Rendered via `app/page.tsx`
      (`.starter-prompts`); chips refresh on mode switch because changing modes
      clears the chat (`handleModeChange`), which re-shows the starter row.
- [x] **"Thinking" animation while the tutor responds** — DONE. The assistant
      bubble now shows an animated three-dot typing indicator while `isStreaming`
      and the accumulated text is still empty, then swaps to the streamed text on
      the first token (`app/page.tsx`). Reused the already-defined-but-unused
      `.typing-dots` styles in `app/globals.css` (now `@keyframes typingPulse`)
      (the JSX previously rendered a static "…"). Verified live in the browser.
      (Follow-up idea: give the FRQ "Grading..." wait the same treatment.)
- [x] **Pre-generate quiz questions to cut wait time** — DONE (2026-09-12).
      `app/page.tsx` keeps a one-slot `prefetchRef` buffer keyed by
      (course, unit, practiceMode, difficulty) via `questionKey()`. As soon as a
      question is shown, `prefetchQuestion()` starts generating the next one;
      "Next" serves it instantly if resolved, awaits it if still in flight, and
      falls back to a live fetch on a miss or background failure.
      `resetQuiz()` (unit / mode change) clears the buffer and bumps
      `quizEpochRef` so late responses are dropped; `switchPracticeDiff()` keeps
      the current question but re-aims the prefetch at the new difficulty.
      The first question of a session still waits (nothing to prefetch from).
      Cost: each practice session ends with one unused generated question.
- [x] **No repeated quiz questions within a session**: DONE (2026-09-12).
      Consecutive questions used to converge on the unit's most canonical problem
      (the same cliff projectile twice). `app/page.tsx` sends the last 6 shown
      questions as `recent` with every generate request, including the prefetch;
      `quizVariety()` in `lib/prompts.ts` demands a different subtopic, scenario, and
      structure. Session-scoped: reload or a unit/mode change clears the list.
- [x] **MCQ choice D contaminated by the explanation**: DONE (2026-09-12).
      `parseMcq()` ran its choice regex over the whole response, so "(USD)" in an
      explanation matched as "D)" and replaced the real option (seen live in Quant
      Finance). Now it scans only between the question and `CORRECT:`, anchors to
      line starts, and keeps the first match per letter. Mirrored in the prototype.
- [x] **Math delimiters destroyed by the currency guard**: DONE (2026-09-12).
      Live symptom: "$5.00%$ for USD" and "$144.29$ yen per dollar" shown with
      literal dollar signs. `protectCurrency()` now keeps any balanced same-line
      `$...$` pair for KaTeX and escapes only stray `$`; it also fixes bare `%` and
      `\$` inside math (the latter mispaired every later `$` in some explanations).
      Prompts now say: `$...$` only for real math, plain numbers and percentages as
      text, currency as `\$100` and never inside math, percent in math as `\%`.
      Verified on 8 fresh Quant Finance MCQs (one per unit + a challenge): all parse,
      31 math spans render, zero KaTeX errors, D always a real choice.
- [x] **UI cleanup pass**: DONE (2026-09-12). Solid hero headline instead of
      gradient text, no card hover accent strip, box-style blockquotes instead of
      a side border, pulsing (not hopping) typing dots, and progress bars animated
      with `transform` instead of `width`.
- [x] **Accessibility + audit fixes**: DONE (2026-09-12). A design audit scored the
      app 12/20, held back by accessibility (1/4). Fixed:
      - Keyboard: course/unit cards, logo, and breadcrumbs were divs with onClick and
        unreachable by Tab; now real buttons, with a palette `:focus-visible` ring.
      - Screen readers: `role="status"` announcer for toasts and quiz results, chat
        as `role="log"` with `aria-busy` while streaming, ARIA tabs for Chat/Practice,
        `aria-pressed` toggles, labels on the chat box, FRQ answer, and goal input.
      - Dialogs: `useDialog()` adds focus-in, Tab trap, Escape, and focus return.
      - Contrast: `--text-faint` from 2.95:1 to 5.0:1; Send gradient end to 5:1.
      - Touch: 44px targets under `(pointer: coarse)`; trailing-edge fade on
        scrollable mobile control rows.
      - Motion: `MotionConfig reducedMotion="user"`; reduced motion keeps loaders
        pulsing instead of freezing them; no smooth scroll per streamed chunk.
      - Polish: success/danger tokens, "Ransom Tutor" in header and title, fixed
        wrong-answer copy, removed unused `lib/utils.ts` (clsx, tailwind-merge).
      Browser-verified: tab order and dialog focus behavior. Not yet verified in a
      live browser: the unit screen (tabs, toggles), phone touch sizes, reduced
      motion. Worth a quick manual check.
- [x] **Dark mode**: DONE (2026-10-12). Follows the device setting, with a ☾/☀
      toggle in the header and on the sign-in screen (choice saved per browser). A
      script in `app/layout.tsx` sets `data-theme` before first paint; the dark palette
      is `:root[data-theme="dark"]` in `app/globals.css`.
- [x] **Lint**: DONE (2026-10-12). `lib/retrieve.ts` and `scripts/ingest.ts` no
      longer use `any`; `npx eslint .` is clean.
- [x] **Fix mobile UI** — DONE (2026-07-14). Mobile pass at ≤640px: control
      strips became horizontally scrollable single rows, header collapses to
      logo + truncating breadcrumbs, chat height uses `dvh` (mobile Safari URL
      bar), 16px input floor stops iOS auto-zoom, scroll resets on navigation.
- [x] **Retry transient LLM errors / friendly error copy** — DONE (2026-07-14).
      `describeLlmError()` in `lib/llm.ts` classifies 529/429/500/503 and
      mid-stream SSE errors (status === undefined); chat + quiz routes retry
      with backoff (only while no tokens have streamed) and ship student-safe
      messages instead of raw API bodies.
- [x] **Currency guard in the math renderer** — DONE (2026-08-20).
      `protectCurrency()` in `app/Markdown.tsx` escapes non-math `$...$` spans
      so prose with two dollar amounts isn't rendered as math italic, plus a
      "currency is not math, write \$100" rule in both prompt constants in
      `lib/prompts.ts`. Critical for Quant Finance. (Rewritten 2026-09-12, see
      "Math delimiters destroyed by the currency guard" above.)
- [x] **Quiz backend on Claude Opus 5** — DONE (2026-08-20). `lib/llm.ts` moved
      from `claude-opus-4-8` to `claude-opus-5` with explicit adaptive thinking
      and a 4096 `max_tokens` floor (thinking tokens count against the budget).

---

## 🧹 Housekeeping (do when convenient)
- [x] **Turn off "Confirm email"** in Supabase Auth: DONE 2026-10-12, verified.
- [ ] **Review the legal pages** with the school or a fellowship advisor, and decide
      whether `LEGAL_CONTACT_EMAIL` in `lib/legal.ts` should be a separate address
      (it's shown publicly on `/privacy` and `/terms`).
- [ ] Rotate the Supabase secret key (it passed through a chat once).
- [ ] Ingest any updated PDFs. **Ingestion is insert-only** — to *replace* a
      syllabus, delete the old rows first, then re-ingest. (And remember the
      Voyage free-tier limit: 3 requests/min — space runs ~70s apart.)
  ```bash
  # 1) delete old rows for a course
  node --input-type=module -e 'import{config}from"dotenv";import{createClient}from"@supabase/supabase-js";config({path:".env.local",quiet:true});const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY);const{error,count}=await sb.from("documents").delete({count:"exact"}).eq("metadata->>course","data-science");console.log(error?error.message:`deleted ${count}`)'
  # 2) re-ingest
  npx tsx scripts/ingest.ts "./course-materials/Syllabus.pdf" --course=data-science --section=syllabus
  ```
