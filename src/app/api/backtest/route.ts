import { getLatestBacktests, runBacktest } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: the latest stored backtest per class (keyed by class id).
export async function GET() {
  return handle(async () => {
    const map = await getLatestBacktests();
    return ok({ latest: Object.fromEntries(map) });
  });
}

// POST: run the leave-one-out backtest now and store the results.
export async function POST(req: Request) {
  return handle(async () => {
    const asOf =
      new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString();
    return ok(await runBacktest(asOf));
  });
}
