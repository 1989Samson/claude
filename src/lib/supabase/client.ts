"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseEnv } from "./env";

// Browser Supabase client, used by the login page. Only called in environments
// where Supabase is configured.
export function createClient() {
  const { url, anon } = requireSupabaseEnv();
  return createBrowserClient(url, anon);
}
