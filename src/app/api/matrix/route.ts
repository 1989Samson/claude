import { getAssumptionsView, getMatrix } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The matrix tab data: every class with its computed band and confidence,
// plus the current assumptions. asOf defaults to now; ?asOf=YYYY-MM-DD pins it.
export async function GET(req: Request) {
  return handle(async () => {
    const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString();
    const [matrix, assumptions] = await Promise.all([
      getMatrix(asOf),
      getAssumptionsView(),
    ]);
    return ok({ matrix, assumptions, asOf });
  });
}
