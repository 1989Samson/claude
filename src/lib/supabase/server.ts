import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseEnv, supabaseConfigured } from "./env";

// Server Supabase client for route handlers and server components. Returns null
// when Supabase is not configured (local dev), so callers can degrade to the
// unauthenticated path.
export async function createClient() {
  if (!supabaseConfigured()) return null;
  const { url, anon } = requireSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; safe to ignore (middleware refreshes).
        }
      },
    },
  });
}

// The signed-in user's email, or null when unauthenticated / unconfigured.
export async function currentUserEmail(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? null;
}
