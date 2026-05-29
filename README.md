# Socratic AI Tutor

A guided, Socratic AI tutor for two Ransom Everglades courses — **Advanced Physics: Mechanics**
and **Applied Data Science** — built for the AI Innovation Fellowship.

The tutor leads students through problems with hints instead of handing over answers,
grounded in the actual course syllabi via retrieval-augmented generation (RAG).

> **What's next?** See **[docs/ROADMAP.md](docs/ROADMAP.md)** for the clear, step-by-step plan.

---

## Quick start

```bash
# install dependencies (first time only)
npm install

# run the app locally
npm run dev
```
Then open **http://localhost:3000**. To stop the server, press **Ctrl + C** in the terminal.

> Current status: the UI is fully built and navigable, but the AI responses
> aren't connected yet — that's Milestone 1 in the roadmap.

---

## Project structure

```
AI_Innovation_Fellowship/
├── app/                  # Next.js app (UI + future API routes)
│   ├── page.tsx          #   the tutor UI (Home → Class → Unit)
│   ├── layout.tsx        #   page shell + metadata
│   └── globals.css       #   the design system (ported from the prototype)
├── lib/                  # shared app code
│   ├── retrieve.ts       #   RAG retrieval (embeds a query, calls match_documents)
│   └── courses.ts        #   course + unit data (titles, syllabi, starter prompts)
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
3. **Tutor** (Milestone 1, not built yet): an API route will feed those chunks +
   a Socratic system prompt to the **Anthropic API** and stream the reply into the chat.

## Secrets

All keys live in `.env.local` (gitignored). The split matters:
- `SUPABASE_SECRET_KEY` / `ANTHROPIC_API_KEY` / `VOYAGE_API_KEY` — **server-only**, never sent to the browser.
- `NEXT_PUBLIC_*` keys — safe for the browser (Row Level Security still protects the data).
