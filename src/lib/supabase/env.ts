// Supabase is optional in local dev: when the env vars are absent the app runs
// unauthenticated against the local database. In any deployed environment the
// vars are set and auth is enforced (see middleware).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function requireSupabaseEnv(): { url: string; anon: string } {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url: SUPABASE_URL, anon: SUPABASE_ANON_KEY };
}
