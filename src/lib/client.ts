// Tiny browser-side API client used by the tab components.
import type { AssumptionsView, ClassMeta, MatrixRow } from "@/lib/types";
import type { AssumptionsInput } from "@/lib/validation";
import type { UnitValuation } from "@/lib/valuation";

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body;
}

export async function fetchMatrix(): Promise<{
  matrix: MatrixRow[];
  assumptions: AssumptionsView;
}> {
  return jsonOrThrow(await fetch("/api/matrix", { cache: "no-store" }));
}

export async function addPoint(input: {
  classSlug: string;
  price: number;
  currency: "CAD" | "USD";
  sourceType: string;
  rating?: number | null;
  hoursBand?: string;
  condition?: string;
  packaging?: string;
  config?: string;
  saleDate?: string;
  sourceNote: string;
}): Promise<void> {
  await jsonOrThrow(
    await fetch("/api/points", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function importPoints(rows: unknown[]): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  return jsonOrThrow(
    await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rows),
    }),
  );
}

export interface Calibration {
  askToFmv: number | null;
  auctionToFmv: number | null;
  nAsking: number;
  nAuction: number;
  nAnchor: number;
}

export async function getCalibration(): Promise<Calibration> {
  return jsonOrThrow(await fetch("/api/calibrate", { cache: "no-store" }));
}

export async function saveAssumptions(
  input: AssumptionsInput,
): Promise<AssumptionsView> {
  return jsonOrThrow(
    await fetch("/api/assumptions", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function runBacktest(): Promise<{
  classesEvaluated: number;
  asOf: string;
}> {
  return jsonOrThrow(await fetch("/api/backtest", { method: "POST" }));
}

export interface ResearchComp {
  description: string;
  price: number;
  currency: "CAD" | "USD";
  type: string;
  sourceName: string;
  url: string;
  date?: string;
}
export interface ResearchResponse {
  band: { fmvCAD: number; olvCAD: number; flvCAD: number } | null;
  confidence: "low" | "medium" | "high";
  comps: ResearchComp[];
  reasoning: string;
  caveats: string;
  persisted?: { imported: number; skipped: number };
}

export async function researchAsset(input: {
  description: string;
  classSlug?: string;
  persist?: boolean;
}): Promise<ResearchResponse> {
  return jsonOrThrow(
    await fetch("/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export interface SupplyCandidate {
  description: string;
  make?: string;
  model?: string;
  year?: number;
  hours?: number;
  priceText?: string;
  currency?: "CAD" | "USD";
  location?: string;
  condition?: string;
  sourceName: string;
  url: string;
  notes?: string;
}

export async function findSupply(input: {
  item: string;
  sizeSpec?: string;
  targetModels?: string[];
  region?: string;
}): Promise<{ candidates: SupplyCandidate[] }> {
  return jsonOrThrow(
    await fetch("/api/sourcing/find", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function valuate(input: {
  classSlug: string;
  rating: number;
  hoursBand?: string;
  condition?: string;
  packaging?: string;
  config?: string;
  transport?: number;
}): Promise<{ meta: ClassMeta; valuation: UnitValuation | null }> {
  return jsonOrThrow(
    await fetch("/api/valuate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
