/**
 * app/api/quiz/route.ts
 *
 * The practice-quiz backend (Milestone 2). Three actions:
 *   - "mcq"   : generate one multiple-choice question, parsed into structured JSON.
 *   - "frq"   : generate one AP-style free-response question (markdown text).
 *   - "grade" : grade a student's FRQ response (markdown feedback).
 *
 * Non-streaming. Shares the dual-provider helper (lib/llm.ts) and RAG grounding
 * (lib/retrieve.ts) with the chat tutor. Server-only.
 */

import { classes, type CourseKey } from "@/lib/courses";
import { retrieveContext } from "@/lib/retrieve";
import { complete } from "@/lib/llm";
import {
  getMcqPrompt,
  getFrqPrompt,
  getGradePrompt,
  type Difficulty,
} from "@/lib/prompts";

export const runtime = "nodejs";

const RETRIEVAL_COURSE: Record<CourseKey, string> = {
  physics: "physics",
  datascience: "data-science",
};

interface QuizRequest {
  action: "mcq" | "frq" | "grade";
  course: CourseKey;
  unitId: string;
  difficulty: Difficulty;
  question?: string; // for "grade"
  answer?: string; // for "grade"
}

export interface McqData {
  question: string;
  choices: Record<"A" | "B" | "C" | "D", string>;
  correct: "A" | "B" | "C" | "D";
  explanation: string;
}

/** Parse the strict MCQ text format into structured data, or null if it doesn't match. */
function parseMcq(text: string): McqData | null {
  const qMatch = text.match(/QUESTION:\s*([\s\S]+?)(?=\n\s*\*?\*?[A-D]\))/);
  const question = qMatch ? qMatch[1].trim() : null;

  const choices: Record<string, string> = {};
  const choiceRe = /\*?\*?([A-D])\)\*?\*?\s+(.+)/g;
  let cm: RegExpExecArray | null;
  while ((cm = choiceRe.exec(text)) !== null) {
    choices[cm[1]] = cm[2].replace(/\*\*/g, "").trim();
  }

  const correctMatch = text.match(/CORRECT:\s*([A-D])/);
  const correct = correctMatch ? correctMatch[1] : null;

  const explMatch = text.match(/EXPLANATION:\s*([\s\S]+)/);
  const explanation = explMatch ? explMatch[1].trim() : "";

  if (!question || !correct) return null;
  if (!["A", "B", "C", "D"].every((l) => choices[l])) return null;

  return {
    question,
    choices: choices as McqData["choices"],
    correct: correct as McqData["correct"],
    explanation,
  };
}

export async function POST(req: Request) {
  let body: QuizRequest;
  try {
    body = (await req.json()) as QuizRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action, course, unitId, difficulty, question, answer } = body;

  const courseData = classes[course];
  if (!courseData) {
    return Response.json({ error: `Unknown course: ${course}` }, { status: 400 });
  }

  try {
    // Grading needs no fresh generation context; it works from the question text.
    if (action === "grade") {
      if (!question || !answer?.trim()) {
        return Response.json(
          { error: "Grading requires both a question and a student answer." },
          { status: 400 },
        );
      }
      const feedback = await complete(getGradePrompt(question, answer), [
        { role: "user", content: "Grade my response per the instructions." },
      ]);
      return Response.json({ feedback });
    }

    const unit = courseData.units.find((u) => u.id === unitId);
    if (!unit) {
      return Response.json({ error: `Unknown unit: ${unitId}` }, { status: 400 });
    }

    // Ground the generated question in the syllabus using the unit topic as the query.
    let context = "";
    try {
      const chunks = await retrieveContext(
        `${unit.title} ${unit.desc}`,
        RETRIEVAL_COURSE[course],
      );
      context = chunks.map((c) => c.content).join("\n\n---\n\n");
    } catch (err) {
      console.error("retrieveContext failed (quiz):", err);
    }

    if (action === "mcq") {
      const text = await complete(
        getMcqPrompt({ course: courseData, unit, difficulty, context }),
        [{ role: "user", content: "Generate one question in the exact format." }],
      );
      const data = parseMcq(text);
      if (!data) {
        console.error("MCQ parse failed. Raw response:\n", text);
        return Response.json(
          { error: "Could not parse the generated question. Try again." },
          { status: 422 },
        );
      }
      return Response.json({ mcq: data });
    }

    if (action === "frq") {
      const frq = await complete(
        getFrqPrompt({ course: courseData, unit, difficulty, context }),
        [{ role: "user", content: "Generate one free-response question." }],
      );
      return Response.json({ frq });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("Quiz route error:", err);
    const msg = err instanceof Error ? err.message : "Unexpected quiz error.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
