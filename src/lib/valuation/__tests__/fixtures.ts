// Test fixtures: load the canonical seed and the reference assumptions, mapping
// the seed_data.json (snake_case, DB shape) into the engine's domain types.
import seed from "../../../../seed_data.json";
import type { Assumptions, DataPoint, EquipmentClass } from "../types";

export const SEED_ASSUMPTIONS: Assumptions = {
  fxRate: seed.assumptions.fx_rate,
  olvRatio: seed.assumptions.olv_ratio,
  flvRatio: seed.assumptions.flv_ratio,
  askToFmv: seed.assumptions.ask_to_fmv,
  auctionToFmv: seed.assumptions.auction_to_fmv,
  recencyHorizonMonths: seed.assumptions.recency_horizon_months,
};

// Fixed reference instant. The prototype used Date.now(); we pin "today" so the
// numbers are reproducible. Seed points are dated 2026-05-01.
export const AS_OF = "2026-06-03";

interface SeedPoint {
  price: number;
  currency: string;
  source_type: string;
  rating: number;
  hours_band: string;
  condition: string;
  packaging: string;
  config: string;
  sale_date: string;
  source_note: string;
}

export function pointFromSeed(p: SeedPoint): DataPoint {
  return {
    price: p.price,
    currency: p.currency as DataPoint["currency"],
    sourceType: p.source_type as DataPoint["sourceType"],
    rating: p.rating,
    hoursBand: p.hours_band,
    condition: p.condition,
    packaging: p.packaging,
    config: p.config,
    saleDate: p.sale_date,
  };
}

export function classBySlug(slug: string): EquipmentClass {
  const sc = seed.classes.find((c) => c.slug === slug);
  if (!sc) throw new Error(`seed class not found: ${slug}`);
  return {
    refRating: sc.ref_rating,
    points: (sc.points as SeedPoint[]).map(pointFromSeed),
  };
}
