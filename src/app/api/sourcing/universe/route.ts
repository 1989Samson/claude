import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { badRequest, handle, ok } from "@/lib/http";
import { buildUniverse } from "@/lib/sourcing/demand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  project: z.string().trim().min(2),
  location: z.string().optional(),
  notes: z.string().optional(),
});

// Generate the complete equipment universe for a mine / restart / project.
export async function POST(req: Request) {
  return handle(async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return badRequest(
        "Not configured: set ANTHROPIC_API_KEY on the server.",
      );
    }
    const input = bodySchema.parse(await req.json());
    const client = new Anthropic({ apiKey, maxRetries: 5 });
    const universe = await buildUniverse(input, { client });
    return ok(universe);
  });
}
