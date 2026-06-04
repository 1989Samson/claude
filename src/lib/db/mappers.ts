import type { Assumptions, DataPoint, SourceType } from "@/lib/valuation";
import type { AssumptionsRow, PointRow } from "./rows";

export function toAssumptions(row: AssumptionsRow): Assumptions {
  return {
    fxRate: Number(row.fx_rate),
    olvRatio: Number(row.olv_ratio),
    flvRatio: Number(row.flv_ratio),
    askToFmv: Number(row.ask_to_fmv),
    auctionToFmv: Number(row.auction_to_fmv),
    recencyHorizonMonths: Number(row.recency_horizon_months),
  };
}

export function toDataPoint(row: PointRow): DataPoint {
  return {
    price: Number(row.price),
    currency: row.currency,
    sourceType: row.source_type as SourceType,
    rating: row.rating === null ? null : Number(row.rating),
    hoursBand: row.hours_band,
    condition: row.condition,
    packaging: row.packaging,
    config: row.config,
    saleDate: row.sale_date,
  };
}
