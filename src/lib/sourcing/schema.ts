import { z } from "zod";

// A demand-led sourcing model: turn a buyer's project (a restart, expansion, or
// build) into structured, used-suitability-scored equipment targets, then find
// verified used/rebuilt supply to fill them. This is the demand half; the supply
// half reuses the web-research agent to find actual available units per line.

export const sourcingItemSchema = z.object({
  item: z.string().min(1),
  category: z.enum([
    "underground_mobile",
    "surface_support",
    "open_pit",
    "plant",
    "dewatering",
    "support",
  ]),
  sizeSpec: z.string().optional(),
  usedSuitability: z.enum(["high", "medium", "low"]),
  targetModels: z.array(z.string()).default([]),
  newLeadTime: z.string().optional(), // e.g. "12-18 mo"
  priority: z.enum(["phase1_now", "phase2_later", "watch"]).default("phase1_now"),
  capexBucket: z.string().optional(),
  notes: z.string().optional(),
});
export type SourcingItem = z.infer<typeof sourcingItemSchema>;

export const sourcingSheetSchema = z.object({
  buyer: z.string(),
  project: z.string(),
  location: z.string().optional(),
  restartTarget: z.string().optional(),
  capexNote: z.string().optional(),
  angle: z.string().optional(), // the de-risk-the-ramp outreach message
  items: z.array(sourcingItemSchema),
});
export type SourcingSheet = z.infer<typeof sourcingSheetSchema>;

// A real available unit found on the market for a given need. Every candidate
// must carry a source URL the agent actually retrieved (cite-or-shut-up): a
// listing with no source is dropped, never shown. This is the supply half of the
// engine: the "get it best and fastest" edge.
export const supplyCandidateSchema = z.object({
  description: z.string().min(1),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  hours: z.number().optional(),
  priceText: z.string().optional(), // often "call for price"
  currency: z.enum(["CAD", "USD"]).optional(),
  location: z.string().optional(),
  condition: z.string().optional(),
  sourceName: z.string().min(1),
  url: z.string().url(),
  notes: z.string().optional(),
});
export type SupplyCandidate = z.infer<typeof supplyCandidateSchema>;

