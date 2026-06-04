import { importPoints } from "@/lib/db/service";
import { badRequest, handle, ok } from "@/lib/http";
import { importPayloadSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accepts a JSON array of sales (the auction-feed output shape). Each row is
// validated individually; rows without a source or for an unknown class are
// skipped and reported. This is the endpoint the scheduled ingestion writes to.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const parsed = importPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Expected a JSON array of sales");
    }
    const result = await importPoints(parsed.data);
    return ok(result);
  });
}
