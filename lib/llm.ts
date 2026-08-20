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
const ANTHROPIC_MODEL = "claude-opus-5";

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

/* ===== Shared error handling (used here and by app/api/chat/route.ts) ===== */

/** Student-facing copy for transient provider failures. Never ship raw SDK errors to the browser. */
export const OVERLOADED_LLM_MESSAGE =
  "Sorry, the tutor is a little overloaded right now. Please try sending that again in a moment.";
export const GENERIC_LLM_MESSAGE =
  "Sorry, something went wrong on the tutor's end. Please try sending that again.";

/** Backoff between retry attempts; length = number of retries after the first try. */
export const LLM_BACKOFF_MS = [500, 1500];

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE_STATUSES = new Set([429, 500, 503, 529]);
const RETRYABLE_TYPES = new Set(["overloaded_error", "rate_limit_error", "api_error"]);

export interface LlmErrorInfo {
  retryable: boolean;
  /** Compact status/type/request-id summary for server logs. */
  detail: string;
}

export function describeLlmError(err: unknown): LlmErrorInfo {
  if (err instanceof Anthropic.APIError || err instanceof OpenAI.APIError) {
    // Errors that arrive MID-STREAM (e.g. a 529 overloaded_error sent as an
    // SSE `error` event) have status === undefined: the SDK only sets status
    // from the initial HTTP response. The type from the event body is still
    // populated, so retryability must consider both.
    const body = err.error as { error?: { type?: string } } | undefined;
    const type = err.type ?? body?.error?.type;
    const connectionError =
      err instanceof Anthropic.APIConnectionError ||
      err instanceof OpenAI.APIConnectionError;
    return {
      retryable:
        connectionError ||
        (err.status !== undefined && RETRYABLE_STATUSES.has(err.status)) ||
        (!!type && RETRYABLE_TYPES.has(type)),
      detail: `status=${err.status ?? "none"} type=${type ?? "none"} request_id=${err.requestID ?? "none"}`,
    };
  }
  return { retryable: false, detail: err instanceof Error ? err.message : String(err) };
}

/**
 * Run one non-streaming completion and return the full text reply.
 *
 * Transient provider failures (529 overloaded, 429, 500/503, connection drops)
 * are retried with short backoff. When retries are exhausted — or the error
 * isn't transient — this throws an Error whose message is safe to show to a
 * student (the quiz route returns err.message to the browser); the raw SDK
 * error is only logged server-side.
 */
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

  for (let attempt = 0; ; attempt++) {
    try {
      return await completeOnce(provider, system, messages, maxTokens);
    } catch (err) {
      const info = describeLlmError(err);
      console.error(`${provider} complete failed (attempt ${attempt + 1}, ${info.detail}):`, err);
      if (info.retryable && attempt < LLM_BACKOFF_MS.length) {
        await sleep(LLM_BACKOFF_MS[attempt]);
        continue;
      }
      throw new Error(info.retryable ? OVERLOADED_LLM_MESSAGE : GENERIC_LLM_MESSAGE);
    }
  }
}

async function completeOnce(
  provider: "anthropic" | "openai",
  system: string,
  messages: LlmMessage[],
  maxTokens: number,
): Promise<string> {
  if (provider === "anthropic") {
    // maxRetries: 0 — the retry loop in complete() owns retries; the SDK's
    // built-in ones would stack multiplicatively on top of it.
    const client = new Anthropic({ maxRetries: 0 });
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
      // Opus 5 thinks by default and thinking tokens count against max_tokens,
      // so floor the budget like the OpenAI reasoning path below.
      max_tokens: Math.max(maxTokens, 4096),
      thinking: { type: "adaptive" },
      system,
      messages: anthropicMessages,
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
  }

  const client = new OpenAI({ maxRetries: 0 });
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
