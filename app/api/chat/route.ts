/**
 * app/api/chat/route.ts
 *
 * The tutor backend (Milestone 1). For each turn it:
 *   1. pulls the relevant syllabus chunks from Supabase via retrieveContext(),
 *   2. builds the Socratic system prompt (lib/prompts.ts),
 *   3. streams the model's reply back to the browser as plain UTF-8 text.
 *
 * Server-only. Provider is chosen by which key is present:
 *   - ANTHROPIC_API_KEY set  -> Claude (claude-sonnet-5-5), the preferred path.
 *   - else OPENAI_API_KEY set -> GPT (gpt-5-mini), a temporary bridge.
 * Pasting an Anthropic key later auto-switches back with no code change.
 * Neither key is ever shipped to the client.
 *
 * Requires a signed-in student (lib/auth-server.ts). Each turn is saved to the
 * student's chat history (lib/chat-store.ts): the first turn creates the
 * conversation and its id goes back in the X-Conversation-Id header; the new
 * user message is saved while the reply streams, and the reply is saved just
 * before the stream closes. Saving is best-effort and never blocks tutoring.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { classes, type CourseKey } from "@/lib/courses";
import { retrieveContext } from "@/lib/retrieve";
import { getSystemPrompt, type Difficulty, type Mode } from "@/lib/prompts";
import { parseDataUrl } from "@/lib/image";
import { requireUser } from "@/lib/auth-server";
import { chatTitle, createConversation, saveMessage, touchConversation } from "@/lib/chat-store";
import {
  describeLlmError,
  sleep,
  GENERIC_LLM_MESSAGE,
  LLM_BACKOFF_MS,
  OVERLOADED_LLM_MESSAGE,
} from "@/lib/llm";

export const runtime = "nodejs";

// The chat tutor runs on Sonnet 5.5 (fast + cheap, indistinguishable from Opus
// for Socratic tutoring). The quiz backend runs Opus 5.5 for FRQ grading
// (see lib/llm.ts) — grading free-response is the most judgment-heavy call.
const ANTHROPIC_MODEL = "claude-sonnet-5-5";
const OPENAI_MODEL = "gpt-5-mini";

// The app's course keys differ from the labels stored in Supabase metadata
// (ingest.ts used --course=physics / --course=data-science).
const RETRIEVAL_COURSE: Record<CourseKey, string> = {
  physics: "physics",
  datascience: "data-science",
  quantfinance: "quant-finance",
  digitalnarrative: "digital-narrative",
  advancedml: "advanced-ml",
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
  conversationId?: string | null; // omitted on the first turn of a new chat
}

const MODES: Mode[] = ["tutor", "checker", "teach"];
const DIFFICULTIES: Difficulty[] = ["warmup", "standard", "challenge"];

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;
  const { id: userId, db } = auth;

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
  if (!MODES.includes(mode) || !DIFFICULTIES.includes(difficulty)) {
    return Response.json({ error: "Unknown mode or difficulty." }, { status: 400 });
  }

  // Retrieve grounding context from the student's latest message.
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  async function getContext(): Promise<string> {
    if (!lastUser?.content) return "";
    try {
      const chunks = await retrieveContext(lastUser.content, RETRIEVAL_COURSE[course]);
      return chunks.map((c) => c.content).join("\n\n---\n\n");
    } catch (err) {
      // Retrieval is best-effort grounding; if it fails, tutor still works.
      console.error("retrieveContext failed:", err);
      return "";
    }
  }

  // First turn of a new chat: create the conversation alongside retrieval.
  async function getConversationId(): Promise<string | null> {
    if (body.conversationId) return body.conversationId;
    const first = messages.find((m) => m.role === "user");
    try {
      return await createConversation(db, {
        course,
        unitId,
        mode,
        difficulty,
        title: chatTitle(first?.content ?? "", !!first?.image),
      });
    } catch (err) {
      console.error("chat history:", err);
      return null;
    }
  }

  const [context, conversationId] = await Promise.all([getContext(), getConversationId()]);

  // The client resends the whole history each turn; only the newest message is new.
  const newest = messages[messages.length - 1];
  const userSaved =
    conversationId && newest.role === "user"
      ? saveMessage(db, userId, conversationId, newest).catch((err) =>
          console.error("chat history:", err),
        )
      : Promise.resolve();

  // Runs before the stream closes (not after), so serverless shutdown can't cut it off.
  async function saveReply(text: string) {
    if (!conversationId) return;
    await userSaved; // keep turn order: user message first
    try {
      if (text.trim()) {
        await saveMessage(db, userId, conversationId, { role: "assistant", content: text });
      }
      await touchConversation(db, conversationId, difficulty);
    } catch (err) {
      console.error("chat history:", err);
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
      // A failed attempt may only be retried while the reply is still empty;
      // once tokens have reached the browser a retry would duplicate them.
      let emitted = false;
      let reply = ""; // model text only, without any error copy, for chat history
      const emit = (text: string) => {
        emitted = true;
        reply += text;
        controller.enqueue(encoder.encode(text));
      };

      for (let attempt = 0; ; attempt++) {
        try {
          if (provider === "anthropic") {
            // maxRetries: 0 — this loop owns retries (it must stop once text
            // has streamed); the SDK's built-in ones would stack on top.
            const client = new Anthropic({ maxRetries: 0 });
            const llm = client.messages.stream({
              model: ANTHROPIC_MODEL,
              max_tokens: 4096,
              thinking: { type: "adaptive" },
              // Socratic replies are short; low keeps streaming snappy.
              output_config: { effort: "low" },
              system,
              messages: anthropicTurns,
            });
            llm.on("text", emit);
            await llm.finalMessage();
          } else {
            const client = new OpenAI({ maxRetries: 0 });
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
              if (delta) emit(delta);
            }
          }
          await saveReply(reply);
          controller.close();
          return;
        } catch (err) {
          const info = describeLlmError(err);
          console.error(`${provider} stream error (attempt ${attempt + 1}, ${info.detail}):`, err);
          if (!emitted && info.retryable && attempt < LLM_BACKOFF_MS.length) {
            await sleep(LLM_BACKOFF_MS[attempt]);
            continue;
          }
          // Students were seeing raw mid-stream 529 bodies here; ship the
          // friendly copy instead and keep the detail in the server log.
          const msg = info.retryable ? OVERLOADED_LLM_MESSAGE : GENERIC_LLM_MESSAGE;
          controller.enqueue(encoder.encode(emitted ? `\n\n${msg}` : msg));
          await saveReply(reply);
          controller.close();
          return;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(conversationId ? { "X-Conversation-Id": conversationId } : {}),
    },
  });
}
