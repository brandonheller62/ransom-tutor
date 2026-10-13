/**
 * lib/chat-store.ts
 *
 * Server-side chat persistence for app/api/chat/route.ts. Every call goes
 * through the student's own Supabase client (lib/auth-server.ts), so RLS keeps
 * each student inside their own rows and their own folder of the private
 * chat-images bucket.
 *
 * Tables: conversations (one per chat) and messages (one per turn). Images are
 * stored in Storage at <userId>/<conversationId>/<uuid>.<ext>, and the message
 * row keeps only the path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDataUrl } from "@/lib/image";

export const CHAT_IMAGES_BUCKET = "chat-images";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** A short history-list title from the student's first message. */
export function chatTitle(text: string, hasImage: boolean): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return hasImage ? "Photo of my work" : "New chat";
  return flat.length > 60 ? `${flat.slice(0, 57).trimEnd()}...` : flat;
}

export async function createConversation(
  db: SupabaseClient,
  row: { course: string; unitId: string; mode: string; difficulty: string; title: string },
): Promise<string> {
  const { data, error } = await db
    .from("conversations")
    .insert({
      course: row.course,
      unit_id: row.unitId,
      mode: row.mode,
      difficulty: row.difficulty,
      title: row.title,
    })
    .select("id")
    .single();
  if (error) throw new Error(`create conversation: ${error.message}`);
  return data.id as string;
}

/** Append one turn. An attached image (data URL) is uploaded to Storage first. */
export async function saveMessage(
  db: SupabaseClient,
  userId: string,
  conversationId: string,
  msg: { role: "user" | "assistant"; content: string; image?: string },
): Promise<void> {
  let imagePath: string | null = null;
  const img = msg.image ? parseDataUrl(msg.image) : null;
  if (img) {
    const path = `${userId}/${conversationId}/${crypto.randomUUID()}.${EXTENSIONS[img.mediaType] ?? "jpg"}`;
    const { error } = await db.storage
      .from(CHAT_IMAGES_BUCKET)
      .upload(path, Buffer.from(img.data, "base64"), { contentType: img.mediaType });
    // Losing the picture shouldn't lose the turn; keep the text.
    if (error) console.error("chat image upload failed:", error.message);
    else imagePath = path;
  }

  const { error } = await db.from("messages").insert({
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    image_path: imagePath,
  });
  if (error) throw new Error(`save message: ${error.message}`);
}

/** Bump the chat to the top of the history list; difficulty can change mid-chat. */
export async function touchConversation(
  db: SupabaseClient,
  conversationId: string,
  difficulty: string,
): Promise<void> {
  const { error } = await db
    .from("conversations")
    .update({ updated_at: new Date().toISOString(), difficulty })
    .eq("id", conversationId);
  if (error) throw new Error(`touch conversation: ${error.message}`);
}
