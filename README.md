# Socratic AI Tutor

A guided, Socratic AI tutor for two Ransom Everglades courses — **Advanced Physics: Mechanics**
and **Applied Data Science** — built for the AI Innovation Fellowship.

The tutor leads students through problems with hints instead of handing over answers,
grounded in the actual course syllabi via retrieval-augmented generation (RAG).

**Status: all five milestones are built, deployed, and verified in production at
[ransomtutor.vercel.app](https://ransomtutor.vercel.app).** The chat tutor, practice
quizzes (MCQ/FRQ + grading), local progress tracking, KaTeX math, image attachments, and
RAG syllabus grounding on the live site all work end to end.

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

> The app needs a model key + the RAG keys in `.env.local` to respond (see **Secrets**
> below). It uses Anthropic (`claude-opus-4-8`) when `ANTHROPIC_API_KEY` is set, otherwise
> falls back to OpenAI (`gpt-4o-mini`).

---

## Project structure

```
AI_Innovation_Fellowship/
├── app/                  # Next.js app (UI + API routes)
│   ├── page.tsx          #   the tutor UI (Home → Class → Unit), chat + quizzes + progress
│   ├── Markdown.tsx      #   renders replies as Markdown + KaTeX math
│   ├── layout.tsx        #   page shell + metadata (+ KaTeX CSS)
│   ├── globals.css       #   the design system (ported from the prototype)
│   └── api/              #   server routes
│       ├── chat/route.ts #     streaming Socratic tutor (vision-capable)
│       └── quiz/route.ts #     MCQ / FRQ generation + grading
├── lib/                  # shared app code
│   ├── retrieve.ts       #   RAG retrieval (embeds a query, calls match_documents)
│   ├── llm.ts            #   dual-provider (Anthropic/OpenAI) completion helper
│   ├── prompts.ts        #   Socratic + quiz system prompts
│   ├── progress.ts       #   local-only progress engine (localStorage)
│   ├── image.ts          #   shared image (data URL) parsing for vision
│   ├── courses.ts        #   course + unit data (titles, syllabi, starter prompts)
│   └── utils.ts          #   small shared helpers (clsx + tailwind-merge)
├── scripts/              # standalone command-line tools (run with tsx)
│   ├── ingest.ts         #   ingest a PDF into Supabase (extract → chunk → embed)
│   └── retrieve-test.ts  #   manual test of retrieval
├── course-materials/     # source PDFs ingested into the RAG store
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
| `npm run ingest -- "<pdf>" --course=<key> --section=<label>` | Ingest a PDF into Supabase |
| `npx tsx scripts/retrieve-test.ts "<question>"` | Test RAG retrieval from the terminal |

Example ingest:
```bash
npm run ingest -- "./course-materials/Advanced-Physics-Mechanics-Syllabus-2025-2026-.pdf" --course=physics --section=syllabus
```

---

## How it works (the big picture)

1. **Ingest** (one-time, from your laptop): `scripts/ingest.ts` reads a syllabus PDF,
   splits it into chunks, embeds each with **Voyage AI**, and stores them in **Supabase**
   (a `documents` table with a `vector(1024)` column).
2. **Retrieve** (at question time): `lib/retrieve.ts` embeds the student's question and
   asks Supabase's `match_documents` for the most relevant chunks.
3. **Tutor**: `app/api/chat/route.ts` feeds those chunks + a Socratic system prompt to the
   model and streams the reply into the chat. `app/api/quiz/route.ts` generates and grades
   practice questions. The model is **Anthropic `claude-opus-4-8`** when `ANTHROPIC_API_KEY`
   is set, otherwise **OpenAI `gpt-5-mini`** — chosen automatically per request.

## Deployment

Live at **[ransomtutor.vercel.app](https://ransomtutor.vercel.app)** on **Vercel**,
auto-deploying from the `main` branch of
[github.com/brandonheller62/ransom-tutor](https://github.com/brandonheller62/ransom-tutor).
The same keys below must be added under **Vercel → Settings → Environment Variables**
(the live app needs `OPENAI_API_KEY`, `VOYAGE_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the two `SUPABASE_*` server keys are ingest-only
and not required there).

Two deploy gotchas to remember:
- Vercel blocks deploys whose git commit author email isn't your Vercel account email
  (use `brandonheller62@gmail.com`).
- **`NEXT_PUBLIC_*` vars are inlined at build time.** After adding or changing one, you
  must trigger a **fresh build** (new commit, or Redeploy with "Use existing Build Cache"
  unchecked) — a plain redeploy of an older build keeps the stale value. This is what
  briefly broke live RAG until a clean rebuild re-inlined `NEXT_PUBLIC_SUPABASE_URL`.

## Secrets

All keys live in `.env.local` (gitignored). The split matters:
- `SUPABASE_SECRET_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `VOYAGE_API_KEY` — **server-only**, never sent to the browser.
- `NEXT_PUBLIC_*` keys — safe for the browser (Row Level Security still protects the data).
