import { z } from "zod";

// Transport engine types. A faithful port of transport_estimator.py (v2). The
// engine is pure and deterministic: given a unit and a destination it returns a
// two-tier result, an internal cost stack and a margin-safe buyer band. No data
// is invented; every number falls out of the editable rate tables in rates.json.

// Four transport classes. Class sets the trailer, the vessel, the permit tier,
// and the crane.
export const transportClass = z.enum(["A", "B", "C", "D"]);
export type TransportClass = z.infer<typeof transportClass>;

// Where the unit sits now (drives the corridor). Country of MANUFACTURE drives
// duty and is carried separately as madeIn.
export const originCode = z.enum(["US", "SA", "AE", "JP"]);
export type OriginCode = z.infer<typeof originCode>;

// Destination region (province). Corridors are defined for AB, ON, QC.
export const destRegion = z.enum(["AB", "ON", "QC", "BC", "SK", "MB"]);
export type DestRegion = z.infer<typeof destRegion>;

export const unitInputSchema = z.object({
  model: z.string().min(1),
  cls: transportClass,
  mw: z.number().nonnegative(),
  origin: originCode,
  valueUsd: z.number().positive(),
  madeIn: z.string().optional(), // country of manufacture (drives duty); defaults to origin
  totalT: z.number().positive().optional(), // override class default when a real spec sheet exists
  pieceT: z.number().positive().optional(),
  winter: z.boolean().default(false),
  waterfront: z.boolean().default(false), // destination has water access (needed for Class D)
});
export type UnitInput = z.infer<typeof unitInputSchema>;

export const estimateRequestSchema = z.object({
  unit: unitInputSchema,
  dest: destRegion,
});
export type EstimateRequest = z.infer<typeof estimateRequestSchema>;

export type Band = [number, number];

// The internal cost stack: the real landed logistics number plus recoverable
// taxes, for building your quote. Yours, never shown raw to a buyer.
// How the estimate knows what it does not know. Weights drive the largest swings
// in the stack, so whether they are real spec-sheet figures or class defaults is
// the honest precision signal. spreadRatio is logistics high / low: the wider it
// is, the coarser the number.
export interface Confidence {
  weightsBasis: "class default" | "spec sheet";
  spreadRatio: number;
  note: string;
}

export interface InternalEstimate {
  model: string;
  cls: TransportClass;
  corridor: string;
  weightsT: { total: number; largestPiece: number };
  confidence: Confidence;
  stackUsd: Record<string, Band>;
  logisticsUsd: Band;
  taxesUsd: Band;
  deliveredWithTaxUsd: Band;
  weeksToSite: Band;
  flags: string[];
  currency: string;
}

// The buyer view: a deliberately coarse logistics band plus weeks-to-site,
// rounded hard so a buyer cannot back into your margin. Carries no precise
// number and no tax line by construction.
export interface BuyerEstimate {
  model: string;
  indicativeLogisticsBandUsd: Band;
  estimatedWeeksToSite: Band;
  note: string;
}

// A floating barge to a landlocked site is not viable: the engine says so
// instead of returning a nonsense-low number.
export interface InfeasibleEstimate {
  model: string;
  infeasible: string;
}

export interface EstimateResult {
  internal: InternalEstimate | InfeasibleEstimate;
  buyer: BuyerEstimate | null;
}

export function isInfeasible(
  e: InternalEstimate | InfeasibleEstimate,
): e is InfeasibleEstimate {
  return "infeasible" in e;
}
