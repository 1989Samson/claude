import { listClasses } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ok({ classes: await listClasses() }));
}
