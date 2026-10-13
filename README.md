# Socratic AI Tutor

A guided, Socratic AI tutor for five Ransom Everglades courses — **Advanced Physics:
Mechanics**, **Applied Data Science**, **Quantitative Finance & AI**, **Digital
Narrative**, and **Advanced Machine Learning** — built for the AI Innovation Fellowship.

The tutor leads students through problems with hints instead of handing over answers,
grounded in the actual course syllabi via retrieval-augmented generation (RAG).

**Status: live at [ransomtutor.vercel.app](https://ransomtutor.vercel.app).** The chat
tutor, practice quizzes (MCQ/FRQ + grading), progress tracking, KaTeX math, image
attachments, a learn-by-teaching "Teach the Tutor" mode, and RAG syllabus grounding all
work end to end across all five courses. Students sign in with an email and password;
their progress follows them across devices, every chat is saved and can be resumed from
the **Chats** panel, and the app has a dark mode, a Privacy Policy and Terms of Use, and
self-serve account deletion.

<img width="1366" height="896" alt="image" src="https://github.com/user-attachments/assets/6bb56307-dabb-4a9f-b3bb-214500f604c0" />

<img width="1195" height="1008" alt="image" src="https://github.com/user-attachments/assets/0cc9670f-02a7-4fa5-8c6b-08bbe0494d19" />

<img width="1213" height="980" alt="image" src="https://github.com/user-attachments/assets/9194ba93-da7a-47b5-a68a-bbb9d2fdccd9" />


---

## Quick start

```bash
# install dependencies (first time only)
npm install

# run the app locally
npm run dev
```
Then open **http://localhost:3000**. To stop the server, press **Ctrl + C** in the terminal.

> The app needs a model key + the Supabase and Voyage keys in `.env.local` to respond
> (see **Secrets** below), and you'll need to sign in, since every page and API route
> requires an account. It uses Anthropic (`claude-sonnet-5-5` for the chat tutor, `claude-opus-5-5` for
> quiz grading) when `ANTHROPIC_API_KEY` is set, otherwise falls back to OpenAI
> (`gpt-5-mini`).

---

## Project structure

```
AI_Innovation_Fellowship/
├── app/                  # Next.js app (UI + API routes)
│   ├── page.tsx          #   sign-in gate + the tutor UI (Home → Class → Unit)
│   ├── AuthScreen.tsx    #   sign in / create account / agree to terms
│   ├── HistoryPanel.tsx  #   "Chats" drawer: resume, rename, delete saved chats
│   ├── DeleteAccountDialog.tsx # type-DELETE confirm for account deletion
│   ├── ThemeToggle.tsx   #   light / dark switch
│   ├── useDialog.ts      #   focus trap + Escape for modals and the drawer
│   ├── Markdown.tsx      #   renders replies as Markdown + KaTeX math
│   ├── layout.tsx        #   page shell + metadata (+ KaTeX CSS, pre-paint theme script)
│   ├── globals.css       #   the design system, light + dark palettes
│   ├── privacy/ terms/   #   Privacy Policy and Terms of Use pages
│   └── api/              #   server routes (both require a signed-in student)
│       ├── chat/route.ts #     streaming Socratic tutor (vision-capable)
│       └── quiz/route.ts #     MCQ / FRQ generation + grading
├── lib/                  # shared app code
│   ├── retrieve.ts       #   RAG retrieval (embeds a query, calls match_documents)
│   ├── llm.ts            #   dual-provider (Anthropic/OpenAI) completion helper
│   ├── prompts.ts        #   Socratic + quiz system prompts
│   ├── progress.ts       #   progress engine (streaks, mastery) + per-account local cache
│   ├── cloud.ts          #   browser reads/writes: synced progress, saved chats, delete account
│   ├── chat-store.ts     #   server-side chat saving (conversations, messages, images)
│   ├── auth-server.ts    #   verifies the student's token in API routes
│   ├── supabase-browser.ts # the browser's Supabase client
│   ├── legal.ts          #   policy version, contact email, minimum age
│   ├── image.ts          #   shared image (data URL) parsing for vision
│   └── courses.ts        #   course + unit data (titles, syllabi, starter prompts)
├── scripts/              # standalone command-line tools (run with tsx)
│   ├── ingest.ts         #   ingest a PDF into Supabase (extract → chunk → embed)
│   └── retrieve-test.ts  #   manual test of retrieval
├── course-materials/     # source PDFs ingested into the RAG store (7 PDFs, 180 chunks)
├── docs/                 # human-facing docs (not shipped)
│   ├── ROADMAP.md        #   ← what's done and what's next
│   ├── prototype/        #   the original single-file HTML prototype (design blueprint)
│   └── notes/            #   fellowship notes
├── public/               # static assets
├── .env.local            # secrets (gitignored — never commit)
└── package.json          # scripts + dependencies
```

---

## Common commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the app locally at http://localhost:3000 |
| `npm run build` | Production build (also type-checks everything) |
| `npm run ingest -- "<pdf>" --course=<label> --section=<label>` | Ingest a PDF into Supabase |
| `npx tsx scripts/retrieve-test.ts "<question>" [course-label]` | Test RAG retrieval from the terminal |

Course labels in Supabase: `physics`, `data-science`, `quant-finance`,
`digital-narrative`, `advanced-ml`. A course can hold more than one document —
`quant-finance`, for example, is grounded in three: the syllabus, the "Story"
PDF, and the Investment Instruments deck.

Example ingest:
```bash
npm run ingest -- "./course-materials/Quantitative-Finance-Syllabus.pdf" --course=quant-finance --section=syllabus
```

> Heads up: the Voyage account is on the free tier (3 requests/minute), so space
> multiple ingest runs about 70 seconds apart or they will hit a 429 rate limit.

> Ingestion is insert-only. Running it twice on the same PDF stores the chunks
> twice, so delete a document's old rows before re-ingesting an updated version.

---

## How it works (the big picture)

1. **Ingest** (one-time, from your laptop): `scripts/ingest.ts` reads a syllabus PDF,
   splits it into chunks, embeds each with **Voyage AI**, and stores them in **Supabase**
   (a `documents` table with a `vector(1024)` column).
2. **Retrieve** (at question time): `lib/retrieve.ts` embeds the student's question and
   asks Supabase's `match_documents` for the most relevant chunks.
3. **Tutor**: `app/api/chat/route.ts` feeds those chunks + a Socratic system prompt to the
   model and streams the reply into the chat. The chat supports four modes: **Socratic
   Tutor**, **Solution Checker**, and a role-flipped **Teach the Tutor** mode (you teach a
   curious AI student, leveraging the protégé effect), plus a general course-info mode.
   `app/api/quiz/route.ts` generates and grades practice questions. The next question
   is generated in the background while the student works the current one, so "Next"
   is instant, and each request carries the questions already asked so the session
   doesn't repeat itself. Models (when
   `ANTHROPIC_API_KEY` is set): the chat tutor runs on **Anthropic `claude-sonnet-5-5`**
   (fast and cost-efficient), while quiz generation and FRQ grading (`lib/llm.ts`) run on
   **`claude-opus-5-5`** for the extra judgment grading needs. Without an Anthropic key it
   falls back to **OpenAI `gpt-5-mini`** — chosen automatically per request.
