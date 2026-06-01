/**
 * lib/llm.ts
 *
 * Dual-provider, non-streaming completion helper shared by the quiz backend.
 * Provider is chosen by which key is present (Anthropic preferred), mirroring
 * app/api/chat/route.ts. Returns the full reply as a trimmed string.
 *
 * Server-only. Never import into client code (it reads secret API keys).
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { parseDataUrl } from "./image";

const OPENAI_MODEL = "gpt-5-mini";
const ANTHROPIC_MODEL = "claude-opus-4-8";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
  image?: string; // data URL (base64) for an attached image on a user turn
}

export function activeProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/** Run one non-streaming completion and return the full text reply. */
export async function complete(
  system: string,
  messages: LlmMessage[],
  maxTokens = 2048,
): Promise<string> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      "No model key set. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.local.",
    );
  }

  if (provider === "anthropic") {
    const client = new Anthropic();
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => {
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
    const res = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: anthropicMessages,
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  const client = new OpenAI();
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
    if (m.role === "user" && m.image) {
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = [];
      if (m.content) parts.push({ type: "text", text: m.content });
      parts.push({ type: "image_url", image_url: { url: m.image } });
      return { role: "user", content: parts };
    }
    return { role: m.role, content: m.content };
  });
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    // gpt-5 reasoning models spend completion tokens on hidden reasoning first.
    // Keep effort low so the visible answer isn't starved (was returning empty),
    // and give a generous ceiling.
    max_completion_tokens: Math.max(maxTokens, 4096),
    reasoning_effort: "low",
    messages: [{ role: "system", content: system }, ...openaiMessages],
  });
  return (res.choices[0]?.message?.content ?? "").trim();
}
