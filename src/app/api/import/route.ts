import { importPoints } from "@/lib/db/service";
import { badRequest, handle, ok } from "@/lib/http";
import { importPayloadSchema } from "@/lib/validation";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Machine-to-machine guard. When INGEST_API_TOKEN is set (prod/CI), the caller
// must present it as a bearer token or x-ingest-token header. Left open only
// when the token is unset (local dev).
function authorized(req: Request): boolean {
  const expected = process.env.INGEST_API_TOKEN;
  if (!expected) return true;
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = bearer ?? req.headers.get("x-ingest-token") ?? undefined;
  return token === expected;
}

// Accepts a JSON array of sales (the auction-feed output shape). Each row is
// validated individually; rows without a source or for an unknown class are
// skipped and reported. This is the endpoint the scheduled ingestion writes to.
export async function POST(req: Request) {
  return handle(async () => {
    if (!authorized(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const parsed = importPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Expected a JSON array of sales");
    }
    const result = await importPoints(parsed.data);
    return ok(result);
  });
}
