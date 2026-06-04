import { getAssumptionsView, updateAssumptions } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";
import { assumptionsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => ok(await getAssumptionsView()));
}

export async function PUT(req: Request) {
  return handle(async () => {
    const input = assumptionsSchema.parse(await req.json());
    await updateAssumptions(input);
    return ok(await getAssumptionsView());
  });
}
