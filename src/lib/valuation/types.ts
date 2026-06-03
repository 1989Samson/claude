// Domain types for the valuation engine. These mirror the reference_ui.html
// data shapes, renamed to the database column conventions (camelCase here,
// snake_case in Postgres). The engine is pure: it never touches the DB.

export type Currency = "CAD" | "USD";

// Five source types, exactly as the reference engine treats them.
export type SourceType =
  | "asking"
  | "auction"
  | "sold_private"
  | "sisp"
  | "own_close";

// A point's spec attributes. Keys match the reference multiplier tables.
export interface SpecAttributes {
  hoursBand?: string | null;
  condition?: string | null;
  packaging?: string | null; // reference "encl"
  config?: string | null;
}

export interface DataPoint extends SpecAttributes {
  price: number;
  currency: Currency;
  sourceType: SourceType;
  rating?: number | null; // falls back to class refRating when absent
  saleDate?: string | null; // ISO date; null means no recency decay
}

export interface EquipmentClass {
  refRating: number;
  points: DataPoint[];
}

// Editable assumptions. Defaults live in the DB and in reference defSettings().
export interface Assumptions {
  fxRate: number; // USD -> CAD
  olvRatio: number;
  flvRatio: number;
  askToFmv: number;
  auctionToFmv: number;
  recencyHorizonMonths: number;
}

export type ConfidenceLevel = "none" | "indicative" | "medium" | "high";

export interface ClassFMV {
  fmv: number | null; // null when the class has no points
  effN: number; // sum of applied weights
  sold: number; // count of verified sold/auction points
}

export interface Band {
  fmv: number;
  olv: number;
  flv: number;
}

// A subject unit to value against a class (the "Valuate Unit" tab).
export interface SubjectUnit extends SpecAttributes {
  rating: number;
  transport?: number; // CAD, deducted in the indicative spread only
}

export interface UnitValuation {
  classFmvRef: number; // class FMV at the reference rating
  rating: number;
  scale: number; // rating / refRating
  specMult: number; // subject spec multiplier
  fmv: number; // scaled subject FMV
  olv: number;
  flv: number;
  spread: number; // OLV-acquire to FMV-sell, less transport
  transport: number;
  confidence: ConfidenceLevel;
  askOnly: boolean; // true when the class holds no verified sold data
}
