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
}

export interface AssumptionsView extends AssumptionsInput {
  fxDate: string;
}
