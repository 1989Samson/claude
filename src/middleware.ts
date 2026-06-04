import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

// Paths that never require a user session.
const PUBLIC_PREFIXES = [
  "/login",
  "/auth", // sign out / callback
  "/api/import", // machine-to-machine, guarded by INGEST_API_TOKEN
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/") || pathname === p,
  );
}

export async function middleware(request: NextRequest) {
  // Local dev without Supabase: no auth, app runs against the local DB.
  if (!supabaseConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (user || isPublic(pathname)) return response;

  // Unauthenticated: APIs get a clean 401, pages are sent to login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// Run on everything except Next internals and static files.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
