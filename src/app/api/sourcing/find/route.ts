import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { badRequest, handle, ok } from "@/lib/http";
import { findSupply } from "@/lib/sourcing/supply";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // web search can be slow; Pro allows up to 300s

const bodySchema = z.object({
  item: z.string().trim().min(2),
  sizeSpec: z.string().optional(),
  targetModels: z.array(z.string()).optional(),
  region: z.string().optional(),
});

// Find real available used/rebuilt units for an equipment need, cited.
export async function POST(req: Request) {
  return handle(async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return badRequest(
        "Supply search is not configured: set ANTHROPIC_API_KEY on the server.",
      );
    }
    const input = bodySchema.parse(await req.json());
    const client = new Anthropic({ apiKey });
    const candidates = await findSupply(input, { client });
    return ok({ candidates });
  });
}
