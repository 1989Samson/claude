import { z } from "zod";

// Internal supply registry. This is the protected side of the business: the real
// units McCord can source, with their origin and cost basis. It is NEVER sent to
// the public wedge or bundled into public pages. It lives behind the internal
// desk, which must be access-protected in deployment. You grow it as you go by
// adding entries to registry.json (version controlled, no database needed yet).

export const supplyStatus = z.enum(["available", "pending", "placed", "watch"]);
export type SupplyStatus = z.infer<typeof supplyStatus>;

// A unit mirrors the transport engine's UnitInput so any registry entry can be
// run straight through estimate() to a destination province.
export const supplyUnitSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  cls: z.enum(["A", "B", "C", "D"]),
  mw: z.number().positive(),
  origin: z.enum(["US", "SA", "AE", "JP"]),
  valueUsd: z.number().positive(),
  madeIn: z.string().optional(),
  totalT: z.number().positive().optional(),
  pieceT: z.number().positive().optional(),
  status: supplyStatus.default("watch"),
  // Free-text provenance for your eyes only. Never shown to a buyer.
  sourceNote: z.string().min(1),
  addedOn: z.string(), // ISO date, e.g. "2026-06-30"
  notes: z.string().optional(),
});
export type SupplyUnit = z.infer<typeof supplyUnitSchema>;

export function parseRegistry(raw: unknown): SupplyUnit[] {
  const arr = z.array(supplyUnitSchema).safeParse(raw);
  return arr.success ? arr.data : [];
}
