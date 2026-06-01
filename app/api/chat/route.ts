/**
 * app/api/chat/route.ts
 *
 * The tutor backend (Milestone 1). For each turn it:
 *   1. pulls the relevant syllabus chunks from Supabase via retrieveContext(),
 *   2. builds the Socratic system prompt (lib/prompts.ts),
 *   3. streams the model's reply back to the browser as plain UTF-8 text.
 *
 * Server-only. Provider is chosen by which key is present:
 *   - ANTHROPIC_API_KEY set  -> Claude (claude-opus-4-8), the preferred path.
 *   - else OPENAI_API_KEY set -> GPT (gpt-5-mini), a temporary bridge.
 * Pasting an Anthropic key later auto-switches back with no code change.
 * Neither key is ever shipped to the client.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { classes, type CourseKey } from "@/lib/courses";
import { retrieveContext } from "@/lib/retrieve";
import { getSystemPrompt, type Difficulty, type Mode } from "@/lib/prompts";
import { parseDataUrl } from "@/lib/image";

export const runtime = "nodejs";

const OPENAI_MODEL = "gpt-5-mini";

// The app's course keys differ from the labels stored in Supabase metadata
// (ingest.ts used --course=physics / --course=data-science).
const RETRIEVAL_COURSE: Record<CourseKey, string> = {
  physics: "physics",
  datascience: "data-science",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string; // data URL (base64) for an attached image on a user turn
}

interface ChatRequest {
  messages: ChatMessage[];
  course: CourseKey;
  unitId: string;
  mode: Mode;
  difficulty: Difficulty;
}

export async function POST(req: Request) {
  const provider = process.env.ANTHROPIC_API_KEY
    ? "anthropic"
    : process.env.OPENAI_API_KEY
      ? "openai"
      : null;

  if (!provider) {
    return Response.json(
      {
        error:
          "No model key set. Add ANTHROPIC_API_KEY (preferred) or OPENAI_API_KEY to .env.local and restart the dev server.",
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

  // Build provider-specific message arrays, attaching any image as a vision block.
  const anthropicTurns: Anthropic.MessageParam[] = messages.map((m) => {
    const img = m.role === "user" && m.image ? parseDataUrl(m.image) : null;
    if (img) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      });
      return { role: m.role, content: blocks };
    }
    return { role: m.role, content: m.content };
  });

  const openaiTurns: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
    if (m.role === "user" && m.image) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      parts.push({ type: "image_url", image_url: { url: m.image } });
      return { role: "user", content: parts };
    }
    return { role: m.role, content: m.content };
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (provider === "anthropic") {
          const client = new Anthropic();
          const llm = client.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 4096,
            thinking: { type: "adaptive" },
            system,
            messages: anthropicTurns,
          });
          llm.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
          await llm.finalMessage();
        } else {
          const client = new OpenAI();
          const llm = await client.chat.completions.create({
            model: OPENAI_MODEL,
            max_completion_tokens: 4096,
            // gpt-5 is a reasoning model; keep effort low so streamed answer
            // tokens aren't consumed by hidden reasoning.
            reasoning_effort: "low",
            stream: true,
            messages: [{ role: "system", content: system }, ...openaiTurns],
          });
          for await (const chunk of llm) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (err) {
        console.error(`${provider} stream error:`, err);
        const msg =
          err instanceof Anthropic.APIError || err instanceof OpenAI.APIError
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
