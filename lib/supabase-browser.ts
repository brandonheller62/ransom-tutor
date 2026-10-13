/**
 * lib/supabase-browser.ts
 *
 * The one Supabase client the browser uses. It keeps the student's session in
 * localStorage and refreshes the access token on its own. Uses the publishable
 * key; every table it touches is locked to the signed-in user by RLS.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not set (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).",
    );
  }
  client = createClient(url, key);
  return client;
}

/** Authorization header for our own API routes (which require a signed-in user). */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
