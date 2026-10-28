# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Ransom Everglades upper-school students enrolled in one of the five supported courses. They use Ransom Tutor on their own, outside class, for homework help, unit review and test prep, usually on a laptop and sometimes on a phone. They sign in with their own account and come back across sessions and devices.

## Product Purpose
Ransom Tutor is a Socratic AI tutor. It leads students through problems with hints and questions instead of handing over answers, and it grounds every reply in the actual course syllabi. Success means four things:

- students actually learn and work answers out themselves;
- students come back regularly (streaks, weekly goals, unit mastery);
- it makes a strong showing as an AI Innovation Fellowship project;
- teachers or the school adopt it beyond the fellowship.

## Positioning
Ransom Tutor is built around specific Ransom Everglades courses rather than general subjects. Its tutoring is grounded through RAG in those courses' own syllabi and unit arcs, so it knows what unit a student is in and what that unit covers. It deliberately refuses to just give answers, unlike a general chatbot.

## Operating Context
- Flow: sign in → Home (pick a class) → Class (pick a unit) → Unit (chat with the tutor, take a practice quiz, or use Teach the Tutor).
- Students paste or photograph work (image attachments) and write math, which renders with KaTeX.
- Saved chats can be resumed, renamed or deleted from the Chats panel.
- Progress (streaks, weekly goals, per-unit mastery rings) syncs to the account.

## Capabilities and Constraints
- Courses (defined in `lib/courses.ts`): Advanced Physics: Mechanics (10 units), Applied Data Science (9), Quantitative Finance & AI (7), Digital Narrative (2), Advanced Machine Learning (6).
- Modes: Socratic chat tutor (streaming), practice quizzes (MCQ + FRQ with AI grading), Teach the Tutor (learn by teaching).
- Login is required (email + password via Supabase Auth). Self-serve account deletion, Privacy Policy and Terms of Use pages.
- Light and dark mode, with a pre-paint theme script.
- Stack: Next.js 16 App Router, React 19, TypeScript, Supabase, Voyage embeddings, Claude (with OpenAI as fallback). Deployed on Vercel at ransomtutor.vercel.app.

## Brand Commitments
- Name: **Ransom Tutor**.
- It may nod to Ransom Everglades (the name, possibly the school's colors) but must not look official. No school logos, crests or anything implying the school endorses it.

## Evidence on Hand
- Real course materials in `course-materials/` (syllabi, the Quant Finance Story and Investment Instruments decks).
- Live production app; README screenshots.
- No testimonials, usage numbers or teacher endorsements exist yet. Do not fabricate any.

## Product Principles
1. **Hints before answers.** The student does the thinking, and the interface should make it easy to try rather than to ask for the answer.
2. **Grounded in the actual class.** Course and unit context should always be visible and real.
3. **Worth coming back to.** Progress should feel earned and quietly motivating, never gamified noise.
4. **Credible to teachers.** Teachers and evaluators should see a serious study tool, not a toy.

## Accessibility & Inclusion
Students are teenagers on school laptops and phones, so the app must work well on mobile. Dialogs and drawers already trap focus and close with Escape (`app/useDialog.ts`), and that behavior must be kept.
