// Raw row shapes as returned by Postgres. Numeric columns arrive as strings
// via node-postgres, so the mappers coerce them with Number().

export interface ClassRow {
  id: string;
  slug: string;
  sector: string;
  category: string;
  name: string;
  unit: string;
  ref_rating: string;
  ref_spec: Record<string, unknown>;
}

export interface PointRow {
  id: string;
  class_id: string;
  price: string;
  currency: "CAD" | "USD";
  source_type: string;
  rating: string | null;
  hours_band: string | null;
  condition: string | null;
  packaging: string | null;
  config: string | null;
  sale_date: string | null;
  source_note: string;
  created_at: string;
}

export interface AssumptionsRow {
  id: string;
  fx_rate: string;
  fx_date: string;
  olv_ratio: string;
  flv_ratio: string;
  ask_to_fmv: string;
  auction_to_fmv: string;
  recency_horizon_months: number;
  updated_at: string;
}
