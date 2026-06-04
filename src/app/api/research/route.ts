import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAssumptionsView, importPoints, listClasses } from "@/lib/db/service";
import { badRequest, handle, ok } from "@/lib/http";
import { researchAsset } from "@/lib/research/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // web research can take a while

const bodySchema = z.object({
  description: z.string().trim().min(3),
  classSlug: z.string().optional(),
  persist: z.boolean().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return badRequest(
        "Research is not configured: set ANTHROPIC_API_KEY on the server.",
      );
    }
    const input = bodySchema.parse(await req.json());

    const assumptions = await getAssumptionsView();
    let className: string | undefined;
    let unit: string | undefined;
    if (input.classSlug) {
      const cls = (await listClasses()).find((c) => c.slug === input.classSlug);
      className = cls?.name;
      unit = cls?.unit;
    }

    const client = new Anthropic({ apiKey });
    const result = await researchAsset(
      { description: input.description, className, unit, fxRate: assumptions.fxRate },
      { client },
    );

    // Optionally store the cited comps as sourced points on the class, so the
    // agent's research compounds into the shared comp database and feeds the
    // deterministic engine and backtest.
    let persisted: { imported: number; skipped: number } | undefined;
    if (input.persist && input.classSlug && result.comps.length > 0) {
      const rows = result.comps.map((c) => ({
        classId: input.classSlug,
        price: c.price,
        cur: c.currency,
        type: c.type,
        date: c.date,
        src: `${c.description} | ${c.sourceName} | ${c.url}`,
      }));
      const r = await importPoints(rows);
      persisted = { imported: r.imported, skipped: r.skipped };
    }

    return ok({ ...result, persisted });
  });
}
