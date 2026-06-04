import { addPoint } from "@/lib/db/service";
import { handle, ok } from "@/lib/http";
import { addPointSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const input = addPointSchema.parse(await req.json());
    const res = await addPoint(input);
    return ok(res, 201);
  });
}
