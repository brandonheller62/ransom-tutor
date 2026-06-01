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

const OPENAI_MODEL = "gpt-5-mini";
const ANTHROPIC_MODEL = "claude-opus-4-8";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
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
    const res = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  const client = new OpenAI();
  const res = await client.chat.completions.create({
    model: OPENAI_MODEL,
    // gpt-5 reasoning models spend completion tokens on hidden reasoning first.
    // Keep effort low so the visible answer isn't starved (was returning empty),
    // and give a generous ceiling.
    max_completion_tokens: Math.max(maxTokens, 4096),
    reasoning_effort: "low",
    messages: [{ role: "system", content: system }, ...messages],
  });
  return (res.choices[0]?.message?.content ?? "").trim();
}
