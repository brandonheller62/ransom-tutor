/**
 * lib/cloud.ts
 *
 * Browser-side reads and writes of the signed-in student's own data: synced
 * progress and saved chats. RLS limits every query to the student's rows, so
 * none of these need a user filter. New chat turns are written by the chat
 * route (lib/chat-store.ts); this file lists, opens, renames, and deletes them.
 */

import { supabase } from "@/lib/supabase-browser";
import { normalizeProgress, type Progress } from "@/lib/progress";

const CHAT_IMAGES_BUCKET = "chat-images";

// ---------- Progress ----------

export async function fetchRemoteProgress(): Promise<Progress | null> {
  const { data, error } = await supabase().from("progress").select("data").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeProgress(data.data) : null;
}

export async function saveRemoteProgress(userId: string, p: Progress): Promise<void> {
  const { error } = await supabase()
    .from("progress")
    .upsert({ user_id: userId, data: p, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ---------- Saved chats ----------

export interface ConversationSummary {
  id: string;
  course: string;
  unit_id: string;
  mode: "tutor" | "checker" | "teach";
  difficulty: "warmup" | "standard" | "challenge";
  title: string;
  updated_at: string;
}

export interface SavedMessage {
  role: "user" | "assistant";
  content: string;
  image?: string; // data URL, so a resumed chat can be resent to the model as-is
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await supabase()
    .from("conversations")
    .select("id, course, unit_id, mode, difficulty, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data as ConversationSummary[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function loadConversationMessages(id: string): Promise<SavedMessage[]> {
  const { data, error } = await supabase()
    .from("messages")
    .select("role, content, image_path")
    .eq("conversation_id", id)
    .order("id");
  if (error) throw new Error(error.message);

  return Promise.all(
    data.map(async (row): Promise<SavedMessage> => {
      const msg: SavedMessage = { role: row.role, content: row.content };
      if (row.image_path) {
        const { data: blob } = await supabase().storage.from(CHAT_IMAGES_BUCKET).download(row.image_path);
        if (blob) msg.image = await blobToDataUrl(blob);
      }
      return msg;
    }),
  );
}

export async function renameConversation(id: string, title: string): Promise<void> {
  const { error } = await supabase().from("conversations").update({ title }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteConversation(id: string): Promise<void> {
  const sb = supabase();
  // Storage objects aren't removed by the messages cascade, so clear them first.
  const { data: rows } = await sb
    .from("messages")
    .select("image_path")
    .eq("conversation_id", id)
    .not("image_path", "is", null);
  const paths = (rows ?? []).map((r) => r.image_path as string);
  if (paths.length) await sb.storage.from(CHAT_IMAGES_BUCKET).remove(paths);

  const { error } = await sb.from("conversations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Account ----------

/**
 * Permanently delete the signed-in student's account and everything in it.
 * Images go first (Storage objects aren't covered by the database cascade),
 * then delete_my_account() removes the auth user, which cascades to progress,
 * conversations, and messages.
 */
export async function deleteMyAccount(): Promise<void> {
  const sb = supabase();

  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("messages")
      .select("image_path")
      .not("image_path", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    paths.push(...data.map((r) => r.image_path as string));
    if (data.length < 1000) break;
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await sb.storage.from(CHAT_IMAGES_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }

  const { error } = await sb.rpc("delete_my_account");
  if (error) throw new Error(error.message);
}
