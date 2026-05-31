/**
 * app/api/chat/route.ts
 *
 * The tutor backend (Milestone 1). For each turn it:
 *   1. pulls the relevant syllabus chunks from Supabase via retrieveContext(),
 *   2. builds the Socratic system prompt (lib/prompts.ts),
 *   3. streams Claude's reply back to the browser as plain UTF-8 text.
 *
 * Server-only. Uses ANTHROPIC_API_KEY (never shipped to the client).
 */

import Anthropic from "@anthropic-ai/sdk";
import { classes, type CourseKey } from "@/lib/courses";
import { retrieveContext } from "@/lib/retrieve";
import { getSystemPrompt, type Difficulty, type Mode } from "@/lib/prompts";

export const runtime = "nodejs";

// The app's course keys differ from the labels stored in Supabase metadata
// (ingest.ts used --course=physics / --course=data-science).
const RETRIEVAL_COURSE: Record<CourseKey, string> = {
  physics: "physics",
  datascience: "data-science",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  course: CourseKey;
  unitId: string;
  mode: Mode;
  difficulty: Difficulty;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { messages, course, unitId, mode, difficulty } = body;

  const courseData = classes[course];
  if (!courseData) {
    return Response.json({ error: `Unknown course: ${course}` }, { status: 400 });
  }
  const unit = courseData.units.find((u) => u.id === unitId) ?? null;

  if (!messages?.length) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  // Retrieve grounding context from the student's latest message.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let context = "";
  if (lastUser?.content) {
    try {
      const chunks = await retrieveContext(
        lastUser.content,
        RETRIEVAL_COURSE[course],
      );
      context = chunks.map((c) => c.content).join("\n\n---\n\n");
    } catch (err) {
      // Retrieval is best-effort grounding; if it fails, tutor still works.
      console.error("retrieveContext failed:", err);
    }
  }

  const system = getSystemPrompt({
    course: courseData,
    unit,
    mode,
    difficulty,
    context,
  });

  const client = new Anthropic();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const llm = client.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          system,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        llm.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        await llm.finalMessage();
        controller.close();
      } catch (err) {
        console.error("Anthropic stream error:", err);
        const msg =
          err instanceof Anthropic.APIError
            ? `Tutor error (${err.status}): ${err.message}`
            : "The tutor hit an unexpected error. Check the server logs.";
        controller.enqueue(encoder.encode(`\n\n[${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