4. **Accounts**: students sign in with **Supabase Auth** (email + password). The API
   routes check the student's token and write to the database *as that student*, so
   Row Level Security keeps every student inside their own data: `progress` (streaks,
   mastery), `conversations` + `messages` (saved chats), and a private `chat-images`
   bucket for attached photos. Students can resume, rename, or delete chats, and delete
   their whole account from the footer.

## Secrets

Keys live in `.env.local` (gitignored, never commit it) and in Vercel's Environment
Variables for production.

| Variable | Used by | Notes |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | chat + quizzes | preferred model provider |
| `OPENAI_API_KEY` | chat + quizzes | fallback only |
| `VOYAGE_API_KEY` | retrieval + ingest | embeddings |
| `NEXT_PUBLIC_SUPABASE_URL` | app + API | browser-safe; baked in at build time |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app + API | browser-safe; RLS protects the data |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | `scripts/ingest.ts` only | bypasses RLS; not needed on Vercel |

Supabase setting: **Authentication → Sign In / Providers → Email → "Confirm email" is
OFF and must stay off.** Supabase's built-in mailer only delivers to project team members, so with it
on, students could never confirm their accounts.

## Deployment

Live at **[ransomtutor.vercel.app](https://ransomtutor.vercel.app)** on **Vercel**,
auto-deploying from the `main` branch of
[github.com/brandonheller62/ransom-tutor](https://github.com/brandonheller62/ransom-tutor).
