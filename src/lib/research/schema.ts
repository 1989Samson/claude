import { z } from "zod";
import { SOURCE_TYPES } from "@/lib/validation";

// Structured output contract for the per-asset research agent. Every comp must
// carry a real source URL: the agent is cite-or-shut-up. Comps without a URL are
// dropped before anything is shown or stored, so a number never stands without
// evidence (CLAUDE.md: never fabricate data; every point carries a source).

export const compSchema = z.object({
  description: z.string().min(1),
  price: z.number().positive(),
  currency: z.enum(["CAD", "USD"]),
  type: z.enum(SOURCE_TYPES),
  sourceName: z.string().min(1),
  url: z.string().url(),
  date: z.string().optional(),
});
export type Comp = z.infer<typeof compSchema>;

export const researchResultSchema = z.object({
  band: z
    .object({
      fmvCAD: z.number().positive(),
      olvCAD: z.number().positive(),
      flvCAD: z.number().positive(),
    })
    .nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  // Comps may arrive slightly malformed; we coerce/validate and drop bad ones in
  // the agent, so accept unknowns here and filter there.
  comps: z.array(z.unknown()),
  reasoning: z.string(),
  caveats: z.string(),
});

export interface ResearchResult {
  band: { fmvCAD: number; olvCAD: number; flvCAD: number } | null;
  confidence: "low" | "medium" | "high";
  comps: Comp[];
  reasoning: string;
  caveats: string;
}
