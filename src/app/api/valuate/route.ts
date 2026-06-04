import { valuate } from "@/lib/db/service";
import { handle, notFound, ok } from "@/lib/http";
import { valuateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handle(async () => {
    const input = valuateSchema.parse(await req.json());
    const asOf = new URL(req.url).searchParams.get("asOf") ?? new Date().toISOString();
    const res = await valuate(input, asOf);
    if (!res) return notFound(`Unknown class: ${input.classSlug}`);
    return ok(res);
  });
}
