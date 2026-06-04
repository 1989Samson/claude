import type { ConfidenceLevel } from "@/lib/valuation";
import type { AssumptionsInput } from "@/lib/validation";

// Client-facing shapes. Kept in their own module (no server imports) so React
// components can import these types without dragging the pg pool into the bundle.

export interface ClassMeta {
  id: string;
  slug: string;
  sector: string;
  category: string;
  name: string;
  unit: string;
  refRating: number;
}

export interface MatrixRow extends ClassMeta {
  nPoints: number;
  verifiedPoints: number;
  pointTypes: string[];
  fmv: number | null;
  olv: number | null;
  flv: number | null;
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  // Latest backtest result for the class, null until one has been run.
  backtestError: number | null; // median absolute percent error (0.18 = 18%)
  backtestN: number | null; // verified sold points evaluated
  backtestRunDate: string | null;
}

export interface BacktestSummary {
  ranAt: string;
  asOf: string;
  classesEvaluated: number; // classes with at least one verified sold point scored
  results: Array<{
    slug: string;
    name: string;
    nPoints: number;
    medianAbsPctError: number | null;
  }>;
}

export interface AssumptionsView extends AssumptionsInput {
  fxDate: string;
}
