import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requireSupabaseEnv } from "./env";

// Refresh the Supabase session on every request and report the user. Adapted
// from the Supabase SSR middleware pattern: cookies must be written onto the
// same response object that is returned.
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse;
  user: { email?: string } | null;
}> {
  let response = NextResponse.next({ request });
  const { url, anon } = requireSupabaseEnv();

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user: user ?? null };
}
