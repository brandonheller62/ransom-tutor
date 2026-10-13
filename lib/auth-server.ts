/**
 * lib/auth-server.ts
 *
 * Server-side sign-in check for the API routes. The browser sends the student's
 * Supabase access token as "Authorization: Bearer ...". We verify it, then hand
 * back a Supabase client that acts AS that student, so RLS applies to every
 * read and write the route makes on their behalf (no secret key needed).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthedUser {
  id: string;
  db: SupabaseClient;
}

function unauthorized() {
  return Response.json({ error: "Please sign in again." }, { status: 401 });
}

/** The signed-in user for this request, or a 401 response to return as-is. */
export async function requireUser(req: Request): Promise<AuthedUser | Response> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("requireUser: Supabase env not set");
    return Response.json({ error: "Sign-in is not configured on the server." }, { status: 500 });
  }

  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // getClaims verifies the JWT signature (locally with asymmetric keys, otherwise
  // via the Auth server) and its expiry.
  const { data, error } = await db.auth.getClaims(token);
  const id = data?.claims?.sub;
  if (error || !id) return unauthorized();
  return { id, db };
}
